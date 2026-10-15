# Optional online packs

The built-in **12,000 levels need no network**. Packs are an optional extra:
new levels you can publish later and have players pick up **without shipping a
new build** - the game is a static site, so "publishing" is just committing a
file and bumping a version number.

The **only** time the game touches the network is when the player taps
**Check for new packs** on the Packs screen.

## How it works

1. The game fetches `packs/manifest.json` from this repo (raw URL, cache-busted).
2. For each pack in the manifest, it compares the pack's `version` with what the
   player already has. Only newer packs are downloaded.
3. Each downloaded pack is **validated level by level** (see below) and stored in
   `localStorage`. Invalid levels are dropped; a pack with no valid levels is
   rejected.
4. Installed packs appear on the Packs screen as playable sets, with progress
   tracked per pack.

If the device is offline the fetch fails gracefully and everything else keeps
working.

## `packs/manifest.json`

```json
{
  "version": 1,
  "generated": "2026-10-15",
  "packs": [
    {
      "id": "starter-boost",
      "name": "Starter Boost",
      "version": 1,
      "desc": "30 fresh, gentle 5x5 puzzles.",
      "url": "https://raw.githubusercontent.com/merry8989-uk/new-arrow-puzzle/main/packs/starter-boost.json"
    }
  ]
}
```

`id` is stable (never reuse it for different content). Bump `version` whenever a
pack's contents change - that is what tells installed games to re-download it.

## A pack file

```json
{
  "id": "starter-boost",
  "name": "Starter Boost",
  "version": 1,
  "levels": [
    { "gen": 50001, "rows": 5, "cols": 5, "arrows": 11 },
    { "rows": 4, "cols": 4, "arrows": [[1,1,2],[0,0,1],[2,2,0],[3,0,3]], "par": 4 }
  ]
}
```

Two level forms are accepted:

- **Generated** - `{ "gen": <seed>, "rows": R, "cols": C, "arrows": N }`. The
  game builds the level from that seed with the given size/difficulty. This keeps
  packs tiny (a few KB) and lets a pack mint levels that are *not* part of the
  built-in campaign. This is the recommended form.
- **Explicit** - `{ "rows", "cols", "arrows": [[r,c,d],...], "par" }` where `d` is
  `0=N 1=E 2=S 3=W`. Use this for handcrafted puzzles. `par` defaults to the
  arrow count.

## Publishing a new pack

```bash
# 1. Build the pack (mints fresh, solvable levels at the difficulty you pick)
node tools/build_pack.js --id winter-event --name "Winter Event" \
  --count 40 --rows 7 --cols 7 --arrows 22 --seed 70001 packs/winter-event.json

# 2. Add it to packs/manifest.json with a version.

# 3. Commit and push. Players get it on their next "Check for new packs".
```

`build_pack.js` refuses to write a level that is not solvable, so a pack it
produces is always valid.

## Validation and safety

Downloaded packs are **untrusted data**. The game:

- only reads numbers from the JSON - it never evaluates or executes anything
  from a pack;
- re-checks **every** level with the same solvability test used for the built-in
  levels, and discards any level that fails;
- rejects a pack entirely if it contains no valid levels.

So even a malformed or hostile pack file cannot produce an unsolvable level or
run code.

## Version bumps vs new packs

- **New content** → add a new entry to the manifest.
- **Changed content** → keep the same `id`, bump `version`. Installed games
  replace their copy; already-completed slots are kept by index.

## Serving packs from somewhere else

The manifest URL is the `MANIFEST_URL` constant in `js/game.js`. Point it at any
HTTPS URL (a CDN, S3, another repo) - the format is the same. The host must send
permissive CORS headers (`Access-Control-Allow-Origin: *`), which
`raw.githubusercontent.com` does.
