(function () {
'use strict';
const C = window.CORE, PD = window.PINYIN_DATA;
const REPO = 'https://github.com/Dan16ssd/chinese-levelup';

/* ---------------- helpers ---------------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const app = $('#app');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const { rand, shuffle, sample } = C;
const pct = (a, b) => (b ? a / b * 100 : 0).toFixed(1);

/* ---------------- data ---------------- */
const LEVELS = [1, 2, 3, 4, 5, 6];
const DB = {}, BYID = {};
const PATTERNS = window.PATTERNS || {}, DIALOGUES = window.DIALOGUES || {};
LEVELS.forEach(l => {
  const r = window.HSK_RAW[l];
  DB[l] = { w: C.parseItems(r.w, l, 'w'), s: C.parseItems(r.s, l, 's'), p: [] };
  (PATTERNS[l] || []).forEach((pt, pi) => pt.ex.forEach(e => {
    DB[l].p.push({ id: 'p:' + e.zh, zh: e.zh, py: e.py, lo: e.lo, en: e.en, tiles: e.tiles, lvl: l, kind: 'p', pat: pi });
  }));
  [...DB[l].w, ...DB[l].s, ...DB[l].p].forEach(it => { if (!BYID[it.id]) BYID[it.id] = it; });
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

/* ---------------- question types ---------------- */
const SR_CLASS = window.SpeechRecognition || window.webkitSpeechRecognition;
const QT = {
  read:     { ic: '📖', name: 'ອ່ານ', sub: 'ເບິ່ງຕົວອັກສອນຈີນ → ເລືອກຄວາມໝາຍ' },
  listen:   { ic: '🎧', name: 'ຟັງ', sub: 'ຟັງສຽງຈີນ → ເລືອກຄວາມໝາຍ' },
  listenzh: { ic: '👂', name: 'ຟັງ → ຕົວອັກສອນ', sub: 'ຟັງສຽງ → ເລືອກຕົວອັກສອນທີ່ຖືກ' },
  lao2zh:   { ic: '🔁', name: 'ລາວ → ຈີນ', sub: 'ເບິ່ງພາສາລາວ → ເລືອກພາສາຈີນ' },
  tone:     { ic: '🎵', name: 'ວັນນະຍຸດ', sub: 'ຟັງ → ເລືອກ pinyin ທີ່ມີວັນນະຍຸດຖືກ' },
  speak:    { ic: '🎤', name: 'ເວົ້າ', sub: 'ເວົ້າໃສ່ໄມ → ກວດການອອກສຽງ ແລະ ວັນນະຍຸດ' },
  build:    { ic: '🧩', name: 'ສ້າງປະໂຫຍກ', sub: 'ລຽງຄຳໃຫ້ເປັນປະໂຫຍກ' }
};
const W_TYPES = ['read', 'listen', 'listenzh', 'lao2zh', 'tone', 'speak'];
const S_TYPES = ['read', 'listen', 'lao2zh', 'speak'];
const VT = new Map();
function validTypes(it) {
  if (it.kind === 'p') return ['build'];
  if (it.kind === 's') return S_TYPES;
  if (!VT.has(it.id)) VT.set(it.id, C.toneVariants(it.py).length >= 2 ? W_TYPES : W_TYPES.filter(t => t !== 'tone'));
  return VT.get(it.id);
}
const qCount = l => itemsOf(l).reduce((a, it) => a + validTypes(it).length, 0) + DB[l].p.length
  + (DIALOGUES[l] || []).reduce((a, d) => a + d.qs.length, 0);
const TOTAL_Q = LEVELS.reduce((a, l) => a + qCount(l), 0);
const TOTAL_W = LEVELS.reduce((a, l) => a + DB[l].w.length, 0);
const TOTAL_S = LEVELS.reduce((a, l) => a + DB[l].s.length + DB[l].p.length, 0);

/* ---------------- storage (v2, migrates v1) ---------------- */
const KEY = 'chinese-levelup-v2', OLD_KEY = 'chinese-levelup-v1';
let S = {};
try { S = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { S = {}; }
if (!S.v) {
  try {
    const old = JSON.parse(localStorage.getItem(OLD_KEY));
    if (old) {
      const map = window.LEGACY_IDS || {};
      S = { xp: old.xp || 0, settings: old.settings || {}, placement: old.placement, stats: {} };
      for (const [id, st] of Object.entries(old.stats || {})) if (map[id]) S.stats[map[id]] = C.migrateStat(st);
    }
  } catch (e) { /* ignore */ }
  S.v = 2;
}
S.stats = S.stats || {}; S.xp = S.xp || 0; S.passed = S.passed || {}; S.errors = S.errors || [];
S.settings = Object.assign({ rate: 0.85, voice: '', engine: 'mp3' }, S.settings || {});
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* private mode / full */ } };
save();
function record(id, ok) {
  S.stats[id] = C.schedule(S.stats[id], ok);
  if (ok) S.xp += 10;
  save();
}
const isMastered = id => C.isMastered(S.stats[id]);
const masteredCount = l => itemsOf(l).filter(it => isMastered(it.id)).length;
const dueItems = () => Object.entries(S.stats).filter(([id, st]) => BYID[id] && C.isDue(st))
  .sort((a, b) => (a[1].due || 0) - (b[1].due || 0)).map(([id]) => BYID[id]);
function maxUnlocked() {
  let m = 1;
  if (S.placement) m = Math.max(m, S.placement.level + 1);
  Object.keys(S.passed).forEach(l => { m = Math.max(m, +l + 1); });
  return Math.min(6, m);
}
const isUnlocked = l => l <= maxUnlocked();

/* ---------------- error capture (local only) ---------------- */
function logError(m, stack) {
  S.errors.push({ m: String(m).slice(0, 300), s: String(stack || '').slice(0, 600), h: location.hash, t: Date.now() });
  S.errors = S.errors.slice(-10); save();
}
addEventListener('error', e => logError(e.message, e.error && e.error.stack));
addEventListener('unhandledrejection', e => logError(e.reason && e.reason.message || e.reason, e.reason && e.reason.stack));
const issueUrl = (title, body) => `${REPO}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
const reportBtn = it => `<button class="say flag" data-report="${esc(it.id)}" title="ແຈ້ງຄຳແປຜິດ" aria-label="ແຈ້ງຄຳແປຜິດ">⚑</button>`;

/* ---------------- audio: pre-generated MP3, falls back to device TTS ---------------- */
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
    return new Promise(res => {
      if (!this.ok) return res();
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'zh-CN';
      if (this.voice) u.voice = this.voice;
      u.rate = rate || S.settings.rate;
      u.onend = u.onerror = () => res();
      setTimeout(() => speechSynthesis.speak(u), 60);
    });
  }
};
TTS.load();
if (TTS.ok) speechSynthesis.onvoiceschanged = () => TTS.load();

const AUDIO = {
  el: null,
  url: t => 'audio/' + C.audioName(t),
  stop() {
    if (this.el) { this.el.pause(); this.el = null; }
    if (TTS.ok) speechSynthesis.cancel();
  },
  // resolves when playback ends
  play(text, slow) {
    this.stop();
    const tts = () => TTS.speak(text, slow ? 0.5 : undefined);
    if (S.settings.engine === 'tts') return tts();
    return new Promise(res => {
      const a = new Audio(this.url(text));
      this.el = a;
      let fell = false;
      const fallback = () => { if (fell || this.el !== a) return res(); fell = true; this.el = null; tts().then(res); };
      a.preservesPitch = a.webkitPreservesPitch = true;
      a.playbackRate = slow ? 0.6 : Math.max(0.5, Math.min(1.5, S.settings.rate / 0.85));
      a.onended = () => res();
      a.onerror = fallback;
      a.play().catch(err => { if (err && err.name === 'NotAllowedError') res(); else if (err && err.name !== 'AbortError') fallback(); else res(); });
    });
  }
};
const say = (text, slow) => AUDIO.play(text, slow);

const sayBtns = zh => `<button class="say" data-say="${esc(zh)}" title="ຟັງ" aria-label="ຟັງ">🔊</button><button class="say" data-say="${esc(zh)}" data-slow="1" title="ຟັງຊ້າໆ" aria-label="ຟັງຊ້າໆ">🐢</button>`;
document.addEventListener('click', e => {
  const b = e.target.closest('[data-say]');
  if (b) { e.stopPropagation(); say(b.dataset.say, !!b.dataset.slow); return; }
  const r = e.target.closest('[data-report]');
  if (r) {
    e.stopPropagation();
    const it = BYID[r.dataset.report]; if (!it) return;
    window.open(issueUrl(`ຄຳແປຜິດ / Translation: ${it.zh}`,
      `**Item:** ${it.zh} (${it.py}) · HSK ${it.lvl}\n**ລາວ (ປັດຈຸບັນ):** ${it.lo}\n**English:** ${it.en}\n\n**ຄຳແປທີ່ຖືກຕ້ອງ / Correct translation:**\n\n`), '_blank', 'noopener');
  }
});

/* ---------------- speech recognition ---------------- */
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

/* ---------------- recording + tone-contour check ---------------- */
async function recordVoice(btn, status, maxMs = 6000) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const rec = new MediaRecorder(stream), chunks = [];
  return new Promise(res => {
    rec.ondataavailable = e => chunks.push(e.data);
    rec.onstop = () => { stream.getTracks().forEach(t => t.stop()); btn.classList.remove('rec'); btn.onclick = null; res(new Blob(chunks, { type: rec.mimeType })); };
    rec.start(); btn.classList.add('rec');
    status.textContent = 'ກຳລັງອັດ... ເວົ້າແລ້ວກົດອີກເທື່ອເພື່ອຢຸດ';
    btn.onclick = () => rec.state === 'recording' && rec.stop();
    setTimeout(() => rec.state === 'recording' && rec.stop(), maxMs);
  });
}
let ACTX = null;
async function decode(buf) {
  ACTX = ACTX || new (window.AudioContext || window.webkitAudioContext)();
  return ACTX.decodeAudioData(buf);
}
async function analyseTone(text, blob) {
  const r = await fetch(AUDIO.url(text));
  if (!r.ok) throw new Error('noref');
  const [ref, usr] = await Promise.all([r.arrayBuffer().then(decode), blob.arrayBuffer().then(decode)]);
  const cr = C.contour(C.pitchTrack(ref.getChannelData(0), ref.sampleRate));
  const cu = C.contour(C.pitchTrack(usr.getChannelData(0), usr.sampleRate));
  return { ref: cr, user: cu, score: C.contourScore(cr, cu) };
}
function drawContours(canvas, ref, user) {
  const g = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
  const css = getComputedStyle(document.body);
  g.clearRect(0, 0, W, H);
  g.strokeStyle = css.getPropertyValue('--line'); g.lineWidth = 1;
  for (let k = -6; k <= 6; k += 6) { const y = H / 2 - k / 16 * H; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  const line = (arr, color, width) => {
    if (!arr.length) return;
    const a = C.resample(arr, 60);
    g.strokeStyle = color; g.lineWidth = width; g.lineJoin = g.lineCap = 'round'; g.beginPath();
    a.forEach((v, i) => { const x = 8 + i / 59 * (W - 16), y = H / 2 - Math.max(-8, Math.min(8, v)) / 16 * H; i ? g.lineTo(x, y) : g.moveTo(x, y); });
    g.stroke();
  };
  line(ref, css.getPropertyValue('--t3').trim() || '#2563eb', 5);
  line(user, css.getPropertyValue('--red').trim() || '#c8102e', 3);
}
function toneCheckUI(it) {
  if (!navigator.mediaDevices || !window.MediaRecorder) return '';
  return `<div class="tonecheck">
    <button class="btn" data-tc>📈 ກວດວັນນະຍຸດ (ອັດສຽງ)</button>
    <div class="small muted" data-tcs>ປຽບທຽບເສັ້ນສຽງສູງ-ຕ່ຳຂອງທ່ານກັບສຽງຕົ້ນແບບ</div>
    <div data-tcr hidden><canvas width="520" height="150"></canvas>
    <div class="small"><span class="lg" style="background:var(--t3)"></span> ສຽງຕົ້ນແບບ &nbsp; <span class="lg" style="background:var(--red)"></span> ສຽງຂອງທ່ານ</div><div data-tcv></div></div>
  </div>`;
}
function wireToneCheck(box, it) {
  const b = $('[data-tc]', box); if (!b) return;
  const st = $('[data-tcs]', box), out = $('[data-tcr]', box);
  b.addEventListener('click', async () => {
    if (b.classList.contains('rec')) return;
    AUDIO.stop();
    try {
      const blob = await recordVoice(b, st);
      st.textContent = 'ກຳລັງວິເຄາະ...';
      const r = await analyseTone(it.zh, blob);
      out.hidden = false;
      drawContours($('canvas', out), r.ref, r.user);
      const v = $('[data-tcv]', out);
      if (r.score === null) { v.innerHTML = '<span class="fb-no">ບໍ່ໄດ້ຍິນສຽງຊັດເຈນ — ເວົ້າດັງຂຶ້ນ ແລະ ໃກ້ໄມ</span>'; }
      else v.innerHTML = `<b class="${r.score >= 80 ? "fb-ok" : "fb-no"}" style="font-size:20px">${r.score}%</b> ${r.score >= 80 ? 'ວັນນະຍຸດໃກ້ຄຽງຫຼາຍ 👏' : r.score >= 60 ? 'ໃກ້ແລ້ວ — ເບິ່ງບ່ອນທີ່ເສັ້ນຕ່າງກັນ' : 'ຟັງ 🐢 ແລ້ວລອງເຮັດໃຫ້ເສັ້ນສີແດງຄືເສັ້ນສີຟ້າ'}
        <audio controls src="${URL.createObjectURL(blob)}" style="width:100%;margin-top:6px"></audio>`;
      st.textContent = 'ໝາຍເຫດ: ກວດສະເພາະຮູບແບບສູງ-ຕ່ຳ (ວັນນະຍຸດ), ບໍ່ໄດ້ກວດພະຍັນຊະນະ/ສະຫຼະ.';
    } catch (e) {
      st.textContent = e && e.message === 'noref' ? 'ບໍ່ມີສຽງຕົ້ນແບບສຳລັບຄຳນີ້ (ຕ້ອງອອນລາຍ)' : 'ບໍ່ສາມາດເປີດໄມໂຄຣໂຟນໄດ້';
      b.classList.remove('rec');
    }
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
const playBig = zh => `<div style="margin-top:12px"><button class="playbig" data-say="${esc(zh)}" aria-label="ຟັງ">🔊</button><div class="row" style="justify-content:center;margin-top:10px"><button class="say" data-say="${esc(zh)}" data-slow="1" aria-label="ຟັງຊ້າໆ">🐢</button></div></div>`;
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
  if (audio) prompt += playBig(it.zh);
  let wrong = type === 'tone' ? C.toneVariants(it.py).slice(0, 3) : distract(it, key, 3);
  if (wrong.length < 3) wrong = wrong.concat(distract(it, key, 3 - wrong.length).filter(x => !wrong.includes(x)));
  const opts = shuffle([{ label: it[key], ok: true }, ...wrong.map(w => ({ label: w, ok: false }))]);
  return { prompt, ask, opts, audio, optClass: type === 'tone' ? '' : optClass, sentence: it.kind === 's' && optClass === 'zh' };
}

const revealHTML = it => `
  <div class="reveal">
    <div class="row" style="justify-content:space-between">
      <div><div class="zh">${esc(it.zh)}</div><div class="py">${esc(it.py)}</div></div>
      <div class="row">${sayBtns(it.zh)}${reportBtn(it)}</div>
    </div>
    <div style="margin-top:6px;font-size:18px">${esc(it.lo)}</div>
    <div class="muted small">${esc(it.en)}</div>
  </div>`;

/* Generic multiple-choice renderer. q = {ask, prompt, opts:[{label, ok}], optClass, autoplay} */
function renderChoices(box, q, opts) {
  box.innerHTML = `
    <div class="card prompt"><div class="ask">${q.ask}</div>${q.prompt}</div>
    <div class="opts">
      ${q.opts.map((o, i) => `<button class="opt ${q.optClass || ''}" data-i="${i}" ${q.sentence ? 'style="font-size:19px"' : ''}><span class="k">${i + 1}</span><span>${esc(o.label)}</span></button>`).join('')}
      ${opts.allowSkip ? `<button class="btn" data-skip>🤷 ບໍ່ຮູ້ / ຂ້າມ</button>` : ''}
    </div>
    <div class="fb"></div>`;
  if (q.autoplay) say(q.autoplay);
  let answered = false;
  const answer = i => {
    if (answered) return; answered = true;
    const ok = i >= 0 && q.opts[i].ok;
    $$('.opt', box).forEach((b, j) => { b.disabled = true; if (q.opts[j].ok) b.classList.add('ok'); else if (j === i) b.classList.add('no'); });
    const sk = $('[data-skip]', box); if (sk) sk.remove();
    document.removeEventListener('keydown', onKey);
    opts.onDone(ok, $('.fb', box));
  };
  const onKey = e => { if (!document.body.contains(box)) return document.removeEventListener('keydown', onKey); const n = +e.key; if (n >= 1 && n <= q.opts.length) answer(n - 1); };
  document.addEventListener('keydown', onKey);
  $$('.opt', box).forEach(b => b.addEventListener('click', () => answer(+b.dataset.i)));
  const sk = $('[data-skip]', box); if (sk) sk.addEventListener('click', () => answer(-1));
}
function renderMC(box, it, type, opts) {
  const q = buildQ(it, type);
  q.autoplay = q.audio ? it.zh : null;
  renderChoices(box, q, opts);
}

/* Speaking: Chrome speech recognition for characters + offline tone-contour check */
function renderSpeak(box, it, onDone) {
  box.innerHTML = `
    <div class="card prompt">
      <div class="ask">ຟັງກ່ອນ ແລ້ວເວົ້າຕາມໃຫ້ຄືທີ່ສຸດ</div>
      <div class="big ${it.kind !== 'w' ? 'sent' : ''}">${esc(it.zh)}</div>
      <div class="py" style="color:var(--red);font-size:18px">${esc(it.py)}</div>
      <div>${esc(it.lo)}</div>
      <div class="row" style="justify-content:center;margin-top:14px">${sayBtns(it.zh)}</div>
      ${SR_CLASS ? `<div style="margin-top:18px"><button class="mic" aria-label="ເວົ້າ">🎤</button></div>
      <div class="muted small" style="margin-top:8px" data-st>ກົດ 🎤 ແລ້ວເວົ້າເປັນພາສາຈີນ (ກວດຕົວອັກສອນ)</div>`
      : `<div class="warn">ບຣາວເຊີນີ້ບໍ່ຮອງຮັບການຮັບຮູ້ຄຳເວົ້າ (ໃຊ້ Google Chrome ເພື່ອກວດຕົວອັກສອນ). ທ່ານຍັງກວດວັນນະຍຸດດ້ວຍການອັດສຽງໄດ້ ⬇️</div>`}
      <div data-res style="margin-top:10px"></div>
      ${toneCheckUI(it)}
    </div>
    <div class="row" style="justify-content:center" data-after></div>`;
  say(it.zh);
  wireToneCheck(box, it);
  const after = $('[data-after]', box);
  let finished = false;
  const finish = ok => { if (finished) return; finished = true; onDone(ok); };
  const selfAssess = () => {
    after.innerHTML = `<button class="btn" data-ok="1">✅ ຂ້ອຍເວົ້າໄດ້ຖືກ</button><button class="btn" data-ok="0">🔁 ຍັງບໍ່ຖືກ</button>`;
    $$('[data-ok]', after).forEach(b => b.addEventListener('click', () => finish(b.dataset.ok === '1')));
  };
  if (!SR_CLASS) return selfAssess();
  const mic = $('.mic', box), st = $('[data-st]', box), res = $('[data-res]', box);
  let tries = 0;
  mic.addEventListener('click', async () => {
    if (mic.classList.contains('rec')) return;
    AUDIO.stop();
    mic.classList.add('rec'); st.textContent = 'ກຳລັງຟັງ... ເວົ້າໄດ້ເລີຍ';
    try {
      const alts = await recognize();
      tries++;
      let best = alts[0] || '', score = 0;
      alts.forEach(a => { const s = C.similarity(it.zh, a); if (s > score) { score = s; best = a; } });
      const heard = new Set([...C.hanzi(best)]);
      const p = Math.round(score * 100), ok = score >= 0.8;
      res.innerHTML = `
        <div class="chars">${[...it.zh].map(c => /[一-鿿]/.test(c) ? `<span class="${heard.has(c) ? 'hit' : 'miss'}">${c}</span>` : esc(c)).join('')}</div>
        <div class="small muted">ລະບົບໄດ້ຍິນ: <span class="zh">${esc(best)}</span></div>
        <div class="${ok ? 'fb-ok' : 'fb-no'}" style="font-size:20px">${p}% ${ok ? '— ດີຫຼາຍ! 👏' : '— ລອງອີກຄັ້ງ'}</div>`;
      st.textContent = ok ? '' : 'ຕົວສີແດງ = ສຽງທີ່ຍັງບໍ່ຖືກ. ຟັງ 🐢 ແລ້ວລອງໃໝ່';
      after.innerHTML = ok || tries >= 3 ? `<button class="btn primary" data-next>ຕໍ່ໄປ →</button>` : `<button class="btn" data-next>ຂ້າມ →</button>`;
      $('[data-next]', after).addEventListener('click', () => finish(ok));
    } catch (err) {
      st.textContent = err === 'not-allowed' ? 'ກະລຸນາອະນຸຍາດໃຫ້ໃຊ້ໄມໂຄຣໂຟນ' : err === 'network' ? 'ຕ້ອງເຊື່ອມຕໍ່ອິນເຕີເນັດເພື່ອກວດຕົວອັກສອນ' : 'ບໍ່ໄດ້ຍິນສຽງ — ລອງໃໝ່ອີກຄັ້ງ';
      if (['not-allowed', 'service-not-allowed', 'network'].includes(err)) selfAssess();
    } finally { mic.classList.remove('rec'); }
  });
  after.innerHTML = `<button class="btn" data-next>ຂ້າມ →</button>`;
  $('[data-next]', after).addEventListener('click', () => finish(false));
}

/* Sentence builder: tap word tiles in order. onDone(ok, fb) */
function renderBuild(box, it, opts) {
  const order = (() => { let s; for (let k = 0; k < 6; k++) { s = shuffle(it.tiles.map((t, i) => i)); if (s.some((v, i) => v !== i)) break; } return s; })();
  const listen = !!opts.listen;
  box.innerHTML = `
    <div class="card prompt">
      <div class="ask">${listen ? 'ຟັງແລ້ວລຽງຄຳໃຫ້ເປັນປະໂຫຍກ' : 'ລຽງຄຳໃຫ້ເປັນປະໂຫຍກພາສາຈີນ'}</div>
      ${listen ? playBig(it.zh) : `<div class="lo-big">${esc(it.lo)}</div>`}
      ${opts.hint ? `<div class="pill" style="margin-top:8px">${esc(opts.hint)}</div>` : ''}
    </div>
    <div class="answer" data-ans aria-label="ຄຳຕອບ"><span class="muted small" data-ph>ແຕະຄຳຂ້າງລຸ່ມຕາມລຳດັບ</span></div>
    <div class="tiles" data-pool>${order.map(i => `<button class="tilew" data-t="${i}">${esc(it.tiles[i])}</button>`).join('')}</div>
    <div class="row" style="margin-top:12px"><button class="btn" data-clear>↺ ລ້າງ</button><button class="btn primary" data-check disabled style="flex:1">ກວດຄຳຕອບ</button></div>
    <div class="fb"></div>`;
  if (listen) say(it.zh);
  const ans = $('[data-ans]', box), pool = $('[data-pool]', box), check = $('[data-check]', box);
  const picked = [];
  const sync = () => { check.disabled = picked.length !== it.tiles.length; $('[data-ph]', box) && ($('[data-ph]', box).hidden = picked.length > 0); };
  pool.addEventListener('click', e => {
    const b = e.target.closest('.tilew'); if (!b || b.disabled) return;
    b.disabled = true; picked.push(+b.dataset.t);
    const a = document.createElement('button'); a.className = 'tilew in'; a.textContent = it.tiles[+b.dataset.t]; a.dataset.t = b.dataset.t;
    ans.appendChild(a); sync();
  });
  ans.addEventListener('click', e => {
    const a = e.target.closest('.tilew'); if (!a || box.dataset.done) return;
    picked.splice(picked.indexOf(+a.dataset.t), 1); a.remove();
    $(`[data-pool] [data-t="${a.dataset.t}"]`, box).disabled = false; sync();
  });
  $('[data-clear]', box).addEventListener('click', () => { if (box.dataset.done) return; picked.length = 0; $$('.in', ans).forEach(x => x.remove()); $$('.tilew', pool).forEach(x => { x.disabled = false; }); sync(); });
  check.addEventListener('click', () => {
    box.dataset.done = '1';
    const ok = C.checkOrder(picked.map(i => it.tiles[i]), it.zh);
    ans.classList.add(ok ? 'ok' : 'no');
    check.disabled = true; $('[data-clear]', box).disabled = true; $$('.tilew', pool).forEach(x => { x.disabled = true; });
    opts.onDone(ok, $('.fb', box));
  });
}

/* ---------------- spaced selection ---------------- */
function weight(it) {
  const s = S.stats[it.id];
  if (!s) return 3;
  if (C.isDue(s)) return s.iv === 0 ? 6 : 4;
  return 0.3;
}
function pickWeighted(pool, n) {
  return pool.map(it => ({ it, k: Math.pow(Math.random(), 1 / weight(it)) }))
    .sort((a, b) => b.k - a.k).slice(0, n).map(x => x.it);
}
function reviewItems() {
  return Object.entries(S.stats).filter(([id, s]) => BYID[id] && s.w > 0 && !C.isMastered(s))
    .sort((a, b) => (b[1].w - b[1].c) - (a[1].w - a[1].c)).map(([id]) => BYID[id]);
}

/* ---------------- shared bits ---------------- */
const lockHTML = l => `<div class="card lock"><div style="font-size:42px">🔒</div><h2>HSK ${l} ຍັງລັອກຢູ່</h2>
  <p>ສອບເສັງຜ່ານ <b>HSK ${l - 1}</b> (80% ຂຶ້ນໄປ) ເພື່ອປົດລັອກ — ຫຼື ເຮັດ <a href="#/test">ທົດສອບລະດັບ</a> ຖ້າທ່ານຮູ້ພາສາຈີນແລ້ວ.</p>
  <div class="row" style="justify-content:center"><a class="btn primary" href="#/exam/${l - 1}">🏁 ສອບເສັງ HSK ${l - 1}</a><a class="btn" href="#/level/${l - 1}">ຮຽນ HSK ${l - 1}</a></div></div>`;
const badge = l => `<div class="badge l${l}">HSK<br>${l}</div>`;
function nextFeedback(fb, ok, it, go) {
  fb.innerHTML = `<div style="margin-top:14px" class="${ok ? 'fb-ok' : 'fb-no'}">${ok ? '✅ ຖືກຕ້ອງ! +10 XP' : '❌ ຍັງບໍ່ຖືກ — ຈື່ໄວ້'}</div>${it ? revealHTML(it) : ''}
    <button class="btn primary block" style="margin-top:14px" data-next>ຕໍ່ໄປ → <span class="small" style="opacity:.7">(Enter)</span></button>`;
  const done = () => { document.removeEventListener('keydown', onEnter); go(); };
  const onEnter = e => { if (!document.body.contains(fb)) return document.removeEventListener('keydown', onEnter); if (e.key === 'Enter') { e.preventDefault(); done(); } };
  setTimeout(() => document.addEventListener('keydown', onEnter), 50);
  $('[data-next]', fb).addEventListener('click', done);
  fb.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/* ---------------- views ---------------- */
function home() {
  const lv = S.placement ? S.placement.level : null;
  const due = dueItems().length, cur = maxUnlocked();
  app.innerHTML = `
  <section class="hero">
    <div class="hero-zh">你好！<span>ສະບາຍດີ!</span></div>
    <h1>ຮຽນພາສາຈີນ ຈາກສູນ ເຖິງ HSK 6</h1>
    <p>ສຳລັບຄົນລາວ — ເນັ້ນ <b>ຟັງ · ເວົ້າ · ອ່ານ</b> ເພື່ອໃຊ້ໃນຊີວິດຈິງ ບໍ່ຕ້ອງຝຶກຂຽນ. ຄຳສັບ HSK ຄົບທຸກຄຳ, ສຽງຄົນຈີນ, ສ້າງປະໂຫຍກ, ບົດສົນທະນາ ແລະ ສອບເສັງເລື່ອນຂັ້ນ.</p>
    <div class="row cta">
      ${lv === null ? '<a class="btn primary" href="#/test">🎯 ທົດສອບລະດັບ HSK</a><a class="btn" href="#/pinyin">🔤 ເລີ່ມຈາກສູນ</a>'
        : `<a class="btn primary" href="#/level/${cur}">📚 ຮຽນ HSK ${cur} ຕໍ່</a><a class="btn" href="#/exam/${cur}">🏁 ສອບເສັງ HSK ${cur}</a>`}
    </div>
  </section>

  ${due ? `<a class="card due" href="#/quiz/due/mix"><div style="font-size:34px">📅</div><div style="flex:1"><h3 style="margin:0">ທົບທວນມື້ນີ້: ${due} ລາຍການ</h3><div class="small muted">ລະບົບທົບທວນແບບເວັ້ນໄລຍະ — ທົບທວນກ່ອນລືມ ຈື່ໄດ້ດົນ</div></div><span class="btn primary">ເລີ່ມ →</span></a>` : ''}

  <div class="grid g4" style="margin-top:14px">
    <div class="card stat"><b>${TOTAL_W.toLocaleString()}</b>ຄຳສັບ HSK</div>
    <div class="card stat"><b>${TOTAL_S}</b>ປະໂຫຍກໃຊ້ຈິງ</div>
    <div class="card stat"><b>${TOTAL_Q.toLocaleString()}</b>ຄຳຖາມຝຶກ</div>
    <div class="card stat"><b>${S.xp}</b>XP ຂອງທ່ານ</div>
  </div>

  <h2>ເສັ້ນທາງການຮຽນ</h2>
  <div class="road">
    <a class="card step" href="#/pinyin"><div class="badge l0">ຂັ້ນ<br>0</div><div><h3>ສຽງ ແລະ ວັນນະຍຸດ (Pinyin)</h3><p class="muted small">ພື້ນຖານທີ່ສຳຄັນທີ່ສຸດ: 4 ວັນນະຍຸດ, ພະຍັນຊະນະ, ສະຫຼະ — ທຽບກັບສຽງລາວ</p></div></a>
    <a class="card step" href="#/grammar"><div class="badge l0">ຂັ້ນ<br>0+</div><div><h3>🧱 ວິທີສ້າງປະໂຫຍກ</h3><p class="muted small">${G.RULES.length} ກົດລຳດັບຄຳ ລາວ ↔ ຈີນ ດ້ວຍສີ, ສ້າງປະໂຫຍກເອງ ແລະ ຝຶກ${Object.keys(S.grammar || {}).length ? ` · ຮຽນແລ້ວ ${Object.keys(S.grammar).length}/${G.RULES.length}` : ''}</p></div></a>
    ${LEVELS.map(l => {
      const tot = itemsOf(l).length, m = masteredCount(l), lock = !isUnlocked(l), passed = S.passed[l];
      return `<a class="card step ${lock ? 'locked' : ''}" href="#/level/${l}">${badge(l)}<div style="flex:1"><h3>${lock ? '🔒 ' : passed ? '✅ ' : ''}${LEVEL_INFO[l].name}</h3><p class="muted small">${LEVEL_INFO[l].desc}</p>
        <div class="bar"><i style="width:${pct(m, tot)}%"></i></div><div class="muted small">${m}/${tot} ຈື່ໄດ້ · ${qCount(l).toLocaleString()} ຄຳຖາມ${passed ? ` · ສອບຜ່ານ ${passed.score}%` : ''}</div></div></a>`;
    }).join('')}
  </div>

  <h2>ຮຽນແນວໃດ?</h2>
  <div class="grid g2">
    <div class="card"><h3>🎧 ຟັງກ່ອນ</h3><p class="small">ທຸກຄຳ ແລະ ທຸກປະໂຫຍກມີສຽງຄົນຈີນ. ກົດ 🐢 ເພື່ອຟັງຊ້າໆ ແລ້ວສັງເກດວັນນະຍຸດ.</p></div>
    <div class="card"><h3>🧩 ສ້າງປະໂຫຍກ</h3><p class="small">ຮຽນໂຄງສ້າງໄວຍາກອນແຕ່ລະລະດັບ ແລ້ວລຽງຄຳໃຫ້ເປັນປະໂຫຍກເອງ.</p></div>
    <div class="card"><h3>🎤 ເວົ້າ ແລະ ກວດວັນນະຍຸດ</h3><p class="small">ເວົ້າໃສ່ໄມ — ລະບົບກວດຕົວອັກສອນ ແລະ ແຕ້ມເສັ້ນວັນນະຍຸດຂອງທ່ານທຽບກັບຄົນຈີນ.</p></div>
    <div class="card"><h3>🏁 ສອບເສັງເລື່ອນຂັ້ນ</h3><p class="small">ຜ່ານ 80% ຂອງການສອບເສັງແຕ່ລະລະດັບ ເພື່ອປົດລັອກລະດັບຕໍ່ໄປ.</p></div>
  </div>`;
}

function levels() {
  app.innerHTML = `<h1>ບົດຮຽນ HSK 1 – 6</h1>
  <p class="muted">ຮຽນຕາມລຳດັບ: ສອບເສັງຜ່ານແຕ່ລະລະດັບເພື່ອປົດລັອກລະດັບຕໍ່ໄປ. ຖ້າຮູ້ພາສາຈີນແລ້ວ <a href="#/test">ທົດສອບລະດັບ</a> ເພື່ອຂ້າມ.</p>
  <div class="grid g3">${LEVELS.map(l => {
    const tot = itemsOf(l).length, m = masteredCount(l), lock = !isUnlocked(l);
    return `<a class="card ${lock ? 'locked' : ''}" href="#/level/${l}" style="text-decoration:none">
      <div class="row">${badge(l)}<div><h3>${lock ? '🔒 ' : S.passed[l] ? '✅ ' : ''}${LEVEL_INFO[l].name}</h3><div class="muted small">${DB[l].w.length} ຄຳ · ${DB[l].s.length + DB[l].p.length} ປະໂຫຍກ</div></div></div>
      <p class="small">${LEVEL_INFO[l].desc}</p>
      <div class="bar"><i style="width:${pct(m, tot)}%"></i></div>
      <div class="muted small">${m}/${tot} ຈື່ໄດ້ · ${qCount(l).toLocaleString()} ຄຳຖາມ</div></a>`;
  }).join('')}</div>`;
}

function level(l) {
  l = +l; if (!DB[l]) return levels();
  if (!isUnlocked(l)) { app.innerHTML = `<a href="#/levels" class="muted small">← ທຸກລະດັບ</a>${lockHTML(l)}`; return; }
  const tot = itemsOf(l).length, m = masteredCount(l), passed = S.passed[l];
  app.innerHTML = `
  <a href="#/levels" class="muted small">← ທຸກລະດັບ</a>
  <div class="row" style="margin-top:8px">${badge(l)}<div><h1 style="margin:0">HSK ${l} · ${LEVEL_INFO[l].name}</h1><div class="muted">${LEVEL_INFO[l].desc}</div></div></div>
  <div class="card" style="margin-top:14px"><div class="row" style="justify-content:space-between"><span>ຄວາມຄືບໜ້າ</span><b>${m}/${tot}</b></div><div class="bar" style="margin-top:6px"><i style="width:${pct(m, tot)}%"></i></div>
    <div class="muted small" style="margin-top:6px">${qCount(l).toLocaleString()} ຄຳຖາມໃນລະດັບນີ້ · ແຕ່ລະຮອບ 10 ຂໍ້</div></div>

  <a class="card exam-cta" href="#/exam/${l}"><div style="font-size:32px">${passed ? '✅' : '🏁'}</div><div style="flex:1"><h3 style="margin:0">ສອບເສັງເລື່ອນຂັ້ນ HSK ${l}</h3>
    <div class="small muted">${passed ? `ຜ່ານແລ້ວ ${passed.score}% · ` : ''}20 ຂໍ້: ຟັງ, ອ່ານ, ສ້າງປະໂຫຍກ, ບົດສົນທະນາ · ຜ່ານ 80% ${l < 6 ? `→ ປົດລັອກ HSK ${l + 1}` : '→ ສຳເລັດ HSK 6'}</div></div><span class="btn primary">${passed ? 'ສອບອີກ' : 'ເລີ່ມ'}</span></a>

  <h2>ຝຶກຫັດ</h2>
  <div class="grid g3">
    <a class="tile" href="#/quiz/${l}/mix" style="border-color:var(--red)"><span class="ic">🌀</span><b>ປະສົມທຸກທັກສະ</b><span>ແນະນຳ — ຟັງ, ອ່ານ, ວັນນະຍຸດ, ສ້າງປະໂຫຍກ</span></a>
    <a class="tile" href="#/patterns/${l}" style="border-color:var(--gold)"><span class="ic">🧩</span><b>ສ້າງປະໂຫຍກ</b><span>${(PATTERNS[l] || []).length} ໂຄງສ້າງໄວຍາກອນ · ${DB[l].p.length} ປະໂຫຍກ</span></a>
    <a class="tile" href="#/dialogues/${l}"><span class="ic">💬</span><b>ບົດສົນທະນາ ແລະ ບົດອ່ານ</b><span>${(DIALOGUES[l] || []).length} ບົດ ພ້ອມຄຳຖາມຄວາມເຂົ້າໃຈ</span></a>
    ${Object.entries(QT).filter(([k]) => k !== 'build').map(([k, v]) => `<a class="tile" href="#/quiz/${l}/${k}"><span class="ic">${v.ic}</span><b>${v.name}</b><span>${v.sub}</span></a>`).join('')}
    <a class="tile" href="#/cards/${l}"><span class="ic">🃏</span><b>ບັດຄຳ</b><span>ເປີດບັດ ທ່ອງຈຳໄວ</span></a>
  </div>
  <div class="row" style="margin-top:12px"><button class="btn" data-offline>📥 ດາວໂຫຼດສຽງ HSK ${l} ໄວ້ໃຊ້ອອບລາຍ</button><span class="small muted" data-offst></span></div>

  <div class="tabs"><button class="on" data-tab="w">ຄຳສັບ (${DB[l].w.length})</button><button data-tab="s">ປະໂຫຍກ (${DB[l].s.length})</button></div>
  <input type="search" placeholder="ຄົ້ນຫາ: ຈີນ / pinyin / ລາວ / English" aria-label="ຄົ້ນຫາ">
  <div class="vlist"></div><div class="row" style="justify-content:center;margin-top:10px"><button class="btn" data-more hidden>ສະແດງເພີ່ມ</button></div>
  <p class="small muted">ຄຳແປພາສາລາວຍັງລໍຖ້າການກວດສອບຈາກເຈົ້າຂອງພາສາ. ເຫັນຄຳແປຜິດ? ກົດ ⚑ ເພື່ອແຈ້ງ.</p>`;
  let tab = 'w', limit = 200;
  const list = $('.vlist'), q = $('input[type=search]'), more = $('[data-more]');
  const strip = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const draw = () => {
    const f = q.value.trim().toLowerCase();
    const items = DB[l][tab].filter(it => !f || it.zh.includes(f) || strip(it.py).includes(strip(f)) || it.lo.includes(f) || it.en.toLowerCase().includes(f));
    list.innerHTML = items.slice(0, limit).map(it => `
      <div class="vitem ${isMastered(it.id) ? 'done' : ''}">
        <div><span class="zh" style="${tab === 's' ? 'font-size:20px' : ''}">${esc(it.zh)}</span> <span class="py">${esc(it.py)}</span>
        <div class="lo">${esc(it.lo)}</div><div class="en">${esc(it.en)}</div></div>
        <div class="row" style="gap:6px">${sayBtns(it.zh)}${reportBtn(it)}</div>
      </div>`).join('') || '<div class="empty">ບໍ່ພົບ</div>';
    more.hidden = items.length <= limit;
  };
  $$('[data-tab]').forEach(b => b.addEventListener('click', () => { tab = b.dataset.tab; limit = 200; $$('[data-tab]').forEach(x => x.classList.toggle('on', x === b)); draw(); }));
  q.addEventListener('input', () => { limit = 200; draw(); });
  more.addEventListener('click', () => { limit += 400; draw(); });
  draw();
  $('[data-offline]').addEventListener('click', e => downloadLevel(l, e.currentTarget, $('[data-offst]')));
}

async function downloadLevel(l, btn, st) {
  if (!('caches' in window)) { st.textContent = 'ບຣາວເຊີນີ້ບໍ່ຮອງຮັບ'; return; }
  const texts = new Set([...itemsOf(l), ...DB[l].p].map(it => it.zh));
  (DIALOGUES[l] || []).forEach(d => d.lines.forEach(x => texts.add(x.zh)));
  const urls = [...texts].map(t => AUDIO.url(t));
  btn.disabled = true;
  const cache = await caches.open('clu-audio');
  let done = 0, fail = 0;
  const work = async () => {
    while (urls.length) {
      const u = urls.pop();
      try { if (!(await cache.match(u))) { const r = await fetch(u); if (r.ok) await cache.put(u, r); else fail++; } } catch (e) { fail++; }
      done++; if (done % 20 === 0) st.textContent = `${done}/${texts.size}`;
    }
  };
  await Promise.all([work(), work(), work(), work(), work(), work()]);
  st.textContent = fail ? `ສຳເລັດ ${done - fail}/${texts.size} (ລົ້ມເຫຼວ ${fail} — ລອງໃໝ່)` : `✅ ສຳເລັດ: ${texts.size} ສຽງ ພ້ອມໃຊ້ອອບລາຍ`;
  btn.disabled = false;
}

/* ----- practice round (levels, review, due) ----- */
function quiz(l, type) {
  const mode = l === 'review' || l === 'due' ? l : null;
  const lvl = mode || +l;
  if (!mode && !DB[lvl]) return levels();
  if (!mode && !isUnlocked(lvl)) return level(lvl);
  if (!QT[type] && type !== 'mix') type = 'mix';
  let pool = mode === 'review' ? reviewItems() : mode === 'due' ? dueItems() : type === 'build' ? DB[lvl].p : [...itemsOf(lvl), ...(type === 'mix' ? DB[lvl].p : [])];
  const allowed = t => type === 'mix' ? (t !== 'speak' && t !== 'listenzh' ? true : Math.random() < 0.3) : t === type;
  pool = pool.filter(it => validTypes(it).some(t => type === 'mix' || t === type));
  if (!pool.length) {
    app.innerHTML = `<div class="empty"><h2>${mode ? 'ບໍ່ມີລາຍການທີ່ຕ້ອງທົບທວນ 🎉' : 'ບໍ່ມີຄຳຖາມ'}</h2><a class="btn primary" href="#/levels">ໄປບົດຮຽນ</a></div>`;
    return;
  }
  const qs = (mode === 'due' ? pool.slice(0, 15) : pickWeighted(pool, 10)).map(it => {
    let vt = validTypes(it).filter(allowed);
    if (!vt.length) vt = validTypes(it).filter(t => type === 'mix' ? t !== 'speak' : t === type);
    if (!vt.length) vt = validTypes(it);
    return { it, t: vt[rand(vt.length)] };
  });
  let i = 0, score = 0; const wrong = [];
  const back = mode === 'review' ? '#/review' : mode === 'due' ? '#/' : `#/level/${lvl}`;
  const title = type === 'mix' ? (mode === 'due' ? '📅 ທົບທວນມື້ນີ້' : '🌀 ປະສົມ') : QT[type].ic + ' ' + QT[type].name;

  const show = () => {
    if (i >= qs.length) return finish();
    const { it, t } = qs[i];
    app.innerHTML = `<div class="qwrap">
      <div class="qtop"><a href="${back}" class="muted" aria-label="ອອກ">✕</a><div class="bar"><i style="width:${i / qs.length * 100}%"></i></div><span class="qtag">${i + 1}/${qs.length}</span></div>
      <div class="qtag" style="margin-bottom:8px">${title} · HSK ${it.lvl} · ${QT[t].ic} ${QT[t].name}</div>
      <div id="qbox"></div></div>`;
    const box = $('#qbox');
    const tally = ok => { record(it.id, ok); if (ok) score++; else wrong.push(it); };
    const go = () => { i++; show(); };
    if (t === 'speak') return renderSpeak(box, it, ok => { tally(ok); go(); });
    if (t === 'build') {
      const pt = PATTERNS[it.lvl][it.pat];
      return renderBuild(box, it, { hint: pt && pt.title, listen: Math.random() < 0.3, onDone: (ok, fb) => { tally(ok); say(it.zh); nextFeedback(fb, ok, it, go); } });
    }
    renderMC(box, it, t, {
      onDone: (ok, fb) => {
        tally(ok);
        if (t !== 'listen' && t !== 'listenzh' && t !== 'tone') say(it.zh);
        nextFeedback(fb, ok, it, go);
      }
    });
  };
  const finish = () => {
    const p = Math.round(score / qs.length * 100);
    app.innerHTML = `<div class="qwrap"><div class="card result">
      <div style="font-size:48px">${p >= 80 ? '🏆' : p >= 50 ? '💪' : '🌱'}</div>
      <div class="lvl">${score}/${qs.length}</div>
      <p>${p >= 80 ? 'ເກັ່ງຫຼາຍ!' : p >= 50 ? 'ດີແລ້ວ, ສືບຕໍ່ຝຶກ!' : 'ບໍ່ເປັນຫຍັງ — ການຝຶກຊ້ຳຄືກະແຈ!'} · XP ທັງໝົດ: <b>${S.xp}</b></p>
      <div class="row" style="justify-content:center"><button class="btn primary" data-again>🔁 ອີກຮອບ</button><a class="btn" href="${back}">ກັບຄືນ</a></div></div>
      ${wrong.length ? `<h2>ຕ້ອງທົບທວນ</h2>${wrong.map(revealHTML).join('')}` : ''}</div>`;
    $('[data-again]').addEventListener('click', () => quiz(l, type));
  };
  show();
}

function cards(l) {
  l = +l; if (!DB[l]) return levels();
  if (!isUnlocked(l)) return level(l);
  const deck = pickWeighted(itemsOf(l), 20); let i = 0, known = 0;
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
    say(it.zh);
    $('[data-flip]').addEventListener('click', () => { $('[data-back]').hidden = false; $('[data-hint]').hidden = true; $('[data-btns]').hidden = false; });
    $$('[data-k]').forEach(b => b.addEventListener('click', () => { const ok = b.dataset.k === '1'; record(it.id, ok); if (ok) known++; i++; show(); }));
  };
  show();
}

/* ----- sentence patterns (grammar + builder) ----- */
function patterns(l) {
  l = +l; if (!DB[l]) return levels();
  if (!isUnlocked(l)) return level(l);
  const P = PATTERNS[l] || [];
  app.innerHTML = `<a href="#/level/${l}" class="muted small">← HSK ${l}</a>
    <h1>🧩 ສ້າງປະໂຫຍກ · HSK ${l}</h1>
    <p class="muted">ຮຽນໂຄງສ້າງປະໂຫຍກທີ່ໃຊ້ຫຼາຍທີ່ສຸດຂອງລະດັບນີ້. ອ່ານຄຳອະທິບາຍ, ຟັງຕົວຢ່າງ, ແລ້ວຝຶກລຽງຄຳດ້ວຍຕົວເອງ.</p>
    <div class="tip">ຍັງບໍ່ເຂົ້າໃຈລຳດັບຄຳພາສາຈີນ? ຮຽນ <a href="#/grammar">🧱 ວິທີສ້າງປະໂຫຍກ</a> ກ່ອນ (${G.RULES.length} ບົດສັ້ນໆ).</div>
    <div class="row"><a class="btn primary" href="#/build/${l}">🧩 ຝຶກທຸກໂຄງສ້າງ (${DB[l].p.length})</a></div>
    ${P.map((pt, pi) => {
      const ex = DB[l].p.filter(it => it.pat === pi), m = ex.filter(it => isMastered(it.id)).length;
      return `<div class="card pattern">
        <div class="row" style="justify-content:space-between"><h3 class="zh" style="margin:0">${esc(pt.title)}</h3><span class="pill">${m}/${ex.length}</span></div>
        <p>${esc(pt.lo)}</p>
        ${ex.map(it => `<div class="exl"><div><span class="zh">${it.tiles.map(t => `<span class="tk">${esc(t)}</span>`).join('')}</span>
          <div class="py">${esc(it.py)}</div><div class="small">${esc(it.lo)}</div></div><div class="row" style="gap:6px">${sayBtns(it.zh)}</div></div>`).join('')}
        <a class="btn" href="#/build/${l}/${pi}">🧩 ຝຶກໂຄງສ້າງນີ້</a></div>`;
    }).join('')}`;
}
function build(l, pi) {
  l = +l; if (!DB[l]) return levels();
  if (!isUnlocked(l)) return level(l);
  const one = pi !== undefined && pi !== '';
  const pool = DB[l].p.filter(it => !one || it.pat === +pi);
  if (!pool.length) return patterns(l);
  const qs = one ? shuffle(pool).concat(shuffle(pool).slice(0, 2)) : pickWeighted(pool, 10);
  let i = 0, score = 0;
  const back = `#/patterns/${l}`;
  const show = () => {
    if (i >= qs.length) {
      app.innerHTML = `<div class="qwrap"><div class="card result"><div style="font-size:48px">🧩</div><div class="lvl">${score}/${qs.length}</div>
        <div class="row" style="justify-content:center"><button class="btn primary" data-again>🔁 ອີກຮອບ</button><a class="btn" href="${back}">ກັບຄືນ</a></div></div></div>`;
      $('[data-again]').addEventListener('click', () => build(l, pi));
      return;
    }
    const it = qs[i], pt = PATTERNS[l][it.pat];
    app.innerHTML = `<div class="qwrap">
      <div class="qtop"><a href="${back}" class="muted">✕</a><div class="bar"><i style="width:${i / qs.length * 100}%"></i></div><span class="qtag">${i + 1}/${qs.length}</span></div>
      <div id="qbox"></div></div>`;
    renderBuild($('#qbox'), it, {
      hint: pt.title, listen: i % 4 === 3,
      onDone: (ok, fb) => { record(it.id, ok); if (ok) score++; say(it.zh); nextFeedback(fb, ok, it, () => { i++; show(); }); }
    });
  };
  show();
}

/* ----- "how to make sentences" course ----- */
const G = window.GRAMMAR;
const chip = (t, r, extra = '') => `<span class="gc r-${r}" ${extra}>${esc(t)}</span>`;
const legend = roles => `<div class="legend">${roles.map(r => `<span class="gc r-${r}">${esc(G.ROLES[r])}</span>`).join('')}</div>`;
function grammarIndex() {
  S.grammar = S.grammar || {};
  app.innerHTML = `<h1>🧱 ວິທີສ້າງປະໂຫຍກພາສາຈີນ</h1>
    <p>ພາສາຈີນບໍ່ມີການປ່ຽນຮູບຄຳ (ບໍ່ມີ past tense, ບໍ່ມີເພດ, ບໍ່ມີພະຫຸພົດ) — ຄືພາສາລາວ. ສິ່ງທີ່ສຳຄັນທີ່ສຸດແມ່ນ <b>ລຳດັບຄຳ</b>.
    ບົດຮຽນນີ້ສອນ ${G.RULES.length} ກົດທີ່ຄົນລາວຕ້ອງຮູ້ ໂດຍປຽບທຽບລຳດັບຄຳ ລາວ ↔ ຈີນ ດ້ວຍສີ. ແຕ່ລະບົດ: ອ່ານກົດ → ເບິ່ງຕົວຢ່າງ → <b>ສ້າງປະໂຫຍກເອງ</b> → ຝຶກ.</p>
    ${legend(['S', 'T', 'P', 'W', 'A', 'V', 'O'])}
    <div class="road" style="margin-top:14px">${G.RULES.map((r, i) => {
      const d = S.grammar[i];
      return `<a class="card step" href="#/grammar/${i}"><div class="badge l${Math.min(6, 1 + Math.floor(i / 2))}">ບົດ<br>${i + 1}</div><div style="flex:1">
        <h3>${d ? '✅ ' : ''}${esc(r.title)}</h3><div class="zh muted small">${esc(r.zhTitle)}</div>
        <div class="cmpmini">${r.cmp.lo.map(c => chip(c[0], c[1])).join('')} <span class="muted">→</span> ${r.cmp.zh.map(c => chip(c[0], c[1])).join('')}</div>
        ${d ? `<div class="small muted">ຝຶກແລ້ວ: ${d.score}/${d.n}</div>` : ''}</div></a>`;
    }).join('')}</div>
    <div class="tip" style="margin-top:14px">ຮຽນຈົບແລ້ວ? ໄປທີ່ <a href="#/patterns/1">🧩 ໂຄງສ້າງປະໂຫຍກ HSK 1</a> ເພື່ອຮຽນຮູບແບບປະໂຫຍກຕາມລະດັບ HSK.</div>`;
}
function grammarLesson(i) {
  i = +i; const r = G.RULES[i];
  if (!r) return grammarIndex();
  const f = r.frame, sel = f.slots.map(() => 0);
  app.innerHTML = `<a href="#/grammar" class="muted small">← ທຸກບົດ</a>
    <div class="qtag" style="margin-top:8px">ບົດທີ ${i + 1} / ${G.RULES.length}</div>
    <h1 style="margin-top:4px">${esc(r.title)}</h1><div class="zh muted">${esc(r.zhTitle)}</div>
    <div class="card" style="margin-top:12px"><p style="margin:0">${r.lo}</p></div>

    <h2>ລາວ ↔ ຈີນ</h2>
    <div class="card cmp">
      <div class="cmprow"><span class="flag">ລາວ</span>${r.cmp.lo.map(c => chip(c[0], c[1])).join('')}</div>
      <div class="cmprow"><span class="flag">ຈີນ</span>${r.cmp.zh.map(c => chip(c[0], c[1], 'lang="zh"')).join('')} ${sayBtns(r.cmp.zh.map(c => c[0]).join(''))}</div>
      <div class="small ${r.cmp.same ? 'fb-ok' : 'fb-no'}" style="margin-top:6px">${r.cmp.same ? '✅ ລຳດັບຄືກັນກັບພາສາລາວ' : '⚠️ ລຳດັບຕ່າງຈາກພາສາລາວ — ສັງເກດສີທີ່ຍ້າຍບ່ອນ'}</div>
      ${legend([...new Set(r.cmp.zh.map(c => c[1]))])}
    </div>

    <h2>ຕົວຢ່າງ</h2>
    ${r.ex.map(e => `<div class="vitem"><div><span class="zh" style="font-size:20px">${esc(e[0])}</span><div class="py">${esc(e[1])}</div><div class="lo">${esc(e[2])}</div></div><div class="row" style="gap:6px">${sayBtns(e[0])}</div></div>`).join('')}

    <h2>🛠 ສ້າງປະໂຫຍກເອງ</h2>
    <p class="small muted">ເລືອກຄຳໃນແຕ່ລະຊ່ອງ — ລະບົບຈະສ້າງປະໂຫຍກພາສາຈີນທີ່ຖືກລຳດັບໃຫ້ ພ້ອມສຽງ ແລະ ຄຳແປ.</p>
    <div class="card maker">
      ${f.slots.map((s, k) => `<div class="slot"><div class="small"><span class="gc r-${s.r}">${esc(G.ROLES[s.r])}</span></div>
        <div class="row" style="gap:6px;margin-top:4px">${s.o.map((o, j) => `<button class="opt sl ${j === 0 ? 'on' : ''}" data-s="${k}" data-j="${j}">${o[0] ? `<span class="zh">${esc(o[0])}</span> <span class="small muted">${esc(o[2])}</span>` : '<span class="small muted">(ບໍ່ມີ)</span>'}</button>`).join('')}</div></div>`).join('')}
      <div class="made" data-made></div>
      <div class="row"><button class="btn" data-rnd>🎲 ສຸ່ມ</button></div>
    </div>

    <h2>✍️ ຝຶກ</h2>
    <div id="gp"><button class="btn primary" data-practice>ເລີ່ມຝຶກ 6 ຂໍ້</button></div>
    <div class="row" style="justify-content:space-between;margin-top:18px">
      ${i > 0 ? `<a class="btn" href="#/grammar/${i - 1}">← ບົດກ່ອນ</a>` : '<span></span>'}
      ${i + 1 < G.RULES.length ? `<a class="btn primary" href="#/grammar/${i + 1}">ບົດຕໍ່ໄປ →</a>` : `<a class="btn primary" href="#/patterns/1">🧩 ໂຄງສ້າງ HSK 1 →</a>`}
    </div>`;
  const made = $('[data-made]');
  const draw = (speak) => {
    const out = G.render(r, sel);
    made.innerHTML = `<div class="zh madezh">${out.chunks.map(c => chip(c[0], c[1])).join('')}<span>${f.end}</span></div>
      <div class="py">${esc(out.py)}</div><div class="lo-big" style="font-size:18px">${esc(out.lo)}</div>
      <div class="row" style="justify-content:center;gap:6px">${sayBtns(out.zh)}</div>`;
    $$('.sl').forEach(b => b.classList.toggle('on', sel[+b.dataset.s] === +b.dataset.j));
    if (speak) say(out.zh);
  };
  $$('.sl').forEach(b => b.addEventListener('click', () => { sel[+b.dataset.s] = +b.dataset.j; draw(true); }));
  $('[data-rnd]').addEventListener('click', () => { f.slots.forEach((s, k) => { sel[k] = rand(s.o.length); }); draw(true); });
  draw(false);
  $('[data-practice]').addEventListener('click', () => grammarPractice(i, $('#gp')));
}
function grammarPractice(i, host) {
  const r = G.RULES[i], all = shuffle(G.combos(r));
  const qs = all.slice(0, 6);
  let k = 0, score = 0;
  const next = () => {
    if (k >= qs.length) {
      S.grammar = S.grammar || {};
      S.grammar[i] = { score, n: qs.length, t: Date.now() }; save();
      host.innerHTML = `<div class="card result"><div class="lvl">${score}/${qs.length}</div><p>${score >= 5 ? 'ເກັ່ງຫຼາຍ! ໄປບົດຕໍ່ໄປໄດ້ເລີຍ 👏' : 'ລອງສ້າງປະໂຫຍກເອງອີກ ແລ້ວຝຶກໃໝ່'}</p>
        <div class="row" style="justify-content:center"><button class="btn" data-again>🔁 ຝຶກອີກ</button>${i + 1 < G.RULES.length ? `<a class="btn primary" href="#/grammar/${i + 1}">ບົດຕໍ່ໄປ →</a>` : ''}</div></div>`;
      $('[data-again]', host).addEventListener('click', () => grammarPractice(i, host));
      return;
    }
    const sel = qs[k], out = G.render(r, sel);
    const it = { id: 'g:' + out.zh, zh: out.zh, py: out.py, lo: out.lo, en: '', lvl: 1, kind: 'g', tiles: out.chunks.map(c => c[0]) };
    host.innerHTML = `<div class="qtag">${k + 1}/${qs.length}</div><div class="sub"></div>`;
    const box = $('.sub', host);
    const done = (ok, fb) => {
      if (ok) { score++; S.xp += 5; save(); }
      say(out.zh);
      fb.innerHTML = `<div style="margin-top:12px" class="${ok ? 'fb-ok' : 'fb-no'}">${ok ? '✅ ຖືກຕ້ອງ!' : '❌ ລຳດັບທີ່ຖືກ:'}</div>
        <div class="made"><div class="zh madezh">${out.chunks.map(c => chip(c[0], c[1])).join('')}<span>${r.frame.end}</span></div><div class="py">${esc(out.py)}</div><div>${esc(out.lo)}</div></div>
        <button class="btn primary block" style="margin-top:10px" data-n>ຕໍ່ໄປ →</button>`;
      $('[data-n]', fb).addEventListener('click', () => { k++; next(); });
    };
    if (k % 2 === 0 || it.tiles.length < 3) {
      // choose the correctly ordered sentence; distractors include the "Lao order" mistake
      const right = it.tiles.join('');
      // time words may also start the sentence (明天我去…), so that order is correct too — never offer it as wrong
      const ti = out.chunks.findIndex(c => c[1] === 'T');
      const alsoRight = ti > 0 ? [out.chunks[ti][0], ...it.tiles.filter((_, j) => j !== ti)].join('') : null;
      const wrongs = new Set();
      wrongs.add = (orig => function (v) { return v === alsoRight || v === right ? this : orig.call(this, v); })(wrongs.add);
      const lao = G.laoOrderChunks(r, sel); if (lao) wrongs.add(lao.join(''));
      for (let t = 0; t < 30 && wrongs.size < 3; t++) { const p = shuffle(it.tiles).join(''); if (p !== right) wrongs.add(p); }
      const q = { ask: 'ປະໂຫຍກໃດຖືກລຳດັບ?', prompt: `<div class="lo-big">${esc(out.lo)}</div>`, optClass: 'zh',
        opts: shuffle([{ label: right + r.frame.end, ok: true }, ...[...wrongs].slice(0, 3).map(w => ({ label: w + r.frame.end, ok: false }))]) };
      renderChoices(box, q, { onDone: done });
    } else {
      renderBuild(box, it, { onDone: done });
    }
  };
  next();
}

/* ----- dialogues & passages ----- */
function dialogues(l) {
  l = +l; if (!DB[l]) return levels();
  if (!isUnlocked(l)) return level(l);
  const D = DIALOGUES[l] || [];
  app.innerHTML = `<a href="#/level/${l}" class="muted small">← HSK ${l}</a>
    <h1>💬 ບົດສົນທະນາ ແລະ ບົດອ່ານ · HSK ${l}</h1>
    <div class="grid g2">${D.map((d, i) => `<a class="card" href="#/dialog/${l}/${i}" style="text-decoration:none">
      <div class="pill">${d.type === 'passage' ? '📰 ບົດອ່ານ' : '💬 ສົນທະນາ'}</div>
      <h3 class="zh" style="margin:6px 0 0">${esc(d.title)}</h3><div>${esc(d.lo)}</div>
      <div class="small muted">${d.lines.length} ປະໂຫຍກ · ${d.qs.length} ຄຳຖາມ${S.stats['d:' + l + ':' + i] ? ' · ✅ ເຮັດແລ້ວ' : ''}</div></a>`).join('') || '<div class="empty">ຍັງບໍ່ມີ</div>'}</div>`;
}
const dialogQ = (d, q) => ({ ask: esc(q.q), prompt: '', opts: shuffle([{ label: q.ok, ok: true }, ...q.wrong.map(w => ({ label: w, ok: false }))]) });
function dialog(l, i) {
  l = +l; i = +i;
  const d = (DIALOGUES[l] || [])[i];
  if (!d) return dialogues(l);
  if (!isUnlocked(l)) return level(l);
  app.innerHTML = `<a href="#/dialogues/${l}" class="muted small">← ບົດສົນທະນາ HSK ${l}</a>
    <h1 class="zh">${esc(d.title)}</h1><p>${esc(d.lo)}</p>
    <div class="row"><button class="btn primary" data-all>▶️ ຟັງທັງໝົດ</button><button class="btn" data-all-slow>🐢 ຟັງຊ້າໆ</button>
      <label class="btn"><input type="checkbox" data-hzh> ເຊື່ອງຕົວອັກສອນ (ຝຶກຟັງ)</label><label class="btn"><input type="checkbox" data-hlo checked> ສະແດງພາສາລາວ</label></div>
    <div class="dlg">${d.lines.map((x, k) => `<div class="dl ${x.who === 'B' ? 'b' : ''} ${x.who === '-' ? 'n' : ''}" data-k="${k}">
      ${x.who !== '-' ? `<div class="who">${esc(x.who)}</div>` : ''}<div class="bub"><div class="zh">${esc(x.zh)}</div><div class="py">${esc(x.py)}</div><div class="lo">${esc(x.lo)}</div>
      <div class="row" style="gap:6px;margin-top:4px">${sayBtns(x.zh)}</div></div></div>`).join('')}</div>
    <h2>ຄຳຖາມຄວາມເຂົ້າໃຈ</h2><div id="dq"></div>`;
  const wrap = $('.dlg');
  $('[data-hzh]').addEventListener('change', e => wrap.classList.toggle('hidezh', e.target.checked));
  $('[data-hlo]').addEventListener('change', e => wrap.classList.toggle('hidelo', !e.target.checked));
  let playing = 0;
  const playAll = async slow => {
    const me = ++playing;
    for (let k = 0; k < d.lines.length && me === playing && document.body.contains(wrap); k++) {
      $$('.dl', wrap).forEach(x => x.classList.toggle('now', +x.dataset.k === k));
      await say(d.lines[k].zh, slow);
      await new Promise(r => setTimeout(r, 350));
    }
    $$('.dl', wrap).forEach(x => x.classList.remove('now'));
  };
  $('[data-all]').addEventListener('click', () => playAll(false));
  $('[data-all-slow]').addEventListener('click', () => playAll(true));
  let qi = 0, right = 0;
  const box = $('#dq');
  const nextQ = () => {
    if (qi >= d.qs.length) {
      box.innerHTML = `<div class="card result"><div class="lvl">${right}/${d.qs.length}</div><div class="row" style="justify-content:center">
        ${i + 1 < (DIALOGUES[l] || []).length ? `<a class="btn primary" href="#/dialog/${l}/${i + 1}">ບົດຕໍ່ໄປ →</a>` : ''}<a class="btn" href="#/dialogues/${l}">ກັບຄືນ</a></div></div>`;
      S.stats['d:' + l + ':' + i] = { t: Date.now(), c: right, w: d.qs.length - right }; save();
      return;
    }
    const sub = document.createElement('div'); box.innerHTML = ''; box.appendChild(sub);
    renderChoices(sub, dialogQ(d, d.qs[qi]), { onDone: (ok, fb) => { if (ok) { right++; S.xp += 10; save(); } fb.innerHTML = `<button class="btn primary block" style="margin-top:10px" data-n>ຕໍ່ໄປ →</button>`; $('[data-n]', fb).addEventListener('click', () => { qi++; nextQ(); }); } });
  };
  nextQ();
}

/* ----- level-up exam ----- */
const EXAM_N = 20, EXAM_PASS = 0.8;
function exam(l) {
  l = +l; if (!DB[l]) return levels();
  if (!isUnlocked(l)) { app.innerHTML = lockHTML(l); return; }
  const p = S.passed[l];
  app.innerHTML = `<div class="qwrap"><a href="#/level/${l}" class="muted small">← HSK ${l}</a>
    <h1>🏁 ສອບເສັງເລື່ອນຂັ້ນ HSK ${l}</h1>
    <div class="card">
      <ul>
        <li>${EXAM_N} ຂໍ້: ຄຳສັບ (ຟັງ/ອ່ານ/ວັນນະຍຸດ), ປະໂຫຍກ, ສ້າງປະໂຫຍກ ແລະ ຄວາມເຂົ້າໃຈບົດສົນທະນາ</li>
        <li>ຕ້ອງໄດ້ <b>${Math.round(EXAM_PASS * 100)}%</b> (${Math.ceil(EXAM_N * EXAM_PASS)}/${EXAM_N}) ຂຶ້ນໄປ ${l < 6 ? `ເພື່ອປົດລັອກ <b>HSK ${l + 1}</b>` : 'ເພື່ອສຳເລັດຫຼັກສູດ HSK 6'}</li>
        <li>ບໍ່ສະແດງຄຳຕອບລະຫວ່າງສອບ — ເບິ່ງຜົນຕອນທ້າຍ · ສອບໃໝ່ໄດ້ທຸກເວລາ</li>
        <li>ເປີດສຽງ ຫຼື ໃສ່ຫູຟັງ 🎧 · ປະມານ 10–15 ນາທີ</li>
      </ul>
      ${p ? `<p class="fb-ok">✅ ທ່ານສອບຜ່ານແລ້ວ ${p.score}% (${new Date(p.date).toLocaleDateString()})</p>` : ''}
      <button class="btn primary" data-start>ເລີ່ມສອບເສັງ</button>
    </div></div>`;
  $('[data-start]').addEventListener('click', () => runExam(l));
}
function examSet(l) {
  const qs = [];
  const words = sample(DB[l].w, 9);
  const wt = ['listen', 'read', 'lao2zh', 'listen', 'tone', 'read', 'listenzh', 'listen', 'lao2zh'];
  words.forEach((it, k) => { let t = wt[k]; if (!validTypes(it).includes(t)) t = 'listen'; qs.push({ kind: 'mc', it, t }); });
  sample(DB[l].s, 4).forEach((it, k) => qs.push({ kind: 'mc', it, t: k % 2 ? 'read' : 'listen' }));
  sample(DB[l].p, 4).forEach((it, k) => qs.push({ kind: 'build', it, listen: k === 3 }));
  const D = DIALOGUES[l] || [];
  if (D.length) {
    const di = rand(D.length), d = D[di];
    sample(d.qs, 3).forEach(q => qs.push({ kind: 'dlg', d, q }));
  }
  while (qs.length < EXAM_N) { const it = DB[l].w[rand(DB[l].w.length)]; if (!qs.some(x => x.it === it)) qs.push({ kind: 'mc', it, t: 'listen' }); }
  // dialogue questions stay together at the end
  const dl = qs.filter(x => x.kind === 'dlg');
  return [...shuffle(qs.filter(x => x.kind !== 'dlg')).slice(0, EXAM_N - dl.length), ...dl];
}
function runExam(l) {
  const qs = examSet(l); let i = 0, score = 0; const wrong = [];
  const show = () => {
    if (i >= qs.length) return examResult(l, score, qs.length, wrong);
    const q = qs[i];
    app.innerHTML = `<div class="qwrap">
      <div class="qtop"><a href="#/exam/${l}" class="muted" aria-label="ອອກ">✕</a><div class="bar"><i style="width:${i / qs.length * 100}%"></i></div><span class="qtag">${i + 1}/${qs.length}</span></div>
      <div class="qtag" style="margin-bottom:8px">🏁 ສອບເສັງ HSK ${l}</div><div id="ctx"></div><div id="qbox"></div></div>`;
    const box = $('#qbox');
    const done = ok => { if (ok) score++; else if (q.it) wrong.push(q.it); if (q.it) record(q.it.id, ok); setTimeout(() => { i++; show(); }, 450); };
    if (q.kind === 'mc') return renderMC(box, q.it, q.t, { allowSkip: true, onDone: ok => done(ok) });
    if (q.kind === 'build') return renderBuild(box, q.it, { listen: q.listen, onDone: ok => done(ok) });
    // dialogue: listening (dialog) or reading (passage)
    const d = q.d, isP = d.type === 'passage';
    $('#ctx').innerHTML = `<div class="card"><div class="small muted">${isP ? '📰 ອ່ານບົດຄວາມ' : '🎧 ຟັງບົດສົນທະນາ (ຟັງໄດ້ຫຼາຍເທື່ອ)'}</div>
      ${isP ? d.lines.map(x => `<p class="zh" style="font-size:19px;margin:6px 0">${esc(x.zh)}</p>`).join('') : `<button class="btn primary" data-play>▶️ ຟັງ</button>`}</div>`;
    if (!isP) {
      const play = async () => { for (const x of d.lines) { if (!document.body.contains(box)) break; await say(x.zh); await new Promise(r => setTimeout(r, 300)); } };
      $('[data-play]').addEventListener('click', play);
    }
    renderChoices(box, dialogQ(d, q.q), { allowSkip: true, onDone: ok => done(ok) });
  };
  show();
}
function examResult(l, score, n, wrong) {
  const p = Math.round(score / n * 100), ok = score / n >= EXAM_PASS;
  if (ok && (!S.passed[l] || S.passed[l].score < p)) S.passed[l] = { score: p, date: Date.now() };
  if (ok) S.xp += 100;
  save();
  app.innerHTML = `<div class="qwrap"><div class="card result">
    <div style="font-size:56px">${ok ? (l === 6 ? '🎓' : '🎉') : '📚'}</div>
    <div class="muted">ສອບເສັງ HSK ${l}</div>
    <div class="lvl">${score}/${n} · ${p}%</div>
    <p>${ok ? (l < 6 ? `<b>ຍິນດີດ້ວຍ! ທ່ານສອບຜ່ານ HSK ${l}</b> — HSK ${l + 1} ປົດລັອກແລ້ວ. +100 XP` : '<b>ຍິນດີດ້ວຍ! ທ່ານສຳເລັດຫຼັກສູດ HSK 6</b> 🎓 ສືບຕໍ່ຟັງ ແລະ ເວົ້າທຸກມື້ເພື່ອຄວາມຄ່ອງແຄ້ວ.')
      : `ຕ້ອງການ ${Math.round(EXAM_PASS * 100)}% ເພື່ອຜ່ານ. ທົບທວນຄຳຂ້າງລຸ່ມ ແລ້ວລອງໃໝ່ — ທ່ານເຮັດໄດ້!`}</p>
    <div class="row" style="justify-content:center">
      ${ok && l < 6 ? `<a class="btn primary" href="#/level/${l + 1}">ເລີ່ມ HSK ${l + 1} →</a>` : `<a class="btn primary" href="#/level/${l}">ຝຶກ HSK ${l}</a>`}
      <a class="btn" href="#/exam/${l}">ສອບອີກຄັ້ງ</a></div></div>
    ${wrong.length ? `<h2>ຂໍ້ທີ່ຜິດ</h2>${wrong.map(revealHTML).join('')}` : ''}</div>`;
}

/* ---------- placement test ---------- */
const PASS = 6, PER_LEVEL = 8;
function placement() {
  app.innerHTML = `<div class="qwrap">
    <h1>🎯 ທົດສອບລະດັບ HSK</h1>
    <div class="card">
      <p>ການທົດສອບນີ້ຈະປະເມີນລະດັບພາສາຈີນຂອງທ່ານ ຕັ້ງແຕ່ HSK 1 ເຖິງ HSK 6 ໂດຍເນັ້ນ <b>ການຟັງ</b> ແລະ <b>ການອ່ານ</b>. ລະດັບທີ່ທ່ານຜ່ານຈະຖືກປົດລັອກທັງໝົດ.</p>
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
  $('[data-zero]').addEventListener('click', () => { if (!S.placement) S.placement = { level: 0, date: Date.now(), scores: {} }; save(); location.hash = '#/pinyin'; });
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
          // never lower what the learner already unlocked
          if (!S.placement || passed >= S.placement.level) S.placement = { level: passed, date: Date.now(), scores };
          save();
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
    <p>${passed === 6 ? 'ຍອດຢ້ຽມ! ທ່ານຢູ່ໃນລະດັບສູງສຸດ — ຝຶກ HSK 6 ຕໍ່ເພື່ອຄວາມຄ່ອງແຄ້ວ.' : passed === 0 ? 'ເລີ່ມຈາກ Pinyin ແລະ HSK 1 — ທຸກຄົນເລີ່ມຈາກບ່ອນນີ້!' : `ທ່ານຜ່ານ HSK ${passed}. HSK 1–${next} ປົດລັອກແລ້ວ — ແນະນຳໃຫ້ຮຽນ HSK ${next} ຕໍ່.`}</p>
    <div style="text-align:left;margin:16px 0">${LEVELS.filter(l => scores[l] !== undefined).map(l => `
      <div class="row" style="gap:10px;margin:6px 0"><span style="width:60px">HSK ${l}</span><div class="bar" style="flex:1"><i style="width:${scores[l] / PER_LEVEL * 100}%;${scores[l] < PASS ? 'background:var(--bad)' : ''}"></i></div><span>${scores[l]}/${PER_LEVEL}</span></div>`).join('')}</div>
    <div class="row" style="justify-content:center">
      ${passed === 0 ? `<a class="btn primary" href="#/pinyin">🔤 ຮຽນ Pinyin</a><a class="btn" href="#/level/1">HSK 1</a>` : `<a class="btn primary" href="#/level/${next}">ຮຽນ HSK ${next} →</a>`}
      <a class="btn" href="#/test">ທົດສອບໃໝ່</a>
    </div></div></div>`;
}

/* ---------- pinyin / pronunciation ---------- */
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

  <h2>3. ຝຶກເວົ້າວັນນະຍຸດ (ເບິ່ງເສັ້ນສຽງຂອງທ່ານ)</h2>
  <div class="card" id="tonespeak"></div>

  <h2>4. ພະຍັນຊະນະຕົ້ນ (声母)</h2>
  <div class="tip">⚠️ <b>ຈຸດທີ່ຄົນລາວມັກຜິດ:</b> <b>b, d, g</b> ໃນ pinyin ບໍ່ແມ່ນ ບ, ດ, ກ ແບບລາວ — ມັນຄື <b>ປ, ຕ, ກ</b> (ບໍ່ມີລົມ). ສ່ວນ <b>p, t, k</b> ຄື <b>ພ, ທ, ຄ</b> (ມີລົມ). ລອງເອົາເຈ້ຍໄວ້ໜ້າປາກ: p/t/k ເຈ້ຍຕ້ອງໄຫວ.</div>
  <div class="card tbl"><table><thead><tr><th>Pinyin</th><th>ໃກ້ຄຽງລາວ</th><th>ຕົວຢ່າງ</th><th>ວິທີອອກສຽງ</th><th></th></tr></thead><tbody>
    ${PD.INITIALS.map(r => `<tr><td><b style="font-size:20px">${r[0]}</b></td><td>${r[1]}</td><td><span class="zh">${r[2]}</span> <span style="color:var(--red)">${r[3]}</span></td><td class="small">${r[4]}</td><td>${sayBtns(r[2])}</td></tr>`).join('')}
  </tbody></table></div>

  <h2>5. ສະຫຼະ (韵母)</h2>
  <div class="card tbl"><table><thead><tr><th>Pinyin</th><th>ໃກ້ຄຽງລາວ</th><th>ຕົວຢ່າງ</th><th></th></tr></thead><tbody>
    ${PD.FINALS.map(r => `<tr><td><b style="font-size:20px">${r[0]}</b></td><td>${r[1]}</td><td><span class="zh">${r[2]}</span> <span style="color:var(--red)">${r[3]}</span></td><td>${sayBtns(r[2])}</td></tr>`).join('')}
  </tbody></table></div>
  <p class="muted small">* ສຽງລາວເປັນພຽງການທຽບໃກ້ຄຽງ — ໃຫ້ຟັງສຽງຕົວຢ່າງ 🔊 ແລ້ວເວົ້າຕາມເປັນຫຼັກ.</p>

  <h2>6. ກົດການປ່ຽນວັນນະຍຸດ</h2>
  <div class="tip"><b>3 + 3 → 2 + 3</b>: ສອງສຽງ 3 ຕິດກັນ ສຽງທຳອິດກາຍເປັນສຽງ 2. <span class="zh">你好</span> nǐ hǎo → ອ່ານ <b>ní hǎo</b> ${sayBtns('你好')}</div>
  <div class="tip"><b>不 bù</b> ກ່ອນສຽງ 4 → <b>bú</b>: <span class="zh">不是</span> bú shì, <span class="zh">不要</span> bú yào ${sayBtns('不是')}</div>
  <div class="tip"><b>一 yī</b> ກ່ອນສຽງ 4 → <b>yí</b> (<span class="zh">一个</span> yí ge); ກ່ອນສຽງ 1/2/3 → <b>yì</b> (<span class="zh">一起</span> yìqǐ) ${sayBtns('一个')}</div>

  <h2>7. ເຄັດລັບສຳລັບຄົນລາວ</h2>
  <div class="grid g2">
    <div class="card"><h3>ü ບໍ່ມີໃນພາສາລາວ</h3><p class="small">ເວົ້າ "ອີ" ຄ້າງໄວ້ ແລ້ວຫໍ່ປາກຄືຈະເປົ່າປາກ — ລີ້ນຢູ່ບ່ອນເກົ່າ. <span class="zh">鱼</span> yú, <span class="zh">女</span> nǚ</p>${sayBtns('鱼')}</div>
    <div class="card"><h3>zh/ch/sh ກັບ z/c/s</h3><p class="small">zh/ch/sh ມ້ວນລີ້ນຂຶ້ນ; z/c/s ລີ້ນແປຢູ່ຫຼັງແຂ້ວ. <span class="zh">四 sì (4) ≠ 是 shì (ແມ່ນ) ≠ 十 shí (10)</span></p>${sayBtns('四，是，十')}</div>
    <div class="card"><h3>-n ກັບ -ng</h3><p class="small">-n ລີ້ນແຕະເຫືອກ (ອານ), -ng ອອກຈາກຄໍ (ອາງ). <span class="zh">山 shān ≠ 上 shàng</span></p>${sayBtns('山，上')}</div>
    <div class="card"><h3>ຟັງ → ເວົ້າ → ອັດສຽງ</h3><p class="small">ຟັງ 🐢 ຊ້າໆ 3 ເທື່ອ, ເວົ້າຕາມ, ແລ້ວໃຊ້ <a href="#/quiz/1/speak">🎤 ຝຶກເວົ້າ</a> ໃຫ້ລະບົບກວດ.</p></div>
  </div>`;
  toneGame($('#tonegame'));
  toneSpeak($('#tonespeak'));
}
function toneGame(box) {
  let n = 0, ok = 0;
  const round = () => {
    const set = PD.TONE_SETS[rand(PD.TONE_SETS.length)], t = 1 + rand(4), zh = set[t - 1];
    box.innerHTML = `<div style="text-align:center"><p>ຟັງແລ້ວເລືອກວັນນະຍຸດ <span class="pill">ຄະແນນ ${ok}/${n}</span></p>
      <button class="playbig" data-say="${zh}">🔊</button>
      <div class="grid g4" style="margin-top:14px">${[1, 2, 3, 4].map(k => `<button class="opt" data-t="${k}" style="justify-content:center;font-size:22px;color:var(--t${k})">${C.markTone(set[4], k)} <span class="small">(${k})</span></button>`).join('')}</div>
      <div data-fb style="margin-top:10px"></div></div>`;
    say(zh);
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
function toneSpeak(box) {
  const set = PD.TONE_SETS[rand(PD.TONE_SETS.length)];
  box.innerHTML = `<p class="small">ເລືອກພະຍາງ, ຟັງ, ແລ້ວກົດ 📈 ອັດສຽງເວົ້າຕາມ. ເສັ້ນສີຟ້າ = ຄົນຈີນ, ເສັ້ນສີແດງ = ທ່ານ.</p>
    <div class="row" data-pick>${set.slice(0, 4).map((zh, k) => `<button class="btn" data-z="${k}" style="color:var(--t${k + 1})"><span class="zh">${zh}</span> ${C.markTone(set[4], k + 1)}</button>`).join('')}<button class="btn" data-other>🔀 ຊຸດອື່ນ</button></div>
    <div data-area style="margin-top:10px"></div>`;
  const area = $('[data-area]', box);
  const pick = k => {
    const it = { zh: set[k], id: 'tone' };
    area.innerHTML = `<div class="row">${sayBtns(it.zh)} <span class="zh" style="font-size:30px">${it.zh}</span></div>${toneCheckUI(it) || '<div class="warn">ບຣາວເຊີນີ້ບໍ່ຮອງຮັບການອັດສຽງ</div>'}`;
    say(it.zh); wireToneCheck(area, it);
  };
  $$('[data-z]', box).forEach(b => b.addEventListener('click', () => pick(+b.dataset.z)));
  $('[data-other]', box).addEventListener('click', () => toneSpeak(box));
  pick(0);
}

/* ---------- review, settings, privacy, report ---------- */
function review() {
  const items = reviewItems(), due = dueItems();
  app.innerHTML = `<h1>🔁 ທົບທວນ</h1>
    <div class="grid g2">
      <a class="card" href="#/quiz/due/mix" style="text-decoration:none"><h3>📅 ຮອດກຳນົດທົບທວນ: ${due.length}</h3><p class="small muted">ລະບົບເວັ້ນໄລຍະ (SRS): ຕອບຖືກ → ກັບມາຫຼັງ 1, 3, 8, 20… ມື້. ຕອບຜິດ → ກັບມາໄວໆ.</p></a>
      <a class="card" href="#/quiz/review/mix" style="text-decoration:none"><h3>❌ ຄຳທີ່ເຄີຍຜິດ: ${items.length}</h3><p class="small muted">ຄຳ ແລະ ປະໂຫຍກທີ່ທ່ານເຄີຍຕອບຜິດ ແລະ ຍັງບໍ່ທັນຈື່ໄດ້.</p></a>
    </div>
    ${items.length ? `<div class="vlist" style="margin-top:14px">${items.slice(0, 100).map(it => `<div class="vitem"><div><span class="zh">${esc(it.zh)}</span> <span class="py">${esc(it.py)}</span> <span class="pill">HSK ${it.lvl}</span><div class="lo">${esc(it.lo)}</div><div class="en">${esc(it.en)}</div></div><div class="row" style="gap:6px">${sayBtns(it.zh)}</div></div>`).join('')}</div>`
      : `<div class="empty"><div style="font-size:48px">🎉</div>ບໍ່ມີຄຳທີ່ຕ້ອງທົບທວນ. <a href="#/levels">ໄປຮຽນຕໍ່</a></div>`}`;
}

const b64 = {
  enc: bytes => { let s = ''; bytes.forEach(b => { s += String.fromCharCode(b); }); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); },
  dec: str => Uint8Array.from(atob(str.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))
};
const progressData = () => ({ app: 'chinese-levelup', v: 2, exported: Date.now(), xp: S.xp, stats: S.stats, placement: S.placement, passed: S.passed });
async function makeCode() {
  const raw = new TextEncoder().encode(JSON.stringify(progressData()));
  if (!window.CompressionStream) return 'CLU0.' + b64.enc(raw);
  const gz = await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
  return 'CLU1.' + b64.enc(new Uint8Array(gz));
}
async function readCode(code) {
  code = code.trim().replace(/\s+/g, '');
  const [tag, body] = code.split('.');
  let bytes = b64.dec(body || '');
  if (tag === 'CLU1') bytes = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
  else if (tag !== 'CLU0') throw new Error('bad code');
  return JSON.parse(new TextDecoder().decode(bytes));
}
function importProgress(d) {
  if (!d || d.app !== 'chinese-levelup' || typeof d.stats !== 'object') throw new Error('not a progress file');
  const stats = {};
  for (const [id, st] of Object.entries(d.stats)) stats[id] = C.migrateStat(st);
  const merged = C.mergeProgress(S, { stats, xp: d.xp, placement: d.placement });
  S.stats = merged.stats; S.xp = merged.xp; S.placement = merged.placement;
  for (const [l, p] of Object.entries(d.passed || {})) if (!S.passed[l] || S.passed[l].score < p.score) S.passed[l] = p;
  save();
}

function settings() {
  app.innerHTML = `<h1>⚙️ ຕັ້ງຄ່າ</h1>
  <div class="card grid" style="gap:16px">
    <div><b>ແຫຼ່ງສຽງ</b>
      <select id="engine"><option value="mp3" ${S.settings.engine !== 'tts' ? 'selected' : ''}>ສຽງຄົນຈີນທີ່ບັນທຶກໄວ້ (ແນະນຳ · ໃຊ້ອອບລາຍໄດ້ຫຼັງດາວໂຫຼດ)</option><option value="tts" ${S.settings.engine === 'tts' ? 'selected' : ''}>ສຽງຂອງອຸປະກອນ (Text-to-speech)</option></select>
      <p class="muted small">ສຽງທີ່ບັນທຶກໄວ້ສ້າງດ້ວຍສຽງ AI ພາສາຈີນກາງມາດຕະຖານ (Microsoft Xiaoxiao). ຖ້າບໍ່ມີໄຟລ໌ຈະໃຊ້ສຽງຂອງອຸປະກອນແທນ.</p></div>
    <div><b>ສຽງຂອງອຸປະກອນ</b>
      ${TTS.voices.length ? `<select id="voice">${TTS.voices.map(v => `<option value="${esc(v.name)}" ${TTS.voice && v.name === TTS.voice.name ? 'selected' : ''}>${esc(v.name)} (${esc(v.lang)})</option>`).join('')}</select>`
      : `<div class="small muted">ບໍ່ພົບສຽງພາສາຈີນໃນອຸປະກອນນີ້ (ບໍ່ເປັນຫຍັງ ຖ້າໃຊ້ສຽງທີ່ບັນທຶກໄວ້).</div>`}
    </div>
    <div><b>ຄວາມໄວສຽງ: <span id="rv">${S.settings.rate}</span></b>
      <input type="range" id="rate" min="0.5" max="1.2" step="0.05" value="${S.settings.rate}" style="width:100%"></div>
    <div class="row"><button class="btn" data-say="你好，欢迎你学习汉语！我们一起加油吧。">🔊 ທົດລອງສຽງ</button></div>
    <div><b>ການຮັບຮູ້ຄຳເວົ້າ (ກວດຕົວອັກສອນ):</b> ${SR_CLASS ? '<span class="fb-ok">✅ ຮອງຮັບ</span>' : '<span class="fb-no">❌ ບໍ່ຮອງຮັບ — ໃຊ້ Google Chrome</span>'} · <b>ກວດວັນນະຍຸດ:</b> ${window.MediaRecorder ? '<span class="fb-ok">✅</span>' : '<span class="fb-no">❌</span>'}</div>
  </div>

  <h2>💾 ສຳຮອງ ແລະ ຍ້າຍຄວາມຄືບໜ້າ</h2>
  <div class="card grid" style="gap:12px">
    <p class="small muted" style="margin:0">ຄວາມຄືບໜ້າເກັບໄວ້ໃນບຣາວເຊີນີ້ເທົ່ານັ້ນ (ບໍ່ມີບັນຊີ, ບໍ່ມີເຊີບເວີ). ເພື່ອຍ້າຍໄປອຸປະກອນອື່ນ: ດາວໂຫຼດໄຟລ໌ ຫຼື ສຳເນົາລະຫັດ ແລ້ວນຳເຂົ້າໃນອຸປະກອນໃໝ່. ການນຳເຂົ້າຈະລວມກັບຂໍ້ມູນເກົ່າ (ບໍ່ລຶບ).</p>
    <div class="row"><button class="btn" id="exf">⬇️ ດາວໂຫຼດໄຟລ໌</button><label class="btn">⬆️ ນຳເຂົ້າໄຟລ໌<input type="file" id="imf" accept=".json,application/json" hidden></label><button class="btn" id="mkc">🔑 ສ້າງລະຫັດ</button></div>
    <textarea id="code" rows="3" placeholder="ວາງລະຫັດ CLU1... ທີ່ນີ້ ເພື່ອນຳເຂົ້າ" style="width:100%;font-family:monospace;font-size:12px"></textarea>
    <div class="row"><button class="btn" id="cpc">📋 ສຳເນົາລະຫັດ</button><button class="btn primary" id="imc">ນຳເຂົ້າລະຫັດ</button><span class="small" id="pst"></span></div>
  </div>

  <h2>ຂໍ້ມູນຂອງທ່ານ</h2>
  <div class="card"><p class="small muted">XP: ${S.xp} · ລາຍການທີ່ເຄີຍຝຶກ: ${Object.keys(S.stats).length} · ສອບຜ່ານ: ${Object.keys(S.passed).map(l => 'HSK ' + l).join(', ') || '—'}</p>
    <div class="row"><a class="btn" href="#/privacy">🔒 ຄວາມເປັນສ່ວນຕົວ</a><a class="btn" href="#/report">🐞 ແຈ້ງບັນຫາ</a><button class="btn" id="reset">🗑️ ລຶບຄວາມຄືບໜ້າທັງໝົດ</button></div></div>`;
  const v = $('#voice'), st = $('#pst');
  if (v) v.addEventListener('change', () => { S.settings.voice = v.value; save(); TTS.load(); TTS.speak('你好'); });
  $('#engine').addEventListener('change', e => { S.settings.engine = e.target.value; save(); say('你好'); });
  $('#rate').addEventListener('input', e => { S.settings.rate = +e.target.value; $('#rv').textContent = S.settings.rate; save(); });
  $('#exf').addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(progressData())], { type: 'application/json' }));
    a.download = `chinese-levelup-progress-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); a.remove();
  });
  $('#imf').addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    try { importProgress(JSON.parse(await f.text())); st.innerHTML = '<span class="fb-ok">✅ ນຳເຂົ້າສຳເລັດ</span>'; } catch (err) { st.innerHTML = '<span class="fb-no">❌ ໄຟລ໌ບໍ່ຖືກຕ້ອງ</span>'; }
  });
  $('#mkc').addEventListener('click', async () => { $('#code').value = await makeCode(); st.textContent = `ລະຫັດຍາວ ${$('#code').value.length} ຕົວອັກສອນ`; });
  $('#cpc').addEventListener('click', async () => {
    if (!$('#code').value) $('#code').value = await makeCode();
    try { await navigator.clipboard.writeText($('#code').value); st.innerHTML = '<span class="fb-ok">📋 ສຳເນົາແລ້ວ</span>'; } catch (e) { $('#code').select(); }
  });
  $('#imc').addEventListener('click', async () => {
    try { importProgress(await readCode($('#code').value)); st.innerHTML = '<span class="fb-ok">✅ ນຳເຂົ້າສຳເລັດ</span>'; } catch (err) { st.innerHTML = '<span class="fb-no">❌ ລະຫັດບໍ່ຖືກຕ້ອງ</span>'; }
  });
  $('#reset').addEventListener('click', e => {
    const b = e.currentTarget;
    if (b.dataset.confirm) { S.stats = {}; S.xp = 0; S.passed = {}; delete S.placement; save(); settings(); }
    else { b.dataset.confirm = '1'; b.textContent = '⚠️ ກົດອີກຄັ້ງເພື່ອຢືນຢັນ (ລຶບຖາວອນ)'; }
  });
}

