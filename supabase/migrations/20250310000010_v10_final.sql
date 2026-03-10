-- ═══════════════════════════════════════════════════════════════
-- MicroVest v10 — Final Hardening, Performance & Admin Upgrades
-- ═══════════════════════════════════════════════════════════════

-- ── 1. inc_xp fix (accept integer) ───────────────────────────
CREATE OR REPLACE FUNCTION inc_xp(uid UUID, xp_amount NUMERIC)
RETURNS VOID LANGUAGE SQL SECURITY DEFINER AS $$
  UPDATE profiles SET xp = xp + xp_amount::INTEGER, updated_at = NOW() WHERE id = uid;
$$;

-- ── 2. Transactions: add reference_id for idempotency ─────────
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS reference_id TEXT UNIQUE;

-- ── 3. Profiles: ensure all v10 columns exist ────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS onboarded       BOOLEAN    DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS onboarded_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS kyc_status      TEXT       DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS preferred_lang  TEXT       DEFAULT 'ms',
  ADD COLUMN IF NOT EXISTS ui_theme        TEXT       DEFAULT 'dark',
  ADD COLUMN IF NOT EXISTS last_active_at  TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS last_spin_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pin_hash        TEXT,
  ADD COLUMN IF NOT EXISTS notif_prefs     JSONB      DEFAULT '{
    "deposit":true,"withdraw":true,"profit":true,
    "robot":true,"referral":true,"mission":true,"broadcast":true
  }'::JSONB;

-- ── 4. Referral: ensure referred_by column ───────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS referred_by TEXT;
UPDATE profiles SET referred_by = referral_by WHERE referred_by IS NULL AND referral_by IS NOT NULL;

-- ── 5. Notifications: add url + read_at ──────────────────────
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS title   TEXT,
  ADD COLUMN IF NOT EXISTS icon    TEXT,
  ADD COLUMN IF NOT EXISTS url     TEXT,
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

-- ── 6. Support tickets: auto ticket_id ───────────────────────
ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS replied_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS replied_by UUID REFERENCES profiles(id);

-- ── 7. Update system_settings to v10 ─────────────────────────
UPDATE system_settings SET value = '"10.0"' WHERE key = 'app_version';
INSERT INTO system_settings (key, value) VALUES
  ('staking_enabled',    'true'),
  ('kyc_required',       'false'),
  ('spin_enabled',       'true'),
  ('min_stake_amount',   '50'),
  ('max_stake_amount',   '50000'),
  ('early_exit_penalty', '0.10')
ON CONFLICT (key) DO NOTHING;

