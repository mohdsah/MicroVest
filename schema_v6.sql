-- ═══════════════════════════════════════════════════════════════
-- MicroVest v6 — Complete Database Schema
-- Supabase Project: zmyiaviafmmwpgxfvsbq
-- Run ENTIRE file in Supabase SQL Editor (Query tab)
-- ═══════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── 1. PROFILES ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id               UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email            TEXT,
  balance          NUMERIC(14,2) DEFAULT 0,
  total_deposit    NUMERIC(14,2) DEFAULT 0,
  total_earned     NUMERIC(14,2) DEFAULT 0,
  mining_wallet    NUMERIC(14,2) DEFAULT 0,
  bonus_wallet     NUMERIC(14,2) DEFAULT 0,
  mvt_balance      NUMERIC(14,2) DEFAULT 0,
  xp               INTEGER       DEFAULT 0,
  vip_rank         TEXT          DEFAULT 'member',
  referral_code    TEXT          UNIQUE,
  referral_by      TEXT,
  is_admin         BOOLEAN       DEFAULT FALSE,
  is_banned        BOOLEAN       DEFAULT FALSE,
  login_streak     INTEGER       DEFAULT 0,
  last_login_date  DATE,
  last_login       TIMESTAMPTZ,
  total_login_days INTEGER       DEFAULT 0,
  last_spin_at     TIMESTAMPTZ,
  pin_hash         TEXT,
  preferred_lang   TEXT          DEFAULT 'ms',
  avatar_url       TEXT,
  created_at       TIMESTAMPTZ   DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   DEFAULT NOW()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_own" ON profiles;
CREATE POLICY "profiles_own" ON profiles FOR ALL USING (auth.uid() = id);
DROP POLICY IF EXISTS "profiles_admin" ON profiles;
CREATE POLICY "profiles_admin" ON profiles FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = TRUE)
);

-- ── 2. TRANSACTIONS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type             TEXT NOT NULL,
  amount           NUMERIC(14,2) NOT NULL,
  status           TEXT DEFAULT 'pending',
  wallet_type      TEXT DEFAULT 'main',
  bank_name        TEXT,
  account_number   TEXT,
  proof_url        TEXT,
  description      TEXT,
  rejection_reason TEXT,
  auto_claimed     BOOLEAN DEFAULT FALSE,
  approved_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tx_own" ON transactions;
CREATE POLICY "tx_own" ON transactions FOR ALL USING (user_id = auth.uid());
DROP POLICY IF EXISTS "tx_admin" ON transactions;
CREATE POLICY "tx_admin" ON transactions FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
);

-- ── 3. INVESTMENTS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS investments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID REFERENCES profiles(id) ON DELETE CASCADE,
  plan_id         TEXT NOT NULL,
  amount          NUMERIC(14,2) NOT NULL,
  daily_profit    NUMERIC(14,4) DEFAULT 0,
  total_return    NUMERIC(14,2) DEFAULT 0,
  total_claimed   NUMERIC(14,2) DEFAULT 0,
  status          TEXT DEFAULT 'active',
  last_claimed_at TIMESTAMPTZ,
  end_at          TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE investments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "inv_own" ON investments;
CREATE POLICY "inv_own" ON investments FOR ALL USING (user_id = auth.uid());
DROP POLICY IF EXISTS "inv_admin" ON investments;
CREATE POLICY "inv_admin" ON investments FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
);

-- ── 4. USER_MACHINES ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_machines (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID REFERENCES profiles(id) ON DELETE CASCADE,
  machine_id      TEXT NOT NULL,
  daily_profit    NUMERIC(14,4) DEFAULT 0,
  total_earned    NUMERIC(14,2) DEFAULT 0,
  status          TEXT DEFAULT 'active',
  last_claimed_at TIMESTAMPTZ,
  end_at          TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE user_machines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "machines_own" ON user_machines;
CREATE POLICY "machines_own" ON user_machines FOR ALL USING (user_id = auth.uid());
DROP POLICY IF EXISTS "machines_admin" ON user_machines;
CREATE POLICY "machines_admin" ON user_machines FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
);

-- ── 5. NOTIFICATIONS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type       TEXT DEFAULT 'info',
  message    TEXT NOT NULL,
  is_read    BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notif_own" ON notifications;
CREATE POLICY "notif_own" ON notifications FOR ALL USING (user_id = auth.uid());
DROP POLICY IF EXISTS "notif_insert" ON notifications;
CREATE POLICY "notif_insert" ON notifications FOR INSERT WITH CHECK (TRUE);

