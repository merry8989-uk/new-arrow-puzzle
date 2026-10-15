#!/usr/bin/env python3
"""Validate a game bundle against the YouTube Playables limits.

Mirrors Google's Playables bundle analyzer limits, and adds two checks that
matter for this game: that the bundle makes no external network calls (other
than the required Playables SDK), and that it uses only relative paths.

Usage: python3 tools/check_bundle.py build/playables
"""
import os
import re
import sys

MIB = 1024 * 1024
FILE_LIMIT = 30 * MIB        # MUST: every individual file < 30 MiB
FILE_SHOULD = 512 * 1024     # SHOULD: every individual file < 512 KiB
BUNDLE_LIMIT = 250 * MIB     # MUST: total bundle < 250 MiB
BUNDLE_SHOULD = 15 * MIB     # SHOULD: total < 15 MiB
INITIAL_LIMIT = 30 * MIB     # MUST: initial bundle < 30 MiB
INITIAL_SHOULD = 15 * MIB    # SHOULD: initial bundle < 15 MiB
FILE_COUNT = 8000            # MUST: at most 8000 files
NAME_RE = re.compile(r"^[a-zA-Z0-9\-\._]+$")

# The Playables SDK script is required and is the one allowed external URL.
ALLOWED_URLS = ("https://www.youtube.com/game_api/v1",)
URL_RE = re.compile(r"https?://[^\s\"'<>)]+")


def main():
    root = sys.argv[1] if len(sys.argv) > 1 else "build/playables"
    if not os.path.isdir(root):
        print("not a directory:", root)
        sys.exit(2)

    total = 0
    files = 0
    too_large = []
    big = []
    bad_names = []
    for dirpath, _, names in os.walk(root):
        for n in names:
            p = os.path.join(dirpath, n)
            sz = os.path.getsize(p)
            total += sz
            files += 1
            rel = os.path.relpath(p, root)
            if sz > FILE_LIMIT:
                too_large.append((rel, sz))
            elif sz > FILE_SHOULD:
                big.append((rel, sz))
            if not NAME_RE.match(n):
                bad_names.append(rel)

    # initial bundle ~= index.html + everything it statically references
    index = os.path.join(root, "index.html")
    initial = os.path.getsize(index) if os.path.exists(index) else 0
    refs = []
    if os.path.exists(index):
        html = open(index, encoding="utf-8", errors="replace").read()
        for m in re.findall(r'(?:src|href)="([^"]+)"', html):
            if m.startswith("http"):
                continue
            refs.append(m.lstrip("./"))
    for r in refs:
        p = os.path.join(root, r)
        if os.path.exists(p):
            initial += os.path.getsize(p)

    # external calls (game code only; the SDK URL is allowed)
    external = []
    for dirpath, _, names in os.walk(root):
        for n in names:
            if not n.endswith((".html", ".js", ".css")):
                continue
            p = os.path.join(dirpath, n)
            txt = open(p, encoding="utf-8", errors="replace").read()
            for u in URL_RE.findall(txt):
                if not any(u.startswith(a) for a in ALLOWED_URLS):
                    external.append((os.path.relpath(p, root), u))

    # absolute paths (leading "/") in html attributes
    absolute = []
    if os.path.exists(index):
        for m in re.findall(r'(?:src|href)="(/[^"]*)"', open(index, encoding="utf-8", errors="replace").read()):
            absolute.append(m)

    def human(b):
        return f"{b/MIB:.2f} MiB" if b >= MIB else f"{b/1024:.1f} KiB"

    problems = 0
    print(f"root            : {root}")
    print(f"files           : {files}  (limit {FILE_COUNT})")
    print(f"total bundle    : {human(total)}  (limit {human(BUNDLE_LIMIT)}, target {human(BUNDLE_SHOULD)})")
    print(f"initial bundle  : ~{human(initial)}  (limit {human(INITIAL_LIMIT)}, target {human(INITIAL_SHOULD)})")

    if files > FILE_COUNT:
        print("  FAIL: too many files"); problems += 1
    if total > BUNDLE_LIMIT:
        print("  FAIL: total bundle over limit"); problems += 1
    if initial > INITIAL_LIMIT:
        print("  FAIL: initial bundle over limit"); problems += 1
    if too_large:
        print("  FAIL: files over 30 MiB:", too_large); problems += 1
    if bad_names:
        print("  FAIL: invalid filenames (allowed: A-Za-z0-9 - . _):", bad_names); problems += 1
    if external:
        print("  FAIL: external calls found (Playables allows none):")
        for f, u in external:
            print(f"        {f}: {u}")
        problems += 1
    if absolute:
        print("  FAIL: absolute paths (must be relative):", absolute); problems += 1

    if big:
        print("  note: files over 512 KiB (SHOULD be smaller):", [(f, human(s)) for f, s in big])
    if not os.path.exists(index):
        print("  FAIL: index.html missing at bundle root"); problems += 1

    print()
    print("RESULT:", "PASS" if problems == 0 else f"{problems} problem(s)")
    sys.exit(1 if problems else 0)


if __name__ == "__main__":
    main()
