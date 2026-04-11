// ———— State ————
const STORAGE_KEY = 'lexicon:state';
let WORDS = [];
let STATE = loadState();

function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (s && s.reviews) {
      s.settings = s.settings || { wordsPerDay: 3 };
      return s;
    }
  } catch {}
  return { reviews: {}, settings: { wordsPerDay: 3 } };
}
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(STATE)); }

// ———— Date helpers ————
function today() { return new Date(); }
function fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

// ———— Spaced repetition (quadratic: step 0→1d, 1→4d, 2→9d, 3→16d…) ————
function intervalDays(step) { const n = step + 1; return n * n; }

function emptyReview(todayStr) {
  return {
    step: 0, nextReviewDate: todayStr, lastReviewed: null, firstSeenAt: todayStr,
    reviewCorrect: 0, reviewWrong: 0, examCorrect: 0, examWrong: 0, lastWrongDate: null,
  };
}

function advanceReview(wordId, correct) {
  const now = today();
  const todayStr = fmtDate(now);
  const r = STATE.reviews[wordId] || emptyReview(todayStr);
  if (r.lastReviewed === todayStr) return;
  r.step = r.step + 1;
  r.nextReviewDate = fmtDate(addDays(now, intervalDays(r.step)));
  r.lastReviewed = todayStr;
  if (correct) r.reviewCorrect++;
  else { r.reviewWrong++; r.lastWrongDate = todayStr; }
  STATE.reviews[wordId] = r;
  saveState();
}

function recordExam(wordId, correct) {
  const todayStr = fmtDate(today());
  const r = STATE.reviews[wordId] || emptyReview(todayStr);
  if (correct) r.examCorrect++;
  else { r.examWrong++; r.lastWrongDate = todayStr; }
  STATE.reviews[wordId] = r;
  saveState();
}

// ———— Word selection ————
function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function getNewWord() {
  const candidates = WORDS.filter(w => {
    const r = STATE.reviews[w.id];
    return !r || (r.step === 0 && !r.lastReviewed);
  });
  return candidates.length ? pickRandom(candidates) : null;
}

function getDueWord() {
  const todayStr = fmtDate(today());
  const due = WORDS.filter(w => {
    const r = STATE.reviews[w.id];
    return r && r.lastReviewed && r.nextReviewDate <= todayStr && r.lastReviewed !== todayStr;
  });
  if (!due.length) return null;
  due.sort((a, b) => STATE.reviews[a.id].nextReviewDate.localeCompare(STATE.reviews[b.id].nextReviewDate));
  return due[0];
}

function getQuizWord() {
  const learned = WORDS.filter(w => {
    const r = STATE.reviews[w.id];
    return r && r.step > 0;
  });
  return learned.length ? pickRandom(learned) : null;
}

function getDistractors(excludeId, n) {
  const pool = WORDS.filter(w => w.id !== excludeId);
  const picked = [];
  const used = new Set();
  while (picked.length < n && used.size < pool.length) {
    const i = Math.floor(Math.random() * pool.length);
    if (used.has(i)) continue;
    used.add(i);
    picked.push(pool[i]);
  }
  return picked.map(w => w.meaning);
}

function doneTodayCount() {
  const todayStr = fmtDate(today());
  return Object.values(STATE.reviews).filter(r => r.step === 1 && r.lastReviewed === todayStr).length;
}

function computeStats() {
  const todayStr = fmtDate(today());
  const revs = Object.values(STATE.reviews);
  const seen = revs.filter(r => r.step > 0 || r.lastReviewed).length;
  const learning = revs.filter(r => r.step > 0 && r.step < 8).length;
  const mastered = revs.filter(r => r.step >= 8).length;
  const dueToday = revs.filter(r => r.lastReviewed && r.nextReviewDate <= todayStr && r.lastReviewed !== todayStr).length;
  const sum = (k) => revs.reduce((s, r) => s + (r[k] || 0), 0);
  return {
    total: WORDS.length,
    new: WORDS.length - seen,
    learning,
    mastered,
    due_today: dueToday,
    review_correct: sum('reviewCorrect'),
    review_wrong: sum('reviewWrong'),
    exam_correct: sum('examCorrect'),
    exam_wrong: sum('examWrong'),
  };
}