function privacy() {
  app.innerHTML = `<h1>🔒 ຄວາມເປັນສ່ວນຕົວ · Privacy</h1>
  <div class="card">
    <h3>ພາສາລາວ</h3>
    <ul>
      <li>ບໍ່ມີບັນຊີຜູ້ໃຊ້, ບໍ່ມີໂຄສະນາ, ບໍ່ມີເຄື່ອງມືຕິດຕາມ (analytics).</li>
      <li>ຄວາມຄືບໜ້າ (XP, ຄຳທີ່ຝຶກ, ຜົນສອບ) ເກັບໄວ້ໃນບຣາວເຊີຂອງທ່ານເທົ່ານັ້ນ (localStorage). ພວກເຮົາບໍ່ໄດ້ຮັບຂໍ້ມູນນີ້.</li>
      <li><b>ການກວດຕົວອັກສອນດ້ວຍໄມ (🎤)</b> ໃຊ້ລະບົບຮັບຮູ້ຄຳເວົ້າຂອງບຣາວເຊີ. ໃນ Google Chrome ສຽງຂອງທ່ານຈະຖືກສົ່ງໄປປະມວນຜົນທີ່ເຊີບເວີຂອງ Google ຕາມນະໂຍບາຍຂອງ Google.</li>
      <li><b>ການກວດວັນນະຍຸດ (📈)</b> ປະມວນຜົນໃນອຸປະກອນຂອງທ່ານທັງໝົດ — ສຽງບໍ່ຖືກສົ່ງໄປໃສ.</li>
      <li>ຕົວໜັງສືຖືກໂຫຼດຈາກ Google Fonts (Google ອາດເຫັນທີ່ຢູ່ IP ຂອງທ່ານ). ເວັບໄຊໂຮດຢູ່ GitHub Pages.</li>
      <li>ຂໍ້ຜິດພາດຂອງແອັບຖືກບັນທຶກໄວ້ໃນເຄື່ອງເທົ່ານັ້ນ ແລະ ຈະຖືກສົ່ງກໍ່ຕໍ່ເມື່ອທ່ານເລືອກແຈ້ງບັນຫາດ້ວຍຕົນເອງຜ່ານ GitHub.</li>
    </ul>
    <h3>English</h3>
    <ul>
      <li>No accounts, no ads, no analytics or trackers.</li>
      <li>Your progress is stored only in this browser (localStorage); it never reaches us. Use Settings → backup to move it.</li>
      <li><b>Character check (🎤)</b> uses the browser's speech recognition; in Google Chrome your voice is sent to Google's servers for processing, under Google's privacy policy.</li>
      <li><b>Tone check (📈)</b> runs entirely on your device; the recording is not uploaded.</li>
      <li>Fonts load from Google Fonts (Google may see your IP address). The site is hosted on GitHub Pages.</li>
      <li>App errors are logged locally and only shared if you choose to open a GitHub issue from the Report page.</li>
    </ul>
  </div>`;
}
function report() {
  const env = `- Page: ${location.hash}\n- Browser: ${navigator.userAgent}\n- Screen: ${screen.width}x${screen.height}\n- Speech recognition: ${!!SR_CLASS}\n- Audio engine: ${S.settings.engine}`;
  const errs = S.errors.map(e => `- ${new Date(e.t).toISOString()} ${e.h} — ${e.m}\n  ${e.s.split('\n').slice(0, 3).join(' | ')}`).join('\n');
  const body = `**ບັນຫາ / What happened:**\n\n\n**Environment**\n${env}\n\n**Recent errors (local log)**\n${errs || '- none'}\n`;
  app.innerHTML = `<h1>🐞 ແຈ້ງບັນຫາ · Report a problem</h1>
    <div class="card"><p>ກົດປຸ່ມລຸ່ມນີ້ເພື່ອເປີດ GitHub Issue ທີ່ມີຂໍ້ມູນລຸ່ມນີ້ກຽມໄວ້ໃຫ້. ທ່ານສາມາດກວດ ແລະ ແກ້ໄຂກ່ອນສົ່ງ (ຕ້ອງມີບັນຊີ GitHub).</p>
    <pre class="small" style="white-space:pre-wrap;background:var(--surface2);padding:10px;border-radius:10px">${esc(body)}</pre>
    <div class="row"><a class="btn primary" href="${esc(issueUrl('ບັນຫາ / Bug: ', body))}" target="_blank" rel="noopener">ເປີດ GitHub Issue</a>
    ${S.errors.length ? '<button class="btn" id="clr">ລຶບບັນທຶກຂໍ້ຜິດພາດ</button>' : ''}</div></div>`;
  const c = $('#clr'); if (c) c.addEventListener('click', () => { S.errors = []; save(); report(); });
}

