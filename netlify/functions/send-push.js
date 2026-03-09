// ═══════════════════════════════════════════════════════════════
// MicroVest v8 — netlify/functions/send-push.js
// Netlify Serverless Function: Send Web Push Notifications
//
// Endpoint: POST /.netlify/functions/send-push
// 
// Body (JSON):
//   { userId, title, body, url, type, target, adminKey }
//
// Required env vars in Netlify:
//   VAPID_PUBLIC_KEY   — from web-push library
//   VAPID_PRIVATE_KEY  — from web-push library
//   VAPID_EMAIL        — mailto:admin@yourdomain.com
//   SUPABASE_URL       — your project URL
//   SUPABASE_SERVICE_KEY — service_role key (not anon)
//   ADMIN_SECRET_KEY   — secret string to auth admin calls
//
// Generate VAPID keys:
//   npx web-push generate-vapid-keys
// ═══════════════════════════════════════════════════════════════

const webpush = require('web-push');

exports.handler = async (event) => {
  // ── CORS preflight ──────────────────────────────────────────
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // ── Parse body ──────────────────────────────────────────────
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return res(400, { error: 'Invalid JSON' });
  }

  const {
    userId,
    title   = 'MicroVest',
    message = 'Ada aktiviti baru di akaun anda.',
    url     = '/dashboard.html',
    type    = 'info',
    target  = 'user',   // 'user' | 'all' | 'vip'
    adminKey,
  } = body;

  // ── Auth check ──────────────────────────────────────────────
  const ADMIN_SECRET = process.env.ADMIN_SECRET_KEY;
  const authHeader   = event.headers['x-admin-key'] || adminKey;

  if (authHeader !== ADMIN_SECRET) {
    return res(401, { error: 'Unauthorized' });
  }

  // ── Configure web-push ──────────────────────────────────────
  const VAPID_PUB   = process.env.VAPID_PUBLIC_KEY;
  const VAPID_PRIV  = process.env.VAPID_PRIVATE_KEY;
  const VAPID_EMAIL = process.env.VAPID_EMAIL || 'mailto:admin@microvest.app';

  if (!VAPID_PUB || !VAPID_PRIV) {
    return res(500, { error: 'VAPID keys not configured' });
  }

  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUB, VAPID_PRIV);

  // ── Fetch subscriptions from Supabase ───────────────────────
  const SUPA_URL = process.env.SUPABASE_URL;
  const SUPA_KEY = process.env.SUPABASE_SERVICE_KEY;

  let subQuery = `${SUPA_URL}/rest/v1/push_subscriptions?active=eq.true&select=endpoint,p256dh,auth,user_id`;
  if (target === 'user' && userId) {
    subQuery += `&user_id=eq.${userId}`;
  }

  const subRes = await fetch(subQuery, {
    headers: {
      'apikey':        SUPA_KEY,
      'Authorization': `Bearer ${SUPA_KEY}`,
      'Content-Type':  'application/json',
    },
  });

  if (!subRes.ok) {
    return res(500, { error: 'Failed to fetch subscriptions' });
  }

  const subscriptions = await subRes.json();
  if (!subscriptions.length) {
    return res(200, { sent: 0, message: 'No subscriptions found' });
  }

  // ── Send notifications ──────────────────────────────────────
  const payload = JSON.stringify({ title, body: message, url, type });
  const results  = { sent: 0, failed: 0, expired: [] };

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification({
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        }, payload, {
          TTL: 86400, // 24 hours
          urgency: 'normal',
          topic: type,
        });
        results.sent++;
      } catch (err) {
        results.failed++;
        // 410 Gone = subscription expired, mark inactive
        if (err.statusCode === 410 || err.statusCode === 404) {
          results.expired.push(sub.endpoint);
          await fetch(`${SUPA_URL}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(sub.endpoint)}`, {
            method: 'PATCH',
            headers: {
              'apikey':        SUPA_KEY,
              'Authorization': `Bearer ${SUPA_KEY}`,
              'Content-Type':  'application/json',
            },
            body: JSON.stringify({ active: false }),
          }).catch(() => {});
        }
      }
    })
  );

  return res(200, {
    sent:    results.sent,
    failed:  results.failed,
    expired: results.expired.length,
    total:   subscriptions.length,
  });
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type, x-admin-key',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

function res(status, data) {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
    body: JSON.stringify(data),
  };
}