-- ── 6. WALLETS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wallets (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES profiles(id) ON DELETE CASCADE,
  wallet_type TEXT NOT NULL,
  balance     NUMERIC(14,2) DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, wallet_type)
);
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "wallets_own" ON wallets;
CREATE POLICY "wallets_own" ON wallets FOR ALL USING (user_id = auth.uid());

-- ── 7. WALLET_TRANSFERS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wallet_transfers (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES profiles(id) ON DELETE CASCADE,
  from_wallet TEXT NOT NULL,
  to_wallet   TEXT NOT NULL,
  amount      NUMERIC(14,2) NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE wallet_transfers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "wtransfer_own" ON wallet_transfers;
CREATE POLICY "wtransfer_own" ON wallet_transfers FOR ALL USING (user_id = auth.uid());

-- ── 8. MVT_TRANSACTIONS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mvt_transactions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  amount      NUMERIC(14,2) NOT NULL,
  rm_value    NUMERIC(14,4) DEFAULT 0,
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE mvt_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mvt_tx_own" ON mvt_transactions;
CREATE POLICY "mvt_tx_own" ON mvt_transactions FOR ALL USING (user_id = auth.uid());

-- ── 9. USER_MISSIONS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_missions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID REFERENCES profiles(id) ON DELETE CASCADE,
  mission_id   TEXT NOT NULL,
  progress     INTEGER DEFAULT 0,
  completed    BOOLEAN DEFAULT FALSE,
  claimed      BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  claimed_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, mission_id)
);
ALTER TABLE user_missions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "missions_own" ON user_missions;
CREATE POLICY "missions_own" ON user_missions FOR ALL USING (user_id = auth.uid());

-- ── 10. USER_BADGES ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_badges (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id   UUID REFERENCES profiles(id) ON DELETE CASCADE,
  badge_id  TEXT NOT NULL,
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, badge_id)
);
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "badges_own" ON user_badges;
CREATE POLICY "badges_own" ON user_badges FOR ALL USING (user_id = auth.uid());

-- ── 11. REFERRAL_COMMISSIONS ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS referral_commissions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referrer_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  referred_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  level       INTEGER NOT NULL,
  amount      NUMERIC(14,4) NOT NULL,
  source_type TEXT DEFAULT 'deposit',
  from_email  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE referral_commissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "referral_own" ON referral_commissions;
CREATE POLICY "referral_own" ON referral_commissions FOR SELECT USING (referrer_id = auth.uid());
DROP POLICY IF EXISTS "referral_insert" ON referral_commissions;
CREATE POLICY "referral_insert" ON referral_commissions FOR INSERT WITH CHECK (TRUE);
DROP POLICY IF EXISTS "referral_admin" ON referral_commissions;
CREATE POLICY "referral_admin" ON referral_commissions FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
);

-- ── 12. BANK_ACCOUNTS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bank_accounts (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  bank_name      TEXT,
  account_number TEXT,
  account_name   TEXT,
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bank_own" ON bank_accounts;
CREATE POLICY "bank_own" ON bank_accounts FOR ALL USING (user_id = auth.uid());
DROP POLICY IF EXISTS "bank_admin" ON bank_accounts;
CREATE POLICY "bank_admin" ON bank_accounts FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
);

-- ── 13. LOGIN_LOGS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS login_logs (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID REFERENCES profiles(id) ON DELETE CASCADE,
  ip_address   TEXT,
  user_agent   TEXT,
  device_type  TEXT DEFAULT 'desktop',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE login_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "loginlog_own" ON login_logs;
CREATE POLICY "loginlog_own"    ON login_logs FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "loginlog_insert" ON login_logs;
CREATE POLICY "loginlog_insert" ON login_logs FOR INSERT WITH CHECK (TRUE);
DROP POLICY IF EXISTS "loginlog_admin" ON login_logs;
CREATE POLICY "loginlog_admin"  ON login_logs FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
);

-- ── 14. SYSTEM_SETTINGS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS system_settings (
  key        TEXT PRIMARY KEY,
  value      JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "settings_read" ON system_settings;
CREATE POLICY "settings_read"  ON system_settings FOR SELECT USING (TRUE);
DROP POLICY IF EXISTS "settings_admin" ON system_settings;
CREATE POLICY "settings_admin" ON system_settings FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
);

-- ── 15. ANNOUNCEMENTS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS announcements (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title      TEXT,
  content    TEXT NOT NULL,
  is_active  BOOLEAN DEFAULT TRUE,
  priority   INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ann_read" ON announcements;
CREATE POLICY "ann_read"  ON announcements FOR SELECT USING (TRUE);
DROP POLICY IF EXISTS "ann_admin" ON announcements;
CREATE POLICY "ann_admin" ON announcements FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
);

