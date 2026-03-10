-- ═══════════════════════════════════════════════════════════════
-- MicroVest v3 — Investments & Mining Machines
-- Tables: investments, user_machines, system_settings
-- ═══════════════════════════════════════════════════════════════

-- ── Investments (plans) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS investments (
  id              UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID    REFERENCES profiles(id) ON DELETE CASCADE,
  plan_id         TEXT    NOT NULL,
  amount          NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  daily_profit    NUMERIC(14,4) DEFAULT 0,
  total_return    NUMERIC(14,2) DEFAULT 0,
  total_claimed   NUMERIC(14,2) DEFAULT 0,
  status          TEXT    DEFAULT 'active' CHECK (status IN ('active','completed','cancelled')),
  last_claimed_at TIMESTAMPTZ,
  end_at          TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE investments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inv_own"   ON investments FOR ALL USING (user_id = auth.uid());
CREATE POLICY "inv_admin" ON investments FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
);
CREATE INDEX IF NOT EXISTS idx_inv_user    ON investments(user_id, status);
CREATE INDEX IF NOT EXISTS idx_inv_active  ON investments(status, end_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_inv_claim   ON investments(user_id, last_claimed_at) WHERE status = 'active';

-- ── Mining Machines ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_machines (
  id              UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID    REFERENCES profiles(id) ON DELETE CASCADE,
  machine_id      TEXT    NOT NULL,
  daily_profit    NUMERIC(14,4) DEFAULT 0,
  total_earned    NUMERIC(14,2) DEFAULT 0,
  status          TEXT    DEFAULT 'active' CHECK (status IN ('active','expired')),
  last_claimed_at TIMESTAMPTZ,
  end_at          TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE user_machines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "machines_own"   ON user_machines FOR ALL USING (user_id = auth.uid());
CREATE POLICY "machines_admin" ON user_machines FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
);
CREATE INDEX IF NOT EXISTS idx_machines_user   ON user_machines(user_id, status);
CREATE INDEX IF NOT EXISTS idx_machines_active ON user_machines(status, last_claimed_at) WHERE status = 'active';

-- ── System settings (admin configurable) ─────────────────────
CREATE TABLE IF NOT EXISTS system_settings (
  key        TEXT  PRIMARY KEY,
  value      JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings_read"  ON system_settings FOR SELECT USING (TRUE);
CREATE POLICY "settings_admin" ON system_settings FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
);

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
  ('app_version',           '"10.0"')
ON CONFLICT (key) DO NOTHING;

-- ── Trigger: auto-expire investments ─────────────────────────
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

-- ── Add to profiles: invest stats ────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS last_login      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_login_date DATE,
  ADD COLUMN IF NOT EXISTS login_streak    INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_login_days INTEGER DEFAULT 0;

-- ── Realtime ─────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE user_machines;

INSERT INTO schema_migrations(version, description)
VALUES ('20250303000003', 'v3 investments, mining machines, system settings')
ON CONFLICT(version) DO NOTHING;
SELECT 'Migration v3 applied ✅' AS status;
