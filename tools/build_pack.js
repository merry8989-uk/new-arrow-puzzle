#!/usr/bin/env node
/* Build a downloadable level pack for Arrow Escape.
 *
 * A pack is JSON the game fetches from packs/manifest.json:
 *   { "id", "name", "version", "levels": [ {gen,rows,cols,arrows} | {rows,cols,arrows,par} ] }
 *
 * This helper mints N fresh, solvable levels with a chosen difficulty. Each
 * entry uses {gen, rows, cols, arrows}: `gen` is a unique seed and rows/cols/
 * arrows set the difficulty, so packs are tiny and can mint levels that are not
 * part of the built-in campaign.
 *
 * Usage:
 *   node tools/build_pack.js --id starter-boost --name "Starter Boost" \
 *     --count 30 --rows 5 --cols 5 --arrows 11 --seed 50001 out.json
 */
const fs = require("fs");
const core = require("../js/core.js");

function arg(name, def) {
  const i = process.argv.indexOf("--" + name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

const id = arg("id", "pack");
const name = arg("name", "Level Pack");
const version = parseInt(arg("version", "1"), 10);
const count = parseInt(arg("count", "30"), 10);
const rows = parseInt(arg("rows", "5"), 10);
const cols = parseInt(arg("cols", "5"), 10);
const arrows = parseInt(arg("arrows", "11"), 10);
const seedStart = parseInt(arg("seed", "50001"), 10);
const out = process.argv[process.argv.length - 1];

const levels = [];
for (let k = 0; k < count; k++) {
  const seed = seedStart + k;
  const lv = core.generateEx(seed, rows, cols, arrows);
  if (!core.isSolvable(lv.rows, lv.cols, lv.arrows)) {
    throw new Error("generated an unsolvable level at seed " + seed);
  }
  levels.push({ gen: seed, rows: rows, cols: cols, arrows: arrows });
}

const pack = { id: id, name: name, version: version, levels: levels };
fs.writeFileSync(out, JSON.stringify(pack));
console.log("wrote " + out + " : " + levels.length + " levels (" + rows + "x" + cols + ", ~" + arrows + " arrows), all solvable");
