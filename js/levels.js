/* Arrow Escape - level catalogue metadata.
   Levels themselves are produced deterministically by APCore.generate(id), so the
   whole 12,000-level catalogue ships with no bulky data files. This object only
   holds the display metadata used by the Levels screen and the difficulty curve.

   Difficulty:
     1-5    tutorial (tiny 3x3 boards)
     6-24   gentle ramp (4x4 -> 6x7, more arrows each level)
     25+    HIGH DIFFICULTY MODE - every level from 25 up is a high-difficulty
            level (7x7 -> 9x9 boards, dense arrows) */
window.ArrowLevels = {
  total: 12000,
  perChapter: 50,
  hardEvery: 6,          // within the ramp, every 6th level is a hard level
  highFrom: 25,          // from this level up, everything is high difficulty
  chapters: 240,
  chapterStart: function (ch) { return ch * this.perChapter + 1; },
  chapterEnd: function (ch) { return Math.min(this.total, (ch + 1) * this.perChapter); },
  isHard: function (id) { return id >= this.highFrom || (id >= 6 && id % this.hardEvery === 0); }
};
