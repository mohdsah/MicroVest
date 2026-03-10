-- ═══════════════════════════════════════════════════════════════
-- MicroVest v4 — Referral System
-- Tables: referral_commissions
-- RPC: process_referral_chain
-- ═══════════════════════════════════════════════════════════════

-- ── Referral commissions ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS referral_commissions (
  id          UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  referrer_id UUID    REFERENCES profiles(id) ON DELETE CASCADE,
  referred_id UUID    REFERENCES profiles(id) ON DELETE SET NULL,
  level       INTEGER NOT NULL CHECK (level BETWEEN 1 AND 4),
  amount      NUMERIC(14,4) NOT NULL,
  source_type TEXT    DEFAULT 'deposit' CHECK (source_type IN ('deposit','invest','robot')),
  source_id   UUID,
  from_email  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE referral_commissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "referral_own"    ON referral_commissions FOR SELECT USING (referrer_id = auth.uid());
CREATE POLICY "referral_insert" ON referral_commissions FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "referral_admin"  ON referral_commissions FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
);
CREATE INDEX IF NOT EXISTS idx_referral_chain   ON referral_commissions(referrer_id, level);
CREATE INDEX IF NOT EXISTS idx_referral_created ON referral_commissions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_referral_referred ON referral_commissions(referred_id);

-- ── RPC: Process multi-level referral chain ───────────────────
CREATE OR REPLACE FUNCTION process_referral_chain(
  p_user_id   UUID,
  p_amount    NUMERIC,
  p_source    TEXT DEFAULT 'deposit'
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_rates      NUMERIC[] := ARRAY[0.10, 0.05, 0.03, 0.02];
  v_current_id UUID      := p_user_id;
  v_referrer   profiles%ROWTYPE;
  v_bonus      NUMERIC;
  i            INTEGER;
BEGIN
  FOR i IN 1..4 LOOP
    -- Get the referrer at this level
    SELECT * INTO v_referrer
    FROM profiles
    WHERE referral_code = (
      SELECT referral_by FROM profiles WHERE id = v_current_id
    );
    EXIT WHEN NOT FOUND OR v_referrer.id IS NULL;
    EXIT WHEN v_referrer.is_banned;

    v_bonus := ROUND(p_amount * v_rates[i], 2);
    IF v_bonus <= 0 THEN EXIT; END IF;

    -- Credit referrer
    UPDATE profiles
    SET balance      = balance + v_bonus,
        total_earned = total_earned + v_bonus,
        updated_at   = NOW()
    WHERE id = v_referrer.id;

    -- Record commission
    INSERT INTO referral_commissions(referrer_id, referred_id, level, amount, source_type)
    VALUES (v_referrer.id, p_user_id, i, v_bonus, p_source);

    -- Notify referrer
    INSERT INTO notifications(user_id, type, message)
    VALUES (v_referrer.id, 'referral',
      format('💰 Komisen Lv%s: +RM%s dari %s rakan', i, v_bonus, p_source));

    v_current_id := v_referrer.id;
  END LOOP;
END;
$$;

-- ── Leaderboard views ─────────────────────────────────────────
CREATE OR REPLACE VIEW leaderboard_deposit AS
SELECT
  id, full_name, vip_rank, referral_code,
  total_deposit AS score,
  'deposit' AS category
FROM profiles
WHERE is_admin = FALSE AND is_banned = FALSE AND total_deposit > 0
ORDER BY total_deposit DESC
LIMIT 100;

CREATE OR REPLACE VIEW leaderboard_earned AS
SELECT
  id, full_name, vip_rank, referral_code,
  total_earned AS score,
  'earned' AS category
FROM profiles
WHERE is_admin = FALSE AND is_banned = FALSE AND total_earned > 0
ORDER BY total_earned DESC
LIMIT 100;

CREATE OR REPLACE VIEW leaderboard_referral AS
SELECT
  p.id, p.full_name, p.vip_rank, p.referral_code,
  COALESCE(SUM(rc.amount), 0) AS score,
  COUNT(DISTINCT rc.referred_id) AS team_count,
  'referral' AS category
FROM profiles p
LEFT JOIN referral_commissions rc ON rc.referrer_id = p.id AND rc.level = 1
WHERE p.is_admin = FALSE AND p.is_banned = FALSE
GROUP BY p.id, p.full_name, p.vip_rank, p.referral_code
HAVING COALESCE(SUM(rc.amount), 0) > 0
ORDER BY score DESC
LIMIT 100;

INSERT INTO schema_migrations(version, description)
VALUES ('20250304000004', 'v4 referral commissions, multi-level chain RPC, leaderboard views')
ON CONFLICT(version) DO NOTHING;
SELECT 'Migration v4 applied ✅' AS status;
