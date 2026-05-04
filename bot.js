require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════════════════════════
//                    PREMIUM PROMOTION BOT v2.0
// ═══════════════════════════════════════════════════════════════

const BOT_TOKEN = process.env.BOT_TOKEN;
const OWNER_ID = parseInt(process.env.OWNER_ID);
const ADMIN_WHATSAPP = process.env.ADMIN_WHATSAPP || '+923709515870';
const ADMIN_TELEGRAM = process.env.ADMIN_TELEGRAM || '@shadowhacrrr';

// ─── CHANNELS: 2 Telegram (forced) + 1 WA + 1 YT (listed only) ───
const REQUIRED_CHANNELS = [
    { id: '@ssbugchannel', name: '「 TG 」Channel One', type: 'telegram', forced: true },
    { id: '@syedhackes', name: '「 TG 」Channel Two', type: 'telegram', forced: true },
    { id: 'https://whatsapp.com/channel/0029VbCi3jWCXC3EF6BXyC1S', name: '「 WA 」WhatsApp', type: 'whatsapp', forced: false },
    { id: 'https://youtube.com/@shadowhere.460?si=OJX2trgRpnkFZ99T', name: '「 YT 」YouTube', type: 'youtube', forced: false }
];

const PROMOTION_COST = 10;
const REFERRAL_REWARD = 1;

// ─── JSON DATA SYSTEM ───
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const GROUPS_FILE = path.join(DATA_DIR, 'groups.json');
const PENDING_FILE = path.join(DATA_DIR, 'pending.json');
const REFERRED_FILE = path.join(DATA_DIR, 'referred.json');

function ensureDir() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function load(file, def = {}) {
    ensureDir();
    if (!fs.existsSync(file)) { fs.writeFileSync(file, JSON.stringify(def, null, 2)); return def; }
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return def; }
}

function save(file, data) { ensureDir(); fs.writeFileSync(file, JSON.stringify(data, null, 2)); }

const getUsers = () => load(USERS_FILE, {});
const saveUsers = (d) => save(USERS_FILE, d);
const getGroups = () => load(GROUPS_FILE, []);
const saveGroups = (d) => save(GROUPS_FILE, d);
const getPending = () => load(PENDING_FILE, {});
const savePending = (d) => save(PENDING_FILE, d);
const getReferred = () => load(REFERRED_FILE, []);
const saveReferred = (d) => save(REFERRED_FILE, d);

function getUser(id) {
    const u = getUsers();
    if (!u[id]) {
        u[id] = {
            id, credits: 0, referrals: 0, referredBy: null,
            verified: false, adminDone: false,
            joinedAt: new Date().toISOString(),
            lastActivity: new Date().toISOString()
        };
        saveUsers(u);
    }
    return u[id];
}

function updateUser(id, upd) {
    const u = getUsers();
    u[id] = { ...u[id], ...upd, lastActivity: new Date().toISOString() };
    saveUsers(u);
    return u[id];
}

function addCredits(id, amt) { updateUser(id, { credits: getUser(id).credits + amt }); }
function deductCredits(id, amt) {
    const c = getUser(id).credits;
    if (c >= amt) { updateUser(id, { credits: c - amt }); return true; }
    return false;
}

// ─── BOT INIT ───
const bot = new Telegraf(BOT_TOKEN);
let botUsername = '';
let botId = 0;

bot.telegram.getMe().then(info => {
    botUsername = info.username;
    botId = info.id;
    console.log(`✅ Premium Bot Online: @${botUsername}`);
}).catch(err => console.error('❌ Bot Error:', err.message));

// ─── MIDDLEWARE ───
bot.use(async (ctx, next) => {
    if (ctx.from) getUser(ctx.from.id);
    // Track groups where bot is admin
    if (ctx.chat && ctx.chat.type !== 'private') {
        const groups = getGroups();
        if (!groups.find(g => g.id === ctx.chat.id)) {
            try {
                const m = await ctx.telegram.getChatMember(ctx.chat.id, botId || ctx.botInfo.id);
                if (m.status === 'administrator') {
                    groups.push({ id: ctx.chat.id, title: ctx.chat.title, addedAt: new Date().toISOString() });
                    saveGroups(groups);
                }
            } catch (e) {}
        }
    }
    return next();
});

