(function () {
  'use strict';

  // ── DOM refs ──────────────────────────────────────────────────────
  const boardEl = document.getElementById('board');
  const keyboardEl = document.getElementById('keyboard');
  const toastEl = document.getElementById('toast');
  const overlayEl = document.getElementById('overlay');
  const modalEl = document.getElementById('modal');
  const settingsPanel = document.getElementById('settings-panel');

  const btnSettings = document.getElementById('btn-settings');
  const btnHelp = document.getElementById('btn-help');

  // ── Constants ─────────────────────────────────────────────────────
  const KEYBOARD_ROWS = [
    ['a','z','e','r','t','y','u','i','o','p'],
    ['q','s','d','f','g','h','j','k','l','m'],
    ['w','x','c','v','b','n','backspace']
  ];

  const WORD_LENGTHS = [4, 5, 6, 7, 8];
  const ATTEMPT_OPTIONS = [6, 8, 0];
  const STORAGE_KEY = 'cogimot';

  // ── State ─────────────────────────────────────────────────────────
  let settings = { wordLength: 5, maxAttempts: 6 };
  let game = null;

  // ── Storage ───────────────────────────────────────────────────────
  function loadSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data.settings) settings = { ...settings, ...data.settings };
      }
    } catch (_) {}
  }

  function saveSettings() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ settings }));
    } catch (_) {}
  }

  // ── Word helpers ──────────────────────────────────────────────────
  function pickSolution(len) {
    const lists = WORD_LISTS[len];
    if (!lists) return '';
    const pool = lists.solutions.length ? lists.solutions : lists.valid;
    if (!pool.length) return '';
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function isValidWord(word, len) {
    const lists = WORD_LISTS[len];
    return lists ? lists.valid.includes(word) : false;
  }

  // ── Color calculation ─────────────────────────────────────────────
  function getColors(guess, solution) {
    const n = guess.length;
    const result = new Array(n).fill('absent');
    const solArr = solution.split('');

    for (let i = 0; i < n; i++) {
      if (guess[i] === solArr[i]) {
        result[i] = 'correct';
        solArr[i] = null;
      }
    }

    for (let i = 0; i < n; i++) {
      if (result[i] !== 'correct') {
        const idx = solArr.indexOf(guess[i]);
        if (idx !== -1) {
          result[i] = 'present';
          solArr[idx] = null;
        }
      }
    }

    return result;
  }

  // ── Helpers ───────────────────────────────────────────────────────
  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  function showToast(msg, duration = 1500) {
    toastEl.textContent = msg;
    toastEl.classList.remove('hidden');
    clearTimeout(toastEl._timer);
    toastEl._timer = setTimeout(() => toastEl.classList.add('hidden'), duration);
  }

  // ── Game logic ────────────────────────────────────────────────────
  function createGame() {
    const len = settings.wordLength;
    const max = settings.maxAttempts === 0 ? Infinity : settings.maxAttempts;
    return {
      wordLength: len,
      maxAttempts: max,
      isInfinite: max === Infinity,
      solution: pickSolution(len),
      guesses: [],
      currentGuess: '',
      gameOver: false,
      keyboardColors: {},
    };
  }

  // ── Board rendering ───────────────────────────────────────────────
  function renderBoard() {
    if (!game) return;

    const len = game.wordLength;
    const maxGuesses = game.isInfinite
      ? Math.max(game.guesses.length + 1, 6)
      : game.maxAttempts;

    boardEl.style.gridTemplateColumns = 'repeat(' + len + ', 1fr)';
    boardEl.style.gridTemplateRows = 'repeat(' + maxGuesses + ', 1fr)';
    boardEl.style.gridAutoRows = '';
    boardEl.style.height = '';
    boardEl.parentElement.style.overflowY = 'hidden';

    if (game.isInfinite) {
      boardEl.style.gridTemplateRows = 'none';
      boardEl.style.gridAutoRows = 'min(10vw, 52px)';
      boardEl.parentElement.style.overflowY = 'auto';
    }

    boardEl.innerHTML = '';

    for (let r = 0; r < maxGuesses; r++) {
      for (let c = 0; c < len; c++) {
        const tile = document.createElement('div');
        tile.className = 'tile';
        tile.dataset.row = r;
        tile.dataset.col = c;
        tile.dataset.state = 'empty';
        tile.dataset.animation = 'idle';

        if (r < game.guesses.length) {
          const colors = getColors(game.guesses[r], game.solution);
          tile.textContent = game.guesses[r][c];
          tile.dataset.state = colors[c];
        } else if (r === game.guesses.length && c < game.currentGuess.length) {
          tile.textContent = game.currentGuess[c];
          tile.dataset.state = 'tbd';
          tile.dataset.animation = 'pop';
        }

        boardEl.appendChild(tile);
      }
    }
  }

  // ── Keyboard rendering ────────────────────────────────────────────
  const isDesktop = !('ontouchstart' in window) && navigator.maxTouchPoints === 0;

  function renderKeyboard() {
    if (isDesktop) { keyboardEl.innerHTML = ''; return; }
    keyboardEl.innerHTML = '';
    const kc = game ? game.keyboardColors : {};

    KEYBOARD_ROWS.forEach((row) => {
      const rowDiv = document.createElement('div');
      rowDiv.className = 'keyboard-row';

      row.forEach((k) => {
        const btn = document.createElement('button');
        btn.className = 'key';
        btn.dataset.key = k;
        btn.setAttribute('aria-label', k);

        if (k === 'backspace') {
          btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 0 24 24" width="20"><path fill="currentColor" d="M22 3H7c-.69 0-1.23.35-1.59.88L0 12l5.41 8.11c.36.53.9.89 1.59.89h15c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-3 12.59L17.59 17 14 13.41 10.41 17 9 15.59 12.59 12 9 8.41 10.41 7 14 10.59 17.59 7 19 8.41 15.41 12 19 15.59z"></path></svg>';
          btn.classList.add('one-and-half');
        } else {
          btn.textContent = k;
          if (kc[k]) btn.classList.add(kc[k]);
        }

        btn.addEventListener('click', () => handleKey(k));
        rowDiv.appendChild(btn);
      });

      keyboardEl.appendChild(rowDiv);
    });
  }

  function updateKeyboardColors() {
    if (!game) return;
    const kc = game.keyboardColors;
    keyboardEl.querySelectorAll('.key[data-key]').forEach(btn => {
      const k = btn.dataset.key;
      if (k === 'backspace') return;
      if (kc[k]) {
        btn.classList.remove('correct', 'present', 'absent');
        btn.classList.add(kc[k]);
      }
    });
  }

  // ── Input ─────────────────────────────────────────────────────────
  function handleKey(key) {
    if (!game || game.gameOver) return;

    const len = game.wordLength;

    if (key === 'backspace') {
      if (game.currentGuess.length > 0) {
        game.currentGuess = game.currentGuess.slice(0, -1);
      }
    } else if (key === 'enter') {
      submitGuess();
      return;
    } else if (/^[a-z]$/.test(key)) {
      if (game.currentGuess.length < len) {
        game.currentGuess += key;
        if (game.currentGuess.length === len) {
          renderBoard();
          submitGuess();
          return;
        }
      }
    }

    renderBoard();
  }

  function submitGuess() {
    if (!game || game.gameOver) return;

    const guess = game.currentGuess;
    const len = game.wordLength;

    if (guess.length !== len) {
      showToast('Pas assez de lettres');
      shakeCurrentRow();
      return;
    }

    if (!isValidWord(guess, len)) {
      showToast('Mot inconnu', 3000);
      shakeCurrentRow();
      setTimeout(() => {
        game.currentGuess = '';
        renderBoard();
      }, 3000);
      return;
    }

    game.currentGuess = '';
    const colors = getColors(guess, game.solution);

    for (let i = 0; i < len; i++) {
      const letter = guess[i];
      const c = colors[i];
      const cur = game.keyboardColors[letter];
      if (!cur || c === 'correct' || (c === 'present' && cur === 'absent')) {
        game.keyboardColors[letter] = c;
      }
    }

    game.guesses.push(guess);
    renderBoard();

    const rowIdx = game.guesses.length - 1;
    animateFlip(rowIdx, colors);

    const won = guess === game.solution;
    const attempts = game.guesses.length;
    const isMaxAttempts = !game.isInfinite && attempts >= game.maxAttempts;

    if (won || isMaxAttempts) {
      game.gameOver = true;
      setTimeout(() => {
        updateKeyboardColors();
        if (won) bounceRow(rowIdx);
      }, len * 350 + 200);
      setTimeout(() => showEndModal(won, won ? attempts : 0), len * 350 + 600);
    } else {
      setTimeout(() => updateKeyboardColors(), len * 350 + 200);
      if (game.isInfinite && game.guesses.length >= game.maxAttempts - 1) {
        setTimeout(() => renderBoard(), len * 350 + 400);
      }
    }
  }

  // ── Animations ────────────────────────────────────────────────────
  async function animateFlip(rowIdx, colors) {
    const tiles = boardEl.querySelectorAll('.tile[data-row="' + rowIdx + '"]');

    for (let i = 0; i < tiles.length; i++) {
      tiles[i].dataset.animation = 'flip-in';
      await sleep(250);
      tiles[i].dataset.state = colors[i];
      tiles[i].dataset.animation = 'flip-out';
    }

    for (let i = 0; i < tiles.length; i++) {
      await sleep(250);
      tiles[i].dataset.animation = 'idle';
    }
  }

  function shakeCurrentRow() {
    const rowIdx = game.guesses.length;
    const tiles = boardEl.querySelectorAll('.tile[data-row="' + rowIdx + '"]');

    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'display:contents';
    tiles.forEach(t => t.parentNode.insertBefore(wrapper, t).appendChild(t));
    wrapper.classList.add('row-shake');

    setTimeout(() => {
      wrapper.classList.remove('row-shake');
      tiles.forEach(t => boardEl.appendChild(t));
      wrapper.remove();
    }, 600);
  }

  function bounceRow(rowIdx) {
    const tiles = boardEl.querySelectorAll('.tile[data-row="' + rowIdx + '"]');
    tiles.forEach((t, i) => {
      t.style.animationDelay = (i * 100) + 'ms';
      t.dataset.animation = 'pop';
    });
  }

  // ── Modal ─────────────────────────────────────────────────────────
  function showModal(html) {
    modalEl.innerHTML = html;
    overlayEl.classList.remove('hidden');
  }

  function hideModal() {
    overlayEl.classList.add('hidden');
  }

  function showEndModal(won, attemptCount) {
    const html = ''
      + '<h2>Le mot à deviner était :</h2>'
      + '<div class="solution-word">' + game.solution + '</div>'
      + (won ? '<p style="margin-top:8px;">Bravo, trouvé en ' + attemptCount + ' tentative' + (attemptCount > 1 ? 's' : '') + ' !</p>' : '')
      + '<button class="btn" id="btn-new-game">Nouvelle partie</button>';

    showModal(html);

    document.getElementById('btn-new-game').addEventListener('click', () => {
      hideModal();
      newGame();
    });
  }

  function showHelpModal() {
    var attStr = game ? (game.maxAttempts === Infinity ? 'autant de tentatives que tu veux' : game.maxAttempts + ' tentatives') : '6 tentatives';
    const html = ''
      + '<h2>Comment jouer</h2>'
      + '<p>Devine le mot en ' + attStr + '.</p>'
      + '<p>Après chaque proposition, les lettres changent de couleur pour t\'indiquer à quel point tu es proche.</p>'
      + '<div class="help-example">'
      + '<div class="help-row">'
      + '<div class="help-tile correct">s</div>'
      + '<div class="help-tile absent">a</div>'
      + '<div class="help-tile absent">l</div>'
      + '<div class="help-tile absent">u</div>'
      + '<div class="help-tile absent">t</div>'
      + '</div>'
      + '<p style="text-align:left;margin-top:4px;"><strong>S</strong> est dans le mot et à la bonne place.</p>'
      + '<div class="help-row" style="margin-top:12px;">'
      + '<div class="help-tile absent">p</div>'
      + '<div class="help-tile present">o</div>'
      + '<div class="help-tile absent">m</div>'
      + '<div class="help-tile absent">m</div>'
      + '<div class="help-tile absent">e</div>'
      + '</div>'
      + '<p style="text-align:left;margin-top:4px;"><strong>O</strong> est dans le mot mais à la mauvaise place.</p>'
      + '<div class="help-row" style="margin-top:12px;">'
      + '<div class="help-tile absent">r</div>'
      + '<div class="help-tile absent">e</div>'
      + '<div class="help-tile absent">g</div>'
      + '<div class="help-tile absent">a</div>'
      + '<div class="help-tile absent">l</div>'
      + '</div>'
      + '<p style="text-align:left;margin-top:4px;">Aucune de ces lettres n\'est dans le mot.</p>'
      + '</div>'
      + '<p>Un nouveau mot est tiré au sort à chaque partie.</p>'
      + '<button class="btn" id="btn-close-modal">C\'est parti !</button>';

    showModal(html);
    document.getElementById('btn-close-modal').addEventListener('click', hideModal);
  }

  function shareResult() {
    if (!game) return;
    const emojiMap = { correct: '🟩', present: '🟧', absent: '🟥' };

    let text = 'COGIMOT (' + game.wordLength + ' lettres, ' + game.guesses.length + '/';
    text += game.isInfinite ? '∞' : game.maxAttempts;
    text += ')\n\n';

    game.guesses.forEach(g => {
      text += getColors(g, game.solution).map(c => emojiMap[c]).join('') + '\n';
    });

    navigator.clipboard.writeText(text).then(() => {
      showToast('Copié dans le presse-papier !', 2000);
    }).catch(() => {
      showToast('Erreur de copie', 1500);
    });
  }

  // ── Settings ──────────────────────────────────────────────────────
  function renderSettings() {
    settingsPanel.innerHTML = ''
      + '<div class="section-title">Longueur du mot</div>'
      + '<div class="setting-options" data-setting="wordLength">'
      + WORD_LENGTHS.map(l =>
          '<button class="setting-option' + (l === settings.wordLength ? ' active' : '') + '" data-value="' + l + '">' + l + '</button>'
        ).join('')
      + '</div>'
      + '<div class="section-title">Tentatives</div>'
      + '<div class="setting-options" data-setting="maxAttempts">'
      + ATTEMPT_OPTIONS.map(a =>
          '<button class="setting-option' + (a === settings.maxAttempts ? ' active' : '') + '" data-value="' + a + '">' + (a === 0 ? '∞' : a) + '</button>'
        ).join('')
      + '</div>'
      + '<button class="btn-new-game" id="btn-new-game-settings">Nouvelle partie</button>';

    settingsPanel.querySelectorAll('.setting-option').forEach(btn => {
      btn.addEventListener('click', () => {
        const prop = btn.parentElement.dataset.setting;
        const val = parseInt(btn.dataset.value, 10);
        if (settings[prop] !== val) {
          settings[prop] = val;
          saveSettings();
          newGame();
        }
        renderSettings();
      });
    });

    const ng = settingsPanel.querySelector('#btn-new-game-settings');
    if (ng) ng.addEventListener('click', () => { newGame(); settingsPanel.classList.add('hidden'); });
  }

  function toggleSettings() {
    const hidden = settingsPanel.classList.toggle('hidden');
    if (!hidden) renderSettings();
  }

  // ── Game lifecycle ────────────────────────────────────────────────
  function newGame() {
    game = createGame();
    renderBoard();
    renderKeyboard();
    if (game.isInfinite) {
      showToast('Mode infini : pas de limite !', 2000);
    }
  }

  // ── Event listeners ───────────────────────────────────────────────
  document.addEventListener('keydown', e => {
    if (!overlayEl.classList.contains('hidden')) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    const key = e.key.toLowerCase();

    if (key === 'backspace') {
      e.preventDefault();
      handleKey('backspace');
    } else if (key === 'enter') {
      e.preventDefault();
      handleKey('enter');
    } else if (/^[a-z]$/.test(key)) {
      e.preventDefault();
      handleKey(key);
    } else {
      const base = key.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (/^[a-z]$/.test(base)) {
        e.preventDefault();
        handleKey(base);
      }
    }
  });

  btnHelp.addEventListener('click', showHelpModal);
  btnSettings.addEventListener('click', toggleSettings);
  document.getElementById('btn-reset').addEventListener('click', () => { newGame(); settingsPanel.classList.add('hidden'); });

  overlayEl.addEventListener('click', e => {
    if (e.target === overlayEl) hideModal();
  });

  // ── Init ──────────────────────────────────────────────────────────
  loadSettings();
  newGame();

})();