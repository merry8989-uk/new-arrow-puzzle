// Dumps every generated level to JSON so the validator can check the exact
// levels the game will show. Run: node tools/dump_levels.js 12000 out.json
const core = require("../js/core.js");
const fs = require("fs");
const N = parseInt(process.argv[2] || "12000", 10);
const outPath = process.argv[3] || "levels_dump.json";
const out = [];
for (let id = 1; id <= N; id++) out.push(core.generate(id));
fs.writeFileSync(outPath, JSON.stringify(out));
console.log("generated " + out.length + " levels -> " + outPath);