-- ── 16. AUTOMATION_LOG ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS automation_log (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID REFERENCES profiles(id) ON DELETE CASCADE,
  action     TEXT NOT NULL,
  result     TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE automation_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auto_insert" ON automation_log;
CREATE POLICY "auto_insert" ON automation_log FOR INSERT WITH CHECK (TRUE);

-- ═══════════════════════════════════════════════════════════════
-- RPC FUNCTIONS — Atomic helpers (replaces db.raw in JS)
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION inc_balance(uid UUID, amt NUMERIC)
RETURNS VOID LANGUAGE SQL SECURITY DEFINER AS $$
  UPDATE profiles SET balance = balance + amt, updated_at = NOW() WHERE id = uid;
$$;

CREATE OR REPLACE FUNCTION inc_mvt(uid UUID, amt NUMERIC)
RETURNS VOID LANGUAGE SQL SECURITY DEFINER AS $$
  UPDATE profiles SET mvt_balance = mvt_balance + amt, updated_at = NOW() WHERE id = uid;
$$;

CREATE OR REPLACE FUNCTION inc_earned(uid UUID, amt NUMERIC)
RETURNS VOID LANGUAGE SQL SECURITY DEFINER AS $$
  UPDATE profiles SET total_earned = total_earned + amt, updated_at = NOW() WHERE id = uid;
$$;

CREATE OR REPLACE FUNCTION credit_profit(uid UUID, amt NUMERIC, mvt_amt NUMERIC DEFAULT 0)
RETURNS VOID LANGUAGE SQL SECURITY DEFINER AS $$
  UPDATE profiles
  SET balance      = balance + amt,
      total_earned = total_earned + amt,
      mvt_balance  = mvt_balance + mvt_amt,
      updated_at   = NOW()
  WHERE id = uid;
$$;

CREATE OR REPLACE FUNCTION inc_wallet(uid UUID, wtype TEXT, amt NUMERIC)
RETURNS VOID LANGUAGE SQL SECURITY DEFINER AS $$
  INSERT INTO wallets (user_id, wallet_type, balance) VALUES (uid, wtype, amt)
  ON CONFLICT (user_id, wallet_type) DO UPDATE SET balance = wallets.balance + amt;
$$;

CREATE OR REPLACE FUNCTION ensure_wallets(uid UUID)
RETURNS VOID LANGUAGE SQL SECURITY DEFINER AS $$
  INSERT INTO wallets (user_id, wallet_type, balance)
  VALUES (uid,'main',0),(uid,'mining',0),(uid,'bonus',0)
  ON CONFLICT (user_id, wallet_type) DO NOTHING;
$$;

-- ── Trigger: auto-create wallets on new profile ──────────────
CREATE OR REPLACE FUNCTION trg_ensure_wallets()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN PERFORM ensure_wallets(NEW.id); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS trig_wallets_on_profile ON profiles;
CREATE TRIGGER trig_wallets_on_profile
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION trg_ensure_wallets();

-- ── Trigger: auto-expire completed investments ────────────────
CREATE OR REPLACE FUNCTION trg_expire_investments()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE investments SET status = 'completed'
  WHERE status = 'active' AND end_at < NOW() AND user_id = NEW.user_id;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trig_expire_inv ON investments;
CREATE TRIGGER trig_expire_inv
  AFTER INSERT OR UPDATE ON investments
  FOR EACH ROW EXECUTE FUNCTION trg_expire_investments();

-- ═══════════════════════════════════════════════════════════════
-- REALTIME
-- ═══════════════════════════════════════════════════════════════
ALTER PUBLICATION supabase_realtime ADD TABLE transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE user_machines;
ALTER PUBLICATION supabase_realtime ADD TABLE announcements;

-- ═══════════════════════════════════════════════════════════════
-- STORAGE bucket for deposit receipts
-- ═══════════════════════════════════════════════════════════════
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('receipts','receipts',TRUE,5242880,
  ARRAY['image/jpeg','image/png','image/webp','application/pdf'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "receipts_upload" ON storage.objects;
CREATE POLICY "receipts_upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id='receipts' AND auth.role()='authenticated');
DROP POLICY IF EXISTS "receipts_read" ON storage.objects;
CREATE POLICY "receipts_read" ON storage.objects
  FOR SELECT USING (bucket_id='receipts');

-- ═══════════════════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_tx_user        ON transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tx_status      ON transactions(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_inv_user       ON investments(user_id, status);
CREATE INDEX IF NOT EXISTS idx_machines_user  ON user_machines(user_id, status);
CREATE INDEX IF NOT EXISTS idx_notif_user     ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_profiles_ref   ON profiles(referral_code);
CREATE INDEX IF NOT EXISTS idx_profiles_earn  ON profiles(total_earned DESC) WHERE is_admin = FALSE;
CREATE INDEX IF NOT EXISTS idx_profiles_dep   ON profiles(total_deposit DESC) WHERE is_admin = FALSE;
CREATE INDEX IF NOT EXISTS idx_profiles_mvt   ON profiles(mvt_balance DESC)   WHERE is_admin = FALSE;
CREATE INDEX IF NOT EXISTS idx_wallets_user   ON wallets(user_id, wallet_type);
CREATE INDEX IF NOT EXISTS idx_referral_chain ON referral_commissions(referrer_id, level);

-- ═══════════════════════════════════════════════════════════════
-- SEED: Default system settings
-- ═══════════════════════════════════════════════════════════════
INSERT INTO system_settings (key, value) VALUES
  ('maintenance_mode',      'false'),
  ('auto_mining_enabled',   'true'),
  ('auto_vip_upgrade',      'true'),
  ('withdraw_pin_required', 'false'),
  ('mvt_price',             '0.085'),
  ('min_deposit',           '20'),
  ('min_withdraw',          '50'),
  ('admin_bank',            '{"bank":"Maybank","accNo":"","name":""}'),
  ('referral_rates',        '[0.10,0.05,0.03,0.02]'),
  ('app_version',           '"6.0"')
ON CONFLICT (key) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- IMPORTANT: After running, set your admin account:
-- UPDATE profiles SET is_admin = TRUE WHERE email = 'your@email.com';
-- ═══════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════
-- SUPPORT TICKETS (for support.html)
-- Run after initial schema if not already present
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS support_tickets (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES profiles(id) ON DELETE CASCADE,
  ticket_id   TEXT UNIQUE,
  category    TEXT NOT NULL DEFAULT 'other',
  subject     TEXT NOT NULL,
  description TEXT NOT NULL,
  screenshot  TEXT,
  status      TEXT DEFAULT 'open' CHECK (status IN ('open','pending','closed')),
  admin_reply TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tickets_own"   ON support_tickets;
CREATE POLICY "tickets_own"   ON support_tickets FOR ALL USING (user_id = auth.uid());
DROP POLICY IF EXISTS "tickets_admin" ON support_tickets;
CREATE POLICY "tickets_admin" ON support_tickets FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
);
CREATE INDEX IF NOT EXISTS idx_tickets_user ON support_tickets(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON support_tickets(status) WHERE status = 'open';

-- ═══════════════════════════════════════════════════════════════
-- AI ROBOT SYSTEM (Robot Wealth feature)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS user_robots (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID REFERENCES profiles(id) ON DELETE CASCADE,
  robot_id        TEXT NOT NULL,
  status          TEXT DEFAULT 'active' CHECK (status IN ('active','expired','paused')),
  price_paid      NUMERIC DEFAULT 0,
  daily_profit    NUMERIC DEFAULT 0,
  total_earned    NUMERIC DEFAULT 0,
  last_claimed_at TIMESTAMPTZ,
  auto_claimed_at TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE user_robots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "robots_own" ON user_robots;
CREATE POLICY "robots_own" ON user_robots FOR ALL USING (user_id = auth.uid());
DROP POLICY IF EXISTS "robots_admin" ON user_robots;
CREATE POLICY "robots_admin" ON user_robots FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
);

CREATE TABLE IF NOT EXISTS robot_promotions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  promoter_id  UUID REFERENCES profiles(id) ON DELETE CASCADE,
  referred_id  UUID REFERENCES profiles(id) ON DELETE CASCADE,
  robot_id     TEXT NOT NULL,
  amount       NUMERIC DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE robot_promotions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "robot_promo_own" ON robot_promotions;
CREATE POLICY "robot_promo_own" ON robot_promotions FOR ALL USING (promoter_id = auth.uid());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_robots_user   ON user_robots(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_robots_status ON user_robots(status, last_claimed_at);
CREATE INDEX IF NOT EXISTS idx_robot_promos       ON robot_promotions(promoter_id, created_at DESC);

-- Expire robots trigger
CREATE OR REPLACE FUNCTION expire_robots()
RETURNS TRIGGER LANGUAGE PLPGSQL AS $$
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

-- Realtime for user_robots
ALTER PUBLICATION supabase_realtime ADD TABLE user_robots;

-- inc_xp: atomic XP increment helper (for missions.html)
CREATE OR REPLACE FUNCTION inc_xp(uid UUID, amt NUMERIC)
RETURNS VOID LANGUAGE SQL SECURITY DEFINER AS $$
  UPDATE profiles SET xp = xp + amt, updated_at = NOW() WHERE id = uid;
$$;
