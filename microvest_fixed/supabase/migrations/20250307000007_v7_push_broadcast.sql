-- ═══════════════════════════════════════════════════════════════
-- MicroVest v7 — Push Notifications, Broadcasts, Spin Wheel
-- Tables: push_subscriptions, broadcasts
-- Adds: last_spin_at to profiles
-- ═══════════════════════════════════════════════════════════════

-- ── Push subscriptions (Web Push VAPID) ──────────────────────
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID    REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint   TEXT    UNIQUE NOT NULL,
  p256dh     TEXT,
  auth       TEXT,
  user_agent TEXT,
  active     BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "push_own"   ON push_subscriptions FOR ALL USING (user_id = auth.uid());
CREATE POLICY "push_admin" ON push_subscriptions FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
);
CREATE INDEX IF NOT EXISTS idx_push_user   ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_active ON push_subscriptions(active) WHERE active = TRUE;

-- ── Admin broadcasts ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS broadcasts (
  id              UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  title           TEXT    NOT NULL,
  body            TEXT    NOT NULL,
  icon            TEXT    DEFAULT '📢',
  url             TEXT    DEFAULT '/dashboard.html',
  type            TEXT    DEFAULT 'admin',
  target          TEXT    DEFAULT 'all',
  target_rank     TEXT,
  recipient_count INTEGER DEFAULT 0,
  sent_by         UUID    REFERENCES profiles(id),
  sent_at         TIMESTAMPTZ DEFAULT NOW(),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE broadcasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "broadcast_admin" ON broadcasts FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
);
CREATE INDEX IF NOT EXISTS idx_broadcast_sent ON broadcasts(sent_at DESC);

-- ── Profile additions: spin + pin ────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS last_spin_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pin_hash      TEXT;

-- ── RPC: Process spin reward ──────────────────────────────────
CREATE OR REPLACE FUNCTION process_spin(
  p_user_id UUID,
  p_type    TEXT,
  p_value   NUMERIC
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_last_spin TIMESTAMPTZ;
  v_now       TIMESTAMPTZ := NOW();
  v_next_spin TIMESTAMPTZ;
BEGIN
  SELECT last_spin_at INTO v_last_spin FROM profiles WHERE id = p_user_id;

  -- Cooldown: 24 hours
  IF v_last_spin IS NOT NULL AND v_last_spin > v_now - INTERVAL '24 hours' THEN
    v_next_spin := v_last_spin + INTERVAL '24 hours';
    RETURN jsonb_build_object('ok', false, 'reason', 'cooldown', 'next_spin', v_next_spin);
  END IF;

  -- Credit reward
  IF p_type = 'cash' THEN
    UPDATE profiles SET
      balance      = balance + p_value,
      total_earned = total_earned + p_value,
      last_spin_at = v_now,
      updated_at   = NOW()
    WHERE id = p_user_id;
  ELSIF p_type = 'mvt' THEN
    UPDATE profiles SET
      mvt_balance  = mvt_balance + p_value,
      last_spin_at = v_now,
      updated_at   = NOW()
    WHERE id = p_user_id;
  END IF;

  INSERT INTO notifications(user_id, type, message)
  VALUES (p_user_id, 'mission',
    format('🎰 Tahniah! Spin roda: +%s %s', p_value, CASE p_type WHEN 'cash' THEN 'RM' ELSE 'MVT' END));

  RETURN jsonb_build_object('ok', true, 'type', p_type, 'value', p_value);
END;
$$;

-- ── VIP rank auto-upgrade ─────────────────────────────────────
CREATE OR REPLACE FUNCTION auto_vip_upgrade(p_user_id UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_dep    NUMERIC;
  v_rank   TEXT;
  v_new    TEXT;
BEGIN
  SELECT total_deposit, vip_rank INTO v_dep, v_rank FROM profiles WHERE id = p_user_id;

  v_new := CASE
    WHEN v_dep >= 5000 THEN 'diamond'
    WHEN v_dep >= 1000 THEN 'gold'
    WHEN v_dep >= 500  THEN 'silver'
    WHEN v_dep >= 100  THEN 'bronze'
    ELSE 'member'
  END;

  IF v_new != v_rank THEN
    UPDATE profiles SET vip_rank = v_new, updated_at = NOW() WHERE id = p_user_id;
    INSERT INTO notifications(user_id, type, message)
    VALUES (p_user_id, 'achievement',
      format('🎉 Tahniah! VIP rank anda naik ke %s!', upper(v_new)));
    RETURN v_new;
  END IF;
  RETURN v_rank;
END;
$$;

-- ── Trigger: VIP upgrade on deposit total change ──────────────
CREATE OR REPLACE FUNCTION trg_check_vip()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.total_deposit IS DISTINCT FROM OLD.total_deposit THEN
    PERFORM auto_vip_upgrade(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trig_vip_upgrade ON profiles;
CREATE TRIGGER trig_vip_upgrade
  AFTER UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION trg_check_vip();

-- ── Additional indexes ────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_profiles_earn ON profiles(total_earned DESC) WHERE is_admin = FALSE;
CREATE INDEX IF NOT EXISTS idx_profiles_dep  ON profiles(total_deposit DESC) WHERE is_admin = FALSE;
CREATE INDEX IF NOT EXISTS idx_profiles_mvt  ON profiles(mvt_balance DESC) WHERE is_admin = FALSE;
CREATE INDEX IF NOT EXISTS idx_profiles_vip  ON profiles(vip_rank);

-- ── Realtime ─────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE transactions;

INSERT INTO schema_migrations(version, description)
VALUES ('20250307000007', 'v7 push subscriptions, broadcasts, spin wheel RPC, VIP auto-upgrade trigger')
ON CONFLICT(version) DO NOTHING;
SELECT 'Migration v7 applied ✅' AS status;
