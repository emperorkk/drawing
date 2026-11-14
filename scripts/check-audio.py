#!/usr/bin/env python3
"""Flags voice clips that are probably broken.  Usage: python3 scripts/check-audio.py public [clip ...]

Checks each clip against its text in lessons.js (needs ffmpeg and node):
  - speech rate in characters of text per second of speech: too fast means words were dropped
  - long silent gaps (silence below -40 dB longer than 0.9 s)
  - murmured pauses: long stretches that are quieter than speech but not silent
Prints one line per clip, with the problems found; exit code 1 if any clip is flagged.
"""
import array, json, math, os, subprocess, sys

SR = 8000
WIN = 0.25  # seconds per loudness window
MIN_RATE, MAX_RATE = 9.0, 21.0  # characters per second of speech
MAX_GAP, MAX_MURMUR = 1.3, 1.0  # seconds
SPEECH_DB = 14  # a window counts as speech when within this many dB of the clip's loud parts

def levels(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"],
                         capture_output=True, check=True).stdout
    a = array.array("f"); a.frombytes(raw)
    w = int(SR * WIN)
    return [20 * math.log10(max(1e-6, math.sqrt(sum(x * x for x in a[i:i + w]) / w))) for i in range(0, len(a) - w + 1, w)]

def longest(flags):
    best = cur = 0
    for f in flags:
        cur = cur + 1 if f else 0
        best = max(best, cur)
    return best * WIN

def texts(app):
    js = "const {LESSONS,UI_AUDIO}=require(process.argv[1]);const m={};" \
         "for(const l of LESSONS){m[l.id+'-0']=l.intro;l.steps.forEach((s,i)=>m[l.id+'-'+(i+1)]=s.say)}" \
         "for(const k in UI_AUDIO)m['ui-'+k]=UI_AUDIO[k];console.log(JSON.stringify(m))"
    return json.loads(subprocess.run(["node", "-e", js, os.path.abspath(os.path.join(app, "lessons.js"))],
                                     capture_output=True, check=True, text=True).stdout)

def main():
    app = sys.argv[1]
    t = texts(app)
    names = sys.argv[2:] or sorted(t)
    bad = 0
    for name in names:
        path = os.path.join(app, "audio", name + ".mp3")
        lv = levels(path)
        # Speech is measured relative to the clip's own loudness (voices differ in level).
        top = sorted(lv)[int(len(lv) * 0.9)] if lv else -100
        loud = top - SPEECH_DB
        speech = sum(1 for x in lv if x > loud) * WIN
        problems = []
        if speech < 0.5:
            problems.append("no speech")
        else:
            rate = len(t[name]) / speech
            if rate > MAX_RATE: problems.append(f"too fast ({rate:.0f} chars/s): words probably missing")
            if rate < MIN_RATE: problems.append(f"too slow ({rate:.0f} chars/s)")
        gap = longest(x < -40 for x in lv)
        if gap > MAX_GAP: problems.append(f"silent gap {gap:.1f}s")
        murmur = longest(-40 <= x <= loud for x in lv)
        if murmur > MAX_MURMUR: problems.append(f"murmured pause {murmur:.1f}s")
        bad += bool(problems)
        print(f"{name:18} {len(lv) * WIN:5.1f}s  " + ("; ".join(problems) if problems else "ok"))
    print(f"{bad} of {len(names)} clips flagged")
    sys.exit(1 if bad else 0)

main()
