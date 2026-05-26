# 💣 Solid BombParty Bot

> A high-performance, real-time text vocabulary game for Discord. Inspired by the classic *BombParty*, players race to type words containing a dynamically generated syllable — before the bomb explodes. Built as a persistent native Gateway Bot using `discord.js` v14. No browser. No iframe. Just raw, real-time gameplay in your server's text channels.

[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-339933?style=flat&logo=node.js&logoColor=white)](https://nodejs.org)
[![discord.js](https://img.shields.io/badge/discord.js-v14-5865F2?style=flat&logo=discord&logoColor=white)](https://discord.js.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Hosted on Render](https://img.shields.io/badge/Hosted%20on-Render-46E3B7?style=flat&logo=render&logoColor=white)](https://render.com)

---

## 🚀 Add the Bot to Your Server

> **No setup required on your end. Click below to invite Solid BombParty Bot instantly:**

### 👉 [Invite Solid BombParty Bot to Your Server](https://discord.com/oauth2/authorize?client_id=1508684561989505024&permissions=551903382592&integration_type=0&scope=bot+applications.commands)

The bot is live and persistent 24/7. Just invite and play.

---

## ✨ Features

- **⚡ O(1) Dictionary Validation** — The entire English word list is loaded into a native ES6 `Set` at process startup. Every word check — regardless of dictionary size — resolves in constant time via a single `.has()` call. No database queries, no array scans, no regex.
- **🚫 Anti-Cheat Duplicate Prevention** — A per-round `Set`-based used-word cache blocks repeated submissions at the data structure level. Enforcement cost stays O(1) even as the round progresses.
- **⏱️ Strict Async Timer Loop** — Each turn runs on a clearable 15-second `setTimeout`. On valid input, the timer is explicitly torn down with `clearTimeout` before a fresh one is issued — preventing ghost callbacks and state corruption across turns.
- **🔗 Persistent Gateway Connection** — Operates as a full Discord Gateway Bot over a live WebSocket connection, not a webhook or iframe activity. The bot is always listening, always responsive.
- **🌐 Express Keep-Alive Infrastructure** — A lightweight Express HTTP server exposes a health-check route, satisfying Render's uptime requirements. Paired with a cron-job.org ping every ~12 minutes, the bot stays warm on free-tier hosting indefinitely.
- **🧹 Clean Round State Management** — Active player, current syllable, timer reference, and used-word cache are fully reset between rounds, with no cross-game data bleed.
- **🖥️ Zero Client Requirements** — Players need nothing beyond their standard Discord client. No extensions, no browser tabs, no special permissions on their end.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js v18+ |
| Discord Library | discord.js v14 |
| Web / Keep-Alive Server | Express.js |
| Dictionary Engine | Native ES6 `Set` (local array-backed) |
| Timer / State Machine | `setTimeout` / `clearTimeout` |
| Configuration | dotenv |
| Hosting | Render |
| Uptime Management | cron-job.org |

---

## 🎮 How to Play

1. Invite the bot to your server using the link above.
2. In any text channel, type `!start` to begin a game.
3. The bot posts a **random syllable prompt** (e.g., `[ TH ]`) and starts the 15-second bomb timer.
4. Type a **valid English word containing that syllable** (e.g., `weather`, `theory`, `bath`).
5. On a valid, non-duplicate word — the bot reacts ✅, posts a new syllable, and resets the timer for the next player.
6. If the timer hits zero or an invalid/duplicate word is submitted — **💥 BOOM.** That player is eliminated.
7. Last player standing wins the round.

**Core Rules:**
- Words must exist in the English dictionary.
- The syllable must appear somewhere within the word.
- Words already used this round are rejected — no recycling.
- Exactly 15 seconds per turn. No extensions.

---

## 💻 Local Installation & Setup

### Prerequisites

- Node.js v18 or higher
- A Discord Bot Token from the [Discord Developer Portal](https://discord.com/developers/applications)
- **Message Content Intent** enabled under your bot's settings in the Developer Portal
- Your bot invited to a test server

### Clone & Install

```bash
git clone https://github.com/Solidx74/Discord-BombParty-Game-Bot.git
cd Discord-BombParty-Game-Bot
npm install
```

### Environment Variables

Create a `.env` file in the root of the project:

```env
# Required — Your Discord bot token from the Developer Portal
DISCORD_TOKEN=your_discord_bot_token_here

# Required — Port for the Express keep-alive server
PORT=3001

# Optional — Set to production for hosted deployments
NODE_ENV=production

# Optional — Your bot's client ID (for slash command registration)
CLIENT_ID=your_client_id_here

# Optional — A specific guild ID for dev/test command deployment
GUILD_ID=your_test_guild_id_here
```

> ⚠️ **Never commit your `.env` file.** It must be listed in `.gitignore`.

### Run Locally

```bash
node server.js
```

---

## ☁️ Hosting on Render + cron-job.org

1. Push your repository to GitHub.
2. Create a new **Web Service** on [Render](https://render.com) and connect your repo.
3. Add all `.env` values as **Environment Variables** in the Render dashboard.
4. Once deployed, copy your public Render URL (e.g., `https://your-service.onrender.com`).
5. Create a free job on [cron-job.org](https://cron-job.org) to `GET` that URL every **12 minutes**.

This keeps the Express health-check route alive, which prevents Render from spinning down your service and dropping the bot's WebSocket connection.

---

## 🔮 Roadmap

There's a lot of upgrades coming in this discord bot soon.

Planned future enhancements include:

- **Persistent SQLite Leaderboards** — Track wins, losses, and streaks per user across sessions with a lightweight embedded database and no external service dependency.
- **Multi-Server Global Rankings** — Aggregate leaderboard data across all servers, with a `!rank` command showing how players stack up worldwide.
- **Full Slash Command Migration** — Replace all prefix-based commands with Discord's native slash command API for better discoverability, autocomplete, and per-guild permission control.
- **Modular Game Modes** — Configurable difficulty tiers (Easy: 25s timer / simple syllables, Hard: 8s timer / complex patterns), selectable at game start.
- **Spectator Mode** — Watch ongoing rounds without participating, with a live-updating scoreboard embed.
- **Word Category Filters** — Optional themed rounds (animals only, no proper nouns, etc.) powered by tagged dictionary subsets.
- **Auto-Rematch & Queue System** — Automatic round restarts with a player queue, so new challengers can join between games without any bot restarts.

---

## 📄 License

Distributed under the MIT License. See [LICENSE](LICENSE) for details.

---

## 🔗 Links

- **GitHub Repository:** [https://github.com/Solidx74/Discord-BombParty-Game-Bot](https://github.com/Solidx74/Discord-BombParty-Game-Bot)
- **Bot Invite Link:** [Add to your server](https://discord.com/oauth2/authorize?client_id=1508684561989505024&permissions=551903382592&integration_type=0&scope=bot+applications.commands)

---

*Built with ❤️ by [Solidx74](https://github.com/Solidx74)*
