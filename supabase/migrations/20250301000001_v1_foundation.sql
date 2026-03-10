-- ═══════════════════════════════════════════════════════════════
-- MicroVest v1 — Foundation
-- Tables: profiles, schema_migrations
-- ═══════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Schema version tracking ───────────────────────────────────
CREATE TABLE IF NOT EXISTS schema_migrations (
  version     TEXT PRIMARY KEY,
  description TEXT,
  applied_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Profiles (auth linked) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id               UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email            TEXT,
  full_name        TEXT,
  balance          NUMERIC(14,2) DEFAULT 0  CHECK (balance >= 0),
  total_deposit    NUMERIC(14,2) DEFAULT 0,
  total_earned     NUMERIC(14,2) DEFAULT 0,
  mvt_balance      NUMERIC(14,2) DEFAULT 0  CHECK (mvt_balance >= 0),
  xp               INTEGER       DEFAULT 0,
  vip_rank         TEXT          DEFAULT 'member',
  referral_code    TEXT          UNIQUE,
  referral_by      TEXT,
  referred_by      TEXT,
  is_admin         BOOLEAN       DEFAULT FALSE,
  is_banned        BOOLEAN       DEFAULT FALSE,
  avatar_url       TEXT,
  preferred_lang   TEXT          DEFAULT 'ms',
  pin_hash         TEXT,
  onboarded        BOOLEAN       DEFAULT FALSE,
  onboarded_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ   DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   DEFAULT NOW()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_own"   ON profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "profiles_admin" ON profiles FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = TRUE)
);

-- ── Auto-generate referral code on signup ─────────────────────
CREATE OR REPLACE FUNCTION gen_referral_code()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trig_ref_code ON profiles;
CREATE TRIGGER trig_ref_code
  BEFORE INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION gen_referral_code();

-- ── Auto update updated_at ────────────────────────────────────
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS trig_profiles_updated ON profiles;
CREATE TRIGGER trig_profiles_updated
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ── Auto-create profile on auth.users insert ──────────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1))
  ) ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trig_new_user ON auth.users;
CREATE TRIGGER trig_new_user
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_profiles_ref    ON profiles(referral_code);
CREATE INDEX IF NOT EXISTS idx_profiles_email  ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_admin  ON profiles(is_admin) WHERE is_admin = TRUE;
CREATE INDEX IF NOT EXISTS idx_profiles_banned ON profiles(is_banned) WHERE is_banned = TRUE;

INSERT INTO schema_migrations(version, description)
VALUES ('20250301000001', 'v1 foundation: profiles, auth trigger, referral code')
ON CONFLICT(version) DO NOTHING;
SELECT 'Migration v1 applied ✅' AS status;
