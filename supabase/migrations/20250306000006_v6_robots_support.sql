-- ═══════════════════════════════════════════════════════════════
-- MicroVest v6 — AI Robots, Support Tickets, Audit, Crypto Cache
-- Tables: user_robots, robot_promotions, support_tickets,
--         audit_log, crypto_cache
-- RPC: process_robot_promotion
-- ═══════════════════════════════════════════════════════════════

-- ── AI Robots ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_robots (
  id              UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID    REFERENCES profiles(id) ON DELETE CASCADE,
  robot_id        TEXT    NOT NULL,
  status          TEXT    DEFAULT 'active' CHECK (status IN ('active','expired','paused')),
  price_paid      NUMERIC(14,2) DEFAULT 0,
  daily_profit    NUMERIC(14,4) DEFAULT 0,
  total_earned    NUMERIC(14,2) DEFAULT 0,
  last_claimed_at TIMESTAMPTZ,
  auto_claimed_at TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE user_robots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "robots_own"   ON user_robots FOR ALL USING (user_id = auth.uid());
CREATE POLICY "robots_admin" ON user_robots FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
);
CREATE INDEX IF NOT EXISTS idx_robots_user   ON user_robots(user_id, status);
CREATE INDEX IF NOT EXISTS idx_robots_active ON user_robots(status, last_claimed_at) WHERE status = 'active';

-- ── Robot promotions (referral bonus when rakan beli robot) ───
CREATE TABLE IF NOT EXISTS robot_promotions (
  id          UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  promoter_id UUID    REFERENCES profiles(id) ON DELETE CASCADE,
  referred_id UUID    REFERENCES profiles(id) ON DELETE CASCADE,
  robot_id    TEXT    NOT NULL,
  amount      NUMERIC(14,2) DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE robot_promotions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "robot_promo_own"   ON robot_promotions FOR ALL USING (promoter_id = auth.uid());
CREATE POLICY "robot_promo_admin" ON robot_promotions FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
);
CREATE INDEX IF NOT EXISTS idx_robot_promos ON robot_promotions(promoter_id, created_at DESC);

-- ── Auto-expire robots trigger ────────────────────────────────
CREATE OR REPLACE FUNCTION expire_robots()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE user_robots SET status = 'expired'
  WHERE status = 'active' AND expires_at < NOW();
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_expire_robots ON user_robots;
CREATE TRIGGER trg_expire_robots
  AFTER INSERT OR UPDATE ON user_robots
  FOR EACH STATEMENT EXECUTE FUNCTION expire_robots();

-- ── RPC: process_robot_promotion ──────────────────────────────
CREATE OR REPLACE FUNCTION process_robot_promotion(
  p_user_id  UUID,
  p_robot_id TEXT,
  p_amount   NUMERIC
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_referrer_id   UUID;
  v_bonus_rate    NUMERIC;
  v_bonus         NUMERIC;
  v_ref_code      TEXT;
BEGIN
  SELECT referral_by INTO v_ref_code FROM profiles WHERE id = p_user_id;
  IF v_ref_code IS NULL THEN RETURN; END IF;
  SELECT id INTO v_referrer_id FROM profiles WHERE referral_code = v_ref_code;
  IF v_referrer_id IS NULL THEN RETURN; END IF;

  v_bonus_rate := CASE p_robot_id
    WHEN 'scout'     THEN 0.02
    WHEN 'alpha'     THEN 0.03
    WHEN 'nexus'     THEN 0.04
    WHEN 'quantum'   THEN 0.05
    WHEN 'sovereign' THEN 0.07
    ELSE 0.02
  END;

  v_bonus := ROUND(p_amount * v_bonus_rate, 2);
  IF v_bonus <= 0 THEN RETURN; END IF;

  UPDATE profiles
  SET balance = balance + v_bonus, total_earned = total_earned + v_bonus, updated_at = NOW()
  WHERE id = v_referrer_id;

  INSERT INTO robot_promotions(promoter_id, referred_id, robot_id, amount)
  VALUES (v_referrer_id, p_user_id, p_robot_id, v_bonus);

  INSERT INTO notifications(user_id, type, message)
  VALUES (v_referrer_id, 'referral',
    format('🤖 Rakan aktifkan %s Bot! Bonus promosi +RM%s dikreditkan.', initcap(p_robot_id), v_bonus));
END;
$$;

-- ── Support Tickets ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS support_tickets (
  id          UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID    REFERENCES profiles(id) ON DELETE CASCADE,
  ticket_id   TEXT    UNIQUE DEFAULT 'TK-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),
  category    TEXT    NOT NULL DEFAULT 'other',
  subject     TEXT    NOT NULL,
  description TEXT    NOT NULL,
  screenshot  TEXT,
  status      TEXT    DEFAULT 'open' CHECK (status IN ('open','pending','closed')),
  admin_reply TEXT,
  replied_at  TIMESTAMPTZ,
  replied_by  UUID    REFERENCES profiles(id),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tickets_own"   ON support_tickets FOR ALL USING (user_id = auth.uid());
CREATE POLICY "tickets_admin" ON support_tickets FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
);
CREATE INDEX IF NOT EXISTS idx_tickets_user   ON support_tickets(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON support_tickets(status) WHERE status = 'open';

-- ── Audit log ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id         UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID    REFERENCES profiles(id) ON DELETE CASCADE,
  action     TEXT    NOT NULL,
  meta       JSONB   DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_own"    ON audit_log FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "audit_insert" ON audit_log FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "audit_admin"  ON audit_log FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
);
CREATE INDEX IF NOT EXISTS idx_audit_user   ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_recent ON audit_log(created_at DESC);

-- ── Crypto price cache (CoinGecko) ────────────────────────────
CREATE TABLE IF NOT EXISTS crypto_cache (
  id         TEXT    PRIMARY KEY,
  symbol     TEXT,
  name       TEXT,
  price_myr  NUMERIC(20,8),
  change_24h NUMERIC(8,4),
  volume_24h NUMERIC(20,2),
  market_cap NUMERIC(20,2),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE crypto_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crypto_read"  ON crypto_cache FOR SELECT USING (TRUE);
CREATE POLICY "crypto_admin" ON crypto_cache FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
);

-- ── Realtime ─────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE user_robots;

INSERT INTO schema_migrations(version, description)
VALUES ('20250306000006', 'v6 AI robots, robot promotions, support tickets, audit log, crypto cache')
ON CONFLICT(version) DO NOTHING;
SELECT 'Migration v6 applied ✅' AS status;
