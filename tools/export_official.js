// One-off: convert the complete-hsk-vocabulary (MIT) "old" HSK 2.0 JSON files into compact
// content/official/hsk{n}.txt lines:  汉字|pinyin|English
const fs = require('fs'), path = require('path');
const SRC = process.argv[2];
const joinPy = p => p.trim().split(/\s+/).map((s, i) => (i && /^[aeoāáǎàēéěèōóǒò]/i.test(s) ? "'" : '') + s).join('');
for (let n = 1; n <= 6; n++) {
  const d = JSON.parse(fs.readFileSync(path.join(SRC, `old${n}.json`), 'utf8'));
  const out = d.map(e => {
    const f = e.forms[0];
    const en = f.meanings.slice(0, 2).join('; ').replace(/\|/g, '/');
    return `${e.simplified}|${joinPy(f.transcriptions.pinyin)}|${en}`;
  });
  fs.writeFileSync(path.join(__dirname, '..', 'content', 'official', `hsk${n}.txt`), out.join('\n') + '\n');
  console.log(n, out.length);
}
