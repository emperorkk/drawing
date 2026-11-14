#!/usr/bin/env python3
# Usage: python3 scripts/trim-silence.py <out-dir> <in.mp3>...   (needs ffmpeg)
# Writes each clip to <out-dir> with long pauses shortened. Prints EMPTY for a clip with no speech.
# Shrink every silent stretch longer than MAX_GAP to KEEP seconds; trim leading/trailing silence.
import subprocess, sys, array, math
SR=44100; FRAME=int(SR*0.02); THR=10**(-40/20); MAX_GAP=0.6; KEEP=0.4; EDGE=0.15
def run(src, dst):
    raw = subprocess.run(['ffmpeg','-v','error','-i',src,'-f','f32le','-ac','1','-ar',str(SR),'-'],capture_output=True,check=True).stdout
    a = array.array('f'); a.frombytes(raw)
    n = len(a)//FRAME
    loud = [math.sqrt(sum(x*x for x in a[i*FRAME:(i+1)*FRAME])/FRAME) > THR for i in range(n)]
    if not any(loud): return None
    keep_frames = []; i = 0
    first = loud.index(True); last = n-1-loud[::-1].index(True)
    i = max(0, first-int(EDGE/0.02))
    end = min(n, last+1+int(EDGE/0.02))
    while i < end:
        if not loud[i]:
            j = i
            while j < end and not loud[j]: j += 1
            run_len = j-i
            if run_len*0.02 > MAX_GAP:
                k = int(KEEP/0.02); keep_frames += list(range(i, i+k//2)) + list(range(j-(k-k//2), j))
            else:
                keep_frames += list(range(i, j))
            i = j
        else:
            keep_frames.append(i); i += 1
    out = array.array('f')
    for f in keep_frames: out.extend(a[f*FRAME:(f+1)*FRAME])
    subprocess.run(['ffmpeg','-v','error','-y','-f','f32le','-ar',str(SR),'-ac','1','-i','-','-b:a','64k',dst],input=out.tobytes(),check=True)
    return len(a)/SR, len(out)/SR
for src in sys.argv[2:]:
    import os
    dst = os.path.join(sys.argv[1], os.path.basename(src))
    r = run(src, dst)
    print(os.path.basename(src), 'EMPTY' if r is None else f'{r[0]:.1f}s -> {r[1]:.1f}s')
