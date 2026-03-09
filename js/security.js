/* ═══════════════════════════════════════════════════════════════
   MicroVest v8 — security.js
   Centralized Security Layer
   ─────────────────────────────────────────────────────────────
   Features:
   • guardSession()    — redirect if not logged in
   • guardAdmin()      — redirect if not admin
   • guardBan()        — lock out banned users
   • Anti-cheat:       rate limiting, action throttling
   • Request signing   — tamper detection
   • Audit logging     — track suspicious activity
═══════════════════════════════════════════════════════════════ */

const Security = (() => {
  'use strict';

  // ── STATE ─────────────────────────────────────────────────
  let _session  = null;
  let _profile  = null;
  let _ready    = false;
  const _calls  = {};       // { action: [timestamps] }
  const _limits = {         // max calls per 60s
    deposit:    3,
    withdraw:   3,
    invest:     5,
    claim:      10,
    spin:       2,
    checkin:    2,
    buy_robot:  5,
    buy_machine:5,
    transfer:   5,
    market_buy: 5,
    market_sell:5,
    default:    20,
  };

  // ── INIT ───────────────────────────────────────────────────
  async function init() {
    if (_ready) return { session:_session, profile:_profile };
    try {
      const { data:{ session } } = await db.auth.getSession();
      _session = session;
      _ready   = true;
      return { session };
    } catch(e) {
      console.warn('[Security] init error:', e);
      return { session:null };
    }
  }

  // ── GUARD: SESSION ─────────────────────────────────────────
  async function guardSession(redirect = 'login.html') {
    const { session } = await init();
    if (!session) {
      const here = encodeURIComponent(location.pathname + location.search);
      location.href = `${redirect}?next=${here}`;
      return null;
    }

    // Load profile
    if (!_profile) {
      const { data } = await db.from('profiles')
        .select('id,email,full_name,balance,is_admin,is_banned,vip_rank,referral_code')
        .eq('id', session.user.id)
        .single()
        .catch(() => ({data:null}));
      _profile = data;
    }

    // Ban check
    if (_profile?.is_banned) {
      guardBanned();
      return null;
    }

    return { session, profile:_profile };
  }

  // ── GUARD: ADMIN ───────────────────────────────────────────
  async function guardAdmin(redirect = '../login.html') {
    const res = await guardSession(redirect);
    if (!res) return null;
    if (!res.profile?.is_admin) {
      location.href = '../dashboard.html';
      return null;
    }
    return res;
  }

  // ── GUARD: BANNED ──────────────────────────────────────────
  function guardBanned() {
    document.body.innerHTML = `
      <div style="
        min-height:100dvh; display:flex; align-items:center; justify-content:center;
        background:#03030A; font-family:'Plus Jakarta Sans',sans-serif; text-align:center; padding:24px;
      ">
        <div style="max-width:340px;">
          <div style="font-size:52px; margin-bottom:16px;">🚫</div>
          <div style="font-family:'Bebas Neue',sans-serif; font-size:28px; letter-spacing:3px; color:#E0F2FE; margin-bottom:10px;">AKAUN DISEKAT</div>
          <p style="color:rgba(226,232,255,0.45); font-size:13px; line-height:1.7; margin-bottom:24px;">
            Akaun anda telah disekat oleh pentadbir.<br>
            Hubungi sokongan jika ini adalah kesilapan.
          </p>
          <a href="support.html" style="
            display:inline-block; padding:12px 24px; border-radius:12px;
            background:linear-gradient(135deg,#5B21B6,#7C3AED); color:#fff;
            font-weight:800; text-decoration:none; font-size:13px;
          ">Hubungi Sokongan</a>
          <div style="margin-top:14px;">
            <a href="#" onclick="(async()=>{await db.auth.signOut();location.href='login.html'})()" 
               style="font-size:12px; color:rgba(167,139,250,0.6); cursor:pointer; text-decoration:underline;">
              Log keluar
            </a>
          </div>
        </div>
      </div>`;
  }

  // ── RATE LIMITING ──────────────────────────────────────────
  function checkRateLimit(action) {
    const now = Date.now();
    const window = 60000; // 60 seconds
    const limit  = _limits[action] || _limits.default;

    if (!_calls[action]) _calls[action] = [];

    // Clean old timestamps
    _calls[action] = _calls[action].filter(t => now - t < window);

    if (_calls[action].length >= limit) {
      const oldest  = _calls[action][0];
      const waitSec = Math.ceil((window - (now - oldest)) / 1000);
      console.warn(`[Security] Rate limit: ${action} (${limit}/min). Wait ${waitSec}s`);
      return { allowed:false, waitSec };
    }

    _calls[action].push(now);
    return { allowed:true };
  }

  // ── INPUT SANITIZATION ─────────────────────────────────────
  function sanitize(str, maxLen = 500) {
    if (typeof str !== 'string') return '';
    return str.trim().slice(0, maxLen)
      .replace(/[<>]/g, '')      // no HTML injection
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '');
  }

  // ── AMOUNT VALIDATION ──────────────────────────────────────
  function validateAmount(amt, min = 0, max = 1000000) {
    const n = parseFloat(amt);
    if (isNaN(n) || !isFinite(n)) return { ok:false, err:'Jumlah tidak sah' };
    if (n < min)   return { ok:false, err:`Minimum RM${min.toFixed(2)}` };
    if (n > max)   return { ok:false, err:`Maksimum RM${max.toFixed(2)}` };
    if (n <= 0)    return { ok:false, err:'Jumlah mesti lebih dari sifar' };
    // Max 2 decimal places
    if (parseFloat(n.toFixed(2)) !== n && String(amt).includes('.') && String(amt).split('.')[1]?.length > 2)
      return { ok:false, err:'Maksimum 2 titik perpuluhan' };
    return { ok:true, val:parseFloat(n.toFixed(2)) };
  }

  // ── AUDIT LOG ─────────────────────────────────────────────
  async function audit(action, meta = {}) {
    if (!_session) return;
    try {
      await db.from('audit_log').insert([{
        user_id:    _session.user.id,
        action,
        meta:       JSON.stringify(meta),
        user_agent: navigator.userAgent.slice(0, 200),
        created_at: new Date().toISOString(),
      }]).catch(() => {});
    } catch(_) {}
  }

  // ── CSRF / TAMPER TOKEN ────────────────────────────────────
  function makeNonce() {
    const arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    return Array.from(arr, b => b.toString(16).padStart(2,'0')).join('');
  }

  // ── SESSION GETTER ─────────────────────────────────────────
  function getSession() { return _session; }
  function getProfile() { return _profile; }
  function getUserId()  { return _session?.user?.id || null; }

  // ── SIGN OUT ───────────────────────────────────────────────
  async function signOut() {
    await db.auth.signOut().catch(() => {});
    _session = null; _profile = null; _ready = false;
    location.href = 'login.html';
  }

  // ── PUBLIC API ─────────────────────────────────────────────
  return {
    init,
    guardSession,
    guardAdmin,
    guardBanned,
    checkRateLimit,
    sanitize,
    validateAmount,
    audit,
    makeNonce,
    getSession,
    getProfile,
    getUserId,
    signOut,
  };
})();
