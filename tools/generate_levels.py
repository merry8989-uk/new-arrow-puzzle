#!/usr/bin/env python3
"""Arrow Escape - reference level generator (Python mirror of js/core.js).

Same algorithm and same PRNG (mulberry32 + the id hash) as the JavaScript
generator, so it reproduces the game's levels exactly. Useful for offline
tooling, bulk export and validation.

A level is built by reverse placement: arrows go on an empty board one at a
time, each required to have a clear lane with respect to everything already
placed. The reverse of the placement order is a valid clearing order, so every
level is solvable by construction.

Usage:
    python3 tools/generate_levels.py 12000 levels.json   # export all levels
    python3 tools/generate_levels.py --show 1 2 3        # print a few levels
"""
import json
import sys

DIRS = [( -1, 0), (0, 1), (1, 0), (0, -1)]   # N E S W
SIZES = [(3, 3), (4, 4), (4, 5), (5, 5), (5, 6), (6, 6), (6, 7), (7, 7), (8, 8), (8, 9), (9, 9)]
HARD_EVERY = 6
M32 = 0xFFFFFFFF


def imul(a, b):
    return ((a & M32) * (b & M32)) & M32


def hash_id(i):
    x = (i + 0x9E3779B9) & M32
    h = (2166136261 ^ imul(x, 2654435761)) & M32
    h = imul(h ^ (h >> 15), 2246822519) & M32
    h = imul(h ^ (h >> 13), 3266489917) & M32
    return (h ^ (h >> 16)) & M32


def mulberry32(seed):
    a = seed & M32

    def rnd():
        nonlocal a
        a = (a + 0x6D2B79F5) & M32
        t = imul(a ^ (a >> 15), (1 | a) & M32) & M32
        t = ((t + imul(t ^ (t >> 7), (61 | t) & M32)) & M32) ^ t
        t &= M32
        return ((t ^ (t >> 14)) & M32) / 4294967296.0
    return rnd


def in_bounds(R, C, r, c):
    return 0 <= r < R and 0 <= c < C


def ray_clear(R, C, r, c, d, occ):
    dr, dc = DIRS[d]
    rr, cc = r + dr, c + dc
    while in_bounds(R, C, rr, cc):
        if (rr, cc) in occ:
            return False
        rr += dr
        cc += dc
    return True


def blocked_count(R, C, arrows):
    occ = {(a[0], a[1]) for a in arrows}
    return sum(0 if ray_clear(R, C, a[0], a[1], a[2], occ) else 1 for a in arrows)


def params(i):
    ch = min((i - 1) // 50, 239)
    hard = (i % HARD_EVERY == 0)
    R, C = SIZES[min(ch, len(SIZES) - 1)]
    if hard:
        R, C = min(9, R + 1), min(9, C + 1)
    area = R * C
    frac = min(0.58, 0.30 + 0.006 * ch) + (0.08 if hard else 0.0)
    n = max(3, min(area - 1, round(area * frac)))
    return R, C, n, hard


def place(rng, R, C, n):
    occ, placed = set(), []
    for _ in range(n):
        for _t in range(600):
            r = int(rng() * R)
            c = int(rng() * C)
            if (r, c) in occ:
                continue
            d = int(rng() * 4)
            if not ray_clear(R, C, r, c, d, occ):
                continue
            placed.append([r, c, d])
            occ.add((r, c))
            break
        else:
            break
    return placed


def generate(i):
    R, C, n, hard = params(i)
    rng = mulberry32(hash_id(i))
    best = None
    for _ in range(14):
        placed = place(rng, R, C, n)
        if len(placed) < 3:
            continue
        blocked = blocked_count(R, C, placed)
        cand = {"id": i, "rows": R, "cols": C, "arrows": placed, "par": len(placed),
                "blocked": blocked, "hard": hard}
        if i > 5 and blocked < 1:
            best = best or cand
            continue
        return cand
    return best or {"id": i, "rows": R, "cols": C, "arrows": place(rng, R, C, n),
                    "par": 0, "blocked": 0, "hard": hard}


def main():
    args = sys.argv[1:]
    if args and args[0] == "--show":
        for i in map(int, args[1:]):
            lv = generate(i)
            print(f"level {i}: {lv['rows']}x{lv['cols']} arrows={len(lv['arrows'])} "
                  f"par={lv['par']} hard={lv['hard']}")
            print("  arrows:", lv["arrows"])
        return
    count = int(args[0]) if args else 12000
    out = args[1] if len(args) > 1 else "levels.json"
    levels = [generate(i) for i in range(1, count + 1)]
    json.dump(levels, open(out, "w"), separators=(",", ":"))
    print(f"wrote {len(levels)} levels -> {out}")


if __name__ == "__main__":
    main()
