/* Arrow Escape - game controller (UI, flow, progress, effects). */
(function () {
  "use strict";
  var C = window.APCore;
  var TOTAL = (window.ArrowLevels && window.ArrowLevels.total) || 12000;
  var GLYPH = ["\u2191", "\u2192", "\u2193", "\u2190"];       // N E S W
  var DCLASS = ["", "d1", "d2", "d3"];
  var LS_KEY = "arrowEscape.v1";

  var S = {
    mode: "campaign", level: 1, lv: null, arrows: [], hearts: 3, maxHearts: 3,
    moves: 0, mistakes: 0, locked: false, cellEls: [], arrowEls: {}, chapter: 0
  };

  function $(id) { return document.getElementById(id); }

  /* ---------------- progress ---------------- */
  function load() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (raw) {
        var p = JSON.parse(raw);
        p.stars = p.stars || {};
        if (typeof p.unlocked !== "number") p.unlocked = 1;
        if (typeof p.sound !== "boolean") p.sound = true;
        if (typeof p.vibrate !== "boolean") p.vibrate = true;
        return p;
      }
    } catch (e) {}
    return { unlocked: 1, stars: {}, sound: true, vibrate: true, seenHelp: false };
  }
  var progress = load();
  function save() { try { localStorage.setItem(LS_KEY, JSON.stringify(progress)); } catch (e) {} }

  /* ---------------- screens & overlays ---------------- */
  function showScreen(id) {
    var scr = document.querySelectorAll(".screen");
    for (var i = 0; i < scr.length; i++) scr[i].classList.toggle("active", scr[i].id === id);
  }
  function showOverlay(id) { $(id).classList.add("show"); }
  function closeOverlays() {
    var ov = document.querySelectorAll(".overlay");
    for (var i = 0; i < ov.length; i++) ov[i].classList.remove("show");
  }
  function toast(msg) {
    var t = $("toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove("show"); }, 1800);
  }

  /* ---------------- sound & haptics ---------------- */
  var actx = null;
  function sfx(kind) {
    if (!progress.sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      var seq = kind === "win" ? [660, 880, 1180] : [kind === "wrong" ? 170 : kind === "hint" ? 520 : 700];
      seq.forEach(function (f, i) {
        var o = actx.createOscillator(), g = actx.createGain();
        o.type = kind === "wrong" ? "sawtooth" : "sine";
        o.frequency.value = f;
        var t0 = actx.currentTime + i * 0.09;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.06, t0 + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
        o.connect(g); g.connect(actx.destination);
        o.start(t0); o.stop(t0 + 0.18);
      });
    } catch (e) {}
  }
  function buzz(ms) { if (progress.vibrate && navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) {} } }

  /* ---------------- board ---------------- */
  function buildBoard(lv) {
    var board = $("board");
    board.innerHTML = "";
    board.style.gridTemplateColumns = "repeat(" + lv.cols + ", 1fr)";
    S.cellEls = [];
    for (var r = 0; r < lv.rows; r++) {
      S.cellEls[r] = [];
      for (var c = 0; c < lv.cols; c++) {
        var cell = document.createElement("div");
        cell.className = "cell";
        board.appendChild(cell);
        S.cellEls[r][c] = cell;
      }
    }
    S.arrowEls = {};
    S.arrows = lv.arrows.map(function (a, i) { return { id: i + 1, r: a[0], c: a[1], d: a[2] }; });
    S.arrows.forEach(placeArrow);
  }

  function placeArrow(a) {
    var btn = document.createElement("button");
    btn.className = "arrow " + DCLASS[a.d];
    btn.textContent = GLYPH[a.d];
    btn.setAttribute("aria-label", "arrow");
    btn.addEventListener("click", function () { tapArrow(a.id); });
    var cell = S.cellEls[a.r][a.c];
    cell.classList.add("arrow-cell");
    cell.appendChild(btn);
    S.arrowEls[a.id] = btn;
  }

  function flyOut(a) {
    var el = S.arrowEls[a.id]; if (!el) return;
    var dx = a.d === 1 ? 1 : a.d === 3 ? -1 : 0;
    var dy = a.d === 0 ? -1 : a.d === 2 ? 1 : 0;
    var dist = Math.max(window.innerWidth, window.innerHeight);
    el.classList.add("fly");
    el.style.transform = "translate(" + (dx * dist) + "px," + (dy * dist) + "px)";
    var cell = el.parentNode; if (cell) cell.classList.remove("arrow-cell");
    delete S.arrowEls[a.id];
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 360);
  }

  // Core works on plain [r,c,d] tuples; the UI keeps richer objects, so map on demand.
  function arrOf() { return S.arrows.map(function (a) { return [a.r, a.c, a.d]; }); }
  function canRemoveAt(i) { return C.canRemove(S.lv.rows, S.lv.cols, arrOf(), i); }

  function shake(id) {
    var el = S.arrowEls[id]; if (!el) return;
    el.classList.remove("shake"); void el.offsetWidth; el.classList.add("shake");
    setTimeout(function () { el.classList.remove("shake"); }, 340);
  }

  /* ---------------- input ---------------- */
  function tapArrow(id) {
    if (S.locked) return;
    var idx = -1;
    for (var i = 0; i < S.arrows.length; i++) if (S.arrows[i].id === id) { idx = i; break; }
    if (idx < 0) return;
    var a = S.arrows[idx];

    if (canRemoveAt(idx)) {
      S.locked = true;
      S.moves++;
      S.arrows.splice(idx, 1);
      flyOut(a);
      sfx("clear"); buzz(12);
      updateHud();
      if (S.arrows.length === 0) { setTimeout(winLevel, 380); }
      else { setTimeout(function () { S.locked = false; }, 130); }
    } else {
      S.locked = true;
      shake(id);
      sfx("wrong"); buzz(35);
      loseHeart(function () { S.locked = false; });
    }
  }

  function loseHeart(cb) {
    S.hearts--; S.mistakes++;
    updateHud();
    if (S.hearts <= 0) {
      setTimeout(function () { showOverlay("ov-over"); }, 380);
    } else {
      toast(S.hearts + (S.hearts === 1 ? " heart left" : " hearts left"));
      if (cb) setTimeout(cb, 360);
    }
  }

  /* ---------------- hud ---------------- */
  function renderHearts() {
    var s = "";
    for (var i = 0; i < S.maxHearts; i++) s += "<span class='" + (i < S.hearts ? "" : "off") + "'>&#9829;</span>";
    $("hearts").innerHTML = s;
  }
  function updateHud() {
    $("stat-left").textContent = S.arrows.length;
    $("stat-moves").textContent = S.moves;
    $("stat-par").textContent = S.lv ? S.lv.par : 0;
    var par = S.lv ? S.lv.par : 1;
    var done = par - S.arrows.length;
    $("progress-bar").style.width = Math.max(0, Math.min(100, (done / par) * 100)) + "%";
    var pot = S.mistakes === 0 ? 3 : S.mistakes === 1 ? 2 : 1;
    $("hud-stars").textContent = "\u2605".repeat(pot) + "\u2606".repeat(3 - pot);
    renderHearts();
  }

  /* ---------------- level flow ---------------- */
  function startLevel(n) {
    S.mode = "campaign"; S.level = n; S.lv = C.generate(n);
    S.hearts = S.maxHearts = 3; S.moves = 0; S.mistakes = 0; S.locked = false;
    buildBoard(S.lv);
    $("hud-level").textContent = "Level " + n;
    updateHud(); closeOverlays(); showScreen("screen-game");
  }

  function startDaily() {
    var d = new Date();
    var seed = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
    var id = 1000000 + seed;
    S.mode = "daily"; S.level = id; S.lv = C.generate(id);
    S.hearts = S.maxHearts = 3; S.moves = 0; S.mistakes = 0; S.locked = false;
    buildBoard(S.lv);
    $("hud-level").textContent = "Daily Puzzle";
    updateHud(); closeOverlays(); showScreen("screen-game");
  }

  function restart() { closeOverlays(); if (S.mode === "daily") startDaily(); else startLevel(S.level); }

  function winLevel() {
    var stars = S.mistakes === 0 ? 3 : S.mistakes === 1 ? 2 : 1;
    if (S.mode === "campaign") {
      var id = S.level;
      if (!progress.stars[id] || progress.stars[id] < stars) progress.stars[id] = stars;
      if (id < TOTAL && id + 1 > progress.unlocked) progress.unlocked = id + 1;
      save();
    }
    confetti();
    sfx("win"); buzz([12, 40, 12]);
    $("win-stars").textContent = "\u2605".repeat(stars) + "\u2606".repeat(3 - stars);
    $("win-line").textContent = "Solved in " + S.moves + " moves \u00b7 " +
      S.mistakes + " mistake" + (S.mistakes === 1 ? "" : "s");
    $("btn-continue").style.display = (S.mode === "campaign" && S.level >= TOTAL) ? "none" : "";
    showOverlay("ov-win");
  }

  function hint() {
    if (S.locked) return;
    var i = C.firstRemovable(S.lv.rows, S.lv.cols, arrOf());
    if (i < 0) { toast("No move available - restart the level"); return; }
    var a = S.arrows[i], el = S.arrowEls[a.id];
    sfx("hint");
    if (el) {
      el.classList.remove("hintpulse"); void el.offsetWidth; el.classList.add("hintpulse");
      setTimeout(function () { el.classList.remove("hintpulse"); }, 2200);
    }
  }

  function confetti() {
    var box = document.createElement("div");
    box.className = "confetti";
    var colors = ["#5b8cff", "#37d39b", "#ffd166", "#ff8a5b", "#c77dff"];
    for (var i = 0; i < 60; i++) {
      var p = document.createElement("i");
      p.style.left = Math.random() * 100 + "vw";
      p.style.background = colors[i % colors.length];
      p.style.animationDuration = (1.1 + Math.random() * 1.2) + "s";
      p.style.animationDelay = (Math.random() * 0.3) + "s";
      box.appendChild(p);
    }
    document.body.appendChild(box);
    setTimeout(function () { box.remove(); }, 2600);
  }

  /* ---------------- levels screen ---------------- */
  function showLevels() {
    renderPager(); renderLevelGrid(S.chapter);
    $("levels-progress").textContent = Object.keys(progress.stars).length + " / " + TOTAL + " solved";
    showScreen("screen-levels");
  }
  function renderPager() {
    var pager = $("level-pager"); pager.innerHTML = "";
    var chapters = Math.ceil(TOTAL / 50);
    var start = Math.max(0, Math.min(S.chapter - 2, chapters - 5));
    for (var ch = start; ch < Math.min(chapters, start + 7); ch++) {
      (function (ch) {
        var b = document.createElement("button");
        b.textContent = "L" + (ch * 50 + 1) + "-" + Math.min(TOTAL, (ch + 1) * 50);
        if (ch === S.chapter) b.className = "on";
        b.onclick = function () { S.chapter = ch; renderPager(); renderLevelGrid(ch); };
        pager.appendChild(b);
      })(ch);
    }
  }
  function isHardLevel(id) {
    return (window.ArrowLevels && window.ArrowLevels.isHard) ? window.ArrowLevels.isHard(id) : (id % 6 === 0);
  }
  function renderLevelGrid(ch) {
    var g = $("level-grid"); g.innerHTML = "";
    for (var i = 0; i < 50; i++) {
      var id = ch * 50 + i + 1; if (id > TOTAL) break;
      var b = document.createElement("button");
      var unlocked = id <= progress.unlocked;
      var st = progress.stars[id] || 0;
      b.className = "lv" + (unlocked ? "" : " locked") + (isHardLevel(id) ? " hard" : "");
      b.innerHTML = id + (st ? "<span class='st'>" + "\u2605".repeat(st) + "</span>" : "");
      if (unlocked) b.onclick = (function (id) { return function () { startLevel(id); }; })(id);
      g.appendChild(b);
    }
  }

  /* ---------------- home ---------------- */
  function refreshHome() {
    $("play-sub").textContent = "Level " + Math.min(progress.unlocked, TOTAL);
    $("levels-sub").textContent = TOTAL.toLocaleString("en-IN");
    $("settings-sub").textContent = progress.sound ? "Sound on" : "Sound off";
    $("daily-sub").textContent = "New puzzle";
  }

  function refreshSettings() {
    $("set-sound").textContent = "Sound: " + (progress.sound ? "on" : "off");
    $("set-vibrate").textContent = "Vibration: " + (progress.vibrate ? "on" : "off");
    $("btn-pause-sound").textContent = "Sound: " + (progress.sound ? "on" : "off");
  }

  /* ---------------- wiring ---------------- */
  function on(id, fn) { var e = $(id); if (e) e.addEventListener("click", fn); }

  on("btn-play", function () { startLevel(Math.min(progress.unlocked, TOTAL)); });
  on("btn-levels", showLevels);
  on("btn-daily", startDaily);
  on("btn-settings", function () { refreshSettings(); showOverlay("ov-settings"); });
  on("btn-help", function () { showOverlay("ov-help"); });
  on("btn-hint", hint);
  on("btn-restart", restart);
  on("btn-pause", function () { refreshSettings(); showOverlay("ov-pause"); });
  on("btn-continue", function () {
    closeOverlays();
    if (S.mode === "campaign" && S.level < TOTAL) startLevel(S.level + 1); else showLevels();
  });
  on("btn-retry", restart);
  on("btn-resume", closeOverlays);
  on("btn-pause-restart", restart);
  on("btn-pause-sound", function () { progress.sound = !progress.sound; save(); refreshSettings(); });
  on("set-sound", function () { progress.sound = !progress.sound; save(); refreshSettings(); });
  on("set-vibrate", function () { progress.vibrate = !progress.vibrate; save(); refreshSettings(); });
  on("set-help", function () { closeOverlays(); showOverlay("ov-help"); });
  on("set-reset", function () {
    if (window.confirm("Reset all progress and stars?")) {
      progress = { unlocked: 1, stars: {}, sound: progress.sound, vibrate: progress.vibrate, seenHelp: true };
      save(); closeOverlays(); refreshHome(); toast("Progress reset");
    }
  });
  var backs = document.querySelectorAll("[data-back]");
  for (var i = 0; i < backs.length; i++) {
    backs[i].addEventListener("click", function () { closeOverlays(); refreshHome(); showScreen("screen-home"); });
  }

  /* ---------------- boot ---------------- */
  refreshHome();
  refreshSettings();
  showScreen("screen-home");
  if (!progress.seenHelp) { progress.seenHelp = true; save(); showOverlay("ov-help"); }

  window.__ArrowEscape = {
    startLevel: startLevel, state: S, progress: progress, core: C,
    canRemoveAt: canRemoveAt, arrOf: arrOf,
    firstRemovableAt: function () { return C.firstRemovable(S.lv.rows, S.lv.cols, arrOf()); }
  };
})();