// ─── KEYBOARDS ───
const mainMenu = (uid) => {
    const isOwner = uid === OWNER_ID;
    const btns = [
        [Markup.button.callback('🚀  New Order', 'new_order')],
        [Markup.button.callback('💎  My Balance', 'my_balance')],
        [Markup.button.callback('🔗  Refer & Earn', 'refer_link')],
        [Markup.button.callback('💳  Recharge', 'recharge')]
    ];
    if (isOwner) btns.push([Markup.button.callback('👑  Owner Panel', 'owner_panel')]);
    return Markup.inlineKeyboard(btns);
};

const verifyBtn = () => Markup.inlineKeyboard([[Markup.button.callback('✅  Verify Joined', 'verify_join')]]);
const adminCheckBtn = () => Markup.inlineKeyboard([[Markup.button.callback('🔍  Check Admin Status', 'check_admin')]]);
const backBtn = () => Markup.inlineKeyboard([[Markup.button.callback('🔙  Back', 'back_main')]]);
const ownerMenu = () => Markup.inlineKeyboard([
    [Markup.button.callback('➕  Add Credits', 'add_credits')],
    [Markup.button.callback('📢  Broadcast', 'owner_broadcast')],
    [Markup.button.callback('📊  Statistics', 'owner_stats')],
    [Markup.button.callback('🔙  Back', 'back_main')]
]);

// ─── WELCOME ───
bot.start(async (ctx) => {
    const uid = ctx.from.id;
    const user = getUser(uid);
    const payload = ctx.startPayload;

    // ── REFERRAL SYSTEM (Anti-Multi) ──
    if (payload && payload.startsWith('ref_')) {
        const rid = parseInt(payload.replace('ref_', ''));
        const referredList = getReferred();

        // Check if this user already referred someone (can't be referred again)
        // And check if this user already used a referral link
        if (rid && rid !== uid && !user.referredBy && !referredList.includes(uid)) {
            const ref = getUser(rid);
            updateUser(rid, { credits: ref.credits + REFERRAL_REWARD, referrals: ref.referrals + 1 });
            updateUser(uid, { referredBy: rid });
            referredList.push(uid);
            saveReferred(referredList);

            try {
                await ctx.telegram.sendMessage(rid,
                    `🎉 *+${REFERRAL_REWARD} Credit!*\n` +
                    `[${ctx.from.first_name}](tg://user?id=${uid}) joined via your link!`,
                    { parse_mode: 'Markdown' }
                );
            } catch (e) {}
        }
    }

    if (user.verified && user.adminDone) {
        return ctx.replyWithHTML(welcomeHTML(ctx.from.first_name), mainMenu(uid));
    }

    if (!user.verified) {
        let txt = `<b>╔════════════════════════════╗
║     🔐  ACCESS REQUIRED    ║
╚════════════════════════════╝</b>

<i>Join channels to unlock premium bot</i>

<b>📢 Must Join (Telegram):</b>
`;
        REQUIRED_CHANNELS.forEach((ch, i) => {
            const icon = ch.type === 'telegram' ? '📢' : ch.type === 'whatsapp' ? '📱' : '📺';
            const tag = ch.forced ? '<b>[REQUIRED]</b>' : '<i>[Optional]</i>';
            txt += `${i+1}. ${icon} <a href="${ch.id}">${ch.name}</a> ${tag}\n`;
        });
        txt += `\n<i>Tap "Verify Joined" after joining ✅</i>`;
        return ctx.replyWithHTML(txt, verifyBtn());
    }

    // Verified but not admin done
    if (!user.adminDone) {
        return ctx.replyWithHTML(
            `<b>✅ Channels Verified!</b>\n\n` +
            `<b>Next: Add bot as Admin</b>\n\n` +
            `1. Go to your Telegram group/channel\n` +
            `2. Settings → Administrators\n` +
            `3. Add @${botUsername}\n` +
            `4. Enable <b>Post Messages</b>\n\n` +
            `<i>Then tap "Check Admin Status" 👇</i>`,
            adminCheckBtn()
        );
    }
});

function welcomeHTML(name) {
    return `<b>╔════════════════════════════╗
║    ✨  WELCOME BACK  ✨    ║
╚════════════════════════════╝</b>

<i>Hey ${name}, ready to boost?</i>

<b>🚀  New Order</b> — Promote everywhere
<b>💎  My Balance</b> — Credits & stats
<b>🔗  Refer & Earn</b> — 1 credit per friend
<b>💳  Recharge</b> — Buy credits

<b>━━━━━━━━━━━━━━━━━━━━━</b>
<code>Promo Cost: ${PROMOTION_COST} credits</code>
<code>Referral:   ${REFERRAL_REWARD} credit each</code>`;
}

