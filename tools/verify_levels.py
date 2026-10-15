#!/usr/bin/env python3
"""Validate every generated Arrow Escape level.

Checks, for each level:
  * no two arrows share a cell, all arrows are in bounds, directions are 0..3
  * the board can actually be cleared (greedy clear, which is complete for this
    mechanic because removing an arrow never creates a new blockage)

Usage: python3 tools/verify_levels.py levels_dump.json
"""
import json
import sys

DIRS = {0: (-1, 0), 1: (0, 1), 2: (1, 0), 3: (0, -1)}


def ray_clear(R, C, r, c, d, occ):
    dr, dc = DIRS[d]
    rr, cc = r + dr, c + dc
    while 0 <= rr < R and 0 <= cc < C:
        if (rr, cc) in occ:
            return False
        rr += dr
        cc += dc
    return True


def verify(lv):
    R, C = lv["rows"], lv["cols"]
    dmap = {}
    for a in lv["arrows"]:
        r, c, d = a[0], a[1], a[2]
        if not (0 <= r < R and 0 <= c < C):
            return False, "out-of-bounds"
        if d not in DIRS:
            return False, "bad-direction"
        if (r, c) in dmap:
            return False, "overlap"
        dmap[(r, c)] = d
    if len(dmap) != lv["par"]:
        return False, "par-mismatch"
    occ = set(dmap)
    while occ:
        moved = False
        for (r, c) in list(occ):
            if ray_clear(R, C, r, c, dmap[(r, c)], occ):
                occ.discard((r, c))
                moved = True
                break
        if not moved:
            return False, "unsolvable"
    return True, "ok"


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else "levels_dump.json"
    levels = json.load(open(path))
    bad = 0
    reasons = {}
    for i, lv in enumerate(levels):
        ok, msg = verify(lv)
        if not ok:
            bad += 1
            reasons[msg] = reasons.get(msg, 0) + 1
            if bad <= 5:
                print("  BAD level", i + 1, msg)
    ids = [lv.get("id") for lv in levels]
    contiguous = ids == list(range(1, len(levels) + 1))
    hard = sum(1 for lv in levels if lv.get("hard"))
    blocked_levels = sum(1 for lv in levels if lv.get("blocked", 0) >= 1)
    print("total levels        :", len(levels))
    print("ids contiguous 1..N :", contiguous)
    print("failures            :", bad, reasons if reasons else "")
    print("hard levels         :", hard)
    print("levels with a block :", blocked_levels)
    print("RESULT              :", "ALL SOLVABLE" if bad == 0 else "FAILURES FOUND")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
