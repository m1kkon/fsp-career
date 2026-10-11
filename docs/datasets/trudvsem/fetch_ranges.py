#!/usr/bin/env python3
"""Robust sequential HTTP Range streamer -> stdout. Usage: fetch_ranges.py URL START END STEP"""
import sys, subprocess, time
url, start, end, step = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4])
out = sys.stdout.buffer
pos = start
while pos < end:
    b = min(pos + step, end) - 1
    p = subprocess.Popen(["curl", "-s", "--max-time", "900", "-r", f"{pos}-{b}", url], stdout=subprocess.PIPE)
    got = 0
    while True:
        chunk = p.stdout.read(1 << 20)
        if not chunk: break
        out.write(chunk); got += len(chunk)
    p.wait()
    pos += got
    print(f"fetched up to {pos} ({got} this request)", file=sys.stderr, flush=True)
    if got == 0: time.sleep(5)
out.flush()
