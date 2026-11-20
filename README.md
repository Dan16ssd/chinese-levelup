# Chinese LevelUp · ຮຽນພາສາຈີນ ສຳລັບຄົນລາວ

A free web app that helps Lao speakers learn Mandarin Chinese from zero up to HSK 6.
It focuses on real-world **listening, speaking and reading** (no handwriting practice).

Live: https://dan16ssd.github.io/chinese-levelup/

## Features
- 🎯 **Adaptive HSK placement test** (HSK 1 → 6) that unlocks the levels you already know
- 🏁 **Level-up exam per level** (20 questions: listening, reading, tones, sentence building, dialogue comprehension); 80% unlocks the next level
- 📚 **The complete HSK 2.0 vocabulary (5,000+ words)** plus 124 real-life sentences, with pinyin, Lao and English
- 🧩 **Sentence building**: 48 grammar patterns (8 per level) explained in Lao, with 147 tap-to-order exercises
- 💬 **Dialogues & reading passages** for every level with comprehension questions
- 🔊 **Consistent native-quality audio**: 5,387 pre-generated MP3s (edge-tts, zh-CN-XiaoxiaoNeural) with 🐢 slow mode; falls back to the device voice
- 🎤 **Speaking check**: speech recognition (Chrome) for characters, plus an **on-device tone-contour check** that draws your pitch curve against the native one
- 📅 **Spaced repetition (SM-2)** with a daily due queue
- 📴 **Offline PWA**: installable; app shell cached, audio cached on use or per level
- 💾 **Backup without accounts**: export/import a progress file or a short sync code
- 🔒 No accounts, no analytics (see the in-app Privacy page)

## Project layout
```
content/            source content (edit these)
  official/         HSK 2.0 word lists (from complete-hsk-vocabulary, MIT)
  curated1.js, 2    hand-written core words + real-life sentences
  lao/              Lao translations for the official words  (汉字|ລາວ|English override|pinyin override)
  patterns.txt      sentence patterns + builder examples per level
  dialogues.txt     dialogues / passages + comprehension questions
  review/           lao_review.csv — export for native-speaker review
js/core.js          pure logic (tones, SRS, parsers, pitch tracking) — shared by app, build and tests
js/app.js           the UI
js/data/            GENERATED data files
audio/              GENERATED mp3s (+ texts.tsv manifest)
tools/              build_data.js, gen_audio.py
tests/              node:test unit + data-integrity tests
```

## Develop
```
npm run build      # content/ -> js/data/, audio/texts.tsv, content/review/lao_review.csv
npm run audio      # pip install edge-tts; generates missing MP3s only
npm test
python -m http.server 8000
```
CI (GitHub Actions) checks that generated data is up to date, syntax, and runs the tests.
Bump `VERSION` in `sw.js` when releasing so offline users get the new app shell.

## Known limitations
- **Lao translations need native-speaker review.** They were written without a native reviewer. Use the ⚑ button
  in the app or `content/review/lao_review.csv` to report or fix errors.
- Audio uses Microsoft Edge's online read-aloud voices via the unofficial `edge-tts` tool. Check their terms
  before commercial use. Polyphonic single characters may occasionally use the other reading.
- The tone check compares pitch-contour shape only. It doesn't score consonants or vowels and isn't a certified
  pronunciation assessment. Character checking requires Chrome (which sends audio to Google).
- Tested in desktop Chrome. Real phone and Safari testing is still to do.
