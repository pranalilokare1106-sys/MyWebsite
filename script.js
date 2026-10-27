/**
 * ==============================================================================
 * Foundations of Artificial Intelligence (FAI) Mini Project:
 * AI-Based Tic-Tac-Toe Game Using the Minimax Algorithm
 * File: script.js
 * ==============================================================================
 * This script implements an unbeatable Tic-Tac-Toe agent powered by the classic
 * Minimax algorithm, an adversarial search algorithm used in two-player,
 * zero-sum, perfect-information games.
 *
 * KEY CONCEPTS EXPLAINED IN CODE:
 * 1. Zero-Sum Game: One player's gain is the exact loss of the opponent.
 * 2. Maximizer vs. Minimizer:
 *    - Computer (O) is the Maximizer (seeks maximum positive score).
 *    - Human (X) is the Minimizer (seeks lowest/most negative score for AI).
 * 3. Terminal State Evaluation:
 *    - AI Win: +10 - depth (favors quicker wins)
 *    - Human Win: -10 + depth (delays losses as long as possible)
 *    - Draw: 0
 * 4. Backtracking: Simulating moves and undoing them to explore the game tree.
 * ==============================================================================
 */

// ==========================================
// 1. CONSTANTS & GAME CONFIGURATION
// ==========================================
const HUMAN = 'X';      // Human player symbol
const AI = 'O';         // Computer player symbol
const EMPTY = '';       // Empty board cell representation

// The 8 possible 3-in-a-row winning alignments on a 3x3 grid
// Indexed 0 through 8:
//  0 | 1 | 2
// -----------
//  3 | 4 | 5
// -----------
//  6 | 7 | 8
const WINNING_COMBOS = [
  [0, 1, 2], // Row 1
  [3, 4, 5], // Row 2
  [6, 7, 8], // Row 3
  [0, 3, 6], // Column 1
  [1, 4, 7], // Column 2
  [2, 5, 8], // Column 3
  [0, 4, 8], // Diagonal top-left to bottom-right
  [2, 4, 6]  // Diagonal top-right to bottom-left
];

// ==========================================
// 2. GAME STATE VARIABLES
// ==========================================
let board = Array(9).fill(EMPTY); // Current 9-cell board state
let currentPlayer = HUMAN;        // Tracks whose turn it is
let isGameOver = false;           // Flag to prevent interactions when game finishes
let isAiThinking = false;         // Flag to prevent clicks while AI calculates
let starter = 'player';           // Who starts the round: 'player' or 'ai'
let aiMode = 'unbeatable';        // 'unbeatable' (Pure Minimax) or 'casual' (Smart)

// Persistent Score Counter
const scores = {
  player: 0,
  draws: 0,
  ai: 0
};

// Telemetry counters for academic inspection
let nodesEvaluatedCount = 0;

// ==========================================
// 3. DOM ELEMENT REFERENCES
// ==========================================
const boardElement = document.getElementById('board');
const cells = Array.from(document.querySelectorAll('.cell'));
const statusBanner = document.getElementById('statusBanner');
const statusIcon = document.getElementById('statusIcon');
const statusText = document.getElementById('statusText');

const playerScoreEl = document.getElementById('playerScore');
const drawScoreEl = document.getElementById('drawScore');
const aiScoreEl = document.getElementById('aiScore');

const playerScoreCard = document.getElementById('playerScoreCard');
const aiScoreCard = document.getElementById('aiScoreCard');

const restartRoundBtn = document.getElementById('restartRoundBtn');
const resetScoresBtn = document.getElementById('resetScoresBtn');

const firstPlayerBtn = document.getElementById('firstPlayerBtn');
const firstAiBtn = document.getElementById('firstAiBtn');
const unbeatableModeBtn = document.getElementById('unbeatableModeBtn');
const casualModeBtn = document.getElementById('casualModeBtn');

// Telemetry metrics
const metricNodesEl = document.getElementById('metricNodes');
const metricTimeEl = document.getElementById('metricTime');
const metricScoreEl = document.getElementById('metricScore');
const metricTargetEl = document.getElementById('metricTarget');
const telemetryStateEl = document.getElementById('telemetryState');

// ==========================================
// 4. AUDIO SYNTHESIZER (Pure Web Audio API)
//    Provides tactile audio feedback without external audio files
// ==========================================
class SoundFX {
  constructor() {
    this.ctx = null;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
  }