// ———— Speech ————
function speak(text) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.85;
  u.pitch = 1;
  u.lang = 'en-US';
  window.speechSynthesis.speak(u);
}

function speakBtn(word) {
  return `<button class="speak-btn" data-speak="${word}" aria-label="Pronounce ${word}" title="Pronounce">
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <path d="M11 5 6 9H2v6h4l5 4z"/>
      <path d="M15.5 8.5a5 5 0 0 1 0 7"/>
      <path d="M18.5 5.5a9 9 0 0 1 0 13"/>
    </svg>
  </button>`;
}

function bindSpeak() {
  document.querySelectorAll('[data-speak]').forEach(btn => {
    btn.onclick = (e) => { e.stopPropagation(); speak(btn.dataset.speak); };
  });
}

// ———— UI helpers ————
const $ = (id) => document.getElementById(id);

function initDate() {
  const d = new Date();
  const opts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  $('date').textContent = d.toLocaleDateString('en-US', opts);
}

function toRoman(num) {
  const r = [['M',1000],['CM',900],['D',500],['CD',400],['C',100],['XC',90],['L',50],['XL',40],['X',10],['IX',9],['V',5],['IV',4],['I',1]];
  let s = '';
  for (const [k, v] of r) { while (num >= v) { s += k; num -= v; } }
  return s;
}

function getQuota() {
  const v = STATE.settings.wordsPerDay;
  return (v >= 1 && v <= 5) ? v : 3;
}
function setQuota(n) {
  STATE.settings.wordsPerDay = n;
  saveState();
}

document.querySelectorAll('nav.columns .col').forEach(btn => {
  btn.onclick = () => {
    const tab = btn.dataset.tab;
    document.querySelectorAll('nav.columns .col').forEach(b => b.classList.toggle('active', b === btn));
    document.querySelectorAll('.tab').forEach(s => s.classList.remove('active'));
    const target = $(tab);
    void target.offsetWidth;
    target.classList.add('active');
    load(tab);
  };
});

function load(tab) {
  if (tab === 'learn') loadLearn();
  if (tab === 'review') loadReview();
  if (tab === 'quiz') loadQuiz();
  if (tab === 'stats') loadStats();
}

// ———— Views ————
function loadLearn() {
  const el = $('learn');
  const limit = getQuota();
  const done = doneTodayCount();
  const pct = Math.min(100, (done / limit) * 100);

  const progressEl = `
    <div class="progress">
      <div class="progress-header">
        <span>Today's Lesson</span>
        <span class="progress-count">${done} of ${limit}</span>
      </div>
      <div class="progress-rail">
        <div class="progress-fill" style="width:${pct}%"></div>
      </div>
    </div>
    <div class="quota">
      <span>Daily Quota</span>
      <div class="quota-dials">
        ${[1,2,3,4,5].map(n => `<button class="quota-dial ${n===limit?'active':''}" data-n="${n}">${n}</button>`).join('')}
      </div>
    </div>`;

  const w = done >= limit ? null : getNewWord();

  if (!w) {
    el.innerHTML = progressEl + `
      <div class="done-state">
        <div class="done-ornament">❧</div>
        <h3>The day's lesson concludes.</h3>
        <p>Your words await their appointed return.<br>Visit the Review tab, or let spaced repetition do its quiet work.</p>
      </div>`;
    bindQuota();
    return;
  }

  const wordIndex = done + 1;
  el.innerHTML = progressEl + `
    <div class="entry-label">Entry № ${toRoman(wordIndex)}</div>
    <div class="word-headline">
      <h2 class="word-title">${w.word}${speakBtn(w.word)}</h2>
    </div>
    <p class="word-definition">${w.meaning}</p>
    <span class="entry-rule"></span>
    <div class="word-details">
      ${w.etymology ? `<div class="detail">
        <span class="detail-label">Origin</span>
        <div class="detail-value">${w.etymology}</div>
      </div>` : ''}
      ${w.usage ? `<div class="detail">
        <span class="detail-label">In a Sentence</span>
        <div class="detail-value example">${w.usage}</div>
      </div>` : ''}
      ${w.synonyms ? `<div class="detail">
        <span class="detail-label">Kindred Words</span>
        <div class="detail-value"><span class="syn-list">${w.synonyms}</span></div>
      </div>` : ''}
    </div>
    <div class="actions">
      <button class="act" data-id="${w.id}" data-correct="true" data-tab="learn">Next entry →</button>
    </div>`;
  bindQuota();
  bindGrade();
  bindSpeak();
}

