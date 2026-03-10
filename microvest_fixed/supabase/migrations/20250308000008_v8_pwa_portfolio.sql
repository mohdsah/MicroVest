-- ═══════════════════════════════════════════════════════════════
-- MicroVest v8 — PWA Tracking, Crypto Portfolio, Referral Analytics
-- Tables: user_crypto_portfolio, pwa_installs, referral_clicks
-- Adds: notif_prefs, ui_theme to profiles
-- ═══════════════════════════════════════════════════════════════

-- ── Notification preferences ──────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS notif_prefs JSONB DEFAULT '{
    "deposit":true,"withdraw":true,"profit":true,
    "robot":true,"referral":true,"mission":true,"broadcast":true
  }'::JSONB;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS ui_theme TEXT DEFAULT 'dark';

-- ── Crypto portfolio (per user holdings) ──────────────────────
CREATE TABLE IF NOT EXISTS user_crypto_portfolio (
  id          UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID    REFERENCES profiles(id) ON DELETE CASCADE,
  coin_id     TEXT    NOT NULL,
  symbol      TEXT,
  amount      NUMERIC(20,8) DEFAULT 0,
  avg_buy_myr NUMERIC(14,2) DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, coin_id)
);
ALTER TABLE user_crypto_portfolio ENABLE ROW LEVEL SECURITY;
CREATE POLICY "portfolio_own" ON user_crypto_portfolio FOR ALL USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_portfolio_user ON user_crypto_portfolio(user_id);

-- ── PWA install tracking ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS pwa_installs (
  id           UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID    REFERENCES profiles(id) ON DELETE CASCADE,
  platform     TEXT    CHECK (platform IN ('ios','android','desktop','unknown')),
  user_agent   TEXT,
  installed_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE pwa_installs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pwa_own"   ON pwa_installs FOR ALL USING (user_id = auth.uid());
CREATE POLICY "pwa_admin" ON pwa_installs FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
);
CREATE INDEX IF NOT EXISTS idx_pwa_user     ON pwa_installs(user_id);
CREATE INDEX IF NOT EXISTS idx_pwa_platform ON pwa_installs(platform, installed_at DESC);

-- ── Referral landing click analytics ─────────────────────────
CREATE TABLE IF NOT EXISTS referral_clicks (
  id          UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  ref_code    TEXT    NOT NULL,
  referrer_id UUID    REFERENCES profiles(id) ON DELETE CASCADE,
  ip_hash     TEXT,
  user_agent  TEXT,
  converted   BOOLEAN DEFAULT FALSE,
  clicked_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE referral_clicks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "refclick_admin" ON referral_clicks FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
);
CREATE POLICY "refclick_own" ON referral_clicks FOR SELECT USING (referrer_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_refclicks_code     ON referral_clicks(ref_code, clicked_at DESC);
CREATE INDEX IF NOT EXISTS idx_refclicks_referrer ON referral_clicks(referrer_id, clicked_at DESC);
CREATE INDEX IF NOT EXISTS idx_refclicks_convert  ON referral_clicks(ref_code, converted);

-- ── Trigger: update last_active_at ───────────────────────────
CREATE OR REPLACE FUNCTION update_last_active()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.last_active_at = NOW();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trig_last_active ON profiles;
CREATE TRIGGER trig_last_active
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  WHEN (OLD.balance IS DISTINCT FROM NEW.balance OR OLD.total_deposit IS DISTINCT FROM NEW.total_deposit)
  EXECUTE FUNCTION update_last_active();

-- ── RPC: Mark referral converted ─────────────────────────────
CREATE OR REPLACE FUNCTION mark_referral_converted(p_ref_code TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE referral_clicks
  SET converted = TRUE
  WHERE ref_code = p_ref_code
    AND converted = FALSE
    AND clicked_at > NOW() - INTERVAL '7 days'
    AND ctid IN (
      SELECT ctid FROM referral_clicks
      WHERE ref_code = p_ref_code AND converted = FALSE
      ORDER BY clicked_at DESC LIMIT 1
    );
END;
$$;

-- ── Analytics views ───────────────────────────────────────────
CREATE OR REPLACE VIEW referral_analytics AS
SELECT
  rc.ref_code,
  p.full_name            AS referrer_name,
  p.vip_rank             AS referrer_vip,
  COUNT(rc.id)           AS total_clicks,
  SUM(CASE WHEN rc.converted THEN 1 ELSE 0 END) AS converted_count,
  ROUND(100.0 * SUM(CASE WHEN rc.converted THEN 1 ELSE 0 END) / NULLIF(COUNT(rc.id),0), 1) AS conversion_pct,
  MAX(rc.clicked_at)     AS last_click
FROM referral_clicks rc
LEFT JOIN profiles p ON p.id = rc.referrer_id
GROUP BY rc.ref_code, p.full_name, p.vip_rank
ORDER BY total_clicks DESC;

INSERT INTO schema_migrations(version, description)
VALUES ('20250308000008', 'v8 PWA tracking, crypto portfolio, referral click analytics, notif prefs')
ON CONFLICT(version) DO NOTHING;
SELECT 'Migration v8 applied ✅' AS status;