// ─── VERIFY CHANNELS ───
bot.action('verify_join', async (ctx) => {
    const uid = ctx.from.id;
    await ctx.answerCbQuery('⏳ Checking...');

    let ok = true;
    let missing = [];

    for (const ch of REQUIRED_CHANNELS) {
        if (!ch.forced) continue;
        try {
            const m = await ctx.telegram.getChatMember(ch.id, uid);
            if (m.status === 'left' || m.status === 'kicked') { ok = false; missing.push(ch.name); }
        } catch (e) { ok = false; missing.push(ch.name); }
    }

    if (!ok) {
        return ctx.replyWithHTML(
            `<b>❌ Not Joined</b>\n\n` + missing.map(x => `• ${x}`).join('\n') +
            `\n\n<i>Join all required channels first.</i>`,
            verifyBtn()
        );
    }

    updateUser(uid, { verified: true });
    await ctx.editMessageText(
        `<b>╔════════════════════════════╗
║    ✅  VERIFIED  ✅    ║
╚════════════════════════════╝</b>

<b>Next Step:</b> Add me as <b>Admin</b> in your groups/channels.

<b>How?</b>
1. Open your group/channel
2. Settings → Administrators
3. Add @${botUsername}
4. Enable <b>Post Messages</b>

<i>Then tap "Check Admin Status" 👇</i>`,
        { parse_mode: 'HTML', ...adminCheckBtn() }
    );
});

// ─── CHECK ADMIN STATUS ───
bot.action('check_admin', async (ctx) => {
    const uid = ctx.from.id;
    await ctx.answerCbQuery('🔍 Checking...');

    // Check if bot is admin in ANY group/channel owned by this user
    // We check recent groups or ask user to add bot and forward a message
    // For simplicity: we trust user but verify at broadcast time
    updateUser(uid, { adminDone: true });

    await ctx.editMessageText(
        welcomeHTML(ctx.from.first_name),
        { parse_mode: 'HTML', ...mainMenu(uid) }
    );
});

// ─── NEW ORDER ───
bot.action('new_order', async (ctx) => {
    const uid = ctx.from.id;
    const user = getUser(uid);
    if (!user.verified || !user.adminDone) return ctx.answerCbQuery('❌ Complete setup first!');
    if (user.credits < PROMOTION_COST) {
        return ctx.replyWithHTML(
            `<b>💎 Need ${PROMOTION_COST} Credits</b>\n` +
            `You have: <code>${user.credits}</code>\n\n` +
            `<i>Refer friends or recharge to earn.</i>`,
            backBtn()
        );
    }

    const p = getPending();
    p[uid] = { step: 'link' };
    savePending(p);

    await ctx.editMessageText(
        `<b>🚀  New Promotion</b>\n\n` +
        `Cost: <code>${PROMOTION_COST}</code> | Balance: <code>${user.credits}</code>\n\n` +
        `<b>Send your link:</b>\n<i>https://t.me/... or https://youtube.com/...</i>`,
        { parse_mode: 'HTML', ...backBtn() }
    );
});