function bindQuota() {
  document.querySelectorAll('.quota-dial').forEach(btn => {
    btn.onclick = () => { setQuota(parseInt(btn.dataset.n)); loadLearn(); };
  });
}

function bindGrade() {
  document.querySelectorAll('.act[data-id]').forEach(btn => {
    btn.onclick = () => {
      const id = parseInt(btn.dataset.id);
      const correct = btn.dataset.correct === 'true';
      const tab = btn.dataset.tab;
      advanceReview(id, correct);
      load(tab);
    };
  });
}

function loadReview() {
  const el = $('review');
  const w = getDueWord();
  if (!w) {
    el.innerHTML = `
      <div class="done-state">
        <div class="done-ornament">❦</div>
        <h3>No reviews are due.</h3>
        <p>Your memory is in order.<br>Return when time has done its work.</p>
      </div>`;
    return;
  }
  el.innerHTML = `
    <div class="entry-label">Review</div>
    <div class="word-headline">
      <h2 class="word-title">${w.word}${speakBtn(w.word)}</h2>
    </div>
    <p id="flash-prompt" class="flash-prompt">— Tap to reveal the meaning —</p>
    <div id="flash-back" style="display:none">
      <p class="word-definition">${w.meaning}</p>
      <span class="entry-rule"></span>
      <div class="word-details">
        ${w.etymology ? `<div class="detail"><span class="detail-label">Origin</span><div class="detail-value">${w.etymology}</div></div>` : ''}
        ${w.usage ? `<div class="detail"><span class="detail-label">In a Sentence</span><div class="detail-value example">${w.usage}</div></div>` : ''}
      </div>
      <div class="actions">
        <button class="act" data-id="${w.id}" data-correct="false" data-tab="review">Forgotten</button>
        <button class="act" data-id="${w.id}" data-correct="true" data-tab="review">Recalled</button>
      </div>
    </div>`;
  $('flash-prompt').onclick = () => {
    $('flash-prompt').style.display = 'none';
    $('flash-back').style.display = 'block';
  };
  bindGrade();
  bindSpeak();
}

function loadQuiz() {
  const el = $('quiz');
  const w = getQuizWord();
  if (!w) {
    el.innerHTML = `
      <div class="done-state">
        <div class="done-ornament">§</div>
        <h3>The examination awaits.</h3>
        <p>Learn a few words first.<br>Mastery must precede testing.</p>
      </div>`;
    return;
  }
  const distractors = getDistractors(w.id, 3);
  const options = [w.meaning, ...distractors];
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  const answer = options.indexOf(w.meaning);

  el.innerHTML = `
    <div class="entry-label">Examination</div>
    <div class="word-headline">
      <h2 class="word-title">${w.word}${speakBtn(w.word)}</h2>
    </div>
    <p class="flash-prompt" style="cursor:default">— Choose the true meaning —</p>
    <div class="quiz-options">
      ${options.map((o, i) => `<button class="quiz-option" data-i="${i}">${o}</button>`).join('')}
    </div>
    <div id="quiz-result" class="quiz-result"></div>`;

  el.querySelectorAll('.quiz-option').forEach(btn => {
    btn.onclick = () => {
      const i = parseInt(btn.dataset.i);
      const correct = i === answer;
      el.querySelectorAll('.quiz-option').forEach((b, j) => {
        b.disabled = true;
        if (j === answer) b.classList.add('right');
        else if (j === i) b.classList.add('wrong');
      });
      recordExam(w.id, correct);
      $('quiz-result').innerHTML = `
        <p class="quiz-result-msg ${correct ? 'right' : ''}">${correct ? 'Well recalled.' : 'Alas — not this time.'}</p>
        <button class="next-btn" id="quiz-next">Next entry →</button>`;
      $('quiz-next').onclick = () => loadQuiz();
    };
  });
  bindSpeak();
}

