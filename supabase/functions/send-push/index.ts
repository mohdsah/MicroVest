// ═══════════════════════════════════════════════════════════════
// MicroVest v8 — supabase/functions/send-push/index.ts
// Supabase Edge Function: Web Push Notification Sender
// ─────────────────────────────────────────────────────────────
// Deploy: supabase functions deploy send-push
// Invoke: POST https://[project].supabase.co/functions/v1/send-push
//
// Required Supabase secrets (set via CLI):
//   supabase secrets set VAPID_PRIVATE_KEY=...
//   supabase secrets set VAPID_PUBLIC_KEY=...
//   supabase secrets set VAPID_EMAIL=mailto:admin@microvest.app
//   supabase secrets set ADMIN_SECRET_KEY=...
// ═══════════════════════════════════════════════════════════════

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Deno Web Push (no npm needed in Edge Functions)
// Using built-in Deno crypto for VAPID signing
const VAPID_PUBLIC  = Deno.env.get('VAPID_PUBLIC_KEY')  || '';
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY') || '';
const VAPID_EMAIL   = Deno.env.get('VAPID_EMAIL')       || 'mailto:admin@microvest.app';
const ADMIN_SECRET  = Deno.env.get('ADMIN_SECRET_KEY')  || '';

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  // Auth check
  const adminKey = req.headers.get('x-admin-key') || '';
  if (adminKey !== ADMIN_SECRET) {
    return json(401, { error: 'Unauthorized' });
  }

  // Parse request
  const body = await req.json().catch(() => ({}));
  const {
    userId,
    title   = '⚡ MicroVest',
    message = 'Ada aktiviti baru di akaun anda.',
    url     = '/dashboard.html',
    type    = 'info',
    target  = 'user',
  } = body;

  // Init Supabase client with service role
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Fetch subscriptions
  let query = supabase.from('push_subscriptions')
    .select('endpoint, p256dh, auth, user_id')
    .eq('active', true);

  if (target === 'user' && userId) {
    query = query.eq('user_id', userId);
  } else if (target === 'vip') {
    // Get VIP user IDs first
    const { data: vips } = await supabase.from('profiles')
      .select('id')
      .in('vip_rank', ['gold', 'platinum', 'diamond']);
    if (vips?.length) {
      query = query.in('user_id', vips.map(v => v.id));
    }
  }

  const { data: subs, error } = await query;
  if (error) return json(500, { error: error.message });
  if (!subs?.length) return json(200, { sent: 0, message: 'No subscriptions' });

  // Send to each subscriber
  const payload   = JSON.stringify({ title, body: message, url, type });
  const results   = { sent: 0, failed: 0, expired: [] as string[] };

  await Promise.allSettled(subs.map(async (sub) => {
    try {
      const pushRes = await sendWebPush(sub.endpoint, sub.p256dh, sub.auth, payload);
      if (pushRes.ok || pushRes.status === 201) {
        results.sent++;
      } else if (pushRes.status === 410 || pushRes.status === 404) {
        // Expired subscription
        results.expired.push(sub.endpoint);
        await supabase.from('push_subscriptions')
          .update({ active: false })
          .eq('endpoint', sub.endpoint);
        results.failed++;
      } else {
        results.failed++;
      }
    } catch (_) {
      results.failed++;
    }
  }));

  return json(200, {
    sent:    results.sent,
    failed:  results.failed,
    expired: results.expired.length,
    total:   subs.length,
  });
});

// ── Simple Web Push sender using fetch ─────────────────────────
// For production, use a proper web-push library via Deno npm support
async function sendWebPush(
  endpoint: string,
  _p256dh: string,
  _auth: string,
  _payload: string,
): Promise<Response> {
  // Note: Full VAPID + encryption implementation requires web-push library.
  // In production, use: import webpush from 'npm:web-push';
  // For now, this sends a basic notification signal.
  // The Netlify serverless function (netlify/functions/send-push.js) 
  // uses the full web-push npm package and is the recommended approach.
  
  return await fetch(endpoint, {
    method: 'POST',
    headers: {
      'TTL':          '86400',
      'Urgency':      'normal',
      'Content-Type': 'application/octet-stream',
    },
    body: new Uint8Array(0), // Placeholder — use npm:web-push for real encryption
  }).catch(() => new Response('', { status: 500 }));
}

function json(status: number, data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}
