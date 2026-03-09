/* ═══════════════════════════════════════════════════════════
   MicroVest v6 — js/config.js
   Supabase project: zmyiaviafmmwpgxfvsbq
═══════════════════════════════════════════════════════════ */

/* ── Supabase Configuration ─────────────────────────────────────
   Values are injected by Netlify Edge Function (inject-env.js)
   OR by GitHub Actions CI/CD pipeline on deploy.
   For local dev, create a .env.local file with:
     SUPABASE_URL=https://zmyiaviafmmwpgxfvsbq.supabase.co
     SUPABASE_ANON_KEY=your_anon_key
   Then run: npm run dev (uses netlify dev)
─────────────────────────────────────────────────────────────── */
const SUPA_URL = '__SUPA_URL__' !== '' && !('__SUPA_URL__').startsWith('__')
  ? '__SUPA_URL__'
  : 'https://pfxtywyedbiqqypwxyfv.supabase.co'; // fallback for local dev

const SUPA_KEY = '__SUPA_KEY__' !== '' && !('__SUPA_KEY__').startsWith('__')
  ? '__SUPA_KEY__'
  : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmeHR5d3llZGJpcXF5cHd4eWZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNjg2NDQsImV4cCI6MjA4ODY0NDY0NH0.FJmSKEl5k4GWJZAgG_HLMNVh3tN2DtRSQY78fT3KW5k'; // fallback

const SUPA_OPTIONS = {
  auth: {
    autoRefreshToken:   true,
    persistSession:     true,
    detectSessionInUrl: true,
    storageKey:         'mv8-auth',
    storage:            localStorage,
  },
  realtime: {
    params: { eventsPerSecond: 10 },
  },
  global: {
    headers: { 'x-app-version': '8.0' },
  },
};

const db = supabase.createClient(SUPA_URL, SUPA_KEY, SUPA_OPTIONS);

/* ── ATOMIC HELPERS (replaces db.raw — not valid in Supabase JS v2) ──
   Calls Postgres RPC functions defined in schema_v6.sql             */
const RPC = {
  incBalance : (uid, amt)         => db.rpc('inc_balance',   { uid, amt }).catch(()=>{}),
  incMVT     : (uid, amt)         => db.rpc('inc_mvt',       { uid, amt }).catch(()=>{}),
  incEarned  : (uid, amt)         => db.rpc('inc_earned',    { uid, amt }).catch(()=>{}),
  creditProfit:(uid, amt, mvt=0)  => db.rpc('credit_profit', { uid, amt, mvt_amt: mvt }).catch(()=>{}),
  incWallet  : (uid, wtype, amt)  => db.rpc('inc_wallet',    { uid, wtype, amt }).catch(()=>{}),
};

