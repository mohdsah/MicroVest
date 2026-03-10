/* ═══════════════════════════════════════════════════════════════
   MicroVest v9 — js/theme.js
   Theme Engine: Dark / Light / Auto
   ─────────────────────────────────────────────────────────────
   Theme.init()          → call on page load (already auto-inits)
   Theme.set('dark'|'light'|'auto')
   Theme.toggle()        → cycle dark ↔ light
   Theme.getCurrent()    → 'dark' | 'light'
   Theme.autoInjectToggle() → add button to .tb-actions
═══════════════════════════════════════════════════════════════ */

const Theme = (() => {
  'use strict';

  const LIGHT = {
    '--abyss':'#F0F4FF','--pit':'#E8EEFF','--well':'#DDE3FF',
    '--vault':'#CED6FF','--surface':'rgba(240,244,255,0.97)',
    '--surf':'rgba(232,238,255,0.9)',
    '--glass':'rgba(0,0,0,0.04)','--glass-hi':'rgba(0,0,0,0.08)',
    '--plasma':'#5B21B6','--plasma-bright':'#6D28D9',
    '--plasma-pale':'#4C1D95','--plasma-dim':'rgba(91,33,182,0.08)',
    '--plasma-glow':'rgba(91,33,182,0.2)','--plasma-border':'rgba(91,33,182,0.2)',
    '--torch':'#D97706','--torch-bright':'#B45309',
    '--torch-dim':'rgba(217,119,6,0.08)','--torch-glow':'rgba(217,119,6,0.2)',
    '--torch-border':'rgba(217,119,6,0.2)',
    '--glacier':'#1E1B4B','--glacier-2':'#3730A3',
    '--ice':'#1E1B4B','--ice-2':'#3730A3','--ice-3':'#6B7280','--ice-4':'#E5E7EB',
    '--profit':'#059669','--profit-dim':'rgba(5,150,105,0.08)',
    '--loss':'#DC2626','--loss-dim':'rgba(220,38,38,0.08)',
    '--gold':'#D97706','--gold-dim':'rgba(217,119,6,0.08)',
    '--border':'rgba(0,0,0,0.08)','--border-hi':'rgba(0,0,0,0.14)',
    '--border-v':'rgba(91,33,182,0.15)',
    '--shadow-v':'0 20px 60px rgba(91,33,182,0.12)',
    '--shadow-d':'0 30px 80px rgba(0,0,0,0.1)',
    '--shadow-card':'0 4px 24px rgba(0,0,0,0.07)',
    /* v6 compat */
    '--v':'#5B21B6','--v-bright':'#6D28D9','--v-pale':'#4C1D95',
    '--v-dim':'rgba(91,33,182,0.08)','--v-glow':'rgba(91,33,182,0.2)',
    '--v-border':'rgba(91,33,182,0.2)','--o':'#D97706','--void':'#F0F4FF',
  };

  let _pref = 'dark', _cur = 'dark', _mq = null;

  function _apply(theme) {
    _cur = theme;
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.add('theme-light');
      for (const [k,v] of Object.entries(LIGHT)) root.style.setProperty(k, v);
    } else {
      root.classList.remove('theme-light');
      for (const k of Object.keys(LIGHT)) root.style.removeProperty(k);
    }
    const m = document.querySelector('meta[name="theme-color"]');
    if (m) m.content = theme === 'light' ? '#F0F4FF' : '#03030A';
    document.querySelectorAll('[data-theme-toggle]').forEach(el => {
      el.innerHTML = theme === 'light' ? '<i class="fas fa-moon"></i>' : '<i class="fas fa-sun"></i>';
      el.title = theme === 'light' ? 'Mod Gelap' : 'Mod Cerah';
    });
    window.dispatchEvent(new CustomEvent('themechange', { detail:{ theme } }));
  }

  function _resolve(p) {
    return p === 'auto'
      ? (window.matchMedia('(prefers-color-scheme:light)').matches ? 'light' : 'dark')
      : p;
  }

  function init() {
    _pref = localStorage.getItem('mv-theme') || 'dark';
    _apply(_resolve(_pref));
    _mq = window.matchMedia('(prefers-color-scheme:light)');
    _mq.addEventListener('change', () => { if (_pref==='auto') _apply(_resolve('auto')); });
    return _cur;
  }

  function set(p) {
    if (!['dark','light','auto'].includes(p)) return;
    _pref = p;
    localStorage.setItem('mv-theme', p);
    _apply(_resolve(p));
    if (typeof db !== 'undefined' && typeof Security !== 'undefined') {
      const uid = Security.getUserId();
      if (uid) db.from('profiles').update({ui_theme:p}).eq('id',uid).then(()=>{}).catch(()=>{});
    }
  }

  function toggle() { set(_cur==='dark'?'light':'dark'); return _cur; }

  function renderToggle(container, cls='') {
    if (!container) return;
    const btn = document.createElement('button');
    btn.setAttribute('data-theme-toggle','1');
    btn.className = cls||'tb-btn';
    btn.style.cursor = 'pointer';
    btn.title = _cur==='light'?'Mod Gelap':'Mod Cerah';
    btn.innerHTML = _cur==='light'?'<i class="fas fa-moon"></i>':'<i class="fas fa-sun"></i>';
    btn.onclick = () => toggle();
    container.appendChild(btn);
    return btn;
  }

  function autoInjectToggle() {
    const el = document.querySelector('.tb-actions,.topbar-right,.admin-topbar-right');
    if (el && !el.querySelector('[data-theme-toggle]')) renderToggle(el);
  }

  function getCurrent() { return _cur; }
  function getPref()    { return _pref; }
  function isLight()    { return _cur==='light'; }

  return { init, set, toggle, getCurrent, getPref, isLight, renderToggle, autoInjectToggle };
})();

// Init before paint to prevent FOUC
(function(){ Theme.init(); })();
window.addEventListener('load', () => Theme.autoInjectToggle(), { once:true });
