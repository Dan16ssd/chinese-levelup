(function () {
'use strict';

/* ---------------- helpers ---------------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const app = $('#app');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rand = n => Math.floor(Math.random() * n);
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const sample = (a, n) => shuffle(a).slice(0, n);

/* ---------------- data ---------------- */
const LEVELS = [1, 2, 3, 4, 5, 6];
const DB = {}, BYID = {};
function parse(text, lvl, kind) {
  return text.trim().split('\n').map(l => l.split('|').map(s => s.trim()))
    .filter(a => a.length >= 4 && a[0])
    .map((a, i) => ({ id: lvl + kind + i, zh: a[0], py: a[1], lo: a[2], en: a[3], lvl, kind }));
}
LEVELS.forEach(l => {
  const r = window.HSK_RAW[l];
  DB[l] = { w: parse(r.w, l, 'w'), s: parse(r.s, l, 's') };
  [...DB[l].w, ...DB[l].s].forEach(it => { BYID[it.id] = it; });
});
const itemsOf = l => [...DB[l].w, ...DB[l].s];

const LEVEL_INFO = {
  1: { name: 'ເລີ່ມຕົ້ນ', desc: 'ທັກທາຍ, ແນະນຳຕົວ, ຕົວເລກ, ເວລາ, ຄອບຄົວ, ຊື້ເຄື່ອງ — ສື່ສານງ່າຍໆໄດ້' },
  2: { name: 'ພື້ນຖານ', desc: 'ຊີວິດປະຈຳວັນ: ຖາມທາງ, ສັ່ງອາຫານ, ຕໍ່ລາຄາ, ເດີນທາງ, ສຸຂະພາບ' },
  3: { name: 'ກາງ-ຕົ້ນ', desc: 'ວຽກງານ, ທະນາຄານ, ໂຮງໝໍ, ສະແດງຄວາມຄິດເຫັນ ແລະ ແຜນການ' },
  4: { name: 'ກາງ', desc: 'ສົນທະນາຫົວຂໍ້ທົ່ວໄປໄດ້ຄ່ອງ, ສະໝັກວຽກ, ແກ້ບັນຫາ, ການບໍລິການ' },
  5: { name: 'ກາງ-ສູງ', desc: 'ທຸລະກິດ, ສັນຍາ, ຂ່າວ, ການເຈລະຈາ ແລະ ນຳສະເໜີ' },
  6: { name: 'ສູງ', desc: 'ສຳນວນ 成语, ພາສາທາງການ, ເຂົ້າໃຈສື່ ແລະ ການປະຊຸມຢ່າງຄ່ອງແຄ້ວ' }
};

/* ---------------- tones ---------------- */
const TONES = { a: 'aāáǎà', e: 'eēéěè', i: 'iīíǐì', o: 'oōóǒò', u: 'uūúǔù', 'ü': 'üǖǘǚǜ' };
const MARK = {};
Object.entries(TONES).forEach(([b, s]) => { for (let t = 1; t < 5; t++) MARK[s[t]] = [b, t]; });
function toneVariants(py) {
  const ch = [...py];
  const pos = ch.map((c, i) => (MARK[c] ? i : -1)).filter(i => i >= 0);
  if (!pos.length) return [];
  const out = new Set();
  for (let tries = 0; out.size < 3 && tries < 80; tries++) {
    const c = ch.slice();
    const k = pos.length > 1 && Math.random() < 0.45 ? 2 : 1;
    sample(pos, k).forEach(i => {
      const [b, t] = MARK[c[i]];
      let nt; do { nt = 1 + rand(4); } while (nt === t);
      c[i] = TONES[b][nt];
    });
    const v = c.join('');
    if (v !== py) out.add(v);
  }
  return [...out];
}

/* ---------------- question types ---------------- */
const SR_CLASS = window.SpeechRecognition || window.webkitSpeechRecognition;
const QT = {
  read:     { ic: '📖', name: 'ອ່ານ', sub: 'ເບິ່ງຕົວອັກສອນຈີນ → ເລືອກຄວາມໝາຍ' },
  listen:   { ic: '🎧', name: 'ຟັງ', sub: 'ຟັງສຽງຈີນ → ເລືອກຄວາມໝາຍ' },
  listenzh: { ic: '👂', name: 'ຟັງ → ຕົວອັກສອນ', sub: 'ຟັງສຽງ → ເລືອກຕົວອັກສອນທີ່ຖືກ' },
  lao2zh:   { ic: '🔁', name: 'ລາວ → ຈີນ', sub: 'ເບິ່ງພາສາລາວ → ເລືອກພາສາຈີນ' },
  tone:     { ic: '🎵', name: 'ວັນນະຍຸດ', sub: 'ຟັງ → ເລືອກ pinyin ທີ່ມີວັນນະຍຸດຖືກ' },
  speak:    { ic: '🎤', name: 'ເວົ້າ', sub: 'ເວົ້າໃສ່ໄມ → ກວດການອອກສຽງ' }
};
const W_TYPES = ['read', 'listen', 'listenzh', 'lao2zh', 'tone', 'speak'];
const S_TYPES = ['read', 'listen', 'lao2zh', 'speak'];
function validTypes(it) {
  if (it.kind === 's') return S_TYPES;
  return toneVariants(it.py).length >= 2 ? W_TYPES : W_TYPES.filter(t => t !== 'tone');
}
const qCount = l => itemsOf(l).reduce((a, it) => a + validTypes(it).length, 0);
const TOTAL_Q = LEVELS.reduce((a, l) => a + qCount(l), 0);
const TOTAL_W = LEVELS.reduce((a, l) => a + DB[l].w.length, 0);
const TOTAL_S = LEVELS.reduce((a, l) => a + DB[l].s.length, 0);

/* ---------------- storage ---------------- */
const KEY = 'chinese-levelup-v1';
let S = {};
try { S = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { S = {}; }
S.stats = S.stats || {}; S.xp = S.xp || 0;
S.settings = Object.assign({ rate: 0.85, voice: '' }, S.settings || {});
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* private mode */ } };
function record(id, ok) {
  const st = S.stats[id] || (S.stats[id] = { c: 0, w: 0 });
  if (ok) { st.c++; S.xp += 10; } else st.w++;
  st.t = Date.now(); save();
}
const isMastered = id => { const s = S.stats[id]; return !!s && s.c >= 3 && s.c >= s.w * 2; };
const masteredCount = l => itemsOf(l).filter(it => isMastered(it.id)).length;

/* ---------------- text-to-speech ---------------- */
const TTS = {
  ok: 'speechSynthesis' in window, voices: [], voice: null,
  load() {
    if (!this.ok) return;
    const score = v => {
      let s = 0;
      if (/zh[-_]CN|cmn/i.test(v.lang)) s += 10;
      if (/xiaoxiao|xiaoyi|yunxi|yunjian|natural|online/i.test(v.name)) s += 6;
      if (/google/i.test(v.name)) s += 5;
      if (/tingting|huihui|yaoyao|kangkang|lili/i.test(v.name)) s += 3;
      if (/HK|TW|yue|canton|taiwan|hong/i.test(v.lang + ' ' + v.name)) s -= 20;
      return s;
    };
    this.voices = speechSynthesis.getVoices().filter(v => /^(zh|cmn)/i.test(v.lang)).sort((a, b) => score(b) - score(a));
    this.voice = this.voices.find(v => v.name === S.settings.voice) || this.voices[0] || null;
  },
  speak(text, rate) {
    if (!this.ok) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'zh-CN';
    if (this.voice) u.voice = this.voice;
    u.rate = rate || S.settings.rate;
    setTimeout(() => speechSynthesis.speak(u), 60);
  }
};
TTS.load();
if (TTS.ok) speechSynthesis.onvoiceschanged = () => TTS.load();

const sayBtns = (zh) => `<button class="say" data-say="${esc(zh)}" title="ຟັງ" aria-label="ຟັງ">🔊</button><button class="say" data-say="${esc(zh)}" data-rate="0.5" title="ຟັງຊ້າໆ" aria-label="ຟັງຊ້າໆ">🐢</button>`;
document.addEventListener('click', e => {
  const b = e.target.closest('[data-say]');
  if (b) { e.stopPropagation(); TTS.speak(b.dataset.say, b.dataset.rate ? +b.dataset.rate : undefined); }
});

/* ---------------- speech recognition ---------------- */
const DIG = { '0': '零', '1': '一', '2': '二', '3': '三', '4': '四', '5': '五', '6': '六', '7': '七', '8': '八', '9': '九' };
const hanzi = s => s.replace(/[0-9]/g, d => DIG[d]).replace(/[^一-鿿]/g, '');
function similarity(target, heard) {
  const a = [...hanzi(target)], b = [...hanzi(heard)];
  if (!a.length || !b.length) return 0;
  const dp = Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    let prev = 0;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev + 1 : Math.max(dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return dp[b.length] / Math.max(a.length, b.length);
}
function recognize() {
  return new Promise((res, rej) => {
    if (!SR_CLASS) return rej('unsupported');
    const r = new SR_CLASS();
    r.lang = 'zh-CN'; r.interimResults = false; r.maxAlternatives = 5;
    let done = false;
    r.onresult = e => { done = true; res([...e.results[0]].map(a => a.transcript)); };
    r.onerror = e => { done = true; rej(e.error); };
    r.onend = () => { if (!done) rej('no-speech'); };
    r.start();
  });
}

/* ---------------- question builder ---------------- */
function poolFor(it) {
  const key = it.kind === 'w' ? 'w' : 's';
  let pool = DB[it.lvl][key].slice();
  if (pool.length < 12) LEVELS.forEach(l => { if (Math.abs(l - it.lvl) === 1) pool = pool.concat(DB[l][key]); });
  return pool.filter(x => x.id !== it.id && x.zh !== it.zh && x.lo !== it.lo && x.py !== it.py);
}
function distract(it, key, n) {
  const seen = new Set([it[key]]), out = [];
  for (const x of shuffle(poolFor(it))) {
    if (!seen.has(x[key])) { seen.add(x[key]); out.push(x[key]); }
    if (out.length >= n) break;
  }
  return out;
}
function buildQ(it, type) {
  let prompt = '', key = 'lo', ask = '', audio = false, optClass = '';
  switch (type) {
    case 'read':
      ask = 'ຄຳນີ້ໝາຍຄວາມວ່າແນວໃດ?';
      prompt = `<div class="big ${it.kind === 's' ? 'sent' : ''}">${esc(it.zh)}</div>`; break;
    case 'listen':
      ask = 'ຟັງແລ້ວເລືອກຄວາມໝາຍທີ່ຖືກ'; audio = true; break;
    case 'listenzh':
      ask = 'ຟັງແລ້ວເລືອກຕົວອັກສອນຈີນທີ່ໄດ້ຍິນ'; audio = true; key = 'zh'; optClass = 'zh'; break;
    case 'lao2zh':
      ask = 'ພາສາຈີນເວົ້າແນວໃດ?'; key = 'zh'; optClass = 'zh';
      prompt = `<div class="lo-big">${esc(it.lo)}</div>`; break;
    case 'tone':
      ask = 'ຟັງໃຫ້ດີ — pinyin ໃດມີວັນນະຍຸດຖືກຕ້ອງ?'; audio = true; key = 'py';
      prompt = `<div class="big">${esc(it.zh)}</div>`; break;
  }
  if (audio) prompt += `<div style="margin-top:12px"><button class="playbig" data-say="${esc(it.zh)}" aria-label="ຟັງ">🔊</button><div class="row" style="justify-content:center;margin-top:10px"><button class="say" data-say="${esc(it.zh)}" data-rate="0.5" aria-label="ຟັງຊ້າໆ">🐢</button></div></div>`;
  let wrong = type === 'tone' ? toneVariants(it.py).slice(0, 3) : distract(it, key, 3);
  if (wrong.length < 3) wrong = wrong.concat(distract(it, key, 3 - wrong.length).filter(x => !wrong.includes(x)));
  const opts = shuffle([{ label: it[key], ok: true }, ...wrong.map(w => ({ label: w, ok: false }))]);
  return { prompt, ask, opts, audio, optClass: type === 'tone' ? '' : optClass, sentence: it.kind === 's' && optClass === 'zh' };
}

const revealHTML = it => `
  <div class="reveal">
    <div class="row" style="justify-content:space-between">
      <div><div class="zh">${esc(it.zh)}</div><div class="py">${esc(it.py)}</div></div>
      <div class="row">${sayBtns(it.zh)}</div>
    </div>
    <div style="margin-top:6px;font-size:18px">${esc(it.lo)}</div>
    <div class="muted small">${esc(it.en)}</div>
  </div>`;

/* Render a multiple-choice question. onDone(ok) is called once answered. */
function renderMC(box, it, type, opts) {
  const q = buildQ(it, type);
  box.innerHTML = `
    <div class="card prompt">
      <div class="ask">${q.ask}</div>
      ${q.prompt}
    </div>
    <div class="opts">
      ${q.opts.map((o, i) => `<button class="opt ${q.optClass}" data-i="${i}" ${q.sentence ? 'style="font-size:19px"' : ''}><span class="k">${i + 1}</span><span>${esc(o.label)}</span></button>`).join('')}
      ${opts.allowSkip ? `<button class="btn" data-skip>🤷 ບໍ່ຮູ້ / ຂ້າມ</button>` : ''}
    </div>
    <div class="fb"></div>`;
  if (q.audio) TTS.speak(it.zh);
  let answered = false;
  const answer = (i) => {
    if (answered) return; answered = true;
    const ok = i >= 0 && q.opts[i].ok;
    $$('.opt', box).forEach((b, j) => { b.disabled = true; if (q.opts[j].ok) b.classList.add('ok'); else if (j === i) b.classList.add('no'); });
    const sk = $('[data-skip]', box); if (sk) sk.remove();
    document.removeEventListener('keydown', onKey);
    opts.onDone(ok, $('.fb', box));
  };
  const onKey = e => { const n = +e.key; if (n >= 1 && n <= q.opts.length) answer(n - 1); };
  document.addEventListener('keydown', onKey);
  box._cleanup = () => document.removeEventListener('keydown', onKey);
  $$('.opt', box).forEach(b => b.addEventListener('click', () => answer(+b.dataset.i)));
  const sk = $('[data-skip]', box); if (sk) sk.addEventListener('click', () => answer(-1));
}

/* Render a speaking question */
function renderSpeak(box, it, onDone) {
  box.innerHTML = `
    <div class="card prompt">
      <div class="ask">ຟັງກ່ອນ ແລ້ວເວົ້າຕາມໃຫ້ຄືທີ່ສຸດ</div>
      <div class="big ${it.kind === 's' ? 'sent' : ''}">${esc(it.zh)}</div>
      <div class="py" style="color:var(--red);font-size:18px">${esc(it.py)}</div>
      <div>${esc(it.lo)}</div>
      <div class="row" style="justify-content:center;margin-top:14px">${sayBtns(it.zh)}</div>
      <div style="margin-top:18px"><button class="mic" aria-label="ເວົ້າ">🎤</button></div>
      <div class="muted small" style="margin-top:8px" data-st>${SR_CLASS ? 'ກົດ 🎤 ແລ້ວເວົ້າເປັນພາສາຈີນ' : ''}</div>
      ${SR_CLASS ? '' : `<div class="warn">ບຣາວເຊີນີ້ບໍ່ຮອງຮັບການຮັບຮູ້ສຽງ. ກະລຸນາໃຊ້ Google Chrome. ທ່ານຍັງສາມາດອັດສຽງຕົນເອງແລ້ວປຽບທຽບໄດ້.</div>`}
      <div data-res style="margin-top:10px"></div>
    </div>
    <div class="row" style="justify-content:center" data-after></div>`;
  TTS.speak(it.zh);
  const mic = $('.mic', box), st = $('[data-st]', box), res = $('[data-res]', box), after = $('[data-after]', box);
  let finished = false;
  const finish = ok => { if (finished) return; finished = true; onDone(ok); };
  const selfAssess = () => {
    after.innerHTML = `<button class="btn" data-ok="1">✅ ຂ້ອຍເວົ້າໄດ້ຖືກ</button><button class="btn" data-ok="0">🔁 ຍັງບໍ່ຖືກ</button>`;
    $$('[data-ok]', after).forEach(b => b.addEventListener('click', () => finish(b.dataset.ok === '1')));
  };
  if (!SR_CLASS) {
    // fallback: record & play back own voice
    let rec, chunks = [];
    mic.addEventListener('click', async () => {
      if (rec && rec.state === 'recording') { rec.stop(); return; }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        rec = new MediaRecorder(stream); chunks = [];
        rec.ondataavailable = e => chunks.push(e.data);
        rec.onstop = () => {
          stream.getTracks().forEach(t => t.stop()); mic.classList.remove('rec');
          const url = URL.createObjectURL(new Blob(chunks));
          res.innerHTML = `<div class="small muted">ສຽງຂອງທ່ານ:</div><audio controls src="${url}"></audio>`;
          selfAssess();
        };
        rec.start(); mic.classList.add('rec'); st.textContent = 'ກຳລັງອັດ... ກົດອີກເທື່ອເພື່ອຢຸດ';
      } catch (e) { st.textContent = 'ບໍ່ສາມາດເປີດໄມໂຄຣໂຟນໄດ້'; selfAssess(); }
    });
    return;
  }
  let tries = 0;
  mic.addEventListener('click', async () => {
    if (mic.classList.contains('rec')) return;
    speechSynthesis.cancel();
    mic.classList.add('rec'); st.textContent = 'ກຳລັງຟັງ... ເວົ້າໄດ້ເລີຍ';
    try {
      const alts = await recognize();
      tries++;
      let best = alts[0] || '', score = 0;
      alts.forEach(a => { const s = similarity(it.zh, a); if (s > score) { score = s; best = a; } });
      const heard = new Set([...hanzi(best)]);
      const pct = Math.round(score * 100);
      const ok = score >= 0.8;
      res.innerHTML = `
        <div class="chars">${[...it.zh].map(c => /[一-鿿]/.test(c) ? `<span class="${heard.has(c) ? 'hit' : 'miss'}">${c}</span>` : c).join('')}</div>
        <div class="small muted">ລະບົບໄດ້ຍິນ: <span class="zh">${esc(best)}</span></div>
        <div class="${ok ? 'fb-ok' : 'fb-no'}" style="font-size:20px">${pct}% ${ok ? '— ດີຫຼາຍ! 👏' : '— ລອງອີກຄັ້ງ'}</div>`;
      st.textContent = ok ? '' : 'ຕົວສີແດງ = ສຽງທີ່ຍັງບໍ່ຖືກ. ຟັງ 🐢 ແລ້ວລອງໃໝ່';
      after.innerHTML = ok || tries >= 3
        ? `<button class="btn primary" data-next>ຕໍ່ໄປ →</button>`
        : `<button class="btn" data-next>ຂ້າມ →</button>`;
      $('[data-next]', after).addEventListener('click', () => finish(ok));
      if (ok) TTS.speak(it.zh);
    } catch (err) {
      st.textContent = err === 'not-allowed' ? 'ກະລຸນາອະນຸຍາດໃຫ້ໃຊ້ໄມໂຄຣໂຟນ' : 'ບໍ່ໄດ້ຍິນສຽງ — ລອງໃໝ່ອີກຄັ້ງ';
      if (err === 'not-allowed' || err === 'service-not-allowed') selfAssess();
    } finally { mic.classList.remove('rec'); }
  });
  after.innerHTML = `<button class="btn" data-next>ຂ້າມ →</button>`;
  $('[data-next]', after).addEventListener('click', () => finish(false));
}

/* ---------------- spaced selection ---------------- */
function weight(it) {
  const s = S.stats[it.id];
  if (!s) return 3;
  if (isMastered(it.id)) return 0.4;
  if (s.w > s.c) return 5;
  return 2;
}
function pickWeighted(pool, n) {
  const p = pool.map(it => ({ it, k: Math.pow(Math.random(), 1 / weight(it)) }));
  return p.sort((a, b) => b.k - a.k).slice(0, n).map(x => x.it);
}
function reviewItems() {
  return Object.entries(S.stats).filter(([id, s]) => BYID[id] && s.w > 0 && !isMastered(id))
    .sort((a, b) => (b[1].w - b[1].c) - (a[1].w - a[1].c)).map(([id]) => BYID[id]);
}

/* ---------------- views ---------------- */
function home() {
  const lv = S.placement ? S.placement.level : null;
  app.innerHTML = `
  <section class="hero">
    <div class="hero-zh">你好！<span>ສະບາຍດີ!</span></div>
    <h1>ຮຽນພາສາຈີນ ຈາກສູນ ເຖິງ HSK 6</h1>
    <p>ສຳລັບຄົນລາວ — ເນັ້ນ <b>ຟັງ · ເວົ້າ · ອ່ານ</b> ເພື່ອໃຊ້ໃນຊີວິດຈິງ ບໍ່ຕ້ອງຝຶກຂຽນ. ຟັງສຽງພາສາຈີນກາງມາດຕະຖານ, ຝຶກເວົ້າໃສ່ໄມ ແລະ ໃຫ້ລະບົບກວດການອອກສຽງ.</p>
    <div class="row cta">
      <a class="btn primary" href="#/test">🎯 ທົດສອບລະດັບ HSK</a>
      <a class="btn" href="#/${lv === null ? 'pinyin' : 'level/' + Math.min(6, Math.max(1, lv + 1))}">${lv === null ? '🔤 ເລີ່ມຈາກສູນ' : '📚 ຮຽນຕໍ່'}</a>
    </div>
  </section>

  <div class="grid g4" style="margin-top:14px">
    <div class="card stat"><b>${TOTAL_W}</b>ຄຳສັບຫຼັກ</div>
    <div class="card stat"><b>${TOTAL_S}</b>ປະໂຫຍກໃຊ້ຈິງ</div>
    <div class="card stat"><b>${TOTAL_Q.toLocaleString()}</b>ຄຳຖາມຝຶກ</div>
    <div class="card stat"><b>${S.xp}</b>XP ຂອງທ່ານ</div>
  </div>

  ${lv !== null ? `<div class="card" style="margin-top:14px"><div class="row" style="justify-content:space-between">
    <div><div class="muted small">ລະດັບຈາກການທົດສອບ</div><h3>${lv === 0 ? 'ເລີ່ມຕົ້ນ (ກ່ອນ HSK 1)' : 'HSK ' + lv}</h3></div>
    <a class="btn primary" href="#/level/${Math.min(6, Math.max(1, lv + 1))}">ຮຽນ HSK ${Math.min(6, Math.max(1, lv + 1))} →</a></div></div>` : ''}

  <h2>ເສັ້ນທາງການຮຽນ</h2>
  <div class="road">
    <a class="card step" href="#/pinyin"><div class="badge l0">ຂັ້ນ<br>0</div><div><h3>ສຽງ ແລະ ວັນນະຍຸດ (Pinyin)</h3><p class="muted small">ພື້ນຖານທີ່ສຳຄັນທີ່ສຸດ: 4 ວັນນະຍຸດ, ພະຍັນຊະນະ, ສະຫຼະ — ທຽບກັບສຽງລາວ</p></div></a>
    ${LEVELS.map(l => {
      const tot = itemsOf(l).length, m = masteredCount(l);
      return `<a class="card step" href="#/level/${l}"><div class="badge l${l}">HSK<br>${l}</div><div style="flex:1"><h3>${LEVEL_INFO[l].name}</h3><p class="muted small">${LEVEL_INFO[l].desc}</p><div class="bar"><i style="width:${(m / tot * 100).toFixed(1)}%"></i></div><div class="muted small">${m}/${tot} ຈື່ໄດ້ແລ້ວ · ${qCount(l)} ຄຳຖາມ</div></div></a>`;
    }).join('')}
  </div>

  <h2>ຮຽນແນວໃດ?</h2>
  <div class="grid g2">
    <div class="card"><h3>🎧 ຟັງກ່ອນ</h3><p class="small">ທຸກຄຳ ແລະ ທຸກປະໂຫຍກມີສຽງ. ກົດ 🐢 ເພື່ອຟັງຊ້າໆ ແລ້ວສັງເກດວັນນະຍຸດ.</p></div>
    <div class="card"><h3>🎤 ເວົ້າຕາມ</h3><p class="small">ເວົ້າໃສ່ໄມໂຄຣໂຟນ, ລະບົບຈະບອກວ່າຕົວໃດອອກສຽງຖືກ (ສີຂຽວ) ຫຼື ຜິດ (ສີແດງ).</p></div>
    <div class="card"><h3>📖 ອ່ານໃຫ້ເຂົ້າໃຈ</h3><p class="small">ຈື່ຕົວອັກສອນຈີນດ້ວຍການອ່ານ — ບໍ່ຕ້ອງຂຽນ. ເນັ້ນເຂົ້າໃຈປ້າຍ, ເມນູ, ຂໍ້ຄວາມ.</p></div>
    <div class="card"><h3>🔁 ທົບທວນອັດຕະໂນມັດ</h3><p class="small">ຄຳທີ່ຕອບຜິດຈະກັບມາເລື້ອຍໆ ຈົນກວ່າທ່ານຈະຈື່ໄດ້. ຄວາມຄືບໜ້າບັນທຶກໄວ້ໃນເຄື່ອງ.</p></div>
  </div>
  ${TTS.ok && !TTS.voices.length ? `<div class="warn" style="margin-top:14px">⚠️ ອຸປະກອນນີ້ຍັງບໍ່ມີສຽງພາສາຈີນ. ໃຊ້ Google Chrome ຫຼື ຕິດຕັ້ງ "Chinese (Simplified)" voice ໃນການຕັ້ງຄ່າລະບົບ.</div>` : ''}
  `;
}

function levels() {
  app.innerHTML = `<h1>ບົດຮຽນ HSK 1 – 6</h1>
  <p class="muted">ເລືອກລະດັບ. ຖ້າບໍ່ແນ່ໃຈ, <a href="#/test">ທົດສອບລະດັບ</a> ກ່ອນ.</p>
  <div class="grid g3">${LEVELS.map(l => {
    const tot = itemsOf(l).length, m = masteredCount(l);
    return `<a class="card" href="#/level/${l}" style="text-decoration:none">
      <div class="row"><div class="badge l${l}">HSK<br>${l}</div><div><h3>${LEVEL_INFO[l].name}</h3><div class="muted small">${DB[l].w.length} ຄຳ · ${DB[l].s.length} ປະໂຫຍກ</div></div></div>
      <p class="small">${LEVEL_INFO[l].desc}</p>
      <div class="bar"><i style="width:${(m / tot * 100).toFixed(1)}%"></i></div>
      <div class="muted small">${m}/${tot} ຈື່ໄດ້ · ${qCount(l)} ຄຳຖາມ</div></a>`;
  }).join('')}</div>`;
}

function level(l) {
  l = +l; if (!DB[l]) return levels();
  const tot = itemsOf(l).length, m = masteredCount(l);
  app.innerHTML = `
  <a href="#/levels" class="muted small">← ທຸກລະດັບ</a>
  <div class="row" style="margin-top:8px"><div class="badge l${l}">HSK<br>${l}</div><div><h1 style="margin:0">HSK ${l} · ${LEVEL_INFO[l].name}</h1><div class="muted">${LEVEL_INFO[l].desc}</div></div></div>
  <div class="card" style="margin-top:14px"><div class="row" style="justify-content:space-between"><span>ຄວາມຄືບໜ້າ</span><b>${m}/${tot}</b></div><div class="bar" style="margin-top:6px"><i style="width:${(m / tot * 100).toFixed(1)}%"></i></div><div class="muted small" style="margin-top:6px">${qCount(l)} ຄຳຖາມໃນລະດັບນີ້ · ແຕ່ລະຮອບ 10 ຂໍ້</div></div>

  <h2>ຝຶກຫັດ</h2>
  <div class="grid g3">
    <a class="tile" href="#/quiz/${l}/mix" style="border-color:var(--red)"><span class="ic">🌀</span><b>ປະສົມທຸກທັກສະ</b><span>ແນະນຳ — ຟັງ, ອ່ານ, ວັນນະຍຸດ ລວມກັນ</span></a>
    ${Object.entries(QT).map(([k, v]) => `<a class="tile" href="#/quiz/${l}/${k}"><span class="ic">${v.ic}</span><b>${v.name}</b><span>${v.sub}</span></a>`).join('')}
    <a class="tile" href="#/cards/${l}"><span class="ic">🃏</span><b>ບັດຄຳ</b><span>ເປີດບັດ ທ່ອງຈຳໄວ</span></a>
  </div>

  <div class="tabs"><button class="on" data-tab="w">ຄຳສັບ (${DB[l].w.length})</button><button data-tab="s">ປະໂຫຍກ (${DB[l].s.length})</button></div>
  <input type="search" placeholder="ຄົ້ນຫາ: ຈີນ / pinyin / ລາວ / English" aria-label="ຄົ້ນຫາ">
  <div class="vlist"></div>`;
  let tab = 'w';
  const list = $('.vlist'), q = $('input[type=search]');
  const draw = () => {
    const f = q.value.trim().toLowerCase();
    const strip = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const items = DB[l][tab].filter(it => !f || it.zh.includes(f) || strip(it.py).includes(strip(f)) || it.lo.includes(f) || it.en.toLowerCase().includes(f));
    list.innerHTML = items.map(it => `
      <div class="vitem ${isMastered(it.id) ? 'done' : ''}">
        <div><span class="zh" style="${tab === 's' ? 'font-size:20px' : ''}">${esc(it.zh)}</span> <span class="py">${esc(it.py)}</span>
        <div class="lo">${esc(it.lo)}</div><div class="en">${esc(it.en)}</div></div>
        <div class="row" style="gap:6px">${sayBtns(it.zh)}</div>
      </div>`).join('') || '<div class="empty">ບໍ່ພົບ</div>';
  };
  $$('[data-tab]').forEach(b => b.addEventListener('click', () => { tab = b.dataset.tab; $$('[data-tab]').forEach(x => x.classList.toggle('on', x === b)); draw(); }));
  q.addEventListener('input', draw);
  draw();
}

function quiz(l, type) {
  const isReview = l === 'review';
  const lvl = isReview ? 'review' : +l;
  if (!isReview && !DB[lvl]) return levels();
  if (!QT[type] && type !== 'mix') type = 'mix';
  let pool = isReview ? reviewItems() : itemsOf(lvl);
  const allowed = t => type === 'mix' ? (t !== 'speak' && t !== 'listenzh' ? true : Math.random() < 0.3) : t === type;
  pool = pool.filter(it => validTypes(it).some(t => type === 'mix' || t === type));
  if (!pool.length) {
    app.innerHTML = `<div class="empty"><h2>${isReview ? 'ບໍ່ມີຄຳທີ່ຕ້ອງທົບທວນ 🎉' : 'ບໍ່ມີຄຳຖາມ'}</h2><a class="btn primary" href="#/levels">ໄປບົດຮຽນ</a></div>`;
    return;
  }
  const qs = pickWeighted(pool, 10).map(it => {
    let vt = validTypes(it).filter(allowed);
    if (!vt.length) vt = validTypes(it).filter(t => type === 'mix' ? t !== 'speak' : t === type);
    return { it, t: vt[rand(vt.length)] };
  });
  let i = 0, score = 0; const wrong = [];
  const back = isReview ? '#/review' : `#/level/${lvl}`;
  const title = type === 'mix' ? '🌀 ປະສົມ' : QT[type].ic + ' ' + QT[type].name;

  const show = () => {
    if (i >= qs.length) return finish();
    const { it, t } = qs[i];
    app.innerHTML = `<div class="qwrap">
      <div class="qtop"><a href="${back}" class="muted" aria-label="ອອກ">✕</a><div class="bar"><i style="width:${i / qs.length * 100}%"></i></div><span class="qtag">${i + 1}/${qs.length}</span></div>
      <div class="qtag" style="margin-bottom:8px">${title} · HSK ${it.lvl} · ${QT[t].ic} ${QT[t].name}</div>
      <div id="qbox"></div></div>`;
    const box = $('#qbox');
    const next = (ok) => {
      record(it.id, ok); if (ok) score++; else wrong.push(it);
      i++; show();
    };
    if (t === 'speak') return renderSpeak(box, it, next);
    renderMC(box, it, t, {
      onDone: (ok, fb) => {
        record(it.id, ok); if (ok) score++; else wrong.push(it);
        fb.innerHTML = `<div style="margin-top:14px" class="${ok ? 'fb-ok' : 'fb-no'}">${ok ? '✅ ຖືກຕ້ອງ! +10 XP' : '❌ ຍັງບໍ່ຖືກ — ຈື່ຄຳນີ້ໄວ້'}</div>${revealHTML(it)}
          <button class="btn primary block" style="margin-top:14px" data-next>ຕໍ່ໄປ → <span class="muted small" style="color:inherit;opacity:.7">(Enter)</span></button>`;
        if (t !== 'listen' && t !== 'listenzh' && t !== 'tone') TTS.speak(it.zh);
        const go = () => { document.removeEventListener('keydown', onEnter); i++; show(); };
        const onEnter = e => { if (!document.body.contains(fb)) return document.removeEventListener('keydown', onEnter); if (e.key === 'Enter') { e.preventDefault(); go(); } };
        setTimeout(() => document.addEventListener('keydown', onEnter), 50);
        $('[data-next]', fb).addEventListener('click', go);
        fb.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });
  };
  const finish = () => {
    const pct = Math.round(score / qs.length * 100);
    app.innerHTML = `<div class="qwrap"><div class="card result">
      <div style="font-size:48px">${pct >= 80 ? '🏆' : pct >= 50 ? '💪' : '🌱'}</div>
      <div class="lvl">${score}/${qs.length}</div>
      <p>${pct >= 80 ? 'ເກັ່ງຫຼາຍ!' : pct >= 50 ? 'ດີແລ້ວ, ສືບຕໍ່ຝຶກ!' : 'ບໍ່ເປັນຫຍັງ — ການຝຶກຊ້ຳຄືກະແຈ!'} · XP ທັງໝົດ: <b>${S.xp}</b></p>
      <div class="row" style="justify-content:center"><button class="btn primary" data-again>🔁 ອີກຮອບ</button><a class="btn" href="${back}">ກັບຄືນ</a></div></div>
      ${wrong.length ? `<h2>ຄຳທີ່ຕ້ອງທົບທວນ</h2>${wrong.map(revealHTML).join('')}` : ''}</div>`;
    $('[data-again]').addEventListener('click', () => quiz(l, type));
  };
  show();
}

function cards(l) {
  l = +l; if (!DB[l]) return levels();
  let deck = pickWeighted(itemsOf(l), 20), i = 0, known = 0;
  const show = () => {
    if (i >= deck.length) {
      app.innerHTML = `<div class="qwrap"><div class="card result"><div style="font-size:48px">🃏</div><div class="lvl">${known}/${deck.length}</div><p>ຈື່ໄດ້ແລ້ວ</p>
        <div class="row" style="justify-content:center"><button class="btn primary" data-again>ອີກຊຸດ</button><a class="btn" href="#/level/${l}">ກັບຄືນ</a></div></div></div>`;
      $('[data-again]').addEventListener('click', () => cards(l));
      return;
    }
    const it = deck[i];
    app.innerHTML = `<div class="qwrap">
      <div class="qtop"><a href="#/level/${l}" class="muted">✕</a><div class="bar"><i style="width:${i / deck.length * 100}%"></i></div><span class="qtag">${i + 1}/${deck.length}</span></div>
      <div class="card flash" data-flip>
        <div class="zh" style="${it.kind === 's' ? 'font-size:30px' : ''}">${esc(it.zh)}</div>
        <div data-back hidden><div style="color:var(--red);font-size:20px">${esc(it.py)}</div><div style="font-size:20px">${esc(it.lo)}</div><div class="muted small">${esc(it.en)}</div></div>
        <div class="muted small" data-hint style="margin-top:14px">ແຕະເພື່ອເບິ່ງຄຳຕອບ</div>
        <div class="row" style="justify-content:center;margin-top:12px">${sayBtns(it.zh)}</div>
      </div>
      <div class="row" style="margin-top:14px" data-btns hidden>
        <button class="btn" style="flex:1" data-k="0">😕 ຍັງບໍ່ຈື່</button>
        <button class="btn primary" style="flex:1" data-k="1">😀 ຈື່ໄດ້</button>
      </div></div>`;
    TTS.speak(it.zh);
    $('[data-flip]').addEventListener('click', () => { $('[data-back]').hidden = false; $('[data-hint]').hidden = true; $('[data-btns]').hidden = false; });
    $$('[data-k]').forEach(b => b.addEventListener('click', () => { const ok = b.dataset.k === '1'; record(it.id, ok); if (ok) known++; i++; show(); }));
  };
  show();
}

/* ---------- placement test ---------- */
const PASS = 6, PER_LEVEL = 8;
function placement() {
  app.innerHTML = `<div class="qwrap">
    <h1>🎯 ທົດສອບລະດັບ HSK</h1>
    <div class="card">
      <p>ການທົດສອບນີ້ຈະປະເມີນລະດັບພາສາຈີນຂອງທ່ານ ຕັ້ງແຕ່ HSK 1 ເຖິງ HSK 6 ໂດຍເນັ້ນ <b>ການຟັງ</b> ແລະ <b>ການອ່ານ</b>.</p>
      <ul class="small">
        <li>ແຕ່ລະລະດັບມີ ${PER_LEVEL} ຂໍ້ (ຄຳສັບ + ປະໂຫຍກ)</li>
        <li>ຖ້າຕອບຖືກ ${PASS}/${PER_LEVEL} ຂໍ້ຂຶ້ນໄປ ຈະໄປລະດັບຕໍ່ໄປ</li>
        <li>ຖ້າບໍ່ຮູ້ ໃຫ້ກົດ "ບໍ່ຮູ້" — ຢ່າເດົາ, ຜົນຈະຖືກຕ້ອງກວ່າ</li>
        <li>ເປີດສຽງລຳໂພງ ຫຼື ໃສ່ຫູຟັງ 🎧 · ໃຊ້ເວລາ 3–15 ນາທີ</li>
      </ul>
      <div class="row"><button class="btn primary" data-start>ເລີ່ມທົດສອບ</button><button class="btn" data-zero>ຂ້ອຍບໍ່ຮູ້ພາສາຈີນເລີຍ</button></div>
    </div>
    ${S.placement ? `<p class="muted small" style="margin-top:12px">ຜົນຄັ້ງກ່ອນ: ${S.placement.level ? 'HSK ' + S.placement.level : 'ເລີ່ມຕົ້ນ'} (${new Date(S.placement.date).toLocaleDateString()})</p>` : ''}
  </div>`;
  $('[data-start]').addEventListener('click', runPlacement);
  $('[data-zero]').addEventListener('click', () => { S.placement = { level: 0, date: Date.now(), scores: {} }; save(); location.hash = '#/pinyin'; });
}
function placementSet(l) {
  const w = sample(DB[l].w, 5).map((it, k) => ({ it, t: ['read', 'listen', 'lao2zh', 'listen', 'read'][k] }));
  const s = sample(DB[l].s, 3).map((it, k) => ({ it, t: ['listen', 'read', 'listen'][k] }));
  return shuffle([...w, ...s]);
}
function runPlacement() {
  let lvl = 1, qs = placementSet(1), i = 0, correct = 0; const scores = {};
  const show = () => {
    const { it, t } = qs[i];
    const done = (lvl - 1) * PER_LEVEL + i;
    app.innerHTML = `<div class="qwrap">
      <div class="qtop"><a href="#/test" class="muted">✕</a><div class="bar"><i style="width:${done / (6 * PER_LEVEL) * 100}%"></i></div><span class="qtag">HSK ${lvl} · ${i + 1}/${PER_LEVEL}</span></div>
      <div id="qbox"></div></div>`;
    renderMC($('#qbox'), it, t, {
      allowSkip: true,
      onDone: ok => {
        if (ok) correct++;
        setTimeout(() => {
          i++;
          if (i < PER_LEVEL) return show();
          scores[lvl] = correct;
          if (correct >= PASS && lvl < 6) { lvl++; qs = placementSet(lvl); i = 0; correct = 0; return show(); }
          const passed = correct >= PASS ? lvl : lvl - 1;
          S.placement = { level: passed, date: Date.now(), scores }; save();
          result(passed, scores);
        }, ok ? 550 : 1100);
      }
    });
  };
  show();
}
function result(passed, scores) {
  const next = Math.min(6, passed + 1);
  app.innerHTML = `<div class="qwrap"><div class="card result">
    <div class="muted">ລະດັບຂອງທ່ານ</div>
    <div class="lvl">${passed ? 'HSK ' + passed : 'ເລີ່ມຕົ້ນ'}</div>
    <p>${passed === 6 ? 'ຍອດຢ້ຽມ! ທ່ານຢູ່ໃນລະດັບສູງສຸດ — ຝຶກ HSK 6 ຕໍ່ເພື່ອຄວາມຄ່ອງແຄ້ວ.' : passed === 0 ? 'ເລີ່ມຈາກ Pinyin ແລະ HSK 1 — ທຸກຄົນເລີ່ມຈາກບ່ອນນີ້!' : `ທ່ານຜ່ານ HSK ${passed}. ແນະນຳໃຫ້ຮຽນ HSK ${next} ຕໍ່.`}</p>
    <div style="text-align:left;margin:16px 0">${LEVELS.filter(l => scores[l] !== undefined).map(l => `
      <div class="row" style="gap:10px;margin:6px 0"><span style="width:60px">HSK ${l}</span><div class="bar" style="flex:1"><i style="width:${scores[l] / PER_LEVEL * 100}%;${scores[l] < PASS ? 'background:var(--bad)' : ''}"></i></div><span>${scores[l]}/${PER_LEVEL}</span></div>`).join('')}</div>
    <div class="row" style="justify-content:center">
      ${passed === 0 ? `<a class="btn primary" href="#/pinyin">🔤 ຮຽນ Pinyin</a><a class="btn" href="#/level/1">HSK 1</a>` : `<a class="btn primary" href="#/level/${next}">ຮຽນ HSK ${next} →</a>`}
      <a class="btn" href="#/test">ທົດສອບໃໝ່</a>
    </div></div></div>`;
}

/* ---------- pinyin / pronunciation ---------- */
const INITIALS = [
  ['b', 'ປ', '爸', 'bà', 'ຄື "ປ" ລາວ ບໍ່ແມ່ນ "ບ" — ບໍ່ມີລົມອອກ'],
  ['p', 'ພ', '怕', 'pà', 'ຄື "ພ" — ມີລົມອອກແຮງ'],
  ['m', 'ມ', '妈', 'mā', 'ຄືລາວ'],
  ['f', 'ຟ', '发', 'fā', 'ຄືລາວ'],
  ['d', 'ຕ', '大', 'dà', 'ຄື "ຕ" ບໍ່ແມ່ນ "ດ"'],
  ['t', 'ທ', '他', 'tā', 'ຄື "ທ" — ມີລົມ'],
  ['n', 'ນ', '你', 'nǐ', 'ຄືລາວ'],
  ['l', 'ລ', '拉', 'lā', 'ຄືລາວ'],
  ['g', 'ກ', '哥', 'gē', 'ຄື "ກ"'],
  ['k', 'ຄ', '可', 'kě', 'ຄື "ຄ" — ມີລົມ'],
  ['h', 'ຮ', '喝', 'hē', 'ຄື "ຮ" ແຕ່ອອກຈາກຄໍ ຫຍາບກວ່າ'],
  ['j', 'ຈ', '鸡', 'jī', 'ຄື "ຈ" ລີ້ນແຕະເພດານລຸ່ມ, ຍິ້ມ'],
  ['q', 'ຈ+ລົມ (ຊ)', '七', 'qī', 'ຄື "ຈ" ແຕ່ມີລົມພົ່ນອອກ — ຄ້າຍ "ຊ"'],
  ['x', 'ຊ', '西', 'xī', 'ຄື "ຊ" ຍິ້ມກວ້າງ ລີ້ນແປ'],
  ['zh', 'ຈ (ມ້ວນລີ້ນ)', '知', 'zhī', 'ມ້ວນປາຍລີ້ນຂຶ້ນ ແລ້ວອອກສຽງ "ຈ"'],
  ['ch', 'ຊ (ມ້ວນລີ້ນ+ລົມ)', '吃', 'chī', 'ມ້ວນລີ້ນ + ມີລົມ — ສຽງໜັກກວ່າ "ຊ"'],
  ['sh', 'ຊ (ມ້ວນລີ້ນ)', '是', 'shì', 'ມ້ວນລີ້ນ ຄ້າຍ "sh" ອັງກິດ'],
  ['r', 'ຣ (ມ້ວນລີ້ນ)', '日', 'rì', 'ມ້ວນລີ້ນ ຄ້າຍ "ຢ/ຣ" ບໍ່ສັ່ນລີ້ນ'],
  ['z', 'ຈ (ts)', '字', 'zì', 'ປາຍລີ້ນແຕະແຂ້ວໜ້າ "ຕຊ" ບໍ່ມີລົມ'],
  ['c', 'ຊ (ts+ລົມ)', '词', 'cí', 'ຄື z ແຕ່ມີລົມພົ່ນອອກ'],
  ['s', 'ຊ', '四', 'sì', 'ຄື "ຊ" ທຳມະດາ'],
  ['y', 'ຢ', '一', 'yī', 'ຄື "ຢ"'],
  ['w', 'ວ', '我', 'wǒ', 'ຄື "ວ"']
];
const FINALS = [
  ['a', 'ອາ', '啊', 'a'], ['o', 'ໂອ / ອໍ', '我', 'wǒ'], ['e', 'ເອີ', '饿', 'è'], ['i', 'ອີ', '一', 'yī'], ['u', 'ອູ', '五', 'wǔ'],
  ['ü', 'ອີ + ຫໍ່ປາກ', '鱼', 'yú'], ['ai', 'ໄອ', '爱', 'ài'], ['ei', 'ເອ(ີ)', '黑', 'hēi'], ['ao', 'ອາວ', '好', 'hǎo'], ['ou', 'ໂອວ', '狗', 'gǒu'],
  ['an', 'ອານ', '安', 'ān'], ['en', 'ເອິນ', '人', 'rén'], ['ang', 'ອາງ', '忙', 'máng'], ['eng', 'ເອິງ', '冷', 'lěng'], ['ong', 'ອົງ', '东', 'dōng'],
  ['er', 'ເອີ (ມ້ວນລີ້ນ)', '二', 'èr'], ['ia', 'ຢາ', '家', 'jiā'], ['ie', 'ເຢ', '谢', 'xiè'], ['iao', 'ຢາວ', '要', 'yào'], ['iu', 'ຢິວ', '六', 'liù'],
  ['ian', 'ເຢນ', '天', 'tiān'], ['in', 'ອິນ', '心', 'xīn'], ['iang', 'ຢາງ', '想', 'xiǎng'], ['ing', 'ອິງ', '听', 'tīng'], ['iong', 'ຢົງ', '用', 'yòng'],
  ['ua', 'ວາ', '花', 'huā'], ['uo', 'ວໍ', '多', 'duō'], ['uai', 'ວາຍ', '快', 'kuài'], ['ui', 'ເວີຍ', '对', 'duì'], ['uan', 'ວານ', '万', 'wàn'],
  ['un', 'ວຸນ', '问', 'wèn'], ['uang', 'ວາງ', '黄', 'huáng'], ['üe', 'ຢຶເອ', '月', 'yuè'], ['üan', 'ຢວນ', '远', 'yuǎn'], ['ün', 'ຢຶນ', '云', 'yún']
];
const TONE_SETS = [['妈', '麻', '马', '骂', 'ma'], ['八', '拔', '把', '爸', 'ba'], ['汤', '糖', '躺', '烫', 'tang'], ['诗', '十', '使', '是', 'shi'],
  ['衣', '姨', '椅', '意', 'yi'], ['通', '同', '统', '痛', 'tong'], ['搭', '达', '打', '大', 'da'], ['呼', '胡', '虎', '户', 'hu'],
  ['灰', '回', '毁', '惠', 'hui'], ['微', '围', '伟', '位', 'wei']];
const curve = { 1: 'M10 10 L130 10', 2: 'M10 30 L130 6', 3: 'M10 22 Q55 46 85 38 T130 8', 4: 'M10 6 L130 40' };

function pinyin() {
  const toneCard = (t, py, zh, lo, desc) => `<div class="tone t${t}"><div class="py">${py}</div>
    <svg viewBox="0 0 140 46"><path d="${curve[t]}" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" style="color:var(--t${t})"/></svg>
    <div class="zh" style="font-size:26px">${zh}</div><div style="font-weight:700">${lo}</div><div class="small muted">${desc}</div>
    <div class="row" style="justify-content:center;margin-top:6px">${sayBtns(zh)}</div></div>`;
  app.innerHTML = `
  <h1>🔤 ອອກສຽງໃຫ້ຄືຄົນຈີນ</h1>
  <p>ພາສາຈີນມີ <b>4 ວັນນະຍຸດ + 1 ສຽງເບົາ</b>. ວັນນະຍຸດຕ່າງກັນ = ຄວາມໝາຍຕ່າງກັນ (ຄືກັບພາສາລາວ). ຄົນລາວໄດ້ປຽບ ເພາະຄຸ້ນເຄີຍກັບພາສາທີ່ມີວັນນະຍຸດຢູ່ແລ້ວ!</p>

  <h2>1. ວັນນະຍຸດ (声调)</h2>
  <div class="tones">
    ${toneCard(1, 'mā', '妈', 'ສຽງ 1 · ສູງ-ຮາບ', 'ສູງ ແລະ ຍາວ ຄືຮ້ອງເພງໂນດສູງ (55) — ແມ່')}
    ${toneCard(2, 'má', '麻', 'ສຽງ 2 · ຂຶ້ນ', 'ຈາກກາງຂຶ້ນສູງ ຄືຖາມ "ຫືມ?" (35) — ປ່ານ')}
    ${toneCard(3, 'mǎ', '马', 'ສຽງ 3 · ລົງ-ຂຶ້ນ', 'ຕ່ຳລົງແລ້ວຂຶ້ນ (214); ເວລາເວົ້າໄວ ມັກອອກແຕ່ສຽງຕ່ຳ — ມ້າ')}
    ${toneCard(4, 'mà', '骂', 'ສຽງ 4 · ລົງແຮງ', 'ຈາກສູງລົງຕ່ຳແຮງໆ ຄືອອກຄຳສັ່ງ (51) — ດ່າ')}
  </div>
  <div class="tip"><b>ສຽງເບົາ (轻声)</b>: ບໍ່ມີເຄື່ອງໝາຍ ເຊັ່ນ <span class="zh">吗</span> ma, <span class="zh">的</span> de — ອອກສຽງສັ້ນ ແລະ ເບົາ. ${sayBtns('妈妈')}</div>

  <h2>2. ຝຶກຟັງວັນນະຍຸດ</h2>
  <div class="card" id="tonegame"></div>

  <h2>3. ພະຍັນຊະນະຕົ້ນ (声母)</h2>
  <div class="tip">⚠️ <b>ຈຸດທີ່ຄົນລາວມັກຜິດ:</b> <b>b, d, g</b> ໃນ pinyin ບໍ່ແມ່ນ ບ, ດ, ກ ແບບລາວ — ມັນຄື <b>ປ, ຕ, ກ</b> (ບໍ່ມີລົມ). ສ່ວນ <b>p, t, k</b> ຄື <b>ພ, ທ, ຄ</b> (ມີລົມ). ລອງເອົາເຈ້ຍໄວ້ໜ້າປາກ: p/t/k ເຈ້ຍຕ້ອງໄຫວ.</div>
  <div class="card tbl"><table><thead><tr><th>Pinyin</th><th>ໃກ້ຄຽງລາວ</th><th>ຕົວຢ່າງ</th><th>ວິທີອອກສຽງ</th><th></th></tr></thead><tbody>
    ${INITIALS.map(r => `<tr><td><b style="font-size:20px">${r[0]}</b></td><td>${r[1]}</td><td><span class="zh">${r[2]}</span> <span style="color:var(--red)">${r[3]}</span></td><td class="small">${r[4]}</td><td>${sayBtns(r[2])}</td></tr>`).join('')}
  </tbody></table></div>

  <h2>4. ສະຫຼະ (韵母)</h2>
  <div class="card tbl"><table><thead><tr><th>Pinyin</th><th>ໃກ້ຄຽງລາວ</th><th>ຕົວຢ່າງ</th><th></th></tr></thead><tbody>
    ${FINALS.map(r => `<tr><td><b style="font-size:20px">${r[0]}</b></td><td>${r[1]}</td><td><span class="zh">${r[2]}</span> <span style="color:var(--red)">${r[3]}</span></td><td>${sayBtns(r[2])}</td></tr>`).join('')}
  </tbody></table></div>
  <p class="muted small">* ສຽງລາວເປັນພຽງການທຽບໃກ້ຄຽງ — ໃຫ້ຟັງສຽງຕົວຢ່າງ 🔊 ແລ້ວເວົ້າຕາມເປັນຫຼັກ.</p>

  <h2>5. ກົດການປ່ຽນວັນນະຍຸດ</h2>
  <div class="tip"><b>3 + 3 → 2 + 3</b>: ສອງສຽງ 3 ຕິດກັນ ສຽງທຳອິດກາຍເປັນສຽງ 2. <span class="zh">你好</span> nǐ hǎo → ອ່ານ <b>ní hǎo</b> ${sayBtns('你好')}</div>
  <div class="tip"><b>不 bù</b> ກ່ອນສຽງ 4 → <b>bú</b>: <span class="zh">不是</span> bú shì, <span class="zh">不要</span> bú yào ${sayBtns('不是')}</div>
  <div class="tip"><b>一 yī</b> ກ່ອນສຽງ 4 → <b>yí</b> (<span class="zh">一个</span> yí ge); ກ່ອນສຽງ 1/2/3 → <b>yì</b> (<span class="zh">一起</span> yìqǐ) ${sayBtns('一个')}</div>

  <h2>6. ເຄັດລັບສຳລັບຄົນລາວ</h2>
  <div class="grid g2">
    <div class="card"><h3>ü ບໍ່ມີໃນພາສາລາວ</h3><p class="small">ເວົ້າ "ອີ" ຄ້າງໄວ້ ແລ້ວຫໍ່ປາກຄືຈະເປົ່າປາກ — ລີ້ນຢູ່ບ່ອນເກົ່າ. <span class="zh">鱼</span> yú, <span class="zh">女</span> nǚ</p>${sayBtns('鱼')}</div>
    <div class="card"><h3>zh/ch/sh ກັບ z/c/s</h3><p class="small">zh/ch/sh ມ້ວນລີ້ນຂຶ້ນ; z/c/s ລີ້ນແປຢູ່ຫຼັງແຂ້ວ. <span class="zh">四 sì (4) ≠ 是 shì (ແມ່ນ) ≠ 十 shí (10)</span></p>${sayBtns('四，是，十')}</div>
    <div class="card"><h3>-n ກັບ -ng</h3><p class="small">-n ລີ້ນແຕະເຫືອກ (ອານ), -ng ອອກຈາກຄໍ (ອາງ). <span class="zh">山 shān ≠ 上 shàng</span></p>${sayBtns('山，上')}</div>
    <div class="card"><h3>ຟັງ → ເວົ້າ → ອັດສຽງ</h3><p class="small">ຟັງ 🐢 ຊ້າໆ 3 ເທື່ອ, ເວົ້າຕາມ, ແລ້ວໃຊ້ <a href="#/quiz/1/speak">🎤 ຝຶກເວົ້າ</a> ໃຫ້ລະບົບກວດ.</p></div>
  </div>`;
  toneGame($('#tonegame'));
}

function markTone(base, t) {
  const i = base.includes('a') ? base.indexOf('a') : base.includes('e') ? base.indexOf('e') : base.includes('ou') ? base.indexOf('o')
    : Math.max(...['i', 'o', 'u', 'ü'].map(v => base.lastIndexOf(v)));
  return base.slice(0, i) + TONES[base[i]][t] + base.slice(i + 1);
}
function toneGame(box) {
  let n = 0, ok = 0;
  const round = () => {
    const set = TONE_SETS[rand(TONE_SETS.length)], t = 1 + rand(4), zh = set[t - 1];
    box.innerHTML = `<div style="text-align:center"><p>ຟັງແລ້ວເລືອກວັນນະຍຸດ <span class="pill">ຄະແນນ ${ok}/${n}</span></p>
      <button class="playbig" data-say="${zh}">🔊</button>
      <div class="grid g4" style="margin-top:14px">${[1, 2, 3, 4].map(k => `<button class="opt" data-t="${k}" style="justify-content:center;font-size:22px;color:var(--t${k})">${markTone(set[4], k)} <span class="small">(${k})</span></button>`).join('')}</div>
      <div data-fb style="margin-top:10px"></div></div>`;
    TTS.speak(zh, 0.8);
    $$('[data-t]', box).forEach(b => b.addEventListener('click', () => {
      if (box.dataset.lock) return; box.dataset.lock = '1';
      n++; const right = +b.dataset.t === t; if (right) ok++;
      $$('[data-t]', box).forEach(x => { x.disabled = true; if (+x.dataset.t === t) x.classList.add('ok'); else if (x === b) x.classList.add('no'); });
      $('[data-fb]', box).innerHTML = `<span class="zh" style="font-size:26px">${zh}</span> — ${right ? '<span class="fb-ok">ຖືກ!</span>' : '<span class="fb-no">ສຽງ ' + t + '</span>'} <button class="btn" data-n>ຕໍ່ໄປ →</button>`;
      $('[data-n]', box).addEventListener('click', () => { delete box.dataset.lock; round(); });
    }));
  };
  round();
}

/* ---------- review & settings ---------- */
function review() {
  const items = reviewItems();
  app.innerHTML = `<h1>🔁 ທົບທວນ</h1>
    <p class="muted">ຄຳ ແລະ ປະໂຫຍກທີ່ທ່ານເຄີຍຕອບຜິດ ແລະ ຍັງບໍ່ທັນຈື່ໄດ້.</p>
    ${items.length ? `<a class="btn primary" href="#/quiz/review/mix">ຝຶກຄຳທີ່ຜິດ (${items.length})</a>
      <div class="vlist" style="margin-top:14px">${items.slice(0, 100).map(it => `<div class="vitem"><div><span class="zh">${esc(it.zh)}</span> <span class="py">${esc(it.py)}</span> <span class="pill">HSK ${it.lvl}</span><div class="lo">${esc(it.lo)}</div><div class="en">${esc(it.en)}</div></div><div class="row" style="gap:6px">${sayBtns(it.zh)}</div></div>`).join('')}</div>`
      : `<div class="empty"><div style="font-size:48px">🎉</div>ບໍ່ມີຄຳທີ່ຕ້ອງທົບທວນ. <a href="#/levels">ໄປຮຽນຕໍ່</a></div>`}`;
}

function settings() {
  app.innerHTML = `<h1>⚙️ ຕັ້ງຄ່າ</h1>
  <div class="card grid" style="gap:16px">
    <div><b>ສຽງອ່ານພາສາຈີນ</b>
      ${TTS.voices.length ? `<select id="voice">${TTS.voices.map(v => `<option value="${esc(v.name)}" ${TTS.voice && v.name === TTS.voice.name ? 'selected' : ''}>${esc(v.name)} (${esc(v.lang)})</option>`).join('')}</select>
      <p class="muted small">ແນະນຳ: ສຽງທີ່ມີຄຳວ່າ "Google 普通话", "Xiaoxiao" ຫຼື "Natural" — ສຽງຄືຄົນຈີນແທ້ທີ່ສຸດ.</p>`
      : `<div class="warn">ບໍ່ພົບສຽງພາສາຈີນໃນອຸປະກອນນີ້. ກະລຸນາໃຊ້ Google Chrome (ຄອມ ຫຼື Android), ຫຼື ຕິດຕັ້ງ Chinese voice ໃນ Settings ຂອງລະບົບ (Windows: Settings → Time & Language → Speech; iPhone: Settings → Accessibility → Spoken Content → Voices → Chinese).</div>`}
    </div>
    <div><b>ຄວາມໄວສຽງ: <span id="rv">${S.settings.rate}</span></b>
      <input type="range" id="rate" min="0.5" max="1.2" step="0.05" value="${S.settings.rate}" style="width:100%"></div>
    <div class="row"><button class="btn" data-say="你好，欢迎你学习汉语！我们一起加油吧。">🔊 ທົດລອງສຽງ</button></div>
    <div><b>ການຮັບຮູ້ສຽງເວົ້າ (ໄມໂຄຣໂຟນ):</b> ${SR_CLASS ? '<span class="fb-ok">✅ ຮອງຮັບ</span>' : '<span class="fb-no">❌ ບໍ່ຮອງຮັບ — ໃຊ້ Google Chrome</span>'}</div>
    <hr style="border:none;border-top:1px solid var(--line);width:100%">
    <div><b>ຂໍ້ມູນຂອງທ່ານ</b><p class="small muted">XP: ${S.xp} · ຄຳທີ່ເຄີຍຝຶກ: ${Object.keys(S.stats).length}. ບັນທຶກຢູ່ໃນບຣາວເຊີນີ້ເທົ່ານັ້ນ.</p>
      <button class="btn" id="reset">🗑️ ລຶບຄວາມຄືບໜ້າທັງໝົດ</button></div>
  </div>`;
  const v = $('#voice');
  if (v) v.addEventListener('change', () => { S.settings.voice = v.value; save(); TTS.load(); TTS.speak('你好'); });
  $('#rate').addEventListener('input', e => { S.settings.rate = +e.target.value; $('#rv').textContent = S.settings.rate; save(); });
  $('#reset').addEventListener('click', e => {
    const b = e.currentTarget;
    if (b.dataset.confirm) { S.stats = {}; S.xp = 0; delete S.placement; save(); settings(); }
    else { b.dataset.confirm = '1'; b.textContent = '⚠️ ກົດອີກຄັ້ງເພື່ອຢືນຢັນ'; }
  });
}

/* ---------------- router ---------------- */
const routes = { '': home, test: placement, levels, level, quiz, cards, pinyin, review, settings };
function router() {
  if (TTS.ok) speechSynthesis.cancel();
  const box = $('#qbox'); if (box && box._cleanup) box._cleanup();
  const [r, ...args] = location.hash.replace(/^#\/?/, '').split('/');
  (routes[r] || home)(...args);
  window.scrollTo(0, 0);
  $$('nav a').forEach(a => {
    const h = a.getAttribute('href').replace('#/', '');
    a.classList.toggle('active', h === r || (h === 'levels' && ['level', 'quiz', 'cards'].includes(r)));
  });
}
addEventListener('hashchange', router);
router();
})();
