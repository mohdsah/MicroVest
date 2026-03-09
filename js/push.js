/* ═══════════════════════════════════════════════════════════════
   MicroVest v8 — push.js
   Web Push Notification System
   ─────────────────────────────────────────────────────────────
   Features:
   • Subscribe / Unsubscribe Web Push
   • Save subscription to Supabase push_subscriptions table
   • Show permission prompt (smart — not annoying)
   • Local notification helper (in-app)
   • Supports Supabase Edge Function trigger (optional)
═══════════════════════════════════════════════════════════════ */

const Push = (() => {
  'use strict';

  // ── VAPID Public Key ──────────────────────────────────────
  // Replace with your actual VAPID public key from:
  // https://web-push-codelab.glitch.me/  OR
  // openssl ecparam -genkey -name prime256v1 -noout | openssl pkcs8 -topk8 -nocrypt | openssl ec -pubout
  const VAPID_PUBLIC_KEY = 'BEl62iUYgUivxIkv69yViEuiBIa40HI8yaFGvqIGBm2l3e0VHHy9Z_2bMO3vRcCUl13z_B8OLqn8c4mZPE4I';

  let _swReg    = null;
  let _userId   = null;
  let _prompted = false;

  // ── INIT ──────────────────────────────────────────────────
  async function init(userId) {
    _userId = userId;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.log('[Push] Not supported in this browser.');
      return false;
    }
    try {
      _swReg = await navigator.serviceWorker.ready;
      return true;
    } catch(e) {
      console.warn('[Push] SW not ready:', e);
      return false;
    }
  }

  // ── REQUEST PERMISSION ────────────────────────────────────
  async function requestPermission() {
    if (Notification.permission === 'granted') return 'granted';
    if (Notification.permission === 'denied')  return 'denied';
    const result = await Notification.requestPermission();
    return result;
  }

  // ── SMART PROMPT ─────────────────────────────────────────
  // Show a soft prompt before native dialog to reduce rejections
  async function promptSoft(onAccept, onDecline) {
    if (_prompted || Notification.permission !== 'default') return;
    _prompted = true;
    if (typeof UI !== 'undefined') {
      UI.confirm(
        '🔔 Aktifkan Notifikasi',
        'Dapatkan alert untuk deposit berjaya, keuntungan robot, dan pengumuman admin. Boleh nyahaktifkan bila-bila masa.',
        async () => {
          const perm = await requestPermission();
          if (perm === 'granted') {
            const ok = await subscribe();
            if (ok && onAccept) onAccept();
          }
        },
        'Aktifkan',
        onDecline
      );
    }
  }

  // ── URL BASE64 → Uint8Array helper ────────────────────────
  function urlB64ToUint8(b64) {
    const padding = '='.repeat((4 - b64.length % 4) % 4);
    const base64  = (b64 + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw     = window.atob(base64);
    const out     = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }

  // ── SUBSCRIBE ─────────────────────────────────────────────
  async function subscribe() {
    if (!_swReg || !_userId) return false;
    try {
      const perm = await requestPermission();
      if (perm !== 'granted') return false;

      const sub = await _swReg.pushManager.subscribe({
        userVisibleOnly:     true,
        applicationServerKey: urlB64ToUint8(VAPID_PUBLIC_KEY),
      });

      // Save subscription to Supabase
      await db.from('push_subscriptions').upsert([{
        user_id:      _userId,
        endpoint:     sub.endpoint,
        p256dh:       btoa(String.fromCharCode(...new Uint8Array(sub.getKey('p256dh')))),
        auth:         btoa(String.fromCharCode(...new Uint8Array(sub.getKey('auth')))),
        user_agent:   navigator.userAgent.slice(0, 200),
        active:       true,
        updated_at:   new Date().toISOString(),
      }], { onConflict:'endpoint' }).catch(() => {});

      console.log('[Push] Subscribed ✅');
      return true;
    } catch(e) {
      console.warn('[Push] Subscribe error:', e);
      return false;
    }
  }

  // ── UNSUBSCRIBE ───────────────────────────────────────────
  async function unsubscribe() {
    if (!_swReg) return;
    try {
      const sub = await _swReg.pushManager.getSubscription();
      if (sub) {
        await db.from('push_subscriptions')
          .update({ active:false, updated_at:new Date().toISOString() })
          .eq('endpoint', sub.endpoint)
          .catch(() => {});
        await sub.unsubscribe();
        console.log('[Push] Unsubscribed');
      }
    } catch(e) {
      console.warn('[Push] Unsubscribe error:', e);
    }
  }

  // ── GET STATUS ────────────────────────────────────────────
  async function getStatus() {
    if (!_swReg) return 'unsupported';
    if (!('PushManager' in window)) return 'unsupported';
    const perm = Notification.permission;
    if (perm === 'denied') return 'blocked';
    const sub = await _swReg.pushManager.getSubscription().catch(() => null);
    return sub ? 'active' : (perm === 'default' ? 'default' : 'inactive');
  }

  // ── LOCAL IN-APP NOTIFICATION ─────────────────────────────
  // Shows a styled toast-like notification when app is open
  function local(title, body, icon = '🔔', onClick = null) {
    const id  = 'push-local-' + Date.now();
    const el  = document.createElement('div');
    el.id     = id;
    el.style.cssText = `
      position:fixed; top:${68 + document.querySelectorAll('.push-local').length * 80}px;
      right:16px; z-index:8500; max-width:320px;
      background:rgba(12,12,32,0.96); backdrop-filter:blur(16px);
      border:1px solid rgba(109,40,217,0.25); border-radius:16px;
      padding:14px 16px; display:flex; align-items:flex-start; gap:12px;
      box-shadow:0 16px 48px rgba(0,0,0,0.6);
      animation:push-slide-in .35s cubic-bezier(0.34,1.56,0.64,1);
      cursor:${onClick?'pointer':'default'};
      font-family:'Plus Jakarta Sans',sans-serif;
    `;
    el.className = 'push-local';
    el.innerHTML = `
      <style>
        @keyframes push-slide-in{from{transform:translateX(120%);opacity:0}to{transform:none;opacity:1}}
        @keyframes push-slide-out{to{transform:translateX(120%);opacity:0}}
      </style>
      <div style="font-size:24px;flex-shrink:0;line-height:1">${icon}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:800;color:#E0F2FE;margin-bottom:3px">${title}</div>
        <div style="font-size:11px;color:rgba(226,232,255,0.5);line-height:1.5">${body}</div>
      </div>
      <button onclick="document.getElementById('${id}').remove()" style="
        background:none;border:none;color:rgba(226,232,255,0.3);cursor:pointer;font-size:14px;
        flex-shrink:0;padding:2px;
      ">✕</button>
    `;
    if (onClick) el.addEventListener('click', e => { if(e.target.tagName!=='BUTTON'){onClick();el.remove();} });
    document.body.appendChild(el);
    setTimeout(() => {
      if (document.getElementById(id)) {
        el.style.animation = 'push-slide-out .3s ease forwards';
        setTimeout(() => el.remove(), 300);
      }
    }, 5000);
  }

  return { init, subscribe, unsubscribe, promptSoft, getStatus, local, requestPermission };
})();