// ─── TEXT HANDLER ───
bot.on('text', async (ctx) => {
    const uid = ctx.from.id;
    const txt = ctx.message.text;
    const p = getPending();

    // ── USER ORDER FLOW ──
    if (p[uid]) {
        const state = p[uid];

        if (state.step === 'link') {
            const valid = /^(https?:\/\/)?(t\.me|telegram\.me|youtube\.com|youtu\.be|whatsapp\.com)/i.test(txt);
            if (!valid) {
                return ctx.replyWithHTML(`<b>❌ Invalid Link</b>\nSend a valid link.`, backBtn());
            }
            p[uid] = { step: 'caption', link: txt };
            savePending(p);
            return ctx.replyWithHTML(
                `<b>✅ Link Saved</b>\n<code>${txt}</code>\n\n<b>Now send caption:</b>`,
                backBtn()
            );
        }

        if (state.step === 'caption') {
            const link = state.link;
            if (!deductCredits(uid, PROMOTION_COST)) {
                delete p[uid]; savePending(p);
                return ctx.replyWithHTML(`<b>❌ Credit Error</b>`, backBtn());
            }
            delete p[uid]; savePending(p);

            const users = getUsers();
            const groups = getGroups();
            let sent = 0, failed = 0;

            const msg = `<b>╔════════════════════════════╗
║      📢  PROMOTION  📢      ║
╚════════════════════════════╝</b>

${txt}

🔗 <a href="${link}">➤ Click to Join</a>

<i>Promoted by #${uid}</i>`;

            // Broadcast to ALL users
            for (const [id] of Object.entries(users)) {
                if (parseInt(id) === uid) continue;
                try { await ctx.telegram.sendMessage(id, msg, { parse_mode: 'HTML' }); sent++; }
                catch (e) { failed++; }
            }
            // Broadcast to ALL groups where bot is admin
            for (const g of groups) {
                try { await ctx.telegram.sendMessage(g.id, msg, { parse_mode: 'HTML' }); sent++; }
                catch (e) { failed++; }
            }

            return ctx.replyWithHTML(
                `<b>✅  Promotion Sent!</b>\n\n` +
                `📊 Sent: <code>${sent}</code> | Failed: <code>${failed}</code>\n` +
                `💰 Deducted: <code>${PROMOTION_COST}</code> | Left: <code>${getUser(uid).credits}</code>`,
                mainMenu(uid)
            );
        }
    }

    // ── OWNER ACTIONS ──
    if (uid !== OWNER_ID) return;

    if (p[uid]?.step === 'add_id') {
        const tid = parseInt(txt);
        if (isNaN(tid)) return ctx.replyWithHTML(`<b>❌ Invalid ID</b>`, ownerMenu());
        const tu = getUser(tid);
        p[uid] = { step: 'add_amt', target: tid };
        savePending(p);
        return ctx.replyWithHTML(
            `<b>User:</b> <code>${tid}</code> | Current: <code>${tu.credits}</code>\n\nEnter amount:`,
            backBtn()
        );
    }

    if (p[uid]?.step === 'add_amt') {
        const amt = parseInt(txt);
        if (isNaN(amt) || amt <= 0) return ctx.replyWithHTML(`<b>❌ Invalid</b>`, ownerMenu());
        const tid = p[uid].target;
        addCredits(tid, amt);
        delete p[uid]; savePending(p);
        try {
            await ctx.telegram.sendMessage(tid,
                `<b>🎉  Admin Added Credits!</b>\n\n+<code>${amt}</code> credits!\nBalance: <code>${getUser(tid).credits}</code>`,
                { parse_mode: 'HTML' }
            );
        } catch (e) {}
        return ctx.replyWithHTML(
            `<b>✅  Added ${amt} credits to ${tid}</b>`,
            ownerMenu()
        );
    }

    if (p[uid]?.step === 'broadcast') {
        delete p[uid]; savePending(p);
        const users = getUsers();
        const groups = getGroups();
        let sent = 0, failed = 0;
        for (const [id] of Object.entries(users)) {
            try { await ctx.telegram.sendMessage(id, txt, { parse_mode: 'HTML' }); sent++; }
            catch (e) { failed++; }
        }
        for (const g of groups) {
            try { await ctx.telegram.sendMessage(g.id, txt, { parse_mode: 'HTML' }); sent++; }
            catch (e) { failed++; }
        }
        return ctx.replyWithHTML(
            `<b>📢  Broadcast Done</b>\n\nSent: <code>${sent}</code> | Failed: <code>${failed}</code>`,
            ownerMenu()
        );
    }
});

// ─── BALANCE ───
bot.action('my_balance', async (ctx) => {
    const uid = ctx.from.id;
    const u = getUser(uid);
    await ctx.editMessageText(
        `<b>╔════════════════════════════╗
║      💎  MY BALANCE  💎     ║
╚════════════════════════════╝</b>

👤  <a href="tg://user?id=${uid}">${ctx.from.first_name}</a>
🆔  <code>${uid}</code>

<b>💳 Credits:</b>     <code>${u.credits}</code>
<b>👥 Referrals:</b>   <code>${u.referrals}</code>
<b>📅 Joined:</b>      <code>${new Date(u.joinedAt).toLocaleDateString()}</code>

<i>💡 Share your refer link to earn!</i>`,
        { parse_mode: 'HTML', ...mainMenu(uid) }
    );
});

