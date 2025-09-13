import { testDictionary, realDictionary } from "./dictionary.js";

// for testing purposes, make sure to use the test dictionary
console.log("test dictionary:", testDictionary);

const dictionary = new Set(realDictionary); // Use a Set for faster lookups
const MAX_HINTS = 2;

// --- State Management ---
let state = {
  secret: realDictionary[Math.floor(Math.random() * realDictionary.length)],
  grid: Array(6)
    .fill()
    .map(() => Array(5).fill("")),
  currentRow: 0,
  currentCol: 0,
  hintsUsed: 0,
  isGameOver: false,
};

let stats = loadStats();

// --- LocalStorage & Stats Functions ---
function loadStats() {
  const defaultStats = {
    gamesPlayed: 0,
    wins: 0,
    currentStreak: 0,
    maxStreak: 0,
    guessDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
  };
  try {
    const statsJson = localStorage.getItem("wordle-stats");
    return statsJson ? JSON.parse(statsJson) : defaultStats;
  } catch (e) {
    console.error("Could not load stats from localStorage", e);
    return defaultStats;
  }
}

function saveStats() {
  try {
    localStorage.setItem("wordle-stats", JSON.stringify(stats));
  } catch (e) {
    console.error("Could not save stats to localStorage", e);
  }
}

function updateStats(isWin) {
  stats.gamesPlayed++;
  if (isWin) {
    stats.wins++;
    stats.currentStreak++;
    if (stats.currentStreak > stats.maxStreak) {
      stats.maxStreak = stats.currentStreak;
    }
    stats.guessDistribution[state.currentRow + 1]++;
  } else {
    stats.currentStreak = 0;
  }
  saveStats();
}

// --- Grid & UI Functions ---
function drawGrid(container) {
  const grid = document.createElement("div");
  grid.className = "grid";
  for (let i = 0; i < 6; i++) {
    const row = document.createElement("div");
    row.className = "row";
    row.id = `row-${i}`;
    for (let j = 0; j < 5; j++) {
      drawBox(row, i, j);
    }
    grid.appendChild(row);
  }
  container.appendChild(grid);
}

function updateGrid() {
  for (let i = 0; i < state.grid.length; i++) {
    for (let j = 0; j < state.grid[i].length; j++) {
      const box = document.getElementById(`box${i}${j}`);
      box.textContent = state.grid[i][j];
    }
  }
}

function drawBox(container, row, col) {
  const box = document.createElement("div");
  box.className = "box";
  box.id = `box${row}${col}`;
  container.appendChild(box);
  return box;
}

function showNotification(message, duration = 1000) {
  const container = document.getElementById("notification-container");
  const notification = document.createElement("div");
  notification.textContent = message;
  notification.className = "notification";
  container.appendChild(notification);
  setTimeout(() => notification.classList.add("show"), 10);
  setTimeout(() => {
    notification.classList.remove("show");
    notification.addEventListener("transitionend", () => notification.remove());
  }, duration);
}

// --- Keyboard Functions ---
function drawKeyboard() {
    const keyboardContainer = document.getElementById('keyboard-container');
    if (!keyboardContainer) return;

    const keysLayout = [
        "q w e r t y u i o p",
        "a s d f g h j k l",
        "backspace z x c v b n m enter"
    ];

    keysLayout.forEach(row => {
        const rowEl = document.createElement('div');
        rowEl.className = 'keyboard-row';
        row.split(' ').forEach(key => {
            const keyEl = document.createElement('button');
            keyEl.className = 'key';
            keyEl.dataset.key = key;

            if (key === 'enter' || key === 'backspace') {
                keyEl.classList.add('large');
                keyEl.textContent = key;
            } else {
                keyEl.textContent = key;
            }
            rowEl.appendChild(keyEl);
        });
        keyboardContainer.appendChild(rowEl);
    });
}

function updateKeyboardColors(guess, result) {
    for (let i = 0; i < guess.length; i++) {
        const letter = guess[i];
        const status = result[i];
        const keyEl = document.querySelector(`.key[data-key="${letter}"]`);
        if (!keyEl) continue;

        const currentStatus = keyEl.className;
        if (currentStatus.includes('right')) continue;
        if (currentStatus.includes('wrong') && status !== 'right') continue;
        
        keyEl.classList.remove('wrong', 'empty');
        keyEl.classList.add(status);
    }
}

