/* ═══════════════════════════════════════════════════════════
   MicroVest v6 — js/ui.js
   Skeleton · Toast · Modal · Counter · Formatters · i18n bridge
═══════════════════════════════════════════════════════════ */

const UI = {

  /* ── TOAST ──────────────────────────────────────────────── */
  _toast: null, _toastT: null,
  toast(msg, type = 'success', ms = 3400) {
    if (this._toast) this._toast.remove();
    clearTimeout(this._toastT);
    const bg = { success:'#22C55E', error:'#EF4444', warning:'#EAB308', info:'rgba(10,10,22,0.98)' }[type] || '#22C55E';
    const fg = type === 'warning' ? '#000' : type === 'success' ? '#000' : '#fff';
    const el = Object.assign(document.createElement('div'), {
      innerHTML: `<span style="font-size:14px">${msg}</span>`,
    });
    Object.assign(el.style, {
      position:'fixed', top:'20px', left:'50%',
      transform:'translateX(-50%) translateY(-130%) scale(0.85)',
      background:bg, color:fg,
      padding:'13px 22px', borderRadius:'20px',
      fontFamily:"'Instrument Sans',sans-serif", fontWeight:'700', fontSize:'13px',
      boxShadow:'0 16px 48px rgba(0,0,0,0.6)',
      border: type==='info'?'1px solid rgba(255,255,255,0.08)':'none',
      zIndex:'9999', maxWidth:'340px', textAlign:'center',
      transition:'transform 0.42s cubic-bezier(0.34,1.56,0.64,1), opacity 0.3s ease',
    });
    document.body.appendChild(el);
    this._toast = el;
    requestAnimationFrame(() => { el.style.transform = 'translateX(-50%) translateY(0) scale(1)'; });
    this._toastT = setTimeout(() => {
      el.style.transform = 'translateX(-50%) translateY(-120%) scale(0.85)';
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 380);
    }, ms);
  },

  /* ── LOADING OVERLAY ────────────────────────────────────── */
  _loadEl: null,
  loading(msg = '') {
    if (this._loadEl) return;
    const el = document.createElement('div');
    el.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;gap:16px">
        <div style="width:42px;height:42px;border:2px solid rgba(124,58,237,0.15);border-top-color:#7C3AED;border-radius:50%;animation:spin .75s linear infinite"></div>
        ${msg?`<span style="font-size:12px;color:#8B95BB;font-family:'Instrument Sans',sans-serif;font-weight:600">${msg}</span>`:''}
      </div>
      <style>@keyframes spin{to{transform:rotate(360deg)}}</style>`;
    Object.assign(el.style, {
      position:'fixed', inset:'0', background:'rgba(2,2,6,0.85)',
      backdropFilter:'blur(16px)', display:'flex',
      alignItems:'center', justifyContent:'center', zIndex:'9990',
      animation:'bg-fade .25s ease',
    });
    document.body.appendChild(el);
    this._loadEl = el;
  },
  unload() { if (this._loadEl) { this._loadEl.remove(); this._loadEl = null; } },

  /* ── CONFIRM MODAL ──────────────────────────────────────── */
  confirm(title, body, onOk, okLabel = 'Ya', danger = false) {
    const w = document.createElement('div');
    w.innerHTML = `
      <div style="position:fixed;inset:0;background:rgba(0,0,0,0.88);backdrop-filter:blur(18px);z-index:9980;display:flex;align-items:center;justify-content:center;padding:20px;animation:bg-fade .3s ease">
        <div style="background:linear-gradient(145deg,#10101E,#06060E);border:1px solid rgba(255,255,255,0.09);border-radius:28px;padding:28px 24px;max-width:320px;width:100%;animation:rise .42s cubic-bezier(0.34,1.56,0.64,1) both">
          <div style="font-family:'DM Serif Display',serif;font-size:20px;margin-bottom:9px">${title}</div>
          <p style="font-size:13px;color:#8B95BB;line-height:1.65;margin-bottom:22px">${body}</p>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <button id="__c" style="padding:14px;border-radius:14px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);color:#8B95BB;font-weight:700;cursor:pointer;font-family:'Instrument Sans',sans-serif">Batal</button>
            <button id="__o" style="padding:14px;border-radius:14px;background:${danger?'linear-gradient(135deg,#DC2626,#EF4444)':'linear-gradient(135deg,#5B21B6,#7C3AED)'};border:none;color:#fff;font-weight:800;cursor:pointer;font-family:'Instrument Sans',sans-serif">${okLabel}</button>
          </div>
        </div>
      </div>
      <style>@keyframes bg-fade{from{opacity:0}to{opacity:1}} @keyframes rise{from{opacity:0;transform:scale(0.88) translateY(22px)}to{opacity:1;transform:scale(1) translateY(0)}}</style>`;
    document.body.appendChild(w);
    w.querySelector('#__c').onclick = () => w.remove();
    w.querySelector('#__o').onclick = () => { w.remove(); onOk(); };
    return w;
  },

  /* ── SKELETON LOADER ────────────────────────────────────── */
  skeleton(container, rows = 3, type = 'card') {
    const templates = {
      card: `<div style="background:rgba(10,10,22,0.94);border:1px solid rgba(255,255,255,0.04);border-radius:22px;padding:20px;margin-bottom:12px">
              <div class="skel skel-text" style="width:40%;height:12px;margin-bottom:10px;border-radius:6px"></div>
              <div class="skel skel-val"  style="width:55%;height:28px;margin-bottom:14px;border-radius:8px"></div>
              <div class="skel" style="height:5px;width:100%;border-radius:4px"></div></div>`,
      row: `<div style="display:flex;align-items:center;gap:12px;padding:14px 0;border-bottom:1px solid rgba(255,255,255,0.04)">
              <div class="skel" style="width:40px;height:40px;border-radius:14px;flex-shrink:0"></div>
              <div style="flex:1"><div class="skel" style="width:55%;height:12px;border-radius:6px;margin-bottom:7px"></div>
              <div class="skel" style="width:35%;height:10px;border-radius:5px"></div></div>
              <div class="skel" style="width:60px;height:14px;border-radius:6px"></div></div>`,
    };
    container.innerHTML = Array(rows).fill(templates[type] || templates.card).join('');
  },

  /* ── COUNT-UP ───────────────────────────────────────────── */
  count(el, to, prefix = '', dur = 1200, dec = 2) {
    if (!el) return;
    const start = performance.now();
    const from  = parseFloat(el.textContent.replace(/[^0-9.]/g, '')) || 0;
    const ease  = t => 1 - Math.pow(1 - t, 3);
    const tick  = now => {
      const t = Math.min((now - start) / dur, 1);
      const v = from + (to - from) * ease(t);
      el.textContent = prefix + (dec > 0 ? v.toFixed(dec) : Math.round(v).toLocaleString());
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  },

  /* ── FORMATTERS ─────────────────────────────────────────── */
  rm(n)  { return 'RM ' + Number(n || 0).toFixed(2); },
  pct(n) { return (n >= 0 ? '+' : '') + Number(n || 0).toFixed(2) + '%'; },
  big(n) { return Number(n || 0).toLocaleString('ms-MY'); },
  k(n)   { const v = Number(n || 0); return v >= 1e6 ? (v/1e6).toFixed(1)+'M' : v >= 1000 ? (v/1000).toFixed(1)+'K' : v.toFixed(0); },
  date(s){ return s ? new Date(s).toLocaleDateString('ms-MY', {day:'2-digit',month:'short',year:'numeric'}) : '—'; },
  time(s){ return s ? new Date(s).toLocaleTimeString('ms-MY', {hour:'2-digit',minute:'2-digit'}) : '—'; },
  ago(s) {
    if (!s) return '—';
    const sec = (Date.now() - new Date(s)) / 1000;
    if (sec < 60)    return `${Math.round(sec)}s lalu`;
    if (sec < 3600)  return `${Math.round(sec/60)}m lalu`;
    if (sec < 86400) return `${Math.round(sec/3600)}j lalu`;
    return `${Math.round(sec/86400)}h lalu`;
  },
  countdown(end) {
    const d = new Date(end) - Date.now();
    if (d <= 0) return 'Tamat';
    const h = Math.floor(d / 3600000), m = Math.floor((d % 3600000) / 60000);
    const days = Math.floor(d / 86400000);
    return days > 0 ? `${days}h ${h % 24}j` : `${h}j ${m}m`;
  },
  mvt(n) { return Number(n || 0).toFixed(0) + ' MVT'; },

  /* ── COIN BURST ─────────────────────────────────────────── */
  burst(x, y, n = 10) {
    ['💜','🪙','✨','⚡','🎯'].forEach((e, i) => {
      if (i >= n/2) return;
      for (let j = 0; j < 2; j++) {
        const el = Object.assign(document.createElement('div'), { textContent: e });
        const ang = Math.random() * Math.PI * 2, dist = 50 + Math.random() * 90;
        Object.assign(el.style, {
          position:'fixed', left:x+'px', top:y+'px', fontSize:(12+Math.random()*14)+'px',
          zIndex:'9995', pointerEvents:'none', userSelect:'none',
          transition:`all ${0.6+Math.random()*0.6}s cubic-bezier(0,0,0.2,1)`,
        });
        document.body.appendChild(el);
        requestAnimationFrame(() => {
          el.style.transform = `translate(${Math.cos(ang)*dist}px,${Math.sin(ang)*dist-50}px)`;
          el.style.opacity = '0';
        });
        setTimeout(() => el.remove(), 1400);
      }
    });
  },
};
