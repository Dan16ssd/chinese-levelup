#!/usr/bin/env python3
"""Generate MP3s for every line of audio/texts.tsv (name<TAB>text) with edge-tts.
Skips files that already exist, so it can be re-run after content changes.
Usage: python tools/gen_audio.py [--voice zh-CN-XiaoxiaoNeural] [--jobs 6]
Note: edge-tts uses Microsoft Edge's online read-aloud service (unofficial, no account).
"""
import argparse, asyncio, os, sys
import edge_tts

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
AUDIO = os.path.join(ROOT, 'audio')


async def one(sem, voice, name, text, stats):
    path = os.path.join(AUDIO, name)
    if os.path.exists(path) and os.path.getsize(path) > 0:
        stats['skip'] += 1
        return
    async with sem:
        for attempt in range(4):
            try:
                tmp = path + '.part'
                await edge_tts.Communicate(text, voice, rate='-5%').save(tmp)
                if os.path.getsize(tmp) == 0:
                    raise RuntimeError('empty audio')
                os.replace(tmp, path)
                stats['ok'] += 1
                if stats['ok'] % 200 == 0:
                    print('generated', stats['ok'], flush=True)
                return
            except Exception as e:  # network hiccups / throttling
                await asyncio.sleep(2 * (attempt + 1))
                err = e
        stats['fail'] += 1
        print('FAILED', name, text, err, file=sys.stderr, flush=True)


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--voice', default='zh-CN-XiaoxiaoNeural')
    ap.add_argument('--jobs', type=int, default=6)
    a = ap.parse_args()
    rows = []
    with open(os.path.join(AUDIO, 'texts.tsv'), encoding='utf-8') as f:
        for line in f:
            line = line.rstrip('\n')
            if '\t' in line:
                rows.append(line.split('\t', 1))
    sem = asyncio.Semaphore(a.jobs)
    stats = {'ok': 0, 'skip': 0, 'fail': 0}
    await asyncio.gather(*(one(sem, a.voice, n, t, stats) for n, t in rows))
    print('done', stats, flush=True)
    sys.exit(1 if stats['fail'] else 0)


asyncio.run(main())
