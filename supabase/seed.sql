-- ═══════════════════════════════════════════════════════════════
-- MicroVest v8 — supabase/seed.sql
-- Initial seed data for system_settings and announcements
-- Run: supabase db reset  (resets + applies seed)
-- ═══════════════════════════════════════════════════════════════

-- ── System Settings ──────────────────────────────────────────
INSERT INTO system_settings (key, value) VALUES
  ('app_name',           '"MicroVest"'),
  ('app_version',        '"8.0"'),
  ('deposit_enabled',    'true'),
  ('withdraw_enabled',   'true'),
  ('invest_enabled',     'true'),
  ('mining_enabled',     'true'),
  ('robot_enabled',      'true'),
  ('market_enabled',     'true'),
  ('min_deposit',        '10'),
  ('min_withdraw',       '20'),
  ('withdraw_fee_pct',   '0'),
  ('bank_name',          '"Maybank"'),
  ('bank_account',       '"1234567890"'),
  ('bank_holder',        '"MicroVest Sdn Bhd"'),
  ('mvt_price',          '1.00'),
  ('maintenance_mode',   'false'),
  ('announcement',       '"Selamat datang ke MicroVest v8! Platform pelaburan premium anda. 🚀"'),
  ('support_telegram',   '"https://t.me/microvest_support"'),
  ('support_whatsapp',   '"https://wa.me/60123456789"'),
  ('support_email',      '"support@microvest.app"')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- ── Welcome Announcement ──────────────────────────────────────
INSERT INTO announcements (title, content, is_active) VALUES
  (
    '🚀 MicroVest v8 Kini Aktif!',
    'Platform telah dinaik taraf ke versi terbaru dengan ciri-ciri baharu: Live Crypto Market, Web Push Notification, dan sistem keselamatan yang lebih kukuh. Terima kasih kerana bersama kami!',
    TRUE
  )
ON CONFLICT DO NOTHING;

-- ── Demo crypto cache (initial prices) ───────────────────────
INSERT INTO crypto_cache (id, symbol, name, price_myr, change_24h) VALUES
  ('bitcoin',      'BTC',  'Bitcoin',         430000.00,  1.25),
  ('ethereum',     'ETH',  'Ethereum',         14500.00,  0.87),
  ('binancecoin',  'BNB',  'BNB',               1850.00, -0.32),
  ('ripple',       'XRP',  'XRP',                  2.45,  2.10),
  ('solana',       'SOL',  'Solana',             750.00,  3.45),
  ('cardano',      'ADA',  'Cardano',              1.85, -0.98),
  ('dogecoin',     'DOGE', 'Dogecoin',             0.78,  1.67),
  ('polkadot',     'DOT',  'Polkadot',            28.50, -1.23)
ON CONFLICT (id) DO UPDATE SET
  price_myr  = EXCLUDED.price_myr,
  change_24h = EXCLUDED.change_24h,
  updated_at = NOW();

RAISE NOTICE 'MicroVest v8 seed data applied successfully!';