  playTone(frequency, duration, type = 'sine', volume = 0.08) {
    try {
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(frequency, this.ctx.currentTime);

      gain.gain.setValueAtTime(volume, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      // Audio autoplay policy fallback
    }
  }

  clickSound() {
    this.playTone(520, 0.08, 'triangle', 0.06);
  }

  aiMoveSound() {
    this.playTone(380, 0.12, 'sine', 0.08);
  }

  winSound() {
    setTimeout(() => this.playTone(523.25, 0.15, 'sine', 0.1), 0);
    setTimeout(() => this.playTone(659.25, 0.18, 'sine', 0.1), 120);
    setTimeout(() => this.playTone(783.99, 0.35, 'sine', 0.12), 260);
  }

  drawSound() {
    setTimeout(() => this.playTone(440, 0.12, 'sawtooth', 0.05), 0);
    setTimeout(() => this.playTone(392, 0.25, 'sine', 0.06), 120);
  }
}

const sfx = new SoundFX();

// ==========================================
// 5. CORE HELPER FUNCTIONS
// ==========================================

/**
 * Checks if a given board configuration has a winner.
 * @param {Array<string>} currentBoard - 9-element array representing board.
 * @returns {object|null} Returns { winner: 'X'|'O', combo: [idx1, idx2, idx3] } or null if no winner.
 */
function checkWinner(currentBoard) {
  for (let i = 0; i < WINNING_COMBOS.length; i++) {
    const [a, b, c] = WINNING_COMBOS[i];
    if (
      currentBoard[a] !== EMPTY &&
      currentBoard[a] === currentBoard[b] &&
      currentBoard[a] === currentBoard[c]
    ) {
      return { winner: currentBoard[a], combo: [a, b, c] };
    }
  }
  return null;
}

/**
 * Returns a list of indices corresponding to open/empty cells on the board.
 * @param {Array<string>} currentBoard
 * @returns {Array<number>} List of indices (0-8)
 */
function getAvailableMoves(currentBoard) {
  const moves = [];
  for (let i = 0; i < currentBoard.length; i++) {
    if (currentBoard[i] === EMPTY) {
      moves.push(i);
    }
  }
  return moves;
}

/**
 * Checks whether the board has any remaining legal moves.
 * @param {Array<string>} currentBoard
 * @returns {boolean} True if board has no empty cells.
 */
function isBoardFull(currentBoard) {
  return !currentBoard.includes(EMPTY);
}

// ==========================================
// 6. MINIMAX ALGORITHM IMPLEMENTATION
// ==========================================

/**
 * The Minimax Algorithm with Depth-Discounted Heuristic Evaluation.
 *
 * @param {Array<string>} currentBoard - The simulated board state at current recursive step.
 * @param {number} depth - Recursion depth (tree level), used to penalize delayed wins.
 * @param {boolean} isMaximizing - True if current recursive turn is Maximizer (Computer 'O'),
 *                                 False if Minimizer (Human 'X').
 * @returns {number} The minimax evaluation score of the board state.
 *
 * HOW IT WORKS STEP-BY-STEP:
 * 1. Base Case / Terminal Check:
 *    - Does anyone have 3 in a row?
 *      * If Computer (O) won, return (+10 - depth).
 *        Subtracting depth ensures AI prefers a quick 1-step win over a 5-step win.
 *      * If Human (X) won, return (-10 + depth).
 *        Adding depth ensures AI prolongs the game as much as possible if defeat is inevitable.
 *    - Is the board completely full? Return 0 (Draw).
 *
 * 2. Recursive Case for Maximizing Player (AI 'O'):
 *    - AI wants to maximize the evaluation score.
 *    - Set maxEval = -Infinity.
 *    - For each possible empty square:
 *      a) Place 'O' (Simulate move).
 *      b) Recurse: eval = minimax(board, depth + 1, false).
 *      c) Undo move: restore square to EMPTY (Backtracking).
 *      d) maxEval = Math.max(maxEval, eval).
 *    - Return maxEval.
 *
 * 3. Recursive Case for Minimizing Player (Human 'X'):
 *    - Human is assumed to make optimal moves minimizing AI's score.
 *    - Set minEval = +Infinity.
 *    - For each possible empty square:
 *      a) Place 'X' (Simulate move).
 *      b) Recurse: eval = minimax(board, depth + 1, true).
 *      c) Undo move: restore square to EMPTY (Backtracking).
 *      d) minEval = Math.min(minEval, eval).
 *    - Return minEval.
 */
function minimax(currentBoard, depth, isMaximizing) {
  nodesEvaluatedCount++; // Track number of game tree nodes visited

  // --- Step 1: Terminal State Checks ---
  const winState = checkWinner(currentBoard);
  if (winState) {
    if (winState.winner === AI) {
      // Maximizer won: higher score is better, shallower depth is favored
      return 10 - depth;
    } else if (winState.winner === HUMAN) {
      // Minimizer won: lower (negative) score is better for human
      return -10 + depth;
    }
  }

  // Draw check (terminal state with no winner)
  if (isBoardFull(currentBoard)) {
    return 0;
  }

  // --- Step 2: Recursive Search & Backtracking ---
  const availableMoves = getAvailableMoves(currentBoard);

  if (isMaximizing) {
    // Maximizer's Turn (Computer 'O')
    let maxEval = -Infinity;

    for (let i = 0; i < availableMoves.length; i++) {
      const move = availableMoves[i];

      // 1. Simulate Move
      currentBoard[move] = AI;

      // 2. Recurse down the game tree
      const evaluation = minimax(currentBoard, depth + 1, false);

      // 3. Backtrack: Undo the move to restore original board
      currentBoard[move] = EMPTY;

      // 4. Track highest score found
      maxEval = Math.max(maxEval, evaluation);
    }
    return maxEval;
  } else {
    // Minimizer's Turn (Human 'X')
    let minEval = +Infinity;

    for (let i = 0; i < availableMoves.length; i++) {
      const move = availableMoves[i];

      // 1. Simulate Move
      currentBoard[move] = HUMAN;

      // 2. Recurse down the game tree
      const evaluation = minimax(currentBoard, depth + 1, true);

      // 3. Backtrack: Undo the move to restore original board
      currentBoard[move] = EMPTY;

      // 4. Track lowest score found
      minEval = Math.min(minEval, evaluation);
    }
    return minEval;
  }
}

/**
 * Evaluates all currently available moves on the board using Minimax,
 * and returns the index of the optimal move for Computer (O).
 *
 * @param {Array<string>} currentBoard
 * @returns {object} { bestMoveIndex: number, bestScore: number }
 */
function findBestMove(currentBoard) {
  const availableMoves = getAvailableMoves(currentBoard);

  // If casual mode is active, introduce a 20% chance to pick a random legal move
  // so beginners can experience a win if desired
  if (aiMode === 'casual' && Math.random() < 0.25) {
    const randomMove = availableMoves[Math.floor(Math.random() * availableMoves.length)];
    return { bestMoveIndex: randomMove, bestScore: 0 };
  }

  let bestScore = -Infinity;
  let bestMoveIndex = availableMoves[0];

  // Evaluate each legal move available at the root level of the game tree
  for (let i = 0; i < availableMoves.length; i++) {
    const move = availableMoves[i];

    // Place candidate AI move
    currentBoard[move] = AI;

    // Run Minimax assuming it is now Human's turn (Minimizer)
    const moveScore = minimax(currentBoard, 0, false);

    // Backtrack
    currentBoard[move] = EMPTY;

    // If this move yields a strictly better minimax value, save it
    if (moveScore > bestScore) {
      bestScore = moveScore;
      bestMoveIndex = move;
    }
  }

  return { bestMoveIndex, bestScore };
}

// ==========================================
// 7. USER INTERFACE & GAMEPLAY LOGIC
// ==========================================

/**
 * Updates the turn banner text, icon, and visual card highlights.
 */
function updateStatusUI() {
  // Clear turn classes
  playerScoreCard.classList.remove('active-turn');
  aiScoreCard.classList.remove('active-turn');
  statusBanner.className = 'status-banner';

  if (isGameOver) return;

  if (currentPlayer === HUMAN) {
    playerScoreCard.classList.add('active-turn');
    statusBanner.classList.add('player-turn');
    statusIcon.textContent = '⚡';
    statusText.textContent = 'Your turn (X) — Select any empty square';
  } else {
    aiScoreCard.classList.add('active-turn');
    statusBanner.classList.add('ai-turn');
    statusIcon.textContent = '🤖';
    statusText.textContent = 'Computer (O) is calculating optimal move...';
  }
}

/**
 * Handles cell click / selection by the human player.
 * @param {number} index - Index of cell clicked (0-8).
 */
function handleCellClick(index) {
  // Disallow clicks if game is over, square is already marked, or AI is currently computing
  if (isGameOver || isAiThinking || board[index] !== EMPTY) {
    return;
  }

  // Human player makes move
  makeMove(index, HUMAN);
  sfx.clickSound();

  // Check if human won (should be impossible in pure Minimax, but verified) or draw
  const winState = checkWinner(board);
  if (winState) {
    endGame(winState);
    return;
  }

  if (isBoardFull(board)) {
    endGame({ winner: 'draw' });
    return;
  }

  // Switch to Computer's turn
  currentPlayer = AI;
  updateStatusUI();
  triggerAiTurn();
}

/**
 * Executes a move on the board and updates DOM element.
 * @param {number} index - Board index (0-8)
 * @param {string} player - HUMAN ('X') or AI ('O')
 */
function makeMove(index, player) {
  board[index] = player;
  const cell = cells[index];
  cell.textContent = player === HUMAN ? '✕' : '◯';
  cell.classList.add(player.toLowerCase());
  cell.setAttribute('aria-label', `Square ${index + 1}, ${player}`);
  cell.disabled = true;
}

/**
 * Initiates the AI's turn with visual telemetry and a realistic humanized delay.
 */
function triggerAiTurn() {
  isAiThinking = true;
  telemetryStateEl.textContent = 'Calculating...';
  telemetryStateEl.classList.add('thinking');

  // Slight natural delay (~280ms) so AI moves feel intentional rather than jarringly instant
  setTimeout(() => {
    nodesEvaluatedCount = 0;
    const startTime = performance.now();

    // Run Minimax algorithm
    const { bestMoveIndex, bestScore } = findBestMove(board);

    const endTime = performance.now();
    const elapsedTime = Math.max(1, Math.round(endTime - startTime));

    // Update real-time telemetry card
    metricNodesEl.textContent = nodesEvaluatedCount.toLocaleString();
    metricTimeEl.textContent = `${elapsedTime} ms`;
    metricScoreEl.textContent = bestScore > 0 ? `+${bestScore}` : `${bestScore}`;
    metricTargetEl.textContent = `Square ${bestMoveIndex + 1}`;
    telemetryStateEl.textContent = 'Move Placed';
    telemetryStateEl.classList.remove('thinking');

    // Commit AI move to the board
    makeMove(bestMoveIndex, AI);
    sfx.aiMoveSound();

    // Check game outcome after AI move
    const winState = checkWinner(board);
    if (winState) {
      endGame(winState);
      isAiThinking = false;
      return;
    }

    if (isBoardFull(board)) {
      endGame({ winner: 'draw' });
      isAiThinking = false;
      return;
    }

    // Hand turn back to human player
    currentPlayer = HUMAN;
    isAiThinking = false;
    updateStatusUI();
  }, 280);
}

/**
 * Handles completion of the game (Win, Loss, or Draw).
 * @param {object} outcome - { winner: 'X'|'O'|'draw', combo: [idx1, idx2, idx3] }
 */
function endGame(outcome) {
  isGameOver = true;
  playerScoreCard.classList.remove('active-turn');
  aiScoreCard.classList.remove('active-turn');

  if (outcome.winner === 'draw') {
    // Draw Scenario
    scores.draws++;
    drawScoreEl.textContent = scores.draws;
    drawScoreEl.classList.add('bump');
    setTimeout(() => drawScoreEl.classList.remove('bump'), 400);

    statusBanner.className = 'status-banner draw';
    statusIcon.textContent = '🤝';
    statusText.textContent = "It's a Draw! Optimal play achieved by both sides.";
    sfx.drawSound();
  } else {
    // Win / Loss Scenario
    const winner = outcome.winner;
    const combo = outcome.combo;

    // Highlight winning cells with celebration styling
    combo.forEach(idx => {
      cells[idx].classList.add('winner', winner.toLowerCase());
    });

    if (winner === AI) {
      scores.ai++;
      aiScoreEl.textContent = scores.ai;
      aiScoreEl.classList.add('bump');
      setTimeout(() => aiScoreEl.classList.remove('bump'), 400);

      statusBanner.className = 'status-banner win-o';
      statusIcon.textContent = '👑';
      statusText.textContent = 'Computer (O) won! Minimax found the optimal path.';
      sfx.winSound();
    } else {
      scores.player++;
      playerScoreEl.textContent = scores.player;
      playerScoreEl.classList.add('bump');
      setTimeout(() => playerScoreEl.classList.remove('bump'), 400);

      statusBanner.className = 'status-banner win-x';
      statusIcon.textContent = '🎉';
      statusText.textContent = 'Player (X) won! Outstanding game!';
      sfx.winSound();
    }
  }

  // Disable any remaining empty cells
  cells.forEach(cell => {
    cell.disabled = true;
  });
}

/**
 * Restarts the current round while preserving existing scores.
 */
function restartRound() {
  // Reset board array
  board = Array(9).fill(EMPTY);
  isGameOver = false;
  isAiThinking = false;

  // Clear cells in DOM
  cells.forEach((cell, index) => {
    cell.textContent = '';
    cell.className = 'cell';
    cell.setAttribute('aria-label', `Square ${index + 1}, empty`);
    cell.disabled = false;
  });

  // Reset telemetry status
  telemetryStateEl.textContent = 'Ready';
  telemetryStateEl.classList.remove('thinking');
  metricTargetEl.textContent = 'Square -';
  metricScoreEl.textContent = '-';

  // Determine starting turn based on user toggle
  currentPlayer = starter === 'player' ? HUMAN : AI;
  updateStatusUI();

  // If AI starts first, trigger its opening move
  if (currentPlayer === AI) {
    triggerAiTurn();
  }
}

/**
 * Resets all scores back to zero and begins a clean round.
 */
function resetAllScores() {
  scores.player = 0;
  scores.draws = 0;
  scores.ai = 0;

  playerScoreEl.textContent = '0';
  drawScoreEl.textContent = '0';
  aiScoreEl.textContent = '0';

  restartRound();
}

// ==========================================
// 8. EVENT LISTENERS & INITIALIZATION
// ==========================================

// Add cell click listeners and keyboard accessibility
cells.forEach((cell, index) => {
  cell.addEventListener('click', () => handleCellClick(index));

  // Enable keyboard play with Enter or Space
  cell.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleCellClick(index);
    }
  });
});