-- ── 8. RPC: get_user_dashboard (single query for dashboard) ──
CREATE OR REPLACE FUNCTION get_user_dashboard(p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_profile    profiles%ROWTYPE;
  v_wallets    JSONB;
  v_active_inv INTEGER;
  v_active_mch INTEGER;
  v_active_rob INTEGER;
  v_active_stk INTEGER;
  v_unread     INTEGER;
BEGIN
  SELECT * INTO v_profile FROM profiles WHERE id = p_user_id;
  IF NOT FOUND THEN RETURN '{"ok":false}'::JSONB; END IF;

  SELECT jsonb_object_agg(wallet_type, balance) INTO v_wallets
  FROM wallets WHERE user_id = p_user_id;

  SELECT COUNT(*) INTO v_active_inv FROM investments  WHERE user_id = p_user_id AND status = 'active';
  SELECT COUNT(*) INTO v_active_mch FROM user_machines WHERE user_id = p_user_id AND status = 'active';
  SELECT COUNT(*) INTO v_active_rob FROM user_robots   WHERE user_id = p_user_id AND status = 'active';
  SELECT COUNT(*) INTO v_active_stk FROM user_stakings WHERE user_id = p_user_id AND status IN ('active','matured');
  SELECT COUNT(*) INTO v_unread     FROM notifications WHERE user_id = p_user_id AND is_read = FALSE;

  RETURN jsonb_build_object(
    'ok',           true,
    'balance',      v_profile.balance,
    'total_deposit',v_profile.total_deposit,
    'total_earned', v_profile.total_earned,
    'mvt_balance',  v_profile.mvt_balance,
    'xp',           v_profile.xp,
    'vip_rank',     v_profile.vip_rank,
    'wallets',      COALESCE(v_wallets, '{}'),
    'active_inv',   v_active_inv,
    'active_mch',   v_active_mch,
    'active_rob',   v_active_rob,
    'active_stk',   v_active_stk,
    'unread',       v_unread
  );
END;
$$;

-- ── 9. RPC: ban_user (admin) ──────────────────────────────────
CREATE OR REPLACE FUNCTION ban_user(p_target UUID, p_admin UUID, p_reason TEXT DEFAULT '')
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_is_admin BOOLEAN;
BEGIN
  SELECT is_admin INTO v_is_admin FROM profiles WHERE id = p_admin;
  IF NOT v_is_admin THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  UPDATE profiles SET is_banned = TRUE, updated_at = NOW() WHERE id = p_target;
  INSERT INTO audit_log(user_id, action, meta)
  VALUES (p_admin, 'ban_user', jsonb_build_object('target', p_target, 'reason', p_reason));
END;
$$;

-- ── 10. RPC: approve_transaction (admin) ──────────────────────
CREATE OR REPLACE FUNCTION approve_transaction(
  p_tx_id    UUID,
  p_admin_id UUID,
  p_action   TEXT  -- 'approve' or 'reject'
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_tx      transactions%ROWTYPE;
  v_is_admin BOOLEAN;
BEGIN
  SELECT is_admin INTO v_is_admin FROM profiles WHERE id = p_admin_id;
  IF NOT v_is_admin THEN RETURN '{"ok":false,"reason":"unauthorized"}'::JSONB; END IF;

  SELECT * INTO v_tx FROM transactions WHERE id = p_tx_id AND status = 'pending';
  IF NOT FOUND THEN RETURN '{"ok":false,"reason":"not_found"}'::JSONB; END IF;

  IF p_action = 'approve' THEN
    UPDATE transactions SET status='approved', approved_at=NOW(), approved_by=p_admin_id WHERE id=p_tx_id;

    IF v_tx.type = 'deposit' THEN
      PERFORM inc_balance(v_tx.user_id, v_tx.amount);
      UPDATE profiles SET total_deposit = total_deposit + v_tx.amount, updated_at = NOW()
        WHERE id = v_tx.user_id;
      PERFORM process_referral_chain(v_tx.user_id, v_tx.amount, 'deposit');
      INSERT INTO notifications(user_id, type, message)
        VALUES (v_tx.user_id, 'deposit',
          format('✅ Deposit RM%s telah diluluskan!', v_tx.amount));
    ELSIF v_tx.type = 'withdrawal' THEN
      INSERT INTO notifications(user_id, type, message)
        VALUES (v_tx.user_id, 'withdrawal',
          format('✅ Pengeluaran RM%s telah diproses!', v_tx.amount));
    END IF;

  ELSIF p_action = 'reject' THEN
    UPDATE transactions SET status='rejected' WHERE id=p_tx_id;
    IF v_tx.type = 'withdrawal' THEN
      PERFORM inc_balance(v_tx.user_id, v_tx.amount);
    END IF;
    INSERT INTO notifications(user_id, type, message)
      VALUES (v_tx.user_id, 'info',
        format('❌ Transaksi RM%s telah ditolak. Hubungi support.', v_tx.amount));
  END IF;

  INSERT INTO audit_log(user_id, action, meta)
    VALUES (p_admin_id, 'tx_' || p_action,
      jsonb_build_object('tx_id', p_tx_id, 'amount', v_tx.amount, 'type', v_tx.type));

  RETURN jsonb_build_object('ok', true, 'action', p_action, 'tx_id', p_tx_id);
END;
$$;

-- ── 11. RPC: full_auto_claim (used by automation.js) ─────────
CREATE OR REPLACE FUNCTION full_auto_claim(p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_total_claim  NUMERIC := 0;
  v_inv          investments%ROWTYPE;
  v_mch          user_machines%ROWTYPE;
  v_rob          user_robots%ROWTYPE;
  v_daily_profit NUMERIC;
BEGIN
  -- Claim investments
  FOR v_inv IN
    SELECT * FROM investments
    WHERE user_id = p_user_id AND status = 'active'
      AND (last_claimed_at IS NULL OR last_claimed_at < NOW() - INTERVAL '20 hours')
  LOOP
    v_daily_profit := v_inv.daily_profit;
    PERFORM credit_profit(p_user_id, v_daily_profit, v_daily_profit * 10);
    UPDATE investments SET last_claimed_at = NOW(), total_claimed = total_claimed + v_daily_profit
      WHERE id = v_inv.id;
    v_total_claim := v_total_claim + v_daily_profit;
  END LOOP;

  -- Claim mining machines
  FOR v_mch IN
    SELECT * FROM user_machines
    WHERE user_id = p_user_id AND status = 'active'
      AND (last_claimed_at IS NULL OR last_claimed_at < NOW() - INTERVAL '20 hours')
  LOOP
    v_daily_profit := v_mch.daily_profit;
    PERFORM inc_wallet(p_user_id, 'mining', v_daily_profit);
    PERFORM inc_earned(p_user_id, v_daily_profit);
    UPDATE user_machines SET last_claimed_at = NOW(), total_earned = total_earned + v_daily_profit
      WHERE id = v_mch.id;
    v_total_claim := v_total_claim + v_daily_profit;
  END LOOP;

  -- Claim robots
  FOR v_rob IN
    SELECT * FROM user_robots
    WHERE user_id = p_user_id AND status = 'active'
      AND (last_claimed_at IS NULL OR last_claimed_at < NOW() - INTERVAL '20 hours')
  LOOP
    v_daily_profit := v_rob.daily_profit;
    PERFORM inc_wallet(p_user_id, 'mining', v_daily_profit);
    PERFORM inc_earned(p_user_id, v_daily_profit);
    UPDATE user_robots SET last_claimed_at = NOW(), auto_claimed_at = NOW(), total_earned = total_earned + v_daily_profit
      WHERE id = v_rob.id;
    v_total_claim := v_total_claim + v_daily_profit;
  END LOOP;

  IF v_total_claim > 0 THEN
    INSERT INTO notifications(user_id, type, message)
    VALUES (p_user_id, 'profit',
      format('⚡ Auto-claim: +RM%s dikreditkan ke wallet mining.', ROUND(v_total_claim,4)));
  END IF;

  RETURN jsonb_build_object('ok', true, 'claimed', v_total_claim);
END;
$$;

-- ── 12. Missing indexes ───────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_inv_claim     ON investments(user_id, last_claimed_at)  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_mch_claim     ON user_machines(user_id, last_claimed_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_rob_claim     ON user_robots(user_id, last_claimed_at)   WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_profiles_rank ON profiles(vip_rank, total_deposit DESC)  WHERE is_admin = FALSE;

-- ── 13. Realtime: ensure all key tables enabled ───────────────
DO $$
BEGIN
  PERFORM pg_publication_tables.pubname
  FROM pg_publication_tables
  WHERE pubname = 'supabase_realtime' AND tablename = 'user_stakings';
  IF NOT FOUND THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE user_stakings;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

-- ── 14. KYC storage bucket ────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('kyc', 'kyc', FALSE, 10485760, ARRAY['image/jpeg','image/png','image/webp','application/pdf'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "kyc_upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'kyc' AND auth.role() = 'authenticated');
CREATE POLICY "kyc_own_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'kyc' AND (
    auth.uid()::text = (storage.foldername(name))[1] OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
  ));

INSERT INTO schema_migrations(version, description)
VALUES ('20250310000010', 'v10 final: dashboard RPC, approve_tx, full_auto_claim, ban_user, KYC bucket, all column guards')
ON CONFLICT(version) DO NOTHING;
SELECT 'Migration v10 applied ✅' AS status;
