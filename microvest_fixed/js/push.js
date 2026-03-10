/* ═══════════════════════════════════════════════════════════════
   MicroVest v10 — push.js
   Web Push Notification System
═══════════════════════════════════════════════════════════════ */

const Push = (() => {
  'use strict';

  /* ── VAPID Public Key ──────────────────────────────────────
     Replace with YOUR key from: https://web-push-codelab.glitch.me/
     OR generate locally:
       npx web-push generate-vapid-keys
     Then set VAPID_PUBLIC_KEY here AND in:
       netlify/functions/send-push.js  →  VAPID_PUBLIC_KEY
       supabase/functions/send-push/index.ts → vapidPublicKey
  ───────────────────────────────────────────────────────────── */
  const VAPID_RAW = '__VAPID_PUBLIC_KEY__';
  const VAPID_PUBLIC_KEY = (VAPID_RAW && !VAPID_RAW.startsWith('__'))
    ? VAPID_RAW
    : 'BEl62iUYgUivxIkv69yViEuiBIa40HI8yaFGvqIGBm2l3e0VHHy9Z_2bMO3vRcCUl13z_B8OLqn8c4mZPE4I'; // dev fallback

  const PUSH_ENABLED = VAPID_PUBLIC_KEY && VAPID_PUBLIC_KEY.length > 30;

  let _swReg    = null;
  let _userId   = null;
  let _prompted = false;

  /* ── urlBase64ToUint8Array ────────────────────────────── */
  function urlBase64ToUint8Array(base64String) {
    const padding  = '='.repeat((4 - base64String.length % 4) % 4);
    const base64   = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData  = atob(base64);
    return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
  }

  /* ── INIT ────────────────────────────────────────────── */
  async function init(userId) {
    _userId = userId;
    if (!PUSH_ENABLED) {
      console.warn('[Push] VAPID key not set. Push notifications disabled.');
      return false;
    }
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.log('[Push] Not supported in this browser.');
      return false;
    }
    try {
      _swReg = await navigator.serviceWorker.ready;
      const sub = await _swReg.pushManager.getSubscription();
      if (sub) {
        await _saveSubscription(sub);
        console.log('[Push] Already subscribed.');
      }
      return true;
    } catch (e) {
      console.error('[Push] Init error:', e);
      return false;
    }
  }

  /* ── SUBSCRIBE ───────────────────────────────────────── */
  async function subscribe() {
    if (!PUSH_ENABLED || !_swReg) return false;
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.log('[Push] Permission denied.');
        return false;
      }
      const sub = await _swReg.pushManager.subscribe({
        userVisibleOnly     : true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      await _saveSubscription(sub);
      console.log('[Push] Subscribed.');
      return true;
    } catch (e) {
      console.error('[Push] Subscribe error:', e);
      return false;
    }
  }

  /* ── UNSUBSCRIBE ─────────────────────────────────────── */
  async function unsubscribe() {
    if (!_swReg) return;
    try {
      const sub = await _swReg.pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
        await db.from('push_subscriptions').delete().eq('user_id', _userId).eq('endpoint', sub.endpoint);
        console.log('[Push] Unsubscribed.');
      }
    } catch (e) {
      console.error('[Push] Unsubscribe error:', e);
    }
  }

  /* ── SAVE SUBSCRIPTION ───────────────────────────────── */
  async function _saveSubscription(sub) {
    if (!_userId || !sub) return;
    const payload = {
      user_id  : _userId,
      endpoint : sub.endpoint,
      p256dh   : btoa(String.fromCharCode(...new Uint8Array(sub.getKey('p256dh')))),
      auth     : btoa(String.fromCharCode(...new Uint8Array(sub.getKey('auth')))),
      user_agent: navigator.userAgent.slice(0, 200),
      updated_at: new Date().toISOString(),
    };
    await db.from('push_subscriptions')
      .upsert(payload, { onConflict: 'user_id,endpoint' });
  }

  /* ── SOFT PROMPT ─────────────────────────────────────── */
  async function promptSoft(delay = 8000) {
    if (!PUSH_ENABLED || _prompted) return;
    if (Notification.permission !== 'default') return;
    _prompted = true;
    setTimeout(async () => {
      if (typeof UI !== 'undefined') {
        UI.confirm(
          '🔔 Aktif Notifikasi',
          'Dapatkan notifikasi segera apabila deposit diluluskan, mining selesai dan ganjaran diterima.',
          async () => { await subscribe(); },
          null,
          'Aktif Sekarang',
          'Nanti'
        );
      }
    }, delay);
  }

  /* ── LOCAL NOTIFICATION (in-app only) ───────────────── */
  function local(title, body, icon = '🔔') {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    try {
      new Notification(title, { body, icon: '/icons/icon-192.png', badge: '/icons/badge-72.png' });
    } catch (e) {
      console.warn('[Push] Local notification failed:', e);
    }
  }

  return { init, subscribe, unsubscribe, promptSoft, local };
})();
