/* ═══════════════════════════════════════════════════════════
   MicroVest v6 — js/automation.js
   Automation Engine:
     · Auto Mining Claim (every 24h per machine)
     · Auto VIP Upgrade (on total_deposit change)
     · Auto Referral Commission (on invest/deposit)
     · Auto Mission Check (on profile change)
     · Auto Daily Reset (streak, missions)
     · Scheduled Ticker (runs client-side every N seconds)
═══════════════════════════════════════════════════════════ */

const Auto = {
  _timers: {},

  /* ── START ALL AUTOMATION FOR USER ──────────────────────── */
  async start(userId) {
    if (!userId) return;
    await this.checkMiningClaims(userId);    // On load: catch any unclaimed
    await this.checkRobotClaims(userId);     // On load: catch any unclaimed robots
    await this.checkVIPUpgrade(userId);      // On load: verify rank is correct
    this._startScheduler(userId);            // Periodic checks every 60s
    console.log('[Auto] Started for', userId);
  },

  /* ── PERIODIC SCHEDULER ─────────────────────────────────── */
  _startScheduler(userId) {
    clearInterval(this._timers.sched);
    this._timers.sched = setInterval(async () => {
      await this.checkMiningClaims(userId);
      await this.checkRobotClaims(userId);
      await this.checkVIPUpgrade(userId);
    }, 60000); // every 60 seconds
  },

  /* ── AUTO MINING CLAIM ──────────────────────────────────── */
  async checkMiningClaims(userId) {
    try {
      const { data: machines } = await db
        .from('user_machines')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active');

      if (!machines?.length) return;

      const now  = Date.now();
      let total  = 0;
      const claimIds = [];

      for (const m of machines) {
        const last = m.last_claimed_at ? new Date(m.last_claimed_at) : new Date(m.created_at);
        if (now - last >= 23.5 * 3600000) {
          total += m.daily_profit;
          claimIds.push(m.id);
        }
      }

      if (!claimIds.length) return;

      // Get boost multiplier
      const { data: p } = await db.from('profiles')
        .select('balance, total_earned, mining_boost').eq('id', userId).single();
      const boost  = p?.mining_boost || 1;
      const reward = total * boost;

      // Atomic: credit profit + mining wallet
      await RPC.creditProfit(userId, reward);
      await RPC.incWallet(userId, 'mining', reward);

      // Mark all as claimed
      await db.from('user_machines')
        .update({ last_claimed_at: new Date().toISOString(), auto_claimed_at: new Date().toISOString() })
        .in('id', claimIds);

      // Log transaction
      await db.from('transactions').insert([{
        user_id: userId, type: 'mining', amount: reward, status: 'approved',
        description: `Auto-claim ${claimIds.length} mesin`,
      }]);

      // Notification
      await db.from('notifications').insert([{
        user_id: userId, type: 'mining',
        message: `⛏️ Auto-mining: +RM${reward.toFixed(2)} dari ${claimIds.length} mesin dikreditkan!`,
      }]);

      console.log(`[Auto] Mining claimed RM${reward.toFixed(2)} for ${userId}`);
    } catch (err) {
      console.warn('[Auto] Mining claim error:', err.message);
    }
  },

  /* ── AUTO VIP UPGRADE ───────────────────────────────────── */

  /* ── AUTO ROBOT CLAIM ───────────────────────────────────────
     Runs alongside mining auto-claim every 60s
     Credits profit from all active robots whose last_claimed_at
     is older than 23.5h                                         */
  async checkRobotClaims(userId) {
    try {
      const { data: robots } = await db.from('user_robots')
        .select('id, robot_id, daily_profit, last_claimed_at, total_earned, expires_at')
        .eq('user_id', userId)
        .eq('status', 'active');

      if (!robots?.length) return;

      const now      = new Date();
      const claimIds = [];
      let   reward   = 0;

      robots.forEach(r => {
        // Skip expired
        if (r.expires_at && new Date(r.expires_at) < now) return;
        const last = r.last_claimed_at ? new Date(r.last_claimed_at) : new Date(r.created_at || 0);
        if ((now - last) >= 23.5 * 3600000) {
          claimIds.push(r.id);
          reward += Number(r.daily_profit || 0);
        }
      });

      if (!claimIds.length) return;

      // Mark claimed + update total_earned atomically per robot
      for (const id of claimIds) {
        const r = robots.find(x => x.id === id);
        if (!r) continue;
        await db.from('user_robots')
          .update({
            last_claimed_at: now.toISOString(),
            auto_claimed_at: now.toISOString(),
            total_earned:    (r.total_earned || 0) + (r.daily_profit || 0),
          })
          .eq('id', id);
      }

      // Atomic credit
      await RPC.creditProfit(userId, reward);
      const mvt = Math.floor(reward * (MV.TOKEN?.miningRate || 1));
      await RPC.incMVT(userId, mvt);

      // Transaction record
      await db.from('transactions').insert([{
        user_id:     userId,
        type:        'profit',
        amount:      reward,
        status:      'approved',
        description: `Auto-robot: +RM${reward.toFixed(2)} dari ${claimIds.length} bot`,
      }]).catch(() => {});

      // Notify user
      await db.from('notifications').insert([{
        user_id: userId,
        type:    'profit',
        message: `🤖 Auto-Robot: +RM${reward.toFixed(2)} +${mvt} MVT dikreditkan dari ${claimIds.length} bot aktif!`,
      }]).catch(() => {});

      // Expire robots that have passed their expiry date
      await db.from('user_robots')
        .update({ status: 'expired' })
        .eq('user_id', userId)
        .eq('status', 'active')
        .lt('expires_at', now.toISOString());

      console.log(`[Auto] Robot claimed RM${reward.toFixed(2)} for ${userId}`);
    } catch (err) {
      console.warn('[Auto] Robot claim error:', err.message);
    }
  },

  async checkVIPUpgrade(userId) {
    try {
      const { data: p } = await db.from('profiles')
        .select('total_deposit, vip_rank').eq('id', userId).single();

      const correct = MV.getRank(p?.total_deposit || 0);
      if (correct.id === p?.vip_rank) return; // No change

      await db.from('profiles')
        .update({ vip_rank: correct.id }).eq('id', userId);

      if ((p?.total_deposit || 0) > 0) {
        await db.from('notifications').insert([{
          user_id: userId, type: 'vip',
          message: `👑 Tahniah! Rank anda dikemaskini ke ${correct.icon} ${correct.name}!`,
        }]);
      }
      console.log(`[Auto] VIP upgraded to ${correct.id} for ${userId}`);
    } catch (err) {
      console.warn('[Auto] VIP check error:', err.message);
    }
  },

  /* ── AUTO REFERRAL COMMISSION ───────────────────────────── */
  async processReferralChain(depositorId, amount, sourceType = 'deposit') {
    try {
      let currentId = depositorId;
      for (const tier of MV.REFERRAL) {
        const { data: cur } = await db.from('profiles')
          .select('referral_by').eq('id', currentId).single();
        if (!cur?.referral_by) break;

        const { data: ref } = await db.from('profiles')
          .select('id, balance, email').eq('referral_code', cur.referral_by).single();
        if (!ref) break;

        const commission = amount * tier.rate;

        // Atomic: credit profile balance + bonus wallet
        await RPC.incBalance(ref.id, commission);
        await RPC.incWallet(ref.id, 'bonus', commission);

        await db.from('referral_commissions').insert([{
          referrer_id: ref.id, referred_id: depositorId,
          amount: commission, level: tier.level, source_type: sourceType,
        }]);

        await db.from('notifications').insert([{
          user_id: ref.id, type: 'referral',
          message: `👥 Komisen L${tier.level} dari ${sourceType}: +RM${commission.toFixed(2)} (${(tier.rate*100).toFixed(0)}%)`,
        }]);

        currentId = ref.id;
      }
    } catch (err) {
      console.warn('[Auto] Referral chain error:', err.message);
    }
  },

  /* ── AUTO MISSION CHECK ─────────────────────────────────── */
  async checkMissions(userId, profile, context = {}) {
    try {
      const { data: done } = await db.from('user_missions')
        .select('mission_id').eq('user_id', userId);
      const doneSet = new Set((done || []).map(m => m.mission_id));

      const unlock = async (missionId) => {
        if (doneSet.has(missionId)) return;
        const def = MV.MISSIONS.find(m => m.id === missionId);
        if (!def) return;

        await db.from('user_missions').insert([{ user_id: userId, mission_id: missionId }])
          .on('conflict', () => {}); // safe upsert

        await RPC.incBalance(userId, def.reward);
        await RPC.incMVT(userId, def.mvt);
        // XP increment (read-then-write is acceptable for XP, not financial)
        const { data: px } = await db.from('profiles').select('xp').eq('id',userId).single().catch(()=>({data:{xp:0}}));
        await db.from('profiles').update({ xp: (px?.xp||0) + def.xp }).eq('id', userId);

        await db.from('notifications').insert([{
          user_id: userId, type: 'mission',
          message: `🎯 Misi: "${def.name}" — +RM${def.reward} +${def.xp}XP +${def.mvt}MVT!`,
        }]);

        doneSet.add(missionId);
        console.log(`[Auto] Mission unlocked: ${missionId}`);
      };

      // Auto-check missions based on profile data
      if ((profile.total_deposit || 0) > 0) await unlock('invest_first');

      // Robot missions
      const { data:userRobots } = await db.from('user_robots').select('id,robot_id,status').eq('user_id',userId);
      const activeRobots = (userRobots||[]).filter(r=>r.status==='active');
      if (activeRobots.length >= 1)                                       await unlock('robot_first');
      if (activeRobots.length >= 3)                                       await unlock('robot_3');
      if (activeRobots.some(r=>r.robot_id==='sovereign'))                 await unlock('robot_sovereign');
      if ((profile.total_earned  || 0) >= 50) await unlock('mine_total_50');
      if (context.machineCount >= 3) await unlock('mine_3machines');
      if (context.teamSize >= 1) await unlock('ref_1');
      if (context.teamSize >= 5) await unlock('ref_5');
      if (context.teamDeposit >= 100) await unlock('ref_team_100');
      if (context.investCount >= 3) await unlock('invest_3');
      if ((profile.total_deposit || 0) >= 1000) await unlock('invest_1000');

      // VIP rank missions
      const rank = MV.getRank(profile.total_deposit || 0);
      if (['bronze','silver','gold','diamond'].includes(rank.id)) await unlock('reach_bronze');
      if (['gold','diamond'].includes(rank.id)) await unlock('reach_gold');
      if (rank.id === 'diamond') await unlock('reach_diamond');

    } catch (err) {
      console.warn('[Auto] Mission check error:', err.message);
    }
  },

  /* ── AUTO BADGE UNLOCK ──────────────────────────────────── */
  async checkBadges(userId, profile, context = {}) {
    try {
      const { data: done } = await db.from('user_badges')
        .select('badge_id').eq('user_id', userId);
      const doneSet = new Set((done || []).map(b => b.badge_id));

      const unlock = async (badgeId) => {
        if (doneSet.has(badgeId)) return;
        await db.from('user_badges').insert([{ user_id: userId, badge_id: badgeId }])
          .on('conflict', () => {});
        await db.from('notifications').insert([{
          user_id: userId, type: 'badge',
          message: `🏅 Badge baru: "${MV.BADGES.find(b=>b.id===badgeId)?.name}" dikunci buka!`,
        }]);
        doneSet.add(badgeId);
      };

      if ((profile.total_deposit || 0) > 0) await unlock('first_invest');
      if (context.machineCount >= 3)          await unlock('power_miner');
      if (context.referralCount >= 10)        await unlock('network_king');
      if ((profile.vip_rank) === 'diamond')   await unlock('diamond_hands');
      if ((profile.total_deposit || 0) >= 10000) await unlock('whale');
      if ((profile.mvt_balance  || 0) >= 1000)   await unlock('mvt_holder');
      if ((profile.total_earned || 0) >= 1000)    await unlock('profit_master');
      if (context.teamDeposit >= 5000)            await unlock('community_boss');

    } catch (err) {
      console.warn('[Auto] Badge check error:', err.message);
    }
  },

  /* ── AUTO INVESTMENT MATURITY ───────────────────────────── */
  async checkInvestmentMaturity(userId) {
    try {
      const now = new Date().toISOString();
      const { data: matured } = await db.from('investments')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .lte('end_at', now);

      for (const inv of matured || []) {
        const remaining = (inv.total_return || 0) - (inv.total_claimed || 0);
        if (remaining > 0) {
          await RPC.creditProfit(userId, remaining);
        }
        await db.from('investments').update({ status: 'completed' }).eq('id', inv.id);
        await db.from('notifications').insert([{
          user_id: userId, type: 'invest',
          message: `🎉 Plan ${inv.plan_id} selesai! RM${remaining.toFixed(2)} dikreditkan ke baki anda.`,
        }]);
      }
    } catch (err) {
      console.warn('[Auto] Maturity check error:', err.message);
    }
  },

  /* ── DAILY WALLET MERGE (move mining+bonus to main) ────── */
  async mergeDailyWallets(userId) {
    // Called when user requests transfer from sub-wallet to main
    try {
      const { data: wallets } = await db.from('wallets')
        .select('*').eq('user_id', userId).neq('wallet_type', 'main');

      let total = 0;
      for (const w of wallets || []) {
        if ((w.balance || 0) > 0) {
          total += w.balance;
          await db.from('wallets').update({ balance: 0 }).eq('id', w.id);
        }
      }
      if (total > 0) {
        // Use RPC.incWallet for atomic increment — no stale read
        await RPC.incWallet(userId, 'main', total);
        await RPC.incBalance(userId, total);
        UI.toast(`✅ RM${total.toFixed(2)} dipindahkan ke Main Wallet`, 'success');
      }
      return total;
    } catch (err) {
      console.warn('[Auto] Wallet merge error:', err.message);
      return 0;
    }
  },

  /* ── STOP ALL ───────────────────────────────────────────── */
  stop() {
    Object.values(this._timers).forEach(t => clearInterval(t));
    this._timers = {};
  },
};