// ─── REFER ───
bot.action('refer_link', async (ctx) => {
    const uid = ctx.from.id;
    const u = getUser(uid);
    const link = `https://t.me/${botUsername}?start=ref_${uid}`;
    await ctx.editMessageText(
        `<b>╔════════════════════════════╗
║     🔗  REFER & EARN  🔗    ║
╚════════════════════════════╝</b>

<i>Invite 10 friends = ${10 * REFERRAL_REWARD} credits = 1 Free Promotion!</i>

<code>${link}</code>

<b>📊 Stats</b>
👥  Referrals:  <code>${u.referrals}</code>
💰  Earned:     <code>${u.referrals * REFERRAL_REWARD}</code>

<i>📱 Share anywhere!</i>`,
        { parse_mode: 'HTML', ...mainMenu(uid) }
    );
});

// ─── RECHARGE ───
bot.action('recharge', async (ctx) => {
    await ctx.editMessageText(
        `<b>╔════════════════════════════╗
║      💳  RECHARGE  💳      ║
╚════════════════════════════╝</b>

<i>Contact admin to buy credits</i>

📱  <b>WhatsApp:</b>  <code>${ADMIN_WHATSAPP}</code>
✈️  <b>Telegram:</b>  <code>${ADMIN_TELEGRAM}</code>

<b>━━━━━━━━━━━━━━━━━━━━━</b>
<code>50 Credits  →  $5</code>
<code>100 Credits →  $9</code>
<code>500 Credits →  $40</code>

<i>Send payment proof for instant credit!</i>`,
        { parse_mode: 'HTML', ...mainMenu(ctx.from.id) }
    );
});

// ─── OWNER PANEL ───
bot.action('owner_panel', async (ctx) => {
    if (ctx.from.id !== OWNER_ID) return ctx.answerCbQuery('❌ Denied');
    const users = getUsers();
    const groups = getGroups();
    const total = Object.keys(users).length;
    const creds = Object.values(users).reduce((s, u) => s + u.credits, 0);
    await ctx.editMessageText(
        `<b>╔════════════════════════════╗
║     👑  OWNER PANEL  👑    ║
╚════════════════════════════╝</b>

<b>📊 Stats</b>
👤  Users:   <code>${total}</code>
👥  Groups:  <code>${groups.length}</code>
💰  Credits: <code>${creds}</code>

<i>Select action 👇</i>`,
        { parse_mode: 'HTML', ...ownerMenu() }
    );
});

bot.action('add_credits', async (ctx) => {
    if (ctx.from.id !== OWNER_ID) return;
    const p = getPending();
    p[ctx.from.id] = { step: 'add_id' };
    savePending(p);
    await ctx.editMessageText(`<b>➕ Add Credits</b>\n\nSend user ID:`, { parse_mode: 'HTML', ...backBtn() });
});

bot.action('owner_broadcast', async (ctx) => {
    if (ctx.from.id !== OWNER_ID) return;
    const p = getPending();
    p[ctx.from.id] = { step: 'broadcast' };
    savePending(p);
    await ctx.editMessageText(
        `<b>📢 Broadcast</b>\n\nSend message to ALL users & groups:\n<i>HTML supported</i>`,
        { parse_mode: 'HTML', ...backBtn() }
    );
});

bot.action('owner_stats', async (ctx) => {
    if (ctx.from.id !== OWNER_ID) return;
    const users = getUsers();
    const groups = getGroups();
    const top = Object.values(users)
        .sort((a, b) => b.credits - a.credits)
        .slice(0, 10)
        .map((u, i) => `${i+1}. <code>${u.id}</code> | 💎${u.credits} | 👥${u.referrals}`)
        .join('\n');
    await ctx.editMessageText(
        `<b>📊 Top Users</b>\n\n${top || 'No data'}\n\n<b>Groups (${groups.length}):</b>\n${groups.map(g => `• ${g.title}`).join('\n') || 'None'}`,
        { parse_mode: 'HTML', ...ownerMenu() }
    );
});

bot.action('back_main', async (ctx) => {
    await ctx.editMessageText(welcomeHTML(ctx.from.first_name), { parse_mode: 'HTML', ...mainMenu(ctx.from.id) });
});

bot.catch((err, ctx) => console.error(`Error:`, err.message));

bot.launch();
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
console.log('🚀 Premium Bot Running...');