function resetKeyboardColors() {
    const keys = document.querySelectorAll('.key');
    keys.forEach(key => {
        key.classList.remove('right', 'wrong', 'empty');
    });
}

// --- Game Logic ---
function handleInput(key) {
    if (state.isGameOver) return;
    
    if (key === "enter") {
        if (state.currentCol === 5) {
            const word = getCurrentWord();
            if (isWordValid(word)) {
                submitGuess(word);
            } else {
                showNotification("Not a valid word");
                const currentRowEl = document.getElementById(`row-${state.currentRow}`);
                currentRowEl.classList.add("shake");
                currentRowEl.addEventListener("animationend", () => {
                    currentRowEl.classList.remove("shake");
                }, { once: true });
            }
        }
    } else if (key === "backspace") {
        removeLetter();
    } else if (isLetter(key)) {
        addLetter(key);
    }
    updateGrid();
}

function registerKeyboardEvents() {
  document.body.onkeydown = (e) => handleInput(e.key.toLowerCase());
}

function getCurrentWord() {
  return state.grid[state.currentRow].reduce((prev, curr) => prev + curr, "");
}

function isWordValid(word) {
  return dictionary.has(word);
}

function computeGuessResult(guess, secret) {
  const result = [];
  const secretLetters = secret.split("");
  const guessLetters = guess.split("");

  // Pass 1: Find 'right' letters
  for (let i = 0; i < 5; i++) {
    if (guessLetters[i] === secretLetters[i]) {
      result[i] = "right";
      secretLetters[i] = null;
      guessLetters[i] = null;
    }
  }

  // Pass 2: Find 'wrong' and 'empty' letters
  for (let i = 0; i < 5; i++) {
    if (guessLetters[i] !== null) {
      const indexInSecret = secretLetters.indexOf(guessLetters[i]);
      if (indexInSecret !== -1) {
        result[i] = "wrong";
        secretLetters[indexInSecret] = null;
      } else {
        result[i] = "empty";
      }
    }
  }
  return result;
}

async function submitGuess(word) {
  await revealWord(word);
  if (!state.isGameOver) {
    state.currentRow++;
    state.currentCol = 0;
  }
}

function revealWord(guess) {
  return new Promise((resolve) => {
    const row = state.currentRow;
    const animation_duration = 500;
    const results = computeGuessResult(guess, state.secret);

    for (let i = 0; i < 5; i++) {
      const box = document.getElementById(`box${row}${i}`);
      setTimeout(() => {
        box.classList.add(results[i]);
      }, ((i + 1) * animation_duration) / 2);

      box.classList.add("animated");
      box.style.animationDelay = `${(i * animation_duration) / 2}ms`;
    }

    const isWinner = state.secret === guess;
    const isGameOverOnThisTurn = state.currentRow === 5;

    setTimeout(() => {
      updateKeyboardColors(guess, results);
      if (isWinner) {
        state.isGameOver = true;
        showNotification("Congratulations!", 3000);
        updateStats(true);
        setTimeout(showStatsModal, 3000);
      } else if (isGameOverOnThisTurn) {
        state.isGameOver = true;
        showNotification(`The word was: ${state.secret}`, 5000);
        updateStats(false);
        setTimeout(showStatsModal, 3000);
      }
      resolve();
    }, 3 * animation_duration);
  });
}

function isLetter(key) {
  return key.length === 1 && key.match(/[a-z]/i);
}

function addLetter(letter) {
  if (state.currentCol === 5) return;
  state.grid[state.currentRow][state.currentCol] = letter.toLowerCase();
  state.currentCol++;
}

function removeLetter() {
  if (state.currentCol === 0) return;
  state.grid[state.currentRow][state.currentCol - 1] = "";
  state.currentCol--;
}