const MV = {
  APP_URL:'__APP_URL__' !== '' && !('__APP_URL__').startsWith('__') ? '__APP_URL__' : 'https://microvest.app',
  ADMIN_EMAIL:'admin@microvest.app',
  APP_NAME:'MicroVest', CURRENCY:'RM', VERSION:'8.0',
  MIN_DEPOSIT:20, MIN_WITHDRAW:50,

  PLANS:[
    {id:'starter',name:'Starter', icon:'🌱',price:50,   dailyRate:0.028,durationDays:7,  totalReturn:20, color:'#3B82F6',badge:null  },
    {id:'silver', name:'Silver',  icon:'🥈',price:200,  dailyRate:0.027,durationDays:15, totalReturn:40, color:'#94A3B8',badge:'HOT' },
    {id:'gold',   name:'Gold',    icon:'🥇',price:500,  dailyRate:0.030,durationDays:30, totalReturn:90, color:'#EAB308',badge:'BEST'},
    {id:'diamond',name:'Diamond', icon:'💎',price:1000, dailyRate:0.032,durationDays:30, totalReturn:96, color:'#8B5CF6',badge:'VIP' },
    {id:'elite',  name:'Elite',   icon:'👑',price:5000, dailyRate:0.035,durationDays:60, totalReturn:210,color:'#22C55E',badge:'NEW' },
  ],

  /* id must match mining.html CSS classes: fan/asic/rack/farm/mega */
  MACHINES:[
    {id:'fan', name:'Fan Miner',   icon:'🌀',price:30,   dailyRate:0.040,durationDays:30, color:'#60A5FA'},
    {id:'asic',name:'ASIC Miner',  icon:'⚡',price:150,  dailyRate:0.038,durationDays:45, color:'#F97316'},
    {id:'rack',name:'Rack Server', icon:'🖥️',price:500,  dailyRate:0.036,durationDays:60, color:'#22C55E'},
    {id:'farm',name:'Mining Farm', icon:'🏭',price:2000, dailyRate:0.034,durationDays:90, color:'#A78BFA'},
    {id:'mega',name:'Mega Cluster',icon:'🚀',price:10000,dailyRate:0.032,durationDays:180,color:'#FB923C'},
  ],

  RANKS:[
    {id:'member', name:'Member', icon:'🆓',minDeposit:0,   color:'#475569',miningBoost:1.00,maxWithdraw:500,  dailyBonus:0,   withdrawFee:0.030},
    {id:'bronze', name:'Bronze', icon:'🥉',minDeposit:100, color:'#CD7F32',miningBoost:1.05,maxWithdraw:1000, dailyBonus:0.20,withdrawFee:0.025},
    {id:'silver', name:'Silver', icon:'🥈',minDeposit:500, color:'#94A3B8',miningBoost:1.10,maxWithdraw:3000, dailyBonus:0.50,withdrawFee:0.020},
    {id:'gold',   name:'Gold',   icon:'🥇',minDeposit:1000,color:'#EAB308',miningBoost:1.20,maxWithdraw:8000, dailyBonus:1.50,withdrawFee:0.015},
    {id:'diamond',name:'Diamond',icon:'💎',minDeposit:5000,color:'#7C3AED',miningBoost:1.35,maxWithdraw:20000,dailyBonus:5.00,withdrawFee:0.010},
  ],

  REFERRAL:[
    {level:1,rate:0.10,label:'Langsung'  },
    {level:2,rate:0.05,label:'Generasi 2'},
    {level:3,rate:0.03,label:'Generasi 3'},
    {level:4,rate:0.02,label:'Generasi 4'},
  ],
  REFERRAL_RATES:[0.10,0.05,0.03,0.02],

  CHECKIN:[0.50,1.00,1.50,2.00,3.00,5.00,10.00],

  TOKEN:{
    symbol:'MVT',name:'MicroVest Token',icon:'🪙',
    basePrice:0.085,totalSupply:100000000,circulatingSupply:28500000,
    earnRate:10,miningRate:5,
  },

  SPIN_PRIZES:[
    {label:'RM 0.50', value:0.50, type:'cash',color:'#22C55E',prob:30},
    {label:'RM 1.00', value:1.00, type:'cash',color:'#3B82F6',prob:25},
    {label:'RM 2.00', value:2.00, type:'cash',color:'#7C3AED',prob:18},
    {label:'RM 5.00', value:5.00, type:'cash',color:'#F97316',prob:12},
    {label:'RM 10.00',value:10.00,type:'cash',color:'#EAB308',prob:7 },
    {label:'20 MVT',  value:20,   type:'mvt', color:'#A78BFA',prob:5 },
    {label:'RM 0.20', value:0.20, type:'cash',color:'#64748B',prob:2 },
    {label:'RM 50',   value:50.00,type:'cash',color:'#EF4444',prob:1 },
  ],

  WALLETS:[
    {id:'main',  name:'Main Wallet',  desc:'Deposit & Withdraw',  color:'#7C3AED',icon:'💼'},
    {id:'mining',name:'Mining Wallet',desc:'Profit mining harian',color:'#F97316',icon:'⛏️'},
    {id:'bonus', name:'Bonus Wallet', desc:'Komisen & Ganjaran',  color:'#22C55E',icon:'🎁'},
  ],

  MISSIONS:[
    {id:'daily_login',   name:'Login Harian',       category:'daily', icon:'📱',target:1,   reward:0.50,xp:30, mvt:5  },
    {id:'daily_claim',   name:'Claim Mining Harian',category:'daily', icon:'⛏️',target:1,   reward:1.00,xp:50, mvt:10 },
    {id:'daily_checkin', name:'Check-In Hari Ini',  category:'daily', icon:'✅',target:1,   reward:0.50,xp:20, mvt:5  },
    {id:'invest_first',  name:'Pelabur Pertama',    category:'invest',icon:'📈',target:1,   reward:5,   xp:150,mvt:50 },
    {id:'invest_3',      name:'3x Pelaburan',       category:'invest',icon:'🔁',target:3,   reward:10,  xp:300,mvt:100},
    {id:'invest_1000',   name:'Labur RM1,000',      category:'invest',icon:'💰',target:1000,reward:30,  xp:500,mvt:200},
    {id:'ref_1',         name:'Jemput 1 Rakan',     category:'team',  icon:'👥',target:1,   reward:3,   xp:100,mvt:30 },
    {id:'ref_5',         name:'Jemput 5 Rakan',     category:'team',  icon:'🌐',target:5,   reward:10,  xp:300,mvt:100},
    {id:'ref_team_100',  name:'Team Deposit RM100', category:'team',  icon:'🏆',target:100, reward:15,  xp:400,mvt:150},
    {id:'mine_7days',    name:'Mining 7 Hari',      category:'mining',icon:'⛏️',target:7,   reward:7,   xp:200,mvt:70 },
    {id:'mine_total_50', name:'Total Mining RM50',  category:'mining',icon:'💎',target:50,  reward:8,   xp:250,mvt:80 },
    {id:'mine_3machines',name:'Beli 3 Mesin',       category:'mining',icon:'🏭',target:3,   reward:12,  xp:350,mvt:120},
    {id:'reach_bronze',  name:'Capai Bronze',       category:'vip',   icon:'🥉',target:100, reward:5,   xp:200,mvt:80 },
    {id:'reach_gold',    name:'Capai Gold',         category:'vip',   icon:'🥇',target:1000,reward:25,  xp:600,mvt:250},
    {id:'reach_diamond', name:'Capai Diamond',      category:'vip',   icon:'💎',target:5000,reward:100, xp:1500,mvt:500},
  ],

  BADGES:[
    {id:'early_adopter', name:'Early Adopter',   icon:'🌟',desc:'Antara 1000 pengguna pertama'            },
    {id:'first_invest',  name:'First Strike',    icon:'⚡',desc:'Pelaburan pertama berjaya'               },
    {id:'power_miner',   name:'Power Miner',     icon:'⛏️',desc:'3 mesin mining aktif serentak'           },
    {id:'network_king',  name:'Network King',    icon:'👑',desc:'10 rakan langsung direferral'            },
    {id:'diamond_hands', name:'Diamond Hands',   icon:'💎',desc:'Capai rank Diamond'                      },
    {id:'centurion',     name:'Centurion',       icon:'🛡️',desc:'Login 100 hari'                          },
    {id:'whale',         name:'The Whale',       icon:'🐋',desc:'Total deposit melebihi RM10,000'         },
    {id:'mvt_holder',    name:'MVT Holder',      icon:'🪙',desc:'Miliki lebih 1,000 MVT'                  },
    {id:'profit_master', name:'Profit Master',   icon:'📊',desc:'Total earning melebihi RM1,000'          },
    {id:'community_boss',name:'Community Boss',  icon:'🤝',desc:'Team deposit melebihi RM5,000'           },
    {id:'speed_demon',   name:'Speed Demon',     icon:'🏎️',desc:'Withdraw dalam 10 minit selepas approve' },
    {id:'elite_investor',name:'Elite Investor',  icon:'🎯',desc:'Aktifkan plan Elite'                     },
  ],

  getRank(dep)   { return [...this.RANKS].reverse().find(r=>dep>=r.minDeposit)||this.RANKS[0]; },
  getPlan(id)    { return this.PLANS.find(p=>p.id===id); },
  getMachine(id) { return this.MACHINES.find(m=>m.id===id); },
  /* ── AI ROBOTS (Robot Wealth system) ─────────────────────────
     price       = activation cost (RM)
     dailyRate   = daily profit % of price
     durationDays= robot contract period
     promoteBonus= % of referral deposit credited as promo bonus
     strategy    = display label for trading strategy
  ────────────────────────────────────────────────────────── */
  ROBOTS:[
    { id:'scout',    name:'Scout Bot',    icon:'🤖', price:30,    dailyRate:0.042, durationDays:30,  promoteBonus:0.02, color:'#60A5FA', strategy:'Scalping',      desc:'Bot entry level untuk pemula. Trading frekuensi tinggi dengan spread kecil.' },
    { id:'alpha',    name:'Alpha Bot',    icon:'🦾', price:150,   dailyRate:0.040, durationDays:45,  promoteBonus:0.03, color:'#F97316', strategy:'Swing Trade',   desc:'Analisis teknikal jangka sederhana. Sesuai untuk pulangan konsisten.' },
    { id:'nexus',    name:'Nexus Bot',    icon:'🧠', price:500,   dailyRate:0.038, durationDays:60,  promoteBonus:0.04, color:'#22C55E', strategy:'AI Arbitrage',  desc:'Memanfaatkan perbezaan harga antara pasaran. Keuntungan hampir zero-risk.' },
    { id:'quantum',  name:'Quantum Bot',  icon:'⚛️', price:2000,  dailyRate:0.036, durationDays:90,  promoteBonus:0.05, color:'#A78BFA', strategy:'ML Prediction', desc:'Model pembelajaran mesin meramal pergerakan pasaran 4 langkah ke hadapan.' },
    { id:'sovereign',name:'Sovereign Bot',icon:'👑', price:10000, dailyRate:0.034, durationDays:180, promoteBonus:0.07, color:'#FB923C', strategy:'Quantum AI',    desc:'Algoritma terpantas di platform. Dagangan mikrosaat. Untuk pelabur elit.' },
  ],

  getRobot(id) { return this.ROBOTS.find(r=>r.id===id); },

  getWallet(id)  { return this.WALLETS.find(w=>w.id===id); },
    {id:'robot_first',    name:'Aktif Robot Pertama', category:'robot',  icon:'🤖',target:1,  reward:5,   xp:100,  mvt:50  },
    {id:'robot_3',        name:'3 Robot Aktif',        category:'robot',  icon:'🦾',target:3,  reward:15,  xp:300,  mvt:120 },
    {id:'robot_promoted', name:'Promosi Robot',         category:'promote',icon:'📢',target:1,  reward:10,  xp:200,  mvt:80  },
    {id:'robot_claim10',  name:'10 Kali Klaim Robot',   category:'robot',  icon:'💰',target:10, reward:20,  xp:500,  mvt:200 },
    {id:'robot_sovereign',name:'Aktif Sovereign Bot',   category:'robot',  icon:'👑',target:1,  reward:100, xp:2000, mvt:500 },

  getMission(id) { return this.MISSIONS.find(m=>m.id===id); },
};

/* ═══════════════════════════════════════════════════════════
   GLOBAL AUTH MONITOR — redirect on session expiry
═══════════════════════════════════════════════════════════ */
const _publicPages = ['login.html','forgot.html','index.html'];
const _isPublic    = _publicPages.some(p => location.pathname.includes(p));

if (!_isPublic) {
  db.auth.onAuthStateChange((event, session) => {
    // FIX: guard — never redirect when already on login/forgot/404 pages
    const authPages = ['login.html','forgot.html','404.html'];
    const onAuthPage = authPages.some(p => location.pathname.endsWith(p) || location.pathname.endsWith('/'));
    if (event === 'SIGNED_OUT' || (!session && event !== 'INITIAL_SESSION')) {
      if (!onAuthPage) {
        if (typeof UI !== 'undefined') UI.toast('Sesi tamat. Sila log masuk semula.', 'error', 3000);
        setTimeout(() => { location.href = 'login.html'; }, 1500);
      }
    }
    if (event === 'TOKEN_REFRESHED') {
      console.log('[Auth] Token refreshed successfully');
    }
  });
}
