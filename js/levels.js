/* Arrow Escape - level catalogue metadata.
   Levels themselves are produced deterministically by APCore.generate(id), so the
   whole 12,000-level catalogue ships with no bulky data files. This object only
   holds the display metadata used by the Levels screen. */
window.ArrowLevels = {
  total: 12000,
  perChapter: 50,
  hardEvery: 6,          // every 6th level is a "hard" level
  chapters: 240,
  chapterStart: function (ch) { return ch * this.perChapter + 1; },
  chapterEnd: function (ch) { return Math.min(this.total, (ch + 1) * this.perChapter); }
};
