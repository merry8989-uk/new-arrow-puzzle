// Headless logic test: proves the shipped core behaves as the game expects.
const core = require("../js/core.js");
let fails = 0;

function check(cond, msg) { if (!cond) { console.log("  FAIL:", msg); fails++; } }

// 1) solvability + the stored solution actually clears the board
[1, 2, 3, 5, 6, 7, 50, 51, 500, 6000, 12000].forEach(function (id) {
  const lv = core.generate(id);
  const sol = core.solve(lv.rows, lv.cols, lv.arrows);
  check(sol !== null, "level " + id + " solvable");
  if (!sol) return;
  let arr = lv.arrows.slice();
  let ok = true;
  for (const step of sol) {
    const i = arr.findIndex(a => a[0] === step[0] && a[1] === step[1]);
    if (i < 0 || !core.canRemove(lv.rows, lv.cols, arr, i)) { ok = false; break; }
    arr.splice(i, 1);
  }
  check(ok && arr.length === 0, "level " + id + " clears via solution");
});

// 2) blocked taps are rejected, free taps accepted
const lv = core.generate(12);
check(lv.blocked >= 1, "level 12 has a blocked arrow");
let freeSeen = false, blockedSeen = false;
for (let i = 0; i < lv.arrows.length; i++) {
  if (core.canRemove(lv.rows, lv.cols, lv.arrows, i)) freeSeen = true; else blockedSeen = true;
}
check(freeSeen && blockedSeen, "level 12 has both free and blocked arrows");

// 3) hint always returns a genuinely removable arrow
const h = core.firstRemovable(lv.rows, lv.cols, lv.arrows);
check(h >= 0 && core.canRemove(lv.rows, lv.cols, lv.arrows, h), "hint returns a removable arrow");

// 4) determinism: same id -> identical level
const a = JSON.stringify(core.generate(777)), b = JSON.stringify(core.generate(777));
check(a === b, "generation is deterministic");

// 5) difficulty rises with level number
const small = core.generate(1), big = core.generate(12000);
check(big.arrows.length >= small.arrows.length, "later levels are not smaller");

console.log(fails === 0 ? "CORE TESTS PASS" : "CORE TESTS FAIL (" + fails + ")");
process.exit(fails ? 1 : 0);
