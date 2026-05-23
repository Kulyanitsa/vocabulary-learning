let vocabData = {};
let words = [];
let progress = {};
let currentIndex = 0;
let isFlipped = false;
let quizCorrect = 0;
let quizTotal = 0;
let currentMode = 'flashcard';
let selectedVoice = null;
let englishVoices = [];
let currentContextWord = null;
let currentContextSentence = null;

// === LOCAL STORAGE ===
function loadProgress() {
  const saved = localStorage.getItem('vocab_progress');
  if (saved) {
    try {
      progress = JSON.parse(saved);
      words.forEach(w => {
        if (!progress[w]) progress[w] = { status: 'изучается', correct: 0, lastReview: null };
      });
    } catch(e) {
      initProgress();
    }
  } else {
    initProgress();
  }
}
function initProgress() {
  progress = {};
  words.forEach(w => { progress[w] = { status: 'изучается', correct: 0, lastReview: null }; });
}
function saveProgress() {
  localStorage.setItem('vocab_progress', JSON.stringify(progress));
}

// === THEME ===
function toggleTheme() {
  document.body.classList.toggle('dark');
  const isDark = document.body.classList.contains('dark');
  localStorage.setItem('vocab_theme', isDark ? 'dark' : 'light');
  document.getElementById('theme-btn').textContent = isDark ? '☀️' : '🌙';
}
function loadTheme() {
  if (localStorage.getItem('vocab_theme') === 'dark') {
    document.body.classList.add('dark');
    document.getElementById('theme-btn').textContent = '☀️';
  }
}

// === SPEECH ===
function loadVoices() {
  const voices = speechSynthesis.getVoices();
  englishVoices = voices.filter(v => v.lang.startsWith('en'));
  if (englishVoices.length === 0) { setTimeout(loadVoices, 100); return; }
  const select = document.getElementById('voice-select');
  select.innerHTML = '';
  const priority = ['Google', 'Microsoft', 'Samantha', 'Daniel', 'Karen', 'Alex', 'Premium', 'Enhanced', 'Neural'];
  englishVoices.sort((a, b) => {
    const aScore = priority.reduce((s, kw) => s + (a.name.includes(kw) ? 1 : 0), 0);
    const bScore = priority.reduce((s, kw) => s + (b.name.includes(kw) ? 1 : 0), 0);
    return bScore - aScore;
  });
  englishVoices.forEach((voice, i) => {
    const option = document.createElement('option');
    option.value = i;
    option.textContent = `${voice.name} (${voice.lang})`;
    select.appendChild(option);
  });
  selectedVoice = englishVoices[0];
  const savedVoice = localStorage.getItem('vocab_voice');
  if (savedVoice !== null) {
    const idx = parseInt(savedVoice);
    if (idx < englishVoices.length) {
      selectedVoice = englishVoices[idx];
      select.value = idx;
    }
  }
}
function onVoiceChange() {
  const idx = document.getElementById('voice-select').value;
  selectedVoice = englishVoices[idx];
  localStorage.setItem('vocab_voice', idx);
}
function speak(text, rate = 0.85) {
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  if (selectedVoice) u.voice = selectedVoice;
  u.lang = 'en-US';
  u.rate = rate;
  u.pitch = 1.0;
  u.volume = 1.0;
  speechSynthesis.speak(u);
}
function testVoice() { speak('Hello, this is a test of pronunciation', 0.9); }
function speakWord(event) { if(event) event.stopPropagation(); speak(words[currentIndex]); }
function speakCardContext(event) { if(event) event.stopPropagation(); const t = vocabData[words[currentIndex]].context; if(t) speak(t, 0.9); }
function speakContextWord() { if(currentContextWord) speak(currentContextWord); }
function speakContextSentence() { if(currentContextSentence) speak(currentContextSentence, 0.9); }
function autoSpeakIfEnabled(text, rate = 0.85) {
  if (document.getElementById('auto-speak').checked) {
    setTimeout(() => speak(text, rate), 200);
  }
}
if (speechSynthesis.onvoiceschanged !== undefined) {
  speechSynthesis.onvoiceschanged = loadVoices;
}

// === UI ===
function updateStats() {
  const learned = Object.values(progress).filter(p => p.status === 'выучено').length;
  const learning = Object.values(progress).filter(p => p.status === 'изучается').length;
  const percent = Math.round((learned / words.length) * 100);
  document.getElementById('total-words').textContent = words.length;
  document.getElementById('learning-words').textContent = learning;
  document.getElementById('learned-words').textContent = learned;
  document.getElementById('progress-percent').textContent = percent + '%';
}

