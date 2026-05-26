require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Enable CORS for development
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

const PORT = process.env.PORT || 3001;

// 1. Load ~274,000 English words from word-list package into a Set for O(1) lookups
const wordListPath = path.join(__dirname, 'node_modules', 'word-list', 'words.txt');
const dictionarySet = new Set(
  fs.readFileSync(wordListPath, 'utf8')
    .split('\n')
    .map(w => w.toLowerCase().trim())
    .filter(Boolean)
);

// Fallback / Extra words: Add words from an-array-of-english-words to the Set (~275,000 words, MIT)
try {
  const extraWords = require('an-array-of-english-words');
  extraWords.forEach(w => {
    if (w) dictionarySet.add(w.toLowerCase().trim());
  });
} catch (err) {
  console.warn("Could not load fallback 'an-array-of-english-words' package:", err.message);
}

console.log(`Dictionary loaded: ${dictionarySet.size} unique English words.`);

// 2. Global Game State Object
const gameState = {
  currentSyllable: "",
  turnOwner: null,
  bombTimer: 15.0,
  usedWords: new Set(),
  // Players data map (socketId -> { username, lives })
  players: new Map()
};

// Common BombParty syllables
const SYLLABLES = [
  "th", "in", "ch", "an", "er", "al", "re", "te", "it", "on", "es", "st", "de", "co", "ma", "ar", "li", "en", "at", "or"
];

// Helper to select a new valid syllable
function pickNewSyllable() {
  const randomIndex = Math.floor(Math.random() * SYLLABLES.length);
  gameState.currentSyllable = SYLLABLES[randomIndex];
}

// Helper to get active player list with lives > 0
function getActivePlayers() {
  return Array.from(gameState.players.entries())
    .filter(([_, player]) => player.lives > 0)
    .map(([id, _]) => id);
}

// Helper to rotate turns to the next active player
function rotateTurn() {
  const activeIds = getActivePlayers();
  if (activeIds.length === 0) {
    gameState.turnOwner = null;
    return;
  }

  if (!gameState.turnOwner || !activeIds.includes(gameState.turnOwner)) {
    gameState.turnOwner = activeIds[0];
    return;
  }

  const currentIndex = activeIds.indexOf(gameState.turnOwner);
  const nextIndex = (currentIndex + 1) % activeIds.length;
  gameState.turnOwner = activeIds[nextIndex];
}

// Helper to format map to object for lightweight socket state updates
function getSerializableGameState() {
  const playersObj = {};
  gameState.players.forEach((value, key) => {
    playersObj[key] = value;
  });
  return {
    currentSyllable: gameState.currentSyllable,
    turnOwner: gameState.turnOwner,
    bombTimer: gameState.bombTimer,
    usedWords: Array.from(gameState.usedWords),
    players: playersObj
  };
}

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Pick the initial syllable
pickNewSyllable();

// 3. Async Game Tick Loop via setInterval running every 100ms
setInterval(() => {
  const activeIds = getActivePlayers();
  if (activeIds.length === 0) {
    return; // No active players to run the game for
  }

  // Only decrement timer if there is a valid turn owner
  if (gameState.turnOwner) {
    gameState.bombTimer = Math.max(0, parseFloat((gameState.bombTimer - 0.1).toFixed(1)));

    // Emit lightweight tick event with only the floating-point bombTimer
    io.emit('TIMER_TICK', { bombTimer: gameState.bombTimer });

    // Handle bomb explosion when timer hits zero
    if (gameState.bombTimer <= 0) {
      const activePlayer = gameState.players.get(gameState.turnOwner);
      if (activePlayer) {
        activePlayer.lives = Math.max(0, activePlayer.lives - 1);
      }

      // Reset timer, pick new syllable, rotate turn, reset used words for the new round, and send full STATE_UPDATE
      gameState.bombTimer = 15.0;
      gameState.usedWords.clear();
      pickNewSyllable();
      rotateTurn();
      io.emit('STATE_UPDATE', getSerializableGameState());
    }
  } else {
    // If turn owner is null or disconnected but we have active players, start the turn
    rotateTurn();
    io.emit('STATE_UPDATE', getSerializableGameState());
  }
}, 100);

// Socket IO Event Listeners
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // Handle player joining
  socket.on('JOIN_GAME', ({ username }) => {
    const defaultLives = 3;
    gameState.players.set(socket.id, {
      username: username || `Player_${socket.id.substring(0, 4)}`,
      lives: defaultLives
    });

    // If there is no active turn owner, assign to this player
    if (!gameState.turnOwner) {
      rotateTurn();
    }

    io.emit('STATE_UPDATE', getSerializableGameState());
  });

  // Handle custom manual word submissions
  socket.on('SUBMIT_WORD', ({ word }) => {
    // Defensive validation gateway
    if (socket.id !== gameState.turnOwner) {
      socket.emit('VALIDATION_ERROR', { message: "It is not your turn!" });
      return;
    }

    if (!word || typeof word !== 'string') {
      socket.emit('VALIDATION_ERROR', { message: "Invalid word submitted." });
      return;
    }

    const cleanedWord = word.toLowerCase().trim();

    // 1. Confirm word contains the current syllable
    if (!cleanedWord.includes(gameState.currentSyllable.toLowerCase())) {
      socket.emit('VALIDATION_ERROR', { message: `Word must contain the syllable "${gameState.currentSyllable}"!` });
      return;
    }

    // 2. Ensure it is absent from usedWords (O(1) Set lookup)
    if (gameState.usedWords.has(cleanedWord)) {
      socket.emit('VALIDATION_ERROR', { message: "That word has already been used!" });
      return;
    }

    // 3. Verify it exists inside the dictionary Set
    if (!dictionarySet.has(cleanedWord)) {
      socket.emit('VALIDATION_ERROR', { message: "Not a valid English word in dictionary." });
      return;
    }

    // Success!
    gameState.usedWords.add(cleanedWord);
    pickNewSyllable();
    rotateTurn();
    gameState.bombTimer = 15.0; // Reset timer to 15.0

    io.emit('STATE_UPDATE', getSerializableGameState());
  });

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
    const isTurnOwner = socket.id === gameState.turnOwner;

    gameState.players.delete(socket.id);

    if (isTurnOwner) {
      rotateTurn();
      gameState.bombTimer = 15.0;
    }

    io.emit('STATE_UPDATE', getSerializableGameState());
  });
});

// 4. Secure HTTP POST route `/api/token` for OAuth2 Discord credential exchange
app.post('/api/token', async (req, res) => {
  const { code, redirect_uri } = req.body;

  if (!code) {
    return res.status(400).json({ error: "Missing authorization code" });
  }

  try {
    const response = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.VITE_CLIENT_ID || "",
        client_secret: process.env.CLIENT_SECRET || "",
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirect_uri || "",
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Discord token exchange failed:", data);
      return res.status(response.status).json(data);
    }

    return res.json(data);
  } catch (error) {
    console.error("OAuth2 Token Exchange Proxy Error:", error);
    return res.status(500).json({ error: "Internal server error during OAuth2 token exchange" });
  }
});

// Root check route
app.get('/', (req, res) => {
  res.send('Discord BombParty Game Engine Server is running.');
});

server.listen(PORT, () => {
  console.log(`BombParty game server listening on port ${PORT}`);
});
