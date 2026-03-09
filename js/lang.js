/* ═══════════════════════════════════════════════════════════
   MicroVest v6 — js/lang.js
   Multi-Language: ms · en · id · zh
   Usage: Lang.t('dashboard.balance') → 'Jumlah Baki'
          Lang.set('en') → switches instantly
          Lang.get() → 'ms'
═══════════════════════════════════════════════════════════ */

const Lang = {
  _current: 'ms',
  _cache:   {},

  LANGS: [
    { id:'ms', name:'Bahasa Melayu', flag:'🇲🇾' },
    { id:'en', name:'English',       flag:'🇬🇧' },
    { id:'id', name:'Bahasa Indonesia', flag:'🇮🇩' },
    { id:'zh', name:'中文',           flag:'🇨🇳' },
  ],

  /* ── TRANSLATION TABLES ─────────────────────────────────── */
  _data: {
    ms: {
      app: { name: 'MicroVest', tagline: 'Platform Pelaburan Premium' },
      nav: { home:'Laman', invest:'Labur', mining:'Mining', rewards:'Ganjaran', team:'Pasukan', market:'Pasaran', missions:'Misi', profile:'Profil' },
      dashboard: {
        greeting: 'Selamat Datang',
        balance: 'Jumlah Baki',
        total_deposit: 'Total Deposit',
        total_profit: 'Total Profit',
        daily_mining: 'Mining Harian',
        live_feed: 'Feed Langsung',
        quick_actions: 'Tindakan Pantas',
        platform_stats: 'Statistik Platform',
        active_plans: 'Plan Aktif',
        no_plans: 'Tiada pelaburan aktif',
      },
      wallet: {
        title: 'Dompet Saya',
        main: 'Dompet Utama',
        mining: 'Dompet Mining',
        bonus: 'Dompet Bonus',
        deposit: 'Deposit',
        withdraw: 'Withdraw',
        transfer: 'Pindah ke Utama',
        history: 'Sejarah',
      },
      missions: {
        title: 'Misi & Pencapaian',
        daily: 'Misi Harian',
        invest: 'Misi Pelaburan',
        team: 'Misi Pasukan',
        mining: 'Misi Mining',
        vip: 'Misi VIP',
        completed: 'Selesai',
        in_progress: 'Dalam Proses',
        locked: 'Terkunci',
        claim: 'Tuntut',
        reward: 'Ganjaran',
      },
      market: {
        title: 'Pasaran MVT',
        price: 'Harga Token',
        volume: 'Isipadu 24j',
        supply: 'Bekalan Beredar',
        my_balance: 'Baki MVT Saya',
        buy: 'Beli MVT',
        use_mvt: 'Guna MVT',
      },
      common: {
        loading: 'Memuatkan...',
        save: 'Simpan',
        cancel: 'Batal',
        confirm: 'Sahkan',
        back: 'Balik',
        next: 'Seterusnya',
        close: 'Tutup',
        copy: 'Salin',
        share: 'Kongsi',
        success: 'Berjaya!',
        error: 'Ralat',
        warning: 'Amaran',
        rm: 'RM',
        mvt: 'MVT',
        day: 'hari',
        days: 'hari',
        profit: 'Profit',
        daily: 'Harian',
        total: 'Jumlah',
        active: 'Aktif',
        inactive: 'Tidak Aktif',
        yes: 'Ya',
        no: 'Tidak',
      },
    },
    en: {
      app: { name: 'MicroVest', tagline: 'Premium Investment Platform' },
      nav: { home:'Home', invest:'Invest', mining:'Mining', rewards:'Rewards', team:'Team', market:'Market', missions:'Missions', profile:'Profile' },
      dashboard: {
        greeting: 'Welcome Back',
        balance: 'Total Balance',
        total_deposit: 'Total Deposit',
        total_profit: 'Total Profit',
        daily_mining: 'Daily Mining',
        live_feed: 'Live Feed',
        quick_actions: 'Quick Actions',
        platform_stats: 'Platform Stats',
        active_plans: 'Active Plans',
        no_plans: 'No active investments',
      },
      wallet: {
        title: 'My Wallet',
        main: 'Main Wallet',
        mining: 'Mining Wallet',
        bonus: 'Bonus Wallet',
        deposit: 'Deposit',
        withdraw: 'Withdraw',
        transfer: 'Transfer to Main',
        history: 'History',
      },
      missions: {
        title: 'Missions & Achievements',
        daily: 'Daily Missions',
        invest: 'Investment Missions',
        team: 'Team Missions',
        mining: 'Mining Missions',
        vip: 'VIP Missions',
        completed: 'Completed',
        in_progress: 'In Progress',
        locked: 'Locked',
        claim: 'Claim',
        reward: 'Reward',
      },
      market: {
        title: 'MVT Market',
        price: 'Token Price',
        volume: '24h Volume',
        supply: 'Circulating Supply',
        my_balance: 'My MVT Balance',
        buy: 'Buy MVT',
        use_mvt: 'Use MVT',
      },
      common: {
        loading: 'Loading...', save: 'Save', cancel: 'Cancel', confirm: 'Confirm',
        back: 'Back', next: 'Next', close: 'Close', copy: 'Copy', share: 'Share',
        success: 'Success!', error: 'Error', warning: 'Warning',
        rm: 'RM', mvt: 'MVT', day: 'day', days: 'days',
        profit: 'Profit', daily: 'Daily', total: 'Total',
        active: 'Active', inactive: 'Inactive', yes: 'Yes', no: 'No',
      },
    },
    id: {
      app: { name: 'MicroVest', tagline: 'Platform Investasi Premium' },
      nav: { home:'Beranda', invest:'Investasi', mining:'Mining', rewards:'Hadiah', team:'Tim', market:'Pasar', missions:'Misi', profile:'Profil' },
      dashboard: {
        greeting: 'Selamat Datang Kembali',
        balance: 'Total Saldo',
        total_deposit: 'Total Deposit',
        total_profit: 'Total Profit',
        daily_mining: 'Mining Harian',
        live_feed: 'Feed Langsung',
        quick_actions: 'Aksi Cepat',
        platform_stats: 'Statistik Platform',
        active_plans: 'Rencana Aktif',
        no_plans: 'Tidak ada investasi aktif',
      },
      wallet: {
        title: 'Dompet Saya',
        main: 'Dompet Utama',
        mining: 'Dompet Mining',
        bonus: 'Dompet Bonus',
        deposit: 'Deposit', withdraw: 'Tarik Dana', transfer: 'Pindah ke Utama', history: 'Riwayat',
      },
      missions: {
        title: 'Misi & Pencapaian', daily: 'Misi Harian', invest: 'Misi Investasi',
        team: 'Misi Tim', mining: 'Misi Mining', vip: 'Misi VIP',
        completed: 'Selesai', in_progress: 'Berlangsung', locked: 'Terkunci',
        claim: 'Klaim', reward: 'Hadiah',
      },
      market: {
        title: 'Pasar MVT', price: 'Harga Token', volume: 'Volume 24j',
        supply: 'Pasokan Beredar', my_balance: 'Saldo MVT Saya', buy: 'Beli MVT', use_mvt: 'Gunakan MVT',
      },
      common: {
        loading: 'Memuat...', save: 'Simpan', cancel: 'Batal', confirm: 'Konfirmasi',
        back: 'Kembali', next: 'Berikutnya', close: 'Tutup', copy: 'Salin', share: 'Bagikan',
        success: 'Berhasil!', error: 'Kesalahan', warning: 'Peringatan',
        rm: 'RM', mvt: 'MVT', day: 'hari', days: 'hari',
        profit: 'Profit', daily: 'Harian', total: 'Total',
        active: 'Aktif', inactive: 'Tidak Aktif', yes: 'Ya', no: 'Tidak',
      },
    },
    zh: {
      app: { name: 'MicroVest', tagline: '高级投资平台' },
      nav: { home:'首页', invest:'投资', mining:'挖矿', rewards:'奖励', team:'团队', market:'市场', missions:'任务', profile:'个人' },
      dashboard: {
        greeting: '欢迎回来',
        balance: '总余额',
        total_deposit: '总存款',
        total_profit: '总利润',
        daily_mining: '每日挖矿',
        live_feed: '实时动态',
        quick_actions: '快速操作',
        platform_stats: '平台统计',
        active_plans: '活跃计划',
        no_plans: '暂无投资',
      },
      wallet: {
        title: '我的钱包',
        main: '主钱包', mining: '挖矿钱包', bonus: '奖励钱包',
        deposit: '存款', withdraw: '提款', transfer: '转到主钱包', history: '历史',
      },
      missions: {
        title: '任务与成就', daily: '每日任务', invest: '投资任务',
        team: '团队任务', mining: '挖矿任务', vip: 'VIP任务',
        completed: '已完成', in_progress: '进行中', locked: '已锁定',
        claim: '领取', reward: '奖励',
      },
      market: {
        title: 'MVT市场', price: '代币价格', volume: '24小时量',
        supply: '流通供应', my_balance: '我的MVT', buy: '购买MVT', use_mvt: '使用MVT',
      },
      common: {
        loading: '加载中...', save: '保存', cancel: '取消', confirm: '确认',
        back: '返回', next: '下一步', close: '关闭', copy: '复制', share: '分享',
        success: '成功！', error: '错误', warning: '警告',
        rm: 'RM', mvt: 'MVT', day: '天', days: '天',
        profit: '利润', daily: '每日', total: '总计',
        active: '活跃', inactive: '不活跃', yes: '是', no: '否',
      },
    },
  },

  /* ── API ────────────────────────────────────────────────── */
  t(key) {
    const parts = key.split('.');
    let obj = this._data[this._current] || this._data.ms;
    for (const p of parts) { obj = obj?.[p]; if (obj === undefined) break; }
    // Fallback to ms
    if (obj === undefined) {
      let fb = this._data.ms;
      for (const p of parts) { fb = fb?.[p]; if (fb === undefined) break; }
      return fb || key;
    }
    return obj || key;
  },

  set(langId) {
    if (!this._data[langId]) return;
    this._current = langId;
    localStorage.setItem('mv6_lang', langId);
    this._apply();
  },

  get() { return this._current; },

  init() {
    const saved = localStorage.getItem('mv6_lang') || navigator.language.split('-')[0] || 'ms';
    this._current = this._data[saved] ? saved : 'ms';
    this._apply();
  },

  /* ── AUTO-TRANSLATE DOM ELEMENTS WITH data-i18n ─────────── */
  _apply() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const val = this.t(el.dataset.i18n);
      if (val) el.textContent = val;
    });
    document.querySelectorAll('[data-i18n-ph]').forEach(el => {
      const val = this.t(el.dataset.i18nPh);
      if (val) el.placeholder = val;
    });
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const val = this.t(el.dataset.i18nTitle);
      if (val) el.title = val;
    });
    document.documentElement.lang = this._current;
  },

  /* ── LANG SWITCHER WIDGET ───────────────────────────────── */
  renderSwitcher(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = this.LANGS.map(l => `
      <button onclick="Lang.set('${l.id}')" style="
        padding:8px 14px; border-radius:999px; border:1px solid;
        font-family:'Instrument Sans',sans-serif; font-size:12px; font-weight:700;
        cursor:pointer; transition:.2s; display:flex; align-items:center; gap:6px;
        background:${l.id===this._current?'rgba(124,58,237,0.15)':'transparent'};
        border-color:${l.id===this._current?'rgba(124,58,237,0.4)':'rgba(255,255,255,0.07)'};
        color:${l.id===this._current?'#A78BFA':'#8B95BB'};
      ">
        <span>${l.flag}</span> ${l.name}
      </button>`).join('');
  },
};
