const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const C = require('../js/core.js');
const ROOT = path.join(__dirname, '..');
global.window = {};
for (let l = 1; l <= 6; l++) require(path.join(ROOT, `js/data/hsk${l}.js`));
require(path.join(ROOT, 'js/data/extra.js'));
const { HSK_RAW, PATTERNS, DIALOGUES, LEGACY_IDS } = window;

test('every level has words and sentences with all 4 fields', () => {
  const seen = new Set();
  let total = 0;
  for (let l = 1; l <= 6; l++) {
    for (const k of ['w', 's']) {
      HSK_RAW[l][k].trim().split('\n').forEach(line => {
        const a = line.split('|');
        assert.equal(a.length, 4, `HSK${l} ${k}: ${line}`);
        a.forEach(f => assert.ok(f.trim(), `empty field: ${line}`));
        assert.match(a[0], /[一-鿿]/, line);
        assert.match(a[2], /[຀-໿]/, `no Lao: ${line}`);
        if (k === 'w') { assert.ok(!seen.has(a[0]), 'duplicate word ' + a[0]); seen.add(a[0]); total++; }
      });
    }
  }
  assert.ok(total >= 5000, 'expected the full HSK 1-6 list, got ' + total);
});
test('official HSK lists are fully covered', () => {
  const have = new Set();
  for (let l = 1; l <= 6; l++) HSK_RAW[l].w.trim().split('\n').forEach(x => have.add(x.split('|')[0]));
  for (let l = 1; l <= 6; l++) {
    const miss = fs.readFileSync(path.join(ROOT, `content/official/hsk${l}.txt`), 'utf8').trim().split('\n')
      .map(x => x.split('|')[0]).filter(z => !have.has(z));
    assert.deepEqual(miss, [], `HSK ${l} missing`);
  }
});
test('patterns: every level has buildable examples', () => {
  for (let l = 1; l <= 6; l++) {
    assert.ok(PATTERNS[l].length >= 5, 'patterns HSK ' + l);
    PATTERNS[l].forEach(p => p.ex.forEach(e => {
      assert.ok(e.tiles.length >= 2, 'too few tiles: ' + e.zh);
      assert.ok(C.checkOrder(e.tiles, e.zh));
      assert.match(e.lo, /[຀-໿]/);
    }));
  }
});
test('dialogues: questions have a correct answer and distractors', () => {
  for (let l = 1; l <= 6; l++) {
    assert.ok((DIALOGUES[l] || []).filter(d => d.type === 'dialog').length >= 3, 'need 3+ conversations for HSK ' + l);
    DIALOGUES[l].forEach(d => {
      assert.ok(d.lines.length >= 3 && d.qs.length >= 2, d.title);
      d.qs.forEach(q => { assert.ok(q.ok); assert.ok(q.wrong.length >= 2); assert.ok(!q.wrong.includes(q.ok), q.q); });
    });
  }
});
test('legacy ids map to existing items', () => {
  const ids = new Set();
  for (let l = 1; l <= 6; l++) for (const k of ['w', 's']) C.parseItems(HSK_RAW[l][k], l, k).forEach(it => ids.add(it.id));
  const vals = Object.values(LEGACY_IDS);
  assert.ok(vals.length > 900);
  vals.forEach(v => assert.ok(ids.has(v), 'legacy target missing: ' + v));
});
test('every spoken text has a unique audio name; mp3s exist when audio/ is populated', () => {
  const rows = fs.readFileSync(path.join(ROOT, 'audio/texts.tsv'), 'utf8').trim().split('\n').map(r => r.split('\t'));
  const names = new Set(rows.map(r => r[0]));
  assert.equal(names.size, rows.length);
  rows.forEach(([n, t]) => assert.equal(C.audioName(t), n));
  const mp3 = fs.readdirSync(path.join(ROOT, 'audio')).filter(f => f.endsWith('.mp3'));
  if (mp3.length) {
    const missing = rows.filter(([n]) => !fs.existsSync(path.join(ROOT, 'audio', n)));
    assert.ok(missing.length === 0, missing.length + ' audio files missing, e.g. ' + (missing[0] || [])[1]);
  }
});

test('sentence-making course: every frame sentence renders, has audio, Lao and correct chunk order', () => {
  const G = require('../js/grammar-data.js');
  const have = new Set(fs.readFileSync(path.join(ROOT, 'audio/texts.tsv'), 'utf8').trim().split('\n').map(r => r.split('\t')[1]));
  assert.ok(G.RULES.length >= 10);
  G.RULES.forEach((r, i) => {
    assert.ok(r.ex.length >= 3 && r.cmp.zh.length && r.cmp.lo.length, 'rule ' + i);
    G.combos(r).forEach(sel => {
      const o = G.render(r, sel);
      assert.ok(have.has(o.zh), 'no audio text for ' + o.zh);
      assert.match(o.lo, /[຀-໿]/);
      assert.ok(o.chunks.every(c => G.ROLES[c[1]]), 'unknown role in ' + o.zh);
      assert.ok(!/undefined/.test(o.py + o.lo), o.zh);
    });
  });
  // 不 tone sandhi and the Lao-order mistake
  const neg = G.RULES.find(r => r.zhTitle.startsWith('不'));
  const qu = G.render(neg, [0, 0, 2]);
  assert.match(qu.py, /bú qù/);
  const time = G.RULES.find(r => r.zhTitle.includes('时间 + 动词'));
  assert.deepEqual(G.laoOrderChunks(time, [0, 1, 0]), ['我', '去学校', '明天']);
});
