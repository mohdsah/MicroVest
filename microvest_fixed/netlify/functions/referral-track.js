// MicroVest v9 — netlify/functions/referral-track.js
// Tracks referral landing page clicks for analytics

exports.handler = async (event) => {
  const cors = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode:200, headers:cors, body:'' };
  if (event.httpMethod !== 'POST')    return { statusCode:405, body:'Method Not Allowed' };

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return { statusCode:400, body:'Bad JSON' }; }

  const { code, referrer, ua } = body;
  if (!code) return { statusCode:400, headers:cors, body: JSON.stringify({ error:'No code' }) };

  const SUPA_URL = process.env.SUPABASE_URL;
  const SUPA_KEY = process.env.SUPABASE_SERVICE_KEY;

  if (!SUPA_URL || !SUPA_KEY) {
    // Env not set — silently skip (dev mode)
    return { statusCode:200, headers:cors, body: JSON.stringify({ ok:true, tracked:false }) };
  }

  try {
    // Find referrer profile
    const pRes = await fetch(
      `${SUPA_URL}/rest/v1/profiles?referral_code=eq.${code.toUpperCase()}&select=id&limit=1`,
      { headers:{ apikey:SUPA_KEY, Authorization:`Bearer ${SUPA_KEY}` } }
    );
    const profiles = await pRes.json();
    const referrerId = profiles?.[0]?.id || null;

    // Hash IP for dedup (privacy-preserving)
    const ip    = event.headers['x-forwarded-for']?.split(',')[0]?.trim() || '';
    const ipBuf = new TextEncoder().encode(ip + code);
    const ipHash = Array.from(new Uint8Array(
      await crypto.subtle.digest('SHA-256', ipBuf)
    )).map(b=>b.toString(16).padStart(2,'0')).join('').slice(0,16);

    // Insert click record
    await fetch(`${SUPA_URL}/rest/v1/referral_clicks`, {
      method: 'POST',
      headers: {
        apikey:         SUPA_KEY,
        Authorization:  `Bearer ${SUPA_KEY}`,
        'Content-Type': 'application/json',
        Prefer:         'resolution=ignore-duplicates',
      },
      body: JSON.stringify({
        ref_code:    code.toUpperCase(),
        referrer_id: referrerId,
        ip_hash:     ipHash,
        user_agent:  (ua||'').slice(0,200),
        converted:   false,
      }),
    });

    return { statusCode:200, headers:cors, body: JSON.stringify({ ok:true, tracked:true }) };
  } catch(e) {
    return { statusCode:200, headers:cors, body: JSON.stringify({ ok:true, tracked:false }) };
  }
};