/* ---------------- router ---------------- */
const routes = { '': home, test: placement, levels, grammar: (i) => (i === undefined || i === '' ? grammarIndex() : grammarLesson(i)), level, quiz, cards, patterns, build, dialogues, dialog, exam, pinyin, review, settings, privacy, report };
function router() {
  AUDIO.stop();
  const [r, ...args] = location.hash.replace(/^#\/?/, '').split('/');
  try { (routes[r] || home)(...args); } catch (e) { logError(e.message, e.stack); app.innerHTML = `<div class="empty"><h2>ເກີດຂໍ້ຜິດພາດ</h2><a class="btn" href="#/report">ແຈ້ງບັນຫາ</a> <a class="btn" href="#/">ໜ້າຫຼັກ</a></div>`; }
  window.scrollTo(0, 0);
  $$('nav a').forEach(a => {
    const h = a.getAttribute('href').replace('#/', '');
    a.classList.toggle('active', h === r || (h === 'levels' && ['level', 'quiz', 'cards', 'patterns', 'build', 'dialogues', 'dialog', 'exam'].includes(r)) || (h === 'grammar' && r === 'grammar'));
  });
}
addEventListener('hashchange', router);
router();

/* ---------------- offline (PWA) ---------------- */
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(e => logError('sw: ' + e.message)));
}
})();
