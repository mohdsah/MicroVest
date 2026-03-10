-- ═══════════════════════════════════════════════════════════════
-- MicroVest v5 — Notifications, Missions, Badges, Check-in
-- Tables: notifications, announcements, user_missions,
--         user_badges, login_logs, automation_log
-- RPC: inc_xp, complete_mission
-- ═══════════════════════════════════════════════════════════════

-- ── Notifications ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id         UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID    REFERENCES profiles(id) ON DELETE CASCADE,
  type       TEXT    DEFAULT 'info',
  title      TEXT,
  message    TEXT    NOT NULL,
  icon       TEXT,
  url        TEXT,
  is_read    BOOLEAN DEFAULT FALSE,
  read_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif_own"    ON notifications FOR ALL USING (user_id = auth.uid());
CREATE POLICY "notif_insert" ON notifications FOR INSERT WITH CHECK (TRUE);
CREATE INDEX IF NOT EXISTS idx_notif_user   ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_unread ON notifications(user_id, created_at DESC) WHERE is_read = FALSE;

-- ── Announcements (admin broadcast to all) ────────────────────
CREATE TABLE IF NOT EXISTS announcements (
  id         UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  title      TEXT,
  content    TEXT    NOT NULL,
  icon       TEXT    DEFAULT '📢',
  type       TEXT    DEFAULT 'info',
  is_active  BOOLEAN DEFAULT TRUE,
  priority   INTEGER DEFAULT 0,
  target_rank TEXT   DEFAULT 'all',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ann_read"  ON announcements FOR SELECT USING (TRUE);
CREATE POLICY "ann_admin" ON announcements FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
);
CREATE INDEX IF NOT EXISTS idx_ann_active ON announcements(is_active, priority DESC) WHERE is_active = TRUE;

-- ── User Missions ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_missions (
  id           UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID    REFERENCES profiles(id) ON DELETE CASCADE,
  mission_id   TEXT    NOT NULL,
  progress     INTEGER DEFAULT 0,
  completed    BOOLEAN DEFAULT FALSE,
  claimed      BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  claimed_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, mission_id)
);
ALTER TABLE user_missions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "missions_own" ON user_missions FOR ALL USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_missions_user ON user_missions(user_id, mission_id);
CREATE INDEX IF NOT EXISTS idx_missions_unclaimed ON user_missions(user_id) WHERE completed = TRUE AND claimed = FALSE;

-- ── User Badges ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_badges (
  id        UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id   UUID    REFERENCES profiles(id) ON DELETE CASCADE,
  badge_id  TEXT    NOT NULL,
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, badge_id)
);
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "badges_own" ON user_badges FOR ALL USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_badges_user ON user_badges(user_id);

-- ── Login logs ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS login_logs (
  id          UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID    REFERENCES profiles(id) ON DELETE CASCADE,
  ip_address  TEXT,
  user_agent  TEXT,
  device_type TEXT    DEFAULT 'mobile',
  country     TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE login_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loginlog_own"    ON login_logs FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "loginlog_insert" ON login_logs FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "loginlog_admin"  ON login_logs FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
);
CREATE INDEX IF NOT EXISTS idx_loginlog_user ON login_logs(user_id, created_at DESC);

-- ── Automation log (robot/mining auto-claim records) ─────────
CREATE TABLE IF NOT EXISTS automation_log (
  id         UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID    REFERENCES profiles(id) ON DELETE CASCADE,
  action     TEXT    NOT NULL,
  result     TEXT,
  amount     NUMERIC(14,4) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE automation_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auto_insert" ON automation_log FOR INSERT WITH CHECK (TRUE);
CREATE INDEX IF NOT EXISTS idx_auto_user ON automation_log(user_id, created_at DESC);

-- ── RPC: inc_xp ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION inc_xp(uid UUID, xp_amount NUMERIC)
RETURNS VOID LANGUAGE SQL SECURITY DEFINER AS $$
  UPDATE profiles SET xp = xp + xp_amount::INTEGER, updated_at = NOW() WHERE id = uid;
$$;

-- ── RPC: Daily login streak ───────────────────────────────────
CREATE OR REPLACE FUNCTION process_daily_login(p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_profile   profiles%ROWTYPE;
  v_today     DATE := CURRENT_DATE;
  v_streak    INTEGER;
  v_reward    NUMERIC := 0;
  v_xp        INTEGER := 30;
BEGIN
  SELECT * INTO v_profile FROM profiles WHERE id = p_user_id;
  IF NOT FOUND THEN RETURN '{"ok":false}'::JSONB; END IF;
  IF v_profile.last_login_date = v_today THEN
    RETURN jsonb_build_object('ok', true, 'already_done', true);
  END IF;

  -- Calculate streak
  IF v_profile.last_login_date = v_today - 1 THEN
    v_streak := COALESCE(v_profile.login_streak, 0) + 1;
  ELSE
    v_streak := 1;
  END IF;

  -- Reward based on streak day (checkin array: 0.50,1.00,1.50,2.00,3.00,5.00,10.00)
  v_reward := CASE LEAST(v_streak, 7)
    WHEN 1 THEN 0.50
    WHEN 2 THEN 1.00
    WHEN 3 THEN 1.50
    WHEN 4 THEN 2.00
    WHEN 5 THEN 3.00
    WHEN 6 THEN 5.00
    ELSE 10.00
  END;

  UPDATE profiles SET
    login_streak      = v_streak,
    last_login_date   = v_today,
    last_login        = NOW(),
    total_login_days  = total_login_days + 1,
    balance           = balance + v_reward,
    total_earned      = total_earned + v_reward,
    xp                = xp + v_xp,
    updated_at        = NOW()
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'ok', true, 'streak', v_streak, 'reward', v_reward, 'xp', v_xp
  );
END;
$$;

-- ── Realtime ─────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE announcements;

INSERT INTO schema_migrations(version, description)
VALUES ('20250305000005', 'v5 notifications, missions, badges, login logs, automation log, XP, daily login RPC')
ON CONFLICT(version) DO NOTHING;
SELECT 'Migration v5 applied ✅' AS status;
