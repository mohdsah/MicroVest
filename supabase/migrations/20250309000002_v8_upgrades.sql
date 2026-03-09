-- ═══════════════════════════════════════════════════════════════
-- MicroVest v8 — Migration 002: v8 New Features
-- ═══════════════════════════════════════════════════════════════

-- ── Notification Preferences (new column) ────────────────────
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS notif_prefs JSONB DEFAULT '{
    "deposit": true,
    "withdraw": true, 
    "profit": true,
    "robot": true,
    "referral": true,
    "mission": true,
    "broadcast": true
  }'::JSONB;

-- ── Theme preference ─────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS ui_theme TEXT DEFAULT 'dark';

-- ── Last active timestamp ─────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ DEFAULT NOW();

-- ── Trigger: auto-update last_active_at on profile update ────
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
  WHEN (OLD.balance IS DISTINCT FROM NEW.balance OR
        OLD.total_deposit IS DISTINCT FROM NEW.total_deposit)
  EXECUTE FUNCTION update_last_active();

-- ── Crypto portfolio cache ────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_crypto_portfolio (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES profiles(id) ON DELETE CASCADE,
  coin_id     TEXT NOT NULL,
  symbol      TEXT,
  amount      NUMERIC(20,8) DEFAULT 0,
  avg_buy_myr NUMERIC(14,2) DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, coin_id)
);
ALTER TABLE user_crypto_portfolio ENABLE ROW LEVEL SECURITY;
CREATE POLICY "portfolio_own" ON user_crypto_portfolio
  FOR ALL USING (user_id = auth.uid());

-- ── PWA Install tracking ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS pwa_installs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES profiles(id) ON DELETE CASCADE,
  platform    TEXT,  -- 'ios','android','desktop'
  user_agent  TEXT,
  installed_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE pwa_installs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pwa_own"   ON pwa_installs FOR ALL USING (user_id = auth.uid());
CREATE POLICY "pwa_admin" ON pwa_installs FOR SELECT USING (
  EXISTS(SELECT 1 FROM profiles WHERE id=auth.uid() AND is_admin=TRUE)
);

-- ── Referral landing analytics ────────────────────────────────
CREATE TABLE IF NOT EXISTS referral_clicks (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ref_code     TEXT NOT NULL,
  referrer_id  UUID REFERENCES profiles(id) ON DELETE CASCADE,
  ip_hash      TEXT,  -- hashed IP for dedup
  user_agent   TEXT,
  converted    BOOLEAN DEFAULT FALSE,
  clicked_at   TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE referral_clicks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "refclick_admin" ON referral_clicks FOR ALL USING (
  EXISTS(SELECT 1 FROM profiles WHERE id=auth.uid() AND is_admin=TRUE)
);
CREATE POLICY "refclick_own" ON referral_clicks FOR SELECT
  USING (referrer_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_refclicks_code ON referral_clicks(ref_code, clicked_at DESC);

-- ── Mark migration ────────────────────────────────────────────
INSERT INTO schema_migrations(version, description)
VALUES ('20250309000002', 'v8 notification prefs, theme, crypto portfolio, PWA tracking, referral analytics')
ON CONFLICT(version) DO NOTHING;
