/* ═══════════════════════════════════════════════════════════
   MicroVest v6 — js/realtime.js
   Real-Time System: Live feed · Supabase channels · Push notify
   Every table event auto-propagates to UI without page refresh
═══════════════════════════════════════════════════════════ */

const RT = {
  _channels:  [],
  _feedItems: [],
  _maxFeed:   30,

  /* ── FEED EVENT TYPES ──────────────────────────────────── */
  EVENTS: {
    deposit:    { icon:'💰', color:'#22C55E', fmt:(d) => `<span class="hi">${RT._mask(d.user_email)}</span> deposit <span style="color:var(--profit);font-weight:800">RM${Number(d.amount).toFixed(2)}</span>` },
    withdraw:   { icon:'💸', color:'#EF4444', fmt:(d) => `<span class="hi">${RT._mask(d.user_email)}</span> withdraw <span style="color:var(--loss);font-weight:800">RM${Number(d.amount).toFixed(2)}</span>` },
    invest:     { icon:'📈', color:'#7C3AED', fmt:(d) => `<span class="hi">${RT._mask(d.user_email)}</span> labur <span style="color:var(--v-pale);font-weight:800">RM${Number(d.amount).toFixed(2)}</span> plan ${d.plan_id||''}` },
    mining:     { icon:'⛏️', color:'#F97316', fmt:(d) => `<span class="hi">${RT._mask(d.user_email)}</span> kutip mining <span style="color:var(--o-bright);font-weight:800">RM${Number(d.amount).toFixed(2)}</span>` },
    referral:   { icon:'👥', color:'#8B5CF6', fmt:(d) => `<span class="hi">${RT._mask(d.user_email)}</span> dapat komisen <span style="color:var(--v-pale);font-weight:800">RM${Number(d.amount).toFixed(2)}</span>` },
    achievement:{ icon:'🏆', color:'#EAB308', fmt:(d) => `<span class="hi">${RT._mask(d.user_email)}</span> unlocked badge <span style="color:var(--gold);font-weight:800">${d.badge_id||''}</span>` },
    vip:        { icon:'👑', color:'#EAB308', fmt:(d) => `<span class="hi">${RT._mask(d.user_email)}</span> naik ke rank <span style="color:var(--gold);font-weight:800">${d.rank||''}</span>` },
  },

  _mask(email = '') {
    const name = email.split('@')[0];
    return name.length > 4 ? name.slice(0, 3) + '***' : name + '***';
  },

  /* ── PUSH FEED ITEM ────────────────────────────────────── */
  pushFeedItem(type, data) {
    const def = this.EVENTS[type];
    if (!def) return;
    const item = { type, data, icon: def.icon, color: def.color, ts: new Date() };
    this._feedItems.unshift(item);
    if (this._feedItems.length > this._maxFeed) this._feedItems.pop();
    this._renderFeedItem(item);
  },

  _renderFeedItem(item) {
    const feed = document.getElementById('liveList');
    if (!feed) return;
    const def = this.EVENTS[item.type];
    const el = document.createElement('div');
    el.className = 'feed-item';
    el.innerHTML = `
      <div class="feed-icon">${item.icon}</div>
      <div class="feed-msg">${def.fmt(item.data)}</div>
      <div class="feed-time">${UI.time(item.ts)}</div>`;
    el.style.animationDelay = '0s';
    feed.insertBefore(el, feed.firstChild);

    // Trim excess
    while (feed.children.length > this._maxFeed) feed.removeChild(feed.lastChild);

    // Update counter badge
    const badge = document.getElementById('liveCount');
    if (badge) {
      const n = parseInt(badge.textContent || 0) + 1;
      badge.textContent = n;
      badge.style.display = 'inline';
    }
  },

  /* ── SUBSCRIBE: GLOBAL TRANSACTION FEED ───────────────── */
  subscribeGlobalFeed() {
    const ch = db.channel('global-feed')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'transactions',
      }, async payload => {
        const tx = payload.new;
        // Get user email for display
        const { data: p } = await db.from('profiles').select('email').eq('id', tx.user_id).single();
        this.pushFeedItem(tx.type, { ...tx, user_email: p?.email || 'user' });

        // Desktop notification if permission granted
        if (Notification.permission === 'granted') {
          const def = this.EVENTS[tx.type];
          if (def) {
            new Notification('MicroVest', {
              body: `${def.icon} ${this._mask(p?.email)} — RM${Number(tx.amount).toFixed(2)}`,
              icon: '/icons/icon-192.png',
              tag:  'mv6-feed',
              silent: true,
            });
          }
        }
      })
      .subscribe();
    this._channels.push(ch);
    return ch;
  },

  /* ── SUBSCRIBE: USER PROFILE CHANGES ──────────────────── */
  subscribeProfile(userId, onUpdate) {
    const ch = db.channel(`profile:${userId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'profiles',
        filter: `id=eq.${userId}`,
      }, payload => onUpdate(payload.new))
      .subscribe();
    this._channels.push(ch);
    return ch;
  },

  /* ── SUBSCRIBE: USER NOTIFICATIONS ────────────────────── */
  subscribeNotifications(userId, onNew) {
    const ch = db.channel(`notifs:${userId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${userId}`,
      }, payload => {
        onNew(payload.new);
        this._showInAppNotif(payload.new.message);
      })
      .subscribe();
    this._channels.push(ch);
    return ch;
  },

  /* ── SUBSCRIBE: MINING REWARDS (auto-claim completed) ── */
  subscribeMiningRewards(userId, onClaim) {
    const ch = db.channel(`mining:${userId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'user_machines',
        filter: `user_id=eq.${userId}`,
      }, payload => {
        if (payload.new.auto_claimed_at && payload.new.auto_claimed_at !== payload.old?.auto_claimed_at) {
          onClaim(payload.new);
        }
      })
      .subscribe();
    this._channels.push(ch);
    return ch;
  },

  /* ── SUBSCRIBE: WITHDRAW STATUS ────────────────────────── */
  subscribeWithdraws(userId, onChange) {
    const ch = db.channel(`withdraws:${userId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'transactions',
        filter: `user_id=eq.${userId}`,
      }, payload => {
        const tx = payload.new;
        if (tx.type === 'withdraw' && tx.status !== payload.old?.status) {
          onChange(tx);
          const msg = tx.status === 'approved'
            ? `✅ Withdraw RM${tx.amount} telah diluluskan!`
            : `❌ Withdraw RM${tx.amount} ditolak: ${tx.rejection_reason || '—'}`;
          UI.toast(msg, tx.status === 'approved' ? 'success' : 'error', 5000);
        }
      })
      .subscribe();
    this._channels.push(ch);
    return ch;
  },

  /* ── IN-APP NOTIFICATION BANNER ────────────────────────── */
  _showInAppNotif(msg) {
    const el = document.createElement('div');
    el.innerHTML = `<span style="font-size:14px">🔔</span> <span>${msg}</span>`;
    Object.assign(el.style, {
      position: 'fixed', top: '70px', left: '50%',
      transform: 'translateX(-50%) translateY(-120%)',
      background: 'rgba(10,10,22,0.97)',
      border: '1px solid rgba(124,58,237,0.3)',
      color: '#E2E8FF', padding: '12px 20px', borderRadius: '20px',
      fontFamily: "'Instrument Sans',sans-serif", fontSize: '13px', fontWeight: '600',
      boxShadow: '0 12px 40px rgba(0,0,0,0.7)',
      zIndex: '9998', maxWidth: '340px', textAlign: 'center',
      display: 'flex', alignItems: 'center', gap: '10px',
      transition: 'transform 0.4s cubic-bezier(0.34,1.56,0.64,1)',
    });
    document.body.appendChild(el);
    requestAnimationFrame(() => { el.style.transform = 'translateX(-50%) translateY(0)'; });
    setTimeout(() => {
      el.style.transform = 'translateX(-50%) translateY(-130%)';
      setTimeout(() => el.remove(), 400);
    }, 4000);
  },

  /* ── REQUEST PUSH PERMISSION ────────────────────────────── */
  async requestPush() {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    const result = await Notification.requestPermission();
    return result === 'granted';
  },

  /* ── REGISTER SERVICE WORKER ────────────────────────────── */
  async registerSW() {
    if (!('serviceWorker' in navigator)) return;
    try {
      const reg = await navigator.serviceWorker.register('/service-worker.js');
      console.log('[SW] Registered:', reg.scope);
      return reg;
    } catch (err) {
      console.warn('[SW] Registration failed:', err);
    }
  },

  /* ── CLEANUP ─────────────────────────────────────────────── */
  destroy() {
    this._channels.forEach(ch => db.removeChannel(ch));
    this._channels = [];
  },

  /* ── POPULATE DEMO FEED (if no live data yet) ────────────── */
  populateDemoFeed() {
    const demos = [
      { type:'deposit',  data:{ user_email:'user872@mail.com', amount:200 } },
      { type:'invest',   data:{ user_email:'user451@mail.com', amount:500, plan_id:'Gold' } },
      { type:'mining',   data:{ user_email:'user993@mail.com', amount:5.40 } },
      { type:'withdraw', data:{ user_email:'user128@mail.com', amount:150 } },
      { type:'referral', data:{ user_email:'vip_lex@mail.com', amount:12.50 } },
      { type:'vip',      data:{ user_email:'user771@mail.com', rank:'Diamond' } },
    ];
    demos.forEach((d, i) => setTimeout(() => this.pushFeedItem(d.type, d.data), i * 400));
  },
};