function switchMode(mode) {
  currentMode = mode;
  ['flashcard','quiz','context','settings'].forEach(m => {
    document.getElementById('mode-' + m).style.display = (m === mode) ? 'block' : 'none';
    document.getElementById('tab-' + m).classList.toggle('active', m === mode);
  });
  if (mode === 'quiz') { quizCorrect = 0; quizTotal = 0; loadQuiz(); }
  else if (mode === 'context') loadContext();
  else if (mode === 'settings') loadSettings();
  else updateFlashcard();
}

function updateFlashcard(autoSpeak = false) {
  isFlipped = false;
  const word = words[currentIndex];
  const data = vocabData[word];
  document.getElementById('card-word').textContent = word;
  document.getElementById('card-ipa').textContent = data.ipa;
  document.getElementById('card-translation-front').textContent = data.translation;
  document.getElementById('card-translation-back').textContent = data.translation;
  document.getElementById('card-word-small').textContent = word;
  document.getElementById('front-side').style.display = 'block';
  document.getElementById('back-side').style.display = 'none';
  document.getElementById('context-text').textContent = data.context || '(нет контекста)';
  document.getElementById('progress-text').textContent = `Слово ${currentIndex + 1} из ${words.length}`;
  document.getElementById('flashcard').classList.remove('flipped');
  if (autoSpeak) autoSpeakIfEnabled(word);
}

function flipCard() {
  isFlipped = !isFlipped;
  if (isFlipped) {
    document.getElementById('front-side').style.display = 'none';
    document.getElementById('back-side').style.display = 'block';
    document.getElementById('flashcard').classList.add('flipped');
  } else {
    document.getElementById('front-side').style.display = 'block';
    document.getElementById('back-side').style.display = 'none';
    document.getElementById('flashcard').classList.remove('flipped');
  }
}

function cardAction(difficulty) {
  const word = words[currentIndex];
  progress[word].correct++;
  if (difficulty === 'easy') progress[word].status = 'выучено';
  progress[word].lastReview = new Date().toISOString().split('T')[0];
  saveProgress();
  updateStats();
  nextCard();
}

function nextCard() {
  currentIndex = (currentIndex + 1) % words.length;
  updateFlashcard(true);
}
function prevCard() {
  currentIndex = (currentIndex - 1 + words.length) % words.length;
  updateFlashcard(true);
}

function loadQuiz() {
  const learning = words.filter(w => progress[w].status === 'изучается');
  const word = learning[Math.floor(Math.random() * learning.length)] || words[0];
  document.getElementById('quiz-word').textContent = word;
  const correct = vocabData[word].translation;
  const options = [correct];
  while (options.length < 4) {
    const r = words[Math.floor(Math.random() * words.length)];
    if (r !== word && !options.includes(vocabData[r].translation)) options.push(vocabData[r].translation);
  }
  options.sort(() => Math.random() - 0.5);
  const optionsHtml = options.map(opt => `
    <button class="quiz-option" onclick="checkAnswer(this, '${word}', ${opt === correct})">${opt}</button>
  `).join('');
  document.getElementById('quiz-options').innerHTML = optionsHtml;
  document.getElementById('next-quiz-btn').disabled = true;
  document.getElementById('next-quiz-btn').style.opacity = '0.5';
  document.getElementById('quiz-correct').textContent = quizCorrect;
  document.getElementById('quiz-total').textContent = quizTotal;
}

function checkAnswer(btn, word, isCorrect) {
  if (isCorrect) {
    quizCorrect++;
    progress[word].correct++;
  }
  quizTotal++;
  progress[word].lastReview = new Date().toISOString().split('T')[0];
  saveProgress();
  updateStats();
  document.getElementById('quiz-correct').textContent = quizCorrect;
  document.getElementById('quiz-total').textContent = quizTotal;
  document.querySelectorAll('.quiz-option').forEach(b => b.disabled = true);
  if (isCorrect) btn.classList.add('correct');
  else {
    btn.classList.add('wrong');
    document.querySelectorAll('.quiz-option').forEach(b => {
      if (b.textContent === vocabData[word].translation) b.classList.add('correct');
    });
  }
  document.getElementById('next-quiz-btn').disabled = false;
  document.getElementById('next-quiz-btn').style.opacity = '1';
}

function nextQuiz() { loadQuiz(); }