function getWordsByStep(predicate) {
  return WORDS.filter(w => {
    const r = STATE.reviews[w.id];
    return r && predicate(r);
  }).sort((a, b) => a.word.localeCompare(b.word));
}

function loadStats() {
  const el = $('stats');
  const s = computeStats();
  const accuracy = (c, w) => (c + w) === 0 ? '—' : Math.round(100 * c / (c + w)) + '%';
  el.innerHTML = `
    <h2 class="almanac-heading">Almanac</h2>
    <p class="almanac-sub">A record of words &amp; retention</p>
    <div class="almanac-grid">
      <div class="almanac-row almanac-clickable" data-list="learning">
        <span class="almanac-label">Presently learning</span>
        <span class="almanac-value rubric">${s.learning}</span>
      </div>
      <div class="almanac-row almanac-clickable" data-list="mastered">
        <span class="almanac-label">Committed to memory</span>
        <span class="almanac-value">${s.mastered}</span>
      </div>
      <div class="almanac-row"><span class="almanac-label">Due today</span><span class="almanac-value">${s.due_today}</span></div>
      <div class="almanac-row"><span class="almanac-label">Review accuracy</span><span class="almanac-value">${accuracy(s.review_correct, s.review_wrong)}</span></div>
      <div class="almanac-row"><span class="almanac-label">Examination accuracy</span><span class="almanac-value">${accuracy(s.exam_correct, s.exam_wrong)}</span></div>
    </div>
    <div id="word-list" class="learning-list" style="display:none"></div>`;
  document.querySelectorAll('.almanac-clickable').forEach(row => {
    row.onclick = () => toggleWordList(row.dataset.list);
  });
}

const LIST_CONFIG = {
  learning: {
    title: 'Words in progress',
    empty: 'No words in progress yet.',
    predicate: r => r.step > 0 && r.step < 8,
  },
  mastered: {
    title: 'Committed to memory',
    empty: 'No words mastered yet.',
    predicate: r => r.step >= 8,
  },
};

let currentList = null;

function toggleWordList(kind) {
  const list = $('word-list');
  if (currentList === kind) {
    list.style.display = 'none';
    list.innerHTML = '';
    currentList = null;
    return;
  }
  const cfg = LIST_CONFIG[kind];
  const words = getWordsByStep(cfg.predicate);
  if (!words.length) {
    list.innerHTML = `<p class="learning-empty">${cfg.empty}</p>`;
  } else {
    list.innerHTML = `
      <div class="learning-header">${cfg.title}</div>
      <ul class="learning-items">
        ${words.map(w => `
          <li class="learning-item">
            <span class="learning-word">${w.word}</span>
            <span class="learning-meaning">${w.meaning}</span>
          </li>`).join('')}
      </ul>`;
  }
  list.style.display = 'block';
  currentList = kind;
}

// ———— Init ————
async function init() {
  initDate();
  try {
    const res = await fetch('./words.json');
    WORDS = await res.json();
    WORDS.forEach((w, i) => { w.id = i; });
    loadLearn();
  } catch (e) {
    $('learn').innerHTML = `<p class="empty">Could not load word corpus: ${e.message}</p>`;
  }
}
init();
