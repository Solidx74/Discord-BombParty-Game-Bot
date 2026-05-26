require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const { Client, GatewayIntentBits } = require('discord.js');

// ==========================================
// 1. LIGHTWEIGHT KEEPER (EXPRESS)
// ==========================================
const app = express();
const PORT = process.env.PORT || 3001;

app.get('/', (req, res) => {
  res.send("Solid BombParty Bot is alive and listening!");
});

app.listen(PORT, () => {
  console.log(`Web keeper server listening on port ${PORT}`);
});

// ==========================================
// 2. DICTIONARY LOAD (Set for O(1) lookups)
// ==========================================
const wordListPath = path.join(__dirname, 'node_modules', 'word-list', 'words.txt');
let dictionarySet = new Set();

try {
  if (fs.existsSync(wordListPath)) {
    const rawWords = fs.readFileSync(wordListPath, 'utf8');
    rawWords
      .split('\n')
      .map(w => w.toLowerCase().trim())
      .filter(Boolean)
      .forEach(w => dictionarySet.add(w));
    console.log(`Main dictionary loaded: ${dictionarySet.size} words.`);
  } else {
    console.warn("Main 'words.txt' file not found. Falling back to internal list.");
  }
} catch (err) {
  console.error("Failed to load main dictionary:", err.message);
}

// Merge fallback extra words from an-array-of-english-words
try {
  const extraWords = require('an-array-of-english-words');
  extraWords.forEach(w => {
    if (w) dictionarySet.add(w.toLowerCase().trim());
  });
  console.log(`Comprehensive dictionary loaded. Total unique words: ${dictionarySet.size}`);
} catch (err) {
  console.warn("Could not load fallback 'an-array-of-english-words' package:", err.message);
}

// Fallback in case dictionary packages are empty
if (dictionarySet.size === 0) {
  const defaultWords = ["the", "and", "bomb", "party", "discord", "game", "bot", "code", "server", "active", "syllable", "timer"];
  defaultWords.forEach(w => dictionarySet.add(w));
  console.log("Using emergency default vocabulary list.");
}

// ==========================================
// 3. GAME STATE ENGINE
// ==========================================
let gameActive = false;
let currentSyllable = "";
let bombTimer = null;
let gameChannelId = null;
const usedWords = new Set();

// Hardcoded pool of syllables
const SYLLABLES = ["TH", "IN", "AN", "RE", "ER", "TE", "AL", "ST", "CO", "MA", "LI", "DE", "OR", "IT", "ON", "ES"];

// Helper to pick a random syllable
function pickRandomSyllable() {
  const randomIndex = Math.floor(Math.random() * SYLLABLES.length);
  currentSyllable = SYLLABLES[randomIndex];
  return currentSyllable;
}

// ==========================================
// 4. TRADITIONAL DISCORD ENGINE
// ==========================================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Function to handle game over / explosion
function explodeBomb(channel) {
  if (!gameActive) return;
  
  channel.send("💥 **BOOM!** The bomb exploded! Nobody answered in time. Game Over! Type `!start` to play again.");
  
  // Reset game state
  gameActive = false;
  gameChannelId = null;
  usedWords.clear();
  if (bombTimer) {
    clearTimeout(bombTimer);
    bombTimer = null;
  }
}

// Function to start or reset the 15-second round timer
function startRoundTimer(channel) {
  if (bombTimer) {
    clearTimeout(bombTimer);
  }
  
  bombTimer = setTimeout(() => {
    explodeBomb(channel);
  }, 15000); // 15 seconds
}

client.once('ready', () => {
  console.log(`Logged in to Discord as ${client.user.tag}! Standalone Text Bot is ready.`);
});

client.on('messageCreate', async (message) => {
  // Ignore bot messages
  if (message.author.bot) return;

  const content = message.content.trim();

  // Command: !start
  if (content.toLowerCase() === '!start') {
    if (gameActive) {
      message.reply("⚠️ A BombParty game is already active in this server! Solve the prompt or wait for it to explode.");
      return;
    }

    gameActive = true;
    gameChannelId = message.channel.id;
    usedWords.clear();
    const prompt = pickRandomSyllable();

    await message.channel.send(
      `💣 **BombParty Started!**\n` +
      `Find a valid English word containing **"${prompt}"**!\n` +
      `⏱️ You have **15 seconds** before the bomb explodes! Type your guess in this channel!`
    );

    startRoundTimer(message.channel);
    return;
  }

  // Handle active game inputs
  if (gameActive && message.channel.id === gameChannelId) {
    const cleanedWord = content.toLowerCase().trim();

    // Check 1: Must contain the active syllable
    if (!cleanedWord.includes(currentSyllable.toLowerCase())) {
      return; // Silently ignore words that do not even match the syllable criteria
    }

    // Check 2: Must be a valid English word in the dictionary
    if (!dictionarySet.has(cleanedWord)) {
      await message.reply("❌ Not a valid English word in the dictionary!");
      return;
    }

    // Check 3: Must not have been used already in this game round
    if (usedWords.has(cleanedWord)) {
      await message.reply("⚠️ That word has already been used in this game!");
      return;
    }

    // Success! Defuse the bomb
    if (bombTimer) {
      clearTimeout(bombTimer);
      bombTimer = null;
    }

    // Mark as used
    usedWords.add(cleanedWord);

    // React with checkmark to signify defusal
    try {
      await message.react('✅');
    } catch (err) {
      console.error("Failed to add emoji reaction:", err.message);
    }

    // Next round setup
    const nextPrompt = pickRandomSyllable();
    await message.channel.send(`defused! Next prompt is: **"${nextPrompt}"**! Quick, 15 seconds!`);
    
    startRoundTimer(message.channel);
  }
});

// Login using securely loaded token
const token = process.env.DISCORD_TOKEN;
if (token && token !== "YOUR_SECRET_TOKEN_HERE") {
  client.login(token).catch(err => {
    console.error("Discord Login failed:", err.message);
  });
} else {
  console.warn("DISCORD_TOKEN is missing or not configured. Set your credentials in the environment or .env file.");
}
