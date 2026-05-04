# 🤖 Premium Telegram Promotion Bot

A complete JSON-based Telegram promotion bot built with Node.js and Telegraf. No database required - all data stored in JSON files.

## ✨ Features

- ✅ **Channel Verification** - Users must join required channels before using
- 🆕 **New Order** - Promote links to all users and groups (10 credits)
- 💰 **My Balance** - Check credits and referral stats
- 🔗 **Refer Link** - Earn 1 credit per referral
- 💳 **Recharge** - Contact admin to buy credits
- 👑 **Owner Panel** - Add credits, broadcast, view stats
- 📢 **Broadcast** - Owner can message all users/groups for free
- 🤖 **Auto Group Tracking** - Bot auto-detects groups where it's admin

## 🚀 Deployment on Railway

### Step 1: Create Bot
1. Message [@BotFather](https://t.me/BotFather) on Telegram
2. Send `/newbot`
3. Choose name and username
4. Copy the **API Token**

### Step 2: Get Your User ID
1. Message [@userinfobot](https://t.me/userinfobot) 
2. Copy your **User ID** (numbers only)

### Step 3: Deploy

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template)

Or manually:

1. **Fork/Upload** this project to GitHub
2. **Connect** Railway to your GitHub repo
3. **Add Environment Variables:**
   ```
   BOT_TOKEN=your_bot_token_here
   OWNER_ID=your_telegram_user_id
   ADMIN_WHATSAPP=+1234567890
   ADMIN_TELEGRAM=@your_username
   ```
4. **Deploy!**

### Step 4: Configure Channels
Edit `REQUIRED_CHANNELS` in `bot.js` with your actual channel usernames/IDs:
```javascript
const REQUIRED_CHANNELS = [
    { id: '@yourchannel1', name: 'Channel 1', type: 'telegram' },
    { id: '@yourchannel2', name: 'Channel 2', type: 'telegram' },
    { id: '@yourchannel3', name: 'Channel 3', type: 'telegram' },
    { id: '@yourchannel4', name: 'Channel 4', type: 'telegram' },
    { id: '@whatsapp_channel', name: 'WhatsApp Channel', type: 'whatsapp' },
    { id: '@youtube_channel', name: 'YouTube Channel', type: 'youtube' }
];
```

## 📁 Project Structure

```
promotion-bot/
├── bot.js              # Main bot logic
├── package.json        # Dependencies
├── .env.example        # Environment template
├── .gitignore         # Git ignore
├── data/              # JSON data storage (auto-created)
│   ├── users.json
│   ├── groups.json
│   └── pending_promos.json
└── README.md
```

## 🛠️ Local Development

```bash
# Install dependencies
npm install

# Create .env file
cp .env.example .env
# Edit .env with your values

# Run bot
npm start

# Dev mode with auto-restart
npm run dev
```

## 💰 Credit System

| Action | Credits |
|--------|---------|
| New Promotion | -10 |
| Referral Join | +1 |
| Admin Add | Variable |

## 👑 Owner Commands

Access via **Owner Panel** button (only visible to OWNER_ID):
- ➕ Add Credits - Give credits to any user
- 📢 Broadcast - Message all users and groups
- 📊 Stats - View top users and groups

## ⚠️ Important Notes

1. **Bot must be admin** in groups to send messages
2. **Channel IDs** must be correct for verification to work
3. **Privacy mode** must be disabled in @BotFather for group features
4. Data persists in `data/` folder - back up regularly

## 📄 License

MIT License
