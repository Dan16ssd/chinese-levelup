const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/core.js');

// deterministic RNG
const rng = (seed = 42) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
const strip = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

test('toneVariants returns distinct wrong-tone forms', () => {
  const v = C.toneVariants('nǐ hǎo', rng());
  assert.ok(v.length >= 2);
  v.forEach(x => { assert.notEqual(x, 'nǐ hǎo'); assert.equal(strip(x), 'ni hao'); });
  assert.deepEqual(C.toneVariants('ma'), []);
});
test('markTone puts the mark on the right vowel', () => {
  assert.equal(C.markTone('hao', 3), 'hǎo');
  assert.equal(C.markTone('gou', 3), 'gǒu');
  assert.equal(C.markTone('hui', 4), 'huì');
  assert.equal(C.markTone('xie', 4), 'xiè');
});
test('similarity: LCS over Chinese characters', () => {
  assert.equal(C.similarity('你好', '你好'), 1);
  assert.equal(C.similarity('你好', '你'), 0.5);
  assert.equal(C.similarity('一个', '1个'), 1);
  assert.equal(C.similarity('你好', ''), 0);
});
test('audioName is stable and hex', () => {
  assert.equal(C.audioName('你好'), C.audioName(' 你好 '));
  assert.match(C.audioName('你好'), /^[0-9a-f]{8}\.mp3$/);
  assert.notEqual(C.audioName('你好'), C.audioName('您好'));
});
test('SM-2 scheduling grows intervals and resets on failure', () => {
  const t0 = 1e12;
  let s = C.schedule(null, true, t0);
  assert.equal(s.iv, 1); assert.equal(s.due, t0 + C.DAY);
  s = C.schedule(s, true, t0); assert.equal(s.iv, 3);
  s = C.schedule(s, true, t0); assert.ok(s.iv >= 7); assert.ok(C.isMastered(s));
  s = C.schedule(s, false, t0);
  assert.equal(s.iv, 0); assert.equal(s.n, 0); assert.equal(s.due, t0 + 10 * C.MIN); assert.ok(s.ef >= 1.3);
  assert.ok(C.isDue(s, t0 + 11 * C.MIN)); assert.ok(!C.isDue(s, t0));
});
test('migrateStat converts v1 stats', () => {
  const m = C.migrateStat({ c: 4, w: 1, t: 1000 });
  assert.equal(m.n, 3); assert.equal(m.iv, 8); assert.equal(m.due, 1000 + 8 * C.DAY);
  assert.equal(C.migrateStat({ c: 0, w: 2, t: 5 }).iv, 0);
  const already = { c: 1, w: 0, ef: 2.5, iv: 1, n: 1, due: 9 };
  assert.equal(C.migrateStat(already), already);
});
test('mergeProgress keeps newest record per item', () => {
  const a = { xp: 10, stats: { x: { t: 1, c: 1 }, y: { t: 9 } } };
  const b = { xp: 50, stats: { x: { t: 5, c: 3 }, z: { t: 2 } } };
  const m = C.mergeProgress(a, b);
  assert.equal(m.stats.x.c, 3); assert.ok(m.stats.y && m.stats.z); assert.equal(m.xp, 50);
});
test('sentence builder order check ignores spaces and punctuation', () => {
  assert.ok(C.checkOrder(['我', '是', '学生。'], '我是学生。'));
  assert.ok(!C.checkOrder(['是', '我', '学生。'], '我是学生。'));
  assert.deepEqual(C.tilesOf(' 我  是 学生。'), ['我', '是', '学生。']);
});
test('parsers read patterns and dialogues', () => {
  const p = C.parsePatterns('## 1\n# A 是 B | ແມ່ນ\n我 是 学生。|wǒ shì xuésheng.|ຂ້ອຍ|I am\n');
  assert.equal(p[1][0].title, 'A 是 B'); assert.equal(p[1][0].ex[0].zh, '我是学生。'); assert.equal(p[1][0].ex[0].tiles.length, 3);
  const d = C.parseDialogues('## 2\n@ 标题 | ຫົວ | dialog\nA: 你好|nǐ hǎo|ສະບາຍດີ\n-: 他说：好|tā shuō: hǎo|ລາວວ່າ\n? ຖາມ | ຖືກ | ຜິດ1 | ຜິດ2\n');
  assert.equal(d[2][0].lines.length, 2); assert.equal(d[2][0].lines[1].who, '-'); assert.equal(d[2][0].lines[1].zh, '他说：好');
  assert.equal(d[2][0].qs[0].ok, 'ຖືກ'); assert.equal(d[2][0].qs[0].wrong.length, 2);
});

/* pitch tracking on synthetic tones */
function tone(f0fn, secs = 0.6, sr = 48000) {
  const x = new Float32Array(Math.round(secs * sr)); let ph = 0;
  for (let i = 0; i < x.length; i++) { const f = f0fn(i / x.length); ph += 2 * Math.PI * f / sr; x[i] = 0.5 * Math.sin(ph) + 0.2 * Math.sin(2 * ph); }
  return x;
}
test('yin estimates a steady pitch', () => {
  const tr = C.pitchTrack(tone(() => 200), 48000).filter(f => f > 0);
  assert.ok(tr.length > 20);
  const med = C.median(tr);
  assert.ok(Math.abs(med - 200) < 4, 'median ' + med);
});
test('contour score: same tone high, opposite tone low', () => {
  const rise = C.contour(C.pitchTrack(tone(p => 150 + 120 * p), 48000));
  const rise2 = C.contour(C.pitchTrack(tone(p => 180 + 140 * p, 0.8), 48000)); // other speaker, longer
  const fall = C.contour(C.pitchTrack(tone(p => 270 - 120 * p), 48000));
  const same = C.contourScore(rise, rise2), diff = C.contourScore(rise, fall);
  assert.ok(same >= 80, 'same ' + same);
  assert.ok(diff < same - 25, `diff ${diff} vs same ${same}`);
  assert.equal(C.contourScore([], rise), null);
});
