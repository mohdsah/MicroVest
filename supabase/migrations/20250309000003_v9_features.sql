-- ═══════════════════════════════════════════════════════════════
-- MicroVest v9 — Migration 003: v9 Feature Tables
-- ═══════════════════════════════════════════════════════════════

-- ── referral_clicks already in 002, ensure indexes ───────────
CREATE INDEX IF NOT EXISTS idx_refclicks_referrer ON referral_clicks(referrer_id, clicked_at DESC);
CREATE INDEX IF NOT EXISTS idx_refclicks_convert  ON referral_clicks(ref_code, converted);

-- ── pwa_installs: ensure index ────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_pwa_user     ON pwa_installs(user_id);
CREATE INDEX IF NOT EXISTS idx_pwa_platform ON pwa_installs(platform, installed_at DESC);

-- ── Referral click → mark converted on registration ──────────
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

-- ── Admin: referral analytics view ───────────────────────────
CREATE OR REPLACE VIEW referral_analytics AS
SELECT
  rc.ref_code,
  p.full_name           AS referrer_name,
  p.vip_rank            AS referrer_vip,
  COUNT(rc.id)          AS total_clicks,
  SUM(CASE WHEN rc.converted THEN 1 ELSE 0 END) AS converted_count,
  ROUND(
    100.0 * SUM(CASE WHEN rc.converted THEN 1 ELSE 0 END) / NULLIF(COUNT(rc.id),0), 1
  )                     AS conversion_pct,
  MIN(rc.clicked_at)    AS first_click,
  MAX(rc.clicked_at)    AS last_click
FROM referral_clicks rc
LEFT JOIN profiles p ON p.id = rc.referrer_id
GROUP BY rc.ref_code, p.full_name, p.vip_rank
ORDER BY total_clicks DESC;

-- ── Leaderboard: top referrers view ──────────────────────────
CREATE OR REPLACE VIEW top_referrers AS
SELECT
  p.id,
  p.full_name,
  p.vip_rank,
  p.referral_code,
  COUNT(DISTINCT ref.id)     AS team_size,
  COALESCE(SUM(rc.amount),0) AS total_commission
FROM profiles p
LEFT JOIN profiles ref ON ref.referred_by = p.id
LEFT JOIN referral_commissions rc ON rc.user_id = p.id
WHERE p.is_admin = FALSE
GROUP BY p.id, p.full_name, p.vip_rank, p.referral_code
ORDER BY total_commission DESC
LIMIT 100;

-- ── Schema migrations tracking ────────────────────────────────
INSERT INTO schema_migrations(version, description)
VALUES ('20250309000003', 'v9 referral analytics, conversion tracking, PWA indexes')
ON CONFLICT(version) DO NOTHING;

SELECT 'Migration 003 applied ✅' AS status;