function useHint() {
  if (state.hintsUsed >= MAX_HINTS || state.isGameOver) return;

  const unrevealedIndices = [];
  for (let i = 0; i < 5; i++) {
    if (state.grid[state.currentRow][i] !== state.secret[i]) {
      unrevealedIndices.push(i);
    }
  }

  if (unrevealedIndices.length === 0) {
    showNotification("All letters are already correct!", 1500);
    return;
  }

  const randomIndex = unrevealedIndices[Math.floor(Math.random() * unrevealedIndices.length)];
  const correctLetter = state.secret[randomIndex];

  state.grid[state.currentRow][randomIndex] = correctLetter;

  updateGrid();
  state.hintsUsed++;
  updateHintButton();
}

function updateHintButton() {
  const hintCountEl = document.getElementById("hint-count");
  const hintButtonEl = document.getElementById("hint-button");
  const remainingHints = MAX_HINTS - state.hintsUsed;
  hintCountEl.textContent = `(${remainingHints})`;
  hintButtonEl.disabled = remainingHints <= 0 || state.isGameOver;
}

function restartGame() {
  state.secret = realDictionary[Math.floor(Math.random() * realDictionary.length)];
  state.grid = Array(6).fill().map(() => Array(5).fill(""));
  state.currentRow = 0;
  state.currentCol = 0;
  state.hintsUsed = 0;
  state.isGameOver = false;

  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 5; j++) {
      const box = document.getElementById(`box${i}${j}`);
      box.textContent = "";
      box.classList.remove("right", "wrong", "empty", "animated");
      box.style.animationDelay = "";
    }
  }

  updateHintButton();
  resetKeyboardColors();
}

// --- Stats Modal Functions ---
function showStatsModal() {
  document.getElementById("games-played").textContent = stats.gamesPlayed;
  const winPercent = stats.gamesPlayed > 0 ? Math.round((stats.wins / stats.gamesPlayed) * 100) : 0;
  document.getElementById("win-percentage").textContent = winPercent;
  document.getElementById("current-streak").textContent = stats.currentStreak;
  document.getElementById("max-streak").textContent = stats.maxStreak;

  const distContainer = document.querySelector(".guess-distribution");
  distContainer.innerHTML = "";
  const maxDist = Math.max(...Object.values(stats.guessDistribution), 1);

  for (let i = 1; i <= 6; i++) {
    const count = stats.guessDistribution[i] || 0;
    const percentage = (count / maxDist) * 100;

    const row = document.createElement("div");
    row.className = "dist-row";
    row.innerHTML = `
      <div class="dist-label">${i}</div>
      <div class="dist-bar-container">
        <div class="dist-bar" style="width: ${percentage}%;">${count}</div>
      </div>
    `;

    if (state.isGameOver && stats.currentStreak > 0 && state.currentRow + 1 === i) {
        row.querySelector('.dist-bar').classList.add("highlight");
    }

    distContainer.appendChild(row);
  }

  document.getElementById("stats-modal").classList.remove("hidden");
}

function hideStatsModal() {
  document.getElementById("stats-modal").classList.add("hidden");
}

// --- Initialization ---
function startup() {
  drawGrid(document.getElementById("game"));
  drawKeyboard();
  registerKeyboardEvents();

  // Event Listeners
  document.getElementById("hint-button").addEventListener("click", useHint);
  document.getElementById("restart-button").addEventListener("click", restartGame);
  document.getElementById("stats-button").addEventListener("click", showStatsModal);
  document.getElementById("close-modal-button").addEventListener("click", hideStatsModal);
  
  const keyboardContainer = document.getElementById("keyboard-container");
  const toggleKeyboardButton = document.getElementById("toggle-keyboard-button");
  if(toggleKeyboardButton && keyboardContainer){
    toggleKeyboardButton.addEventListener("click", () => {
        keyboardContainer.classList.toggle("hidden");
    });
    keyboardContainer.addEventListener("click", (e) => {
        if (e.target.matches(".key")) {
            handleInput(e.target.dataset.key);
        }
    });
  }

  document.getElementById("stats-modal").addEventListener("click", (e) => {
    if (e.target.id === "stats-modal") {
      hideStatsModal();
    }
  });

  updateHintButton();
}

startup();

