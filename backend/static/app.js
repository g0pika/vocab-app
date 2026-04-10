const $ = (id) => document.getElementById(id);

function initDate() {
  const d = new Date();
  const opts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  $('date').textContent = d.toLocaleDateString('en-US', opts);
}
initDate();

function toRoman(num) {
  const r = [['M',1000],['CM',900],['D',500],['CD',400],['C',100],['XC',90],['L',50],['XL',40],['X',10],['IX',9],['V',5],['IV',4],['I',1]];
  let s = '';
  for (const [k, v] of r) { while (num >= v) { s += k; num -= v; } }
  return s;
}

function getQuota() {
  const v = parseInt(localStorage.getItem('wordsPerDay') || '3');
  return (v >= 1 && v <= 5) ? v : 3;
}
function setQuota(n) { localStorage.setItem('wordsPerDay', String(n)); }

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

async function loadLearn() {
  const el = $('learn');
  el.innerHTML = '<p class="loading">Turning the page…</p>';
  const limit = getQuota();
  const data = await fetch('/api/next?limit=' + limit).then(r => r.json());
  const pct = Math.min(100, (data.today_done / data.limit) * 100);

  const progressEl = `
    <div class="progress">
      <div class="progress-header">
        <span>Today's Lesson</span>
        <span class="progress-count">${data.today_done} of ${data.limit}</span>
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

  if (!data.word) {
    el.innerHTML = progressEl + `
      <div class="done-state">
        <div class="done-ornament">❧</div>
        <h3>The day's lesson concludes.</h3>
        <p>Your words await their appointed return.<br>Visit the Review tab, or let spaced repetition do its quiet work.</p>
      </div>`;
    bindQuota();
    return;
  }

  const w = data.word;
  const wordIndex = data.today_done + 1;
  el.innerHTML = progressEl + `
    <div class="entry-label">Entry № ${toRoman(wordIndex)}</div>
    <div class="word-headline">
      <h2 class="word-title">${w.word}</h2>
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
      <button class="act" onclick="grade(${w.id},false,'learn')">Forgotten</button>
      <button class="act" onclick="grade(${w.id},true,'learn')">Recalled</button>
    </div>`;
  bindQuota();
}

function bindQuota() {
  document.querySelectorAll('.quota-dial').forEach(btn => {
    btn.onclick = () => { setQuota(parseInt(btn.dataset.n)); loadLearn(); };
  });
}

async function loadReview() {
  const el = $('review');
  el.innerHTML = '<p class="loading">Fetching due entries…</p>';
  const res = await fetch('/api/due');
  if (res.status === 404) {
    el.innerHTML = `
      <div class="done-state">
        <div class="done-ornament">❦</div>
        <h3>No reviews are due.</h3>
        <p>Your memory is in order.<br>Return when time has done its work.</p>
      </div>`;
    return;
  }
  const w = await res.json();
  el.innerHTML = `
    <div class="entry-label">Review</div>
    <div class="word-headline">
      <h2 class="word-title">${w.word}</h2>
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
        <button class="act" onclick="grade(${w.id},false,'review')">Forgotten</button>
        <button class="act" onclick="grade(${w.id},true,'review')">Recalled</button>
      </div>
    </div>`;
  $('flash-prompt').onclick = () => {
    $('flash-prompt').style.display = 'none';
    $('flash-back').style.display = 'block';
  };
}

async function loadQuiz() {
  const el = $('quiz');
  el.innerHTML = '<p class="loading">Preparing examination…</p>';
  const res = await fetch('/api/quiz');
  if (res.status === 404) {
    el.innerHTML = `
      <div class="done-state">
        <div class="done-ornament">§</div>
        <h3>The examination awaits.</h3>
        <p>Learn a few words first.<br>Mastery must precede testing.</p>
      </div>`;
    return;
  }
  const q = await res.json();
  el.innerHTML = `
    <div class="entry-label">Examination</div>
    <div class="word-headline">
      <h2 class="word-title">${q.word.word}</h2>
    </div>
    <p class="flash-prompt" style="cursor:default">— Choose the true meaning —</p>
    <div class="quiz-options">
      ${q.options.map((o, i) => `<button class="quiz-option" data-i="${i}">${o}</button>`).join('')}
    </div>
    <div id="quiz-result" class="quiz-result"></div>`;
  el.querySelectorAll('.quiz-option').forEach(btn => {
    btn.onclick = async () => {
      const i = parseInt(btn.dataset.i);
      const correct = i === q.answer;
      el.querySelectorAll('.quiz-option').forEach((b, j) => {
        b.disabled = true;
        if (j === q.answer) b.classList.add('right');
        else if (j === i) b.classList.add('wrong');
      });
      $('quiz-result').innerHTML = `
        <p class="quiz-result-msg ${correct ? 'right' : ''}">${correct ? 'Well recalled.' : 'Alas — not this time.'}</p>
        <button class="next-btn" onclick="loadQuiz()">Next entry →</button>`;
      await fetch('/api/exam', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({word_id: q.word.id, correct})
      });
    };
  });
}

async function loadStats() {
  const el = $('stats');
  const s = await fetch('/api/stats').then(r => r.json());
  const accuracy = (c, w) => (c + w) === 0 ? '—' : Math.round(100 * c / (c + w)) + '%';
  el.innerHTML = `
    <h2 class="almanac-heading">Almanac</h2>
    <p class="almanac-sub">A record of words &amp; retention</p>
    <div class="almanac-grid">
      <div class="almanac-row"><span class="almanac-label">Words in the corpus</span><span class="almanac-value">${s.total}</span></div>
      <div class="almanac-row"><span class="almanac-label">Yet unseen</span><span class="almanac-value">${s.new}</span></div>
      <div class="almanac-row"><span class="almanac-label">Presently learning</span><span class="almanac-value rubric">${s.learning}</span></div>
      <div class="almanac-row"><span class="almanac-label">Committed to memory</span><span class="almanac-value">${s.mastered}</span></div>
      <div class="almanac-row"><span class="almanac-label">Due today</span><span class="almanac-value">${s.due_today}</span></div>
      <div class="almanac-row"><span class="almanac-label">Review accuracy</span><span class="almanac-value">${accuracy(s.review_correct, s.review_wrong)}</span></div>
      <div class="almanac-row"><span class="almanac-label">Examination accuracy</span><span class="almanac-value">${accuracy(s.exam_correct, s.exam_wrong)}</span></div>
    </div>`;
}

async function grade(wordId, correct, tab) {
  await fetch('/api/review', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({word_id: wordId, correct})
  });
  load(tab);
}

loadLearn();
