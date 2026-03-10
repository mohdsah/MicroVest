-- ═══════════════════════════════════════════════════════════════
-- MicroVest v9 — Staking, KYC, Device Logs, Admin Views
-- Tables: user_stakings, kyc_applications, device_logs
-- Adds: onboarded columns (already in v1, ensure here)
-- ═══════════════════════════════════════════════════════════════

-- ── User Stakings ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_stakings (
  id           UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID    REFERENCES profiles(id) ON DELETE CASCADE,
  plan_id      TEXT    NOT NULL CHECK (plan_id IN ('flex','silver','gold','plat')),
  amount       NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  apy          NUMERIC(6,4)  NOT NULL,
  lock_days    INTEGER NOT NULL,
  staked_at    TIMESTAMPTZ DEFAULT NOW(),
  locked_until TIMESTAMPTZ NOT NULL,
  status       TEXT    DEFAULT 'active' CHECK (status IN ('active','matured','unstaked','early_exit')),
  interest_earned NUMERIC(14,4) DEFAULT 0,
  unstaked_at  TIMESTAMPTZ,
  early_exit   BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE user_stakings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stake_own"   ON user_stakings FOR ALL USING (user_id = auth.uid());
CREATE POLICY "stake_admin" ON user_stakings FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
);
CREATE INDEX IF NOT EXISTS idx_stake_user   ON user_stakings(user_id, status);
CREATE INDEX IF NOT EXISTS idx_stake_active ON user_stakings(status, locked_until) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_stake_mature ON user_stakings(locked_until) WHERE status = 'active';

-- ── Auto-mature staking trigger ───────────────────────────────
CREATE OR REPLACE FUNCTION trg_mature_stakes()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE user_stakings SET status = 'matured'
  WHERE status = 'active' AND locked_until <= NOW();
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_stake_mature ON user_stakings;
CREATE TRIGGER trg_stake_mature
  AFTER INSERT OR UPDATE ON user_stakings
  FOR EACH STATEMENT EXECUTE FUNCTION trg_mature_stakes();

