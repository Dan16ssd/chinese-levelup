# Chinese LevelUp · ຮຽນພາສາຈີນ ສຳລັບຄົນລາວ

A free web app that helps Lao speakers learn Mandarin Chinese from zero up to HSK 6.
It focuses on real-world **listening, speaking and reading** (no handwriting practice).

## Features
- 🎯 **Adaptive HSK placement test** (HSK 1 → 6, listening + reading)
- 📚 **931 core words + 124 real-life sentences** with pinyin, Lao and English
- ❓ **~6,000 practice questions** generated from the data: reading, listening, listen→characters, Lao→Chinese, tone discrimination, speaking
- 🔊 **Native-like pronunciation** using the device's Mandarin (zh-CN) voice, plus 🐢 slow mode
- 🎤 **Speaking check** with speech recognition (Chrome) that highlights which characters you pronounced correctly
- 🔤 **Pinyin guide for Lao speakers**: tones, initials and finals with Lao-script approximations, tone-sandhi rules and a tone-listening game
- 🔁 **Spaced review** of mistakes; progress is saved in the browser (localStorage)

## Run locally
It's a static site. Open `index.html` or serve the folder:
```
python -m http.server 8000
```

## Adding content
Edit `js/data1.js` / `js/data2.js`. Each line is `汉字|pinyin|ລາວ|English`. New questions are generated automatically.
