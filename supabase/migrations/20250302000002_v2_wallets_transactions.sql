-- ═══════════════════════════════════════════════════════════════
-- MicroVest v2 — Wallets & Transactions
-- Tables: wallets, wallet_transfers, transactions, mvt_transactions
-- RPC: inc_balance, inc_wallet, ensure_wallets, credit_profit
-- ═══════════════════════════════════════════════════════════════

-- ── Wallets (3 per user: main / mining / bonus) ───────────────
CREATE TABLE IF NOT EXISTS wallets (
  id          UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID    REFERENCES profiles(id) ON DELETE CASCADE,
  wallet_type TEXT    NOT NULL CHECK (wallet_type IN ('main','mining','bonus')),
  balance     NUMERIC(14,2) DEFAULT 0 CHECK (balance >= 0),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, wallet_type)
);
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wallets_own"   ON wallets FOR ALL USING (user_id = auth.uid());
CREATE POLICY "wallets_admin" ON wallets FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
);
CREATE INDEX IF NOT EXISTS idx_wallets_user ON wallets(user_id, wallet_type);

-- ── Wallet transfers (internal moves) ────────────────────────
CREATE TABLE IF NOT EXISTS wallet_transfers (
  id          UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID    REFERENCES profiles(id) ON DELETE CASCADE,
  from_wallet TEXT    NOT NULL,
  to_wallet   TEXT    NOT NULL,
  amount      NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  note        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE wallet_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wtransfer_own" ON wallet_transfers FOR ALL USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_wtransfer_user ON wallet_transfers(user_id, created_at DESC);

-- ── Transactions (deposits, withdrawals) ──────────────────────
CREATE TABLE IF NOT EXISTS transactions (
  id               UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID    REFERENCES profiles(id) ON DELETE CASCADE,
  type             TEXT    NOT NULL CHECK (type IN ('deposit','withdrawal','transfer','bonus','refund')),
  amount           NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  status           TEXT    DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  wallet_type      TEXT    DEFAULT 'main',
  bank_name        TEXT,
  account_number   TEXT,
  account_name     TEXT,
  proof_url        TEXT,
  description      TEXT,
  rejection_reason TEXT,
  auto_claimed     BOOLEAN DEFAULT FALSE,
  approved_at      TIMESTAMPTZ,
  approved_by      UUID    REFERENCES profiles(id),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tx_own"   ON transactions FOR ALL USING (user_id = auth.uid());
CREATE POLICY "tx_admin" ON transactions FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
);
CREATE INDEX IF NOT EXISTS idx_tx_user        ON transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tx_status      ON transactions(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tx_pending     ON transactions(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_tx_type        ON transactions(type, status);

-- ── MVT Token transactions ────────────────────────────────────
CREATE TABLE IF NOT EXISTS mvt_transactions (
  id          UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID    REFERENCES profiles(id) ON DELETE CASCADE,
  type        TEXT    NOT NULL,
  amount      NUMERIC(14,2) NOT NULL,
  rm_value    NUMERIC(14,4) DEFAULT 0,
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE mvt_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mvt_tx_own" ON mvt_transactions FOR ALL USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_mvt_user ON mvt_transactions(user_id, created_at DESC);

-- ── Bank accounts (saved for withdrawal) ─────────────────────
CREATE TABLE IF NOT EXISTS bank_accounts (
  id             UUID  PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID  REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  bank_name      TEXT,
  account_number TEXT,
  account_name   TEXT,
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bank_own"   ON bank_accounts FOR ALL USING (user_id = auth.uid());
CREATE POLICY "bank_admin" ON bank_accounts FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
);

-- ── Add wallet columns to profiles ───────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS mining_wallet NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bonus_wallet  NUMERIC(14,2) DEFAULT 0;

-- ── RPC: Atomic balance helpers ───────────────────────────────
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
  ON CONFLICT (user_id, wallet_type)
  DO UPDATE SET balance = wallets.balance + EXCLUDED.balance;
$$;

CREATE OR REPLACE FUNCTION ensure_wallets(uid UUID)
RETURNS VOID LANGUAGE SQL SECURITY DEFINER AS $$
  INSERT INTO wallets (user_id, wallet_type, balance)
  VALUES (uid,'main',0),(uid,'mining',0),(uid,'bonus',0)
  ON CONFLICT (user_id, wallet_type) DO NOTHING;
$$;

-- ── Auto-create wallets on new profile ────────────────────────
CREATE OR REPLACE FUNCTION trg_ensure_wallets()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN PERFORM ensure_wallets(NEW.id); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS trig_wallets_on_profile ON profiles;
CREATE TRIGGER trig_wallets_on_profile
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION trg_ensure_wallets();

-- ── Storage: receipts bucket ──────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('receipts','receipts',TRUE,5242880,
  ARRAY['image/jpeg','image/png','image/webp','application/pdf'])
ON CONFLICT (id) DO NOTHING;
CREATE POLICY "receipts_upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id='receipts' AND auth.role()='authenticated');
CREATE POLICY "receipts_read" ON storage.objects
  FOR SELECT USING (bucket_id='receipts');

INSERT INTO schema_migrations(version, description)
VALUES ('20250302000002', 'v2 wallets, transactions, bank accounts, RPC helpers')
ON CONFLICT(version) DO NOTHING;
SELECT 'Migration v2 applied ✅' AS status;