-- ── RPC: Claim staking interest ───────────────────────────────
CREATE OR REPLACE FUNCTION claim_staking_interest(p_stake_id UUID, p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_stake  user_stakings%ROWTYPE;
  v_days   NUMERIC;
  v_earned NUMERIC;
BEGIN
  SELECT * INTO v_stake FROM user_stakings
  WHERE id = p_stake_id AND user_id = p_user_id AND status IN ('active','matured');

  IF NOT FOUND THEN
    RETURN '{"ok":false,"reason":"not_found"}'::JSONB;
  END IF;

  -- Calculate interest since last claim or stake start
  v_days   := EXTRACT(EPOCH FROM (NOW() - v_stake.staked_at)) / 86400.0;
  v_earned := ROUND(v_stake.amount * (v_stake.apy / 365.0) * v_days, 4);

  IF v_earned <= 0 THEN
    RETURN '{"ok":false,"reason":"nothing_to_claim"}'::JSONB;
  END IF;

  -- Credit to mining wallet
  PERFORM inc_wallet(p_user_id, 'mining', v_earned);
  UPDATE profiles SET total_earned = total_earned + v_earned, updated_at = NOW()
  WHERE id = p_user_id;

  UPDATE user_stakings SET interest_earned = interest_earned + v_earned
  WHERE id = p_stake_id;

  INSERT INTO notifications(user_id, type, message)
  VALUES (p_user_id, 'profit',
    format('💎 Staking interest claimed: +RM%s', v_earned));

  RETURN jsonb_build_object('ok', true, 'earned', v_earned);
END;
$$;

-- ── RPC: Unstake (early exit or matured) ─────────────────────
CREATE OR REPLACE FUNCTION unstake(p_stake_id UUID, p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_stake       user_stakings%ROWTYPE;
  v_is_early    BOOLEAN;
  v_penalty_pct NUMERIC := 0.10; -- 10% early exit penalty
  v_return      NUMERIC;
BEGIN
  SELECT * INTO v_stake FROM user_stakings
  WHERE id = p_stake_id AND user_id = p_user_id AND status IN ('active','matured');
  IF NOT FOUND THEN RETURN '{"ok":false,"reason":"not_found"}'::JSONB; END IF;

  v_is_early := v_stake.locked_until > NOW();
  v_return   := CASE WHEN v_is_early
    THEN ROUND(v_stake.amount * (1 - v_penalty_pct), 2)
    ELSE v_stake.amount
  END;

  -- Return principal to main wallet
  PERFORM inc_balance(p_user_id, v_return);

  UPDATE user_stakings SET
    status      = CASE WHEN v_is_early THEN 'early_exit' ELSE 'unstaked' END,
    early_exit  = v_is_early,
    unstaked_at = NOW()
  WHERE id = p_stake_id;

  IF v_is_early THEN
    INSERT INTO notifications(user_id, type, message)
    VALUES (p_user_id, 'info',
      format('⚠️ Early unstake: RM%s dikembalikan (10%% penalti dikenakan)', v_return));
  ELSE
    INSERT INTO notifications(user_id, type, message)
    VALUES (p_user_id, 'profit',
      format('✅ Staking matured! RM%s dikembalikan ke wallet.', v_return));
  END IF;

  RETURN jsonb_build_object('ok', true, 'returned', v_return, 'early_exit', v_is_early);
END;
$$;

-- ── KYC Applications ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS kyc_applications (
  id           UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID    REFERENCES profiles(id) ON DELETE CASCADE,
  full_name    TEXT    NOT NULL,
  id_type      TEXT    DEFAULT 'mykad' CHECK (id_type IN ('mykad','passport','other')),
  id_number    TEXT    NOT NULL,
  front_url    TEXT,
  back_url     TEXT,
  selfie_url   TEXT,
  status       TEXT    DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  admin_note   TEXT,
  reviewed_by  UUID    REFERENCES profiles(id),
  reviewed_at  TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE kyc_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kyc_own"   ON kyc_applications FOR ALL USING (user_id = auth.uid());
CREATE POLICY "kyc_admin" ON kyc_applications FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
);
CREATE INDEX IF NOT EXISTS idx_kyc_user    ON kyc_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_pending ON kyc_applications(status) WHERE status = 'pending';

-- ── KYC status on profiles ────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS kyc_status TEXT DEFAULT 'unverified'
    CHECK (kyc_status IN ('unverified','pending','verified','rejected'));

-- ── Device / activity logs (admin analytics) ─────────────────
CREATE TABLE IF NOT EXISTS device_logs (
  id          UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID    REFERENCES profiles(id) ON DELETE CASCADE,
  event       TEXT    NOT NULL,
  platform    TEXT,
  user_agent  TEXT,
  ip_hash     TEXT,
  meta        JSONB   DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE device_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "device_insert" ON device_logs FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "device_admin"  ON device_logs FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
);
CREATE INDEX IF NOT EXISTS idx_device_user  ON device_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_device_event ON device_logs(event, created_at DESC);

-- ── Admin summary view ────────────────────────────────────────
CREATE OR REPLACE VIEW admin_dashboard_stats AS
SELECT
  (SELECT COUNT(*)          FROM profiles WHERE is_admin = FALSE)             AS total_users,
  (SELECT COUNT(*)          FROM profiles WHERE is_banned = TRUE)             AS banned_users,
  (SELECT COUNT(*)          FROM profiles WHERE created_at > NOW()-INTERVAL '24h') AS new_today,
  (SELECT COALESCE(SUM(amount),0) FROM transactions WHERE status='approved' AND type='deposit') AS total_deposits,
  (SELECT COALESCE(SUM(amount),0) FROM transactions WHERE status='approved' AND type='withdrawal') AS total_withdrawals,
  (SELECT COUNT(*)          FROM transactions WHERE status='pending')         AS pending_txns,
  (SELECT COUNT(*)          FROM user_robots WHERE status='active')           AS active_robots,
  (SELECT COUNT(*)          FROM user_stakings WHERE status='active')         AS active_stakes,
  (SELECT COUNT(*)          FROM support_tickets WHERE status='open')         AS open_tickets;

-- ── Top referrers view ────────────────────────────────────────
CREATE OR REPLACE VIEW top_referrers AS
SELECT
  p.id, p.full_name, p.vip_rank, p.referral_code,
  COUNT(DISTINCT ref.id)      AS team_size,
  COALESCE(SUM(rc.amount), 0) AS total_commission
FROM profiles p
LEFT JOIN profiles ref ON ref.referred_by = p.referral_code
LEFT JOIN referral_commissions rc ON rc.referrer_id = p.id
WHERE p.is_admin = FALSE
GROUP BY p.id, p.full_name, p.vip_rank, p.referral_code
ORDER BY total_commission DESC
LIMIT 100;

-- ── Realtime ─────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE user_stakings;

INSERT INTO schema_migrations(version, description)
VALUES ('20250309000009', 'v9 staking system, KYC, device logs, admin views, unstake RPC')
ON CONFLICT(version) DO NOTHING;
SELECT 'Migration v9 applied ✅' AS status;