function loadContext() {
  const learning = words.filter(w => progress[w].status === 'изучается' && vocabData[w].context);
  if (learning.length === 0) {
    document.getElementById('context-sentence').textContent = 'Нет слов с контекстом';
    return;
  }
  const word = learning[Math.floor(Math.random() * learning.length)];
  const data = vocabData[word];
  document.getElementById('context-sentence').textContent = data.context.replace(word, '______');
  document.getElementById('context-answer').value = '';
  document.getElementById('context-answer').dataset.correct = word;
  document.getElementById('context-result').style.display = 'none';
  currentContextWord = word;
  currentContextSentence = data.context;
  autoSpeakIfEnabled(data.context, 0.9);
}

function checkContextAnswer() {
  const input = document.getElementById('context-answer');
  const correct = input.dataset.correct.toLowerCase();
  const answer = input.value.toLowerCase().trim();
  const result = document.getElementById('context-result');
  if (answer === correct) {
    result.style.background = '#E5F7E5';
    result.style.color = '#1d6e2a';
    result.textContent = '✓ Правильно!';
    progress[correct].correct++;
  } else {
    result.style.background = '#FFE5E5';
    result.style.color = '#c91f1f';
    result.textContent = `✗ Неправильно. Ответ: ${correct}`;
  }
  result.style.display = 'block';
  progress[correct].lastReview = new Date().toISOString().split('T')[0];
  saveProgress();
  updateStats();
}

function nextContext() { loadContext(); }

function loadSettings() {
  const stats = words.map(w => ({ word: w, ...progress[w] })).sort((a, b) => b.correct - a.correct);
  document.getElementById('words-stats').innerHTML = stats.map(s => `
    <div class="stat-item">
      <div class="stat-item-row">
        <span class="stat-item-word">${s.word}</span>
        <span class="stat-item-count">${s.correct} ответов</span>
      </div>
      <div class="stat-item-meta">
        ${s.status === 'выучено' ? '✓ Выучено' : '◐ В процессе'} • ${s.lastReview || 'не повторял'}
      </div>
    </div>
  `).join('');
}

function exportProgress() {
  const data = JSON.stringify({ progress, exported: new Date().toISOString() }, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `vocabulary_progress_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function openWordList(filter) {
  const titles = { all: 'Все слова', 'изучается': 'В учёбе', 'выучено': 'Выучено' };
  const list = filter === 'all' ? words : words.filter(w => progress[w].status === filter);

  document.getElementById('wl-title').textContent = `${titles[filter]} — ${list.length} слов`;

  const rows = list.map(w => {
    const d = vocabData[w];
    return `<tr style="border-top:1px solid #e5e5e7" onmouseenter="this.querySelectorAll('td').forEach(td=>td.style.background='#f5f5f7')" onmouseleave="this.querySelectorAll('td').forEach(td=>td.style.background='')">
      <td style="padding:10px 12px;font-weight:600;white-space:nowrap">${w}</td>
      <td style="padding:10px 12px;color:#86868b;font-family:monospace;white-space:nowrap">${d.ipa}</td>
      <td style="padding:10px 12px">${d.translation}</td>
      <td style="padding:10px 12px;color:#86868b;font-style:italic">${d.context || '—'}</td>
    </tr>`;
  }).join('');

  document.getElementById('wl-body').innerHTML = rows;

  const overlay = document.getElementById('word-list-overlay');
  overlay.style.display = 'block';
  if (document.body.classList.contains('dark')) overlay.classList.add('dark-modal');
  else overlay.classList.remove('dark-modal');
  document.body.style.overflow = 'hidden';
}

function closeWordList() {
  document.getElementById('word-list-overlay').style.display = 'none';
  document.body.style.overflow = '';
}

function resetProgress() {
  if (confirm('Точно сбросить весь прогресс?')) {
    initProgress();
    saveProgress();
    updateStats();
    loadSettings();
  }
}

// === INIT ===
fetch('vocabulary.json')
  .then(r => r.json())
  .then(data => {
    vocabData = data;
    words = Object.keys(vocabData).sort();
    loadProgress();
    loadTheme();
    loadVoices();
    updateStats();
    updateFlashcard();
  })
  .catch(() => {
    document.querySelector('.container').innerHTML =
      '<p style="color:red;padding:2rem">Ошибка загрузки vocabulary.json. ' +
      'Откройте приложение через веб-сервер, а не напрямую из файловой системы.</p>';
  });