// Restart & Reset Score buttons
restartRoundBtn.addEventListener('click', () => {
  sfx.clickSound();
  restartRound();
});

resetScoresBtn.addEventListener('click', () => {
  sfx.clickSound();
  resetAllScores();
});

// Starter selector buttons
firstPlayerBtn.addEventListener('click', () => {
  if (starter === 'player') return;
  starter = 'player';
  firstPlayerBtn.classList.add('active');
  firstPlayerBtn.setAttribute('aria-checked', 'true');
  firstAiBtn.classList.remove('active');
  firstAiBtn.setAttribute('aria-checked', 'false');
  restartRound();
});

firstAiBtn.addEventListener('click', () => {
  if (starter === 'ai') return;
  starter = 'ai';
  firstAiBtn.classList.add('active');
  firstAiBtn.setAttribute('aria-checked', 'true');
  firstPlayerBtn.classList.remove('active');
  firstPlayerBtn.setAttribute('aria-checked', 'false');
  restartRound();
});

// AI Mode selector buttons
unbeatableModeBtn.addEventListener('click', () => {
  aiMode = 'unbeatable';
  unbeatableModeBtn.classList.add('active');
  unbeatableModeBtn.setAttribute('aria-checked', 'true');
  casualModeBtn.classList.remove('active');
  casualModeBtn.setAttribute('aria-checked', 'false');
});

casualModeBtn.addEventListener('click', () => {
  aiMode = 'casual';
  casualModeBtn.classList.add('active');
  casualModeBtn.setAttribute('aria-checked', 'true');
  unbeatableModeBtn.classList.remove('active');
  unbeatableModeBtn.setAttribute('aria-checked', 'false');
});

// Initialize game on load
updateStatusUI();
