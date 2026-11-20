/* Chinese LevelUp — pure logic shared by the browser app, the build scripts and the tests.
   No DOM access here. Works as a browser global (window.CORE) and as a CommonJS module. */
(function (root, factory) {
  const core = factory();
  if (typeof module === 'object' && module.exports) module.exports = core;
  else root.CORE = core;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- random helpers (injectable RNG for tests) ---------- */
  const rand = (n, rnd = Math.random) => Math.floor(rnd() * n);
  function shuffle(a, rnd = Math.random) {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1, rnd); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  const sample = (a, n, rnd) => shuffle(a, rnd).slice(0, n);

  /* ---------- data parsing ---------- */
  // "汉字|pinyin|ລາວ|English" per line
  function parseItems(text, lvl, kind) {
    return String(text || '').trim().split('\n').map(l => l.split('|').map(s => s.trim()))
      .filter(a => a.length >= 4 && a[0])
      .map(a => ({ id: kind + ':' + a[0], zh: a[0], py: a[1], lo: a[2], en: a[3], lvl, kind }));
  }

  /* ---------- tones ---------- */
  const TONES = { a: 'aāáǎà', e: 'eēéěè', i: 'iīíǐì', o: 'oōóǒò', u: 'uūúǔù', 'ü': 'üǖǘǚǜ' };
  const MARK = {};
  Object.entries(TONES).forEach(([b, s]) => { for (let t = 1; t < 5; t++) MARK[s[t]] = [b, t]; });

  // Up to 3 wrong-tone variants of a tone-marked pinyin string
  function toneVariants(py, rnd = Math.random) {
    const ch = [...py];
    const pos = ch.map((c, i) => (MARK[c] ? i : -1)).filter(i => i >= 0);
    if (!pos.length) return [];
    const out = new Set();
    for (let tries = 0; out.size < 3 && tries < 80; tries++) {
      const c = ch.slice();
      const k = pos.length > 1 && rnd() < 0.45 ? 2 : 1;
      sample(pos, k, rnd).forEach(i => {
        const [b, t] = MARK[c[i]];
        let nt; do { nt = 1 + rand(4, rnd); } while (nt === t);
        c[i] = TONES[b][nt];
      });
      const v = c.join('');
      if (v !== py) out.add(v);
    }
    return [...out];
  }
  function markTone(base, t) {
    const i = base.includes('a') ? base.indexOf('a') : base.includes('e') ? base.indexOf('e') : base.includes('ou') ? base.indexOf('o')
      : Math.max(...['i', 'o', 'u', 'ü'].map(v => base.lastIndexOf(v)));
    return base.slice(0, i) + TONES[base[i]][t] + base.slice(i + 1);
  }

  /* ---------- speech-recognition comparison ---------- */
  const DIG = { '0': '零', '1': '一', '2': '二', '3': '三', '4': '四', '5': '五', '6': '六', '7': '七', '8': '八', '9': '九' };
  const hanzi = s => String(s).replace(/[0-9]/g, d => DIG[d]).replace(/[^一-鿿]/g, '');
  // LCS-based character similarity 0..1
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

  /* ---------- audio file naming (same hash in build + browser) ---------- */
  function fnv1a(s) {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h.toString(16).padStart(8, '0');
  }
  const audioName = text => fnv1a(String(text).trim()) + '.mp3';

  /* ---------- spaced repetition (SM-2 variant) ---------- */
  const MIN = 60e3, DAY = 864e5;
  function schedule(st, ok, now = Date.now()) {
    st = Object.assign({ c: 0, w: 0, n: 0, ef: 2.5, iv: 0, due: 0 }, st || {});
    if (ok) {
      st.c++; st.n++;
      st.iv = st.n === 1 ? 1 : st.n === 2 ? 3 : Math.round(st.iv * st.ef);
      st.ef = Math.min(3, st.ef + 0.05);
      st.due = now + st.iv * DAY;
    } else {
      st.w++; st.n = 0; st.iv = 0;
      st.ef = Math.max(1.3, +(st.ef - 0.2).toFixed(2));
      st.due = now + 10 * MIN;
    }
    st.t = now;
    return st;
  }
  const isMastered = st => !!st && st.iv >= 7;
  const isDue = (st, now = Date.now()) => !!st && (st.due || 0) <= now;
  // v1 stats were {c, w, t}
  function migrateStat(st, now = Date.now()) {
    if (!st || st.ef) return st;
    const n = st.c > st.w ? Math.min(st.c - st.w, 3) : 0;
    const iv = [0, 1, 3, 8][n];
    const t = st.t || now;
    return { c: st.c || 0, w: st.w || 0, n, ef: 2.5, iv, due: t + iv * DAY, t };
  }
  // merge two progress objects (import): keep the most recently practised record per item
  function mergeProgress(a, b) {
    const out = Object.assign({}, a, { stats: Object.assign({}, a.stats) });
    for (const [id, st] of Object.entries(b.stats || {})) {
      const cur = out.stats[id];
      if (!cur || (st.t || 0) > (cur.t || 0)) out.stats[id] = st;
    }
    out.xp = Math.max(a.xp || 0, b.xp || 0);
    if (b.placement && (!a.placement || b.placement.date > a.placement.date)) out.placement = b.placement;
    return out;
  }

  /* ---------- sentence builder ---------- */
  const PUNCT = /[，。？！、,.?!；：]/g;
  const normSentence = s => String(s).replace(/\s+/g, '').replace(PUNCT, '');
  const checkOrder = (tiles, target) => normSentence(tiles.join('')) === normSentence(target);
  // split "我 是 学生。" into tiles, punctuation stays on the previous tile
  const tilesOf = spaced => String(spaced).trim().split(/\s+/).filter(Boolean);

  /* ---------- content parsers ---------- */
  // content/patterns.txt
  function parsePatterns(text) {
    const out = {}; let lvl = 0, cur = null;
    for (const raw of String(text).split('\n')) {
      const line = raw.trim();
      if (!line) continue;
      if (/^##\s*\d/.test(line)) { lvl = +line.replace(/\D/g, ''); out[lvl] = out[lvl] || []; cur = null; continue; }
      if (line.startsWith('#')) {
        if (!lvl) continue;
        const [title, ...rest] = line.replace(/^#\s*/, '').split('|');
        cur = { title: title.trim(), lo: rest.join('|').trim(), ex: [] };
        out[lvl].push(cur); continue;
      }
      if (!cur) continue;
      const [spaced, py, lo, en] = line.split('|').map(s => s.trim());
      cur.ex.push({ tiles: tilesOf(spaced), zh: tilesOf(spaced).join(''), py, lo, en });
    }
    return out;
  }
  // content/dialogues.txt
  function parseDialogues(text) {
    const out = {}; let lvl = 0, cur = null;
    for (const raw of String(text).split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('//')) continue;
      if (/^##\s*\d/.test(line)) { lvl = +line.replace(/\D/g, ''); out[lvl] = out[lvl] || []; cur = null; continue; }
      if (line.startsWith('@')) {
        const [title, lo, type] = line.slice(1).split('|').map(s => s.trim());
        cur = { title, lo, type: type || 'dialog', lines: [], qs: [] };
        out[lvl].push(cur); continue;
      }
      if (!cur) continue;
      if (line.startsWith('?')) {
        const [q, ok, ...wrong] = line.slice(1).split('|').map(s => s.trim());
        cur.qs.push({ q, ok, wrong }); continue;
      }
      const m = line.match(/^([A-Z]|-)\s*:\s*(.*)$/);
      const who = m ? m[1] : '-';
      const [zh, py, lo] = (m ? m[2] : line).split('|').map(s => s.trim());
      cur.lines.push({ who, zh, py, lo });
    }
    return out;
  }

  /* ---------- pitch (F0) tracking for the tone-contour check ---------- */
  // Downsample by integer factor with simple averaging
  function downsample(x, sr, target = 16000) {
    const f = Math.max(1, Math.floor(sr / target));
    if (f === 1) return { x, sr };
    const y = new Float32Array(Math.floor(x.length / f));
    for (let i = 0; i < y.length; i++) { let s = 0; for (let k = 0; k < f; k++) s += x[i * f + k]; y[i] = s / f; }
    return { x: y, sr: sr / f };
  }
  // YIN pitch estimate for one frame; returns Hz or 0 (unvoiced)
  function yin(frame, sr, fmin = 70, fmax = 500, thr = 0.2) {
    const maxTau = Math.min(Math.floor(sr / fmin), Math.floor(frame.length / 2));
    const minTau = Math.max(2, Math.floor(sr / fmax));
    const W = frame.length - maxTau;
    if (W <= 0) return 0;
    const d = new Float32Array(maxTau + 1);
    for (let tau = 1; tau <= maxTau; tau++) {
      let s = 0;
      for (let j = 0; j < W; j++) { const v = frame[j] - frame[j + tau]; s += v * v; }
      d[tau] = s;
    }
    let run = 0; const cm = new Float32Array(maxTau + 1); cm[0] = 1;
    for (let tau = 1; tau <= maxTau; tau++) { run += d[tau]; cm[tau] = run ? d[tau] * tau / run : 1; }
    let tau = -1;
    for (let t = minTau; t <= maxTau; t++) {
      if (cm[t] < thr) { while (t + 1 <= maxTau && cm[t + 1] < cm[t]) t++; tau = t; break; }
    }
    if (tau < 0) { // no clear dip: accept the global minimum if it is still fairly periodic (fast-moving pitch)
      let best = minTau; for (let t = minTau; t <= maxTau; t++) if (cm[t] < cm[best]) best = t;
      if (cm[best] > 0.45) return 0;
      tau = best;
    }
    if (tau <= 0 || tau >= maxTau) return 0;
    // parabolic interpolation
    const a = cm[tau - 1], b = cm[tau], c = tau + 1 <= maxTau ? cm[tau + 1] : b;
    const den = a + c - 2 * b;
    const t2 = den ? tau + (a - c) / (2 * den) : tau;
    return sr / t2;
  }
  // Pitch track (Hz per 10 ms hop, 0 = unvoiced/silent)
  function pitchTrack(samples, sampleRate) {
    const { x, sr } = downsample(samples, sampleRate);
    const N = Math.round(sr * 0.04), hop = Math.round(sr * 0.01);
    const rms = [];
    for (let i = 0; i + N <= x.length; i += hop) {
      let s = 0; for (let j = 0; j < N; j++) s += x[i + j] * x[i + j];
      rms.push(Math.sqrt(s / N));
    }
    const peak = Math.max(1e-9, ...rms);
    const out = [];
    for (let k = 0, i = 0; i + N <= x.length; i += hop, k++) {
      out.push(rms[k] < peak * 0.05 ? 0 : yin(x.subarray(i, i + N), sr));
    }
    return out;
  }
  const median = a => { const s = a.slice().sort((p, q) => p - q); return s.length ? s[s.length >> 1] : 0; };
  // Voiced frames → semitones relative to the speaker's median pitch, median-smoothed, octave jumps removed
  function contour(track) {
    const v = track.filter(f => f > 0);
    if (v.length < 5) return [];
    const med = median(v);
    let st = v.map(f => 12 * Math.log2(f / med));
    st = st.map(s => (s > 9 ? s - 12 : s < -9 ? s + 12 : s)); // octave errors
    return st.map((_, i) => median(st.slice(Math.max(0, i - 2), i + 3)));
  }
  function resample(a, n) {
    if (!a.length) return [];
    if (a.length === 1) return Array(n).fill(a[0]);
    return Array.from({ length: n }, (_, i) => {
      const p = i * (a.length - 1) / (n - 1), k = Math.floor(p), f = p - k;
      return k + 1 < a.length ? a[k] * (1 - f) + a[k + 1] * f : a[k];
    });
  }
  // Dynamic time warping (Sakoe-Chiba band w): mean absolute difference along the best path
  function dtw(a, b, w = Infinity) {
    const n = a.length, m = b.length;
    if (!n || !m) return Infinity;
    const D = Array.from({ length: n + 1 }, () => new Float64Array(m + 1).fill(Infinity));
    const L = Array.from({ length: n + 1 }, () => new Float64Array(m + 1));
    D[0][0] = 0;
    for (let i = 1; i <= n; i++) for (let j = Math.max(1, i - w); j <= Math.min(m, i + w); j++) {
      const c = Math.abs(a[i - 1] - b[j - 1]);
      let best = D[i - 1][j - 1], len = L[i - 1][j - 1];
      if (D[i - 1][j] < best) { best = D[i - 1][j]; len = L[i - 1][j]; }
      if (D[i][j - 1] < best) { best = D[i][j - 1]; len = L[i][j - 1]; }
      D[i][j] = best + c; L[i][j] = len + 1;
    }
    return D[n][m] / L[n][m];
  }
  // 0..100 similarity of two pitch contours (semitone arrays); null when not enough voice
  function contourScore(ref, user) {
    if (ref.length < 5 || user.length < 5) return null;
    const a = resample(ref, 40), b = resample(user, 40);
    // band of 8/40 frames and the 35x scale were tuned on the native tone sets (妈麻马骂 …):
    // same tone ≈ 89 on average, different tone ≈ 64
    const err = dtw(a, b, 8);
    return Math.max(0, Math.min(100, Math.round(100 - err * 35)));
  }

  return {
    rand, shuffle, sample, parseItems, TONES, MARK, toneVariants, markTone, hanzi, similarity,
    fnv1a, audioName, DAY, MIN, schedule, isMastered, isDue, migrateStat, mergeProgress,
    normSentence, checkOrder, tilesOf, parsePatterns, parseDialogues,
    downsample, yin, pitchTrack, contour, resample, dtw, contourScore, median
  };
});
