/* New Arrow Puzzle - game controller (UI, flow, progress, effects, online packs). */
(function () {
  "use strict";
  var C = window.APCore;
  var TOTAL = (window.ArrowLevels && window.ArrowLevels.total) || 12000;
  var GLYPH = ["\u2191", "\u2192", "\u2193", "\u2190"];       // N E S W
  var DCLASS = ["", "d1", "d2", "d3"];
  var LS_KEY = "newArrowPuzzle.v1";
  // The only network use in the whole game: the optional pack manifest. The URL
  // lives in js/packs-config.js, which is excluded from the Playables bundle, so
  // the bundle contains no external URLs at all.
  var MANIFEST_URL = window.PACKS_MANIFEST_URL || "";
  var packsAvailable = !!MANIFEST_URL;   // false inside Playables

  // YouTube Playables shim (js/playables.js). No-ops outside YouTube.
  var YT = window.YTPlay || {
    present: false, env: false,
    firstFrame: function () {}, ready: function () {},
    load: function () { return Promise.resolve(null); },
    save: function () { return Promise.resolve(); },
    audioEnabled: function () { return true; },
    onAudio: function () {}, onPause: function () {}, onResume: function () {}
  };
  var cloudReady = !YT.env;   // cloud save only after loadData resolves
  var paused = false;         // set by the Playables onPause / onResume callbacks

  var S = {
    mode: "campaign", ctx: null, lv: null, arrows: [], hearts: 3, maxHearts: 3,
    moves: 0, mistakes: 0, locked: false, cellEls: [], arrowEls: {}, chapter: 0
  };

  function $(id) { return document.getElementById(id); }

  /* ---------------- progress ---------------- */
  function blank() {
    return { unlocked: 1, stars: {}, sound: true, vibrate: true, seenHelp: false,
             online: { packs: {}, checked: null } };
  }
  function normalize(p) {
    if (!p || typeof p !== "object") return blank();
    p.stars = p.stars || {};
    if (typeof p.unlocked !== "number") p.unlocked = 1;
    if (typeof p.sound !== "boolean") p.sound = true;
    if (typeof p.vibrate !== "boolean") p.vibrate = true;
    if (!p.online) p.online = { packs: {}, checked: null };
    if (!p.online.packs) p.online.packs = {};
    return p;
  }
  function load() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (raw) return normalize(JSON.parse(raw));
    } catch (e) {}
    return blank();
  }
  var progress = load();
  // Inside YouTube Playables, progress is cloud-saved via the SDK; elsewhere it
  // goes to localStorage. saveData must not run before loadData has resolved.
  function save() {
    var str;
    try { str = JSON.stringify(progress); } catch (e) { return; }
    if (YT.env) { if (cloudReady) YT.save(str); return; }
    try { localStorage.setItem(LS_KEY, str); } catch (e) {}
  }
  function onlinePacks() { if (!progress.online) progress.online = { packs: {}, checked: null }; if (!progress.online.packs) progress.online.packs = {}; return progress.online.packs; }

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
    clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove("show"); }, 1900);
  }

  /* ---------------- sound & haptics ---------------- */
  var actx = null;
  function sfx(kind) {
    if (!progress.sound) return;
    if (!YT.audioEnabled()) return;   // respect YouTube's mute
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

  function shake(id) {
    var el = S.arrowEls[id]; if (!el) return;
    el.classList.remove("shake"); void el.offsetWidth; el.classList.add("shake");
    setTimeout(function () { el.classList.remove("shake"); }, 340);
  }

  // Core works on plain [r,c,d] tuples; the UI keeps richer objects, so map on demand.
  function arrOf() { return S.arrows.map(function (a) { return [a.r, a.c, a.d]; }); }
  function canRemoveAt(i) { return C.canRemove(S.lv.rows, S.lv.cols, arrOf(), i); }
  function firstRemovableAt() { return C.firstRemovable(S.lv.rows, S.lv.cols, arrOf()); }

  /* ---------------- input ---------------- */
  function tapArrow(id) {
    if (S.locked || paused) return;
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
  function startLevelObject(lv, title, ctx) {
    S.mode = ctx.type; S.ctx = ctx; S.lv = lv;
    S.hearts = S.maxHearts = 3; S.moves = 0; S.mistakes = 0; S.locked = false;
    buildBoard(lv);
    $("hud-level").textContent = title;
    updateHud(); closeOverlays(); showScreen("screen-game");
  }
  function startLevel(n) { startLevelObject(C.generate(n), "Level " + n, { type: "campaign", index: n }); }
  function startDaily() {
    var d = new Date();
    var seed = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
    startLevelObject(C.generate(1000000 + seed), "Daily Puzzle", { type: "daily" });
  }
  function startPack(packId, slot) {
    var p = onlinePacks()[packId]; if (!p || !p.levels[slot]) return;
    startLevelObject(p.levels[slot], p.name, { type: "pack", packId: packId, slot: slot, count: p.levels.length });
  }
  function restart() {
    closeOverlays(); if (!S.ctx) return;
    if (S.ctx.type === "campaign") startLevel(S.ctx.index);
    else if (S.ctx.type === "daily") startDaily();
    else if (S.ctx.type === "pack") startPack(S.ctx.packId, S.ctx.slot);
  }
  function hasNext() {
    if (!S.ctx) return false;
    if (S.ctx.type === "campaign") return S.ctx.index < TOTAL;
    if (S.ctx.type === "pack") return S.ctx.slot + 1 < S.ctx.count;
    return false;
  }

  function winLevel() {
    var stars = S.mistakes === 0 ? 3 : S.mistakes === 1 ? 2 : 1;
    if (S.ctx.type === "campaign") {
      var id = S.ctx.index;
      if (!progress.stars[id] || progress.stars[id] < stars) progress.stars[id] = stars;
      if (id < TOTAL && id + 1 > progress.unlocked) progress.unlocked = id + 1;
      save();
    } else if (S.ctx.type === "pack") {
      var p = onlinePacks()[S.ctx.packId];
      if (p) { p.done = p.done || {}; p.done[S.ctx.slot] = 1; save(); }
    }
    confetti();
    sfx("win"); buzz([12, 40, 12]);
    $("win-stars").textContent = "\u2605".repeat(stars) + "\u2606".repeat(3 - stars);
    var line = "Solved in " + S.moves + " moves \u00b7 " + S.mistakes + " mistake" + (S.mistakes === 1 ? "" : "s");
    if (S.ctx.type === "campaign" && S.ctx.index >= TOTAL) {
      line = "You've cleared all " + TOTAL.toLocaleString("en-IN") + " levels - that's the whole game. Thanks for playing!";
    }
    $("win-line").textContent = line;
    $("btn-continue").style.display = hasNext() ? "" : "none";
    showOverlay("ov-win");
  }

  function hint() {
    if (S.locked || paused) return;
    var i = firstRemovableAt();
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

  /* ---------------- packs (the only network feature) ---------------- */
  // Turn one downloaded entry into a level object. Packs are untrusted data:
  // we only read numbers, and every level is re-checked for solvability before
  // it is kept. Nothing from a pack is ever executed.
  function normalizeLevel(entry) {
    if (!entry || typeof entry !== "object") return null;
    if (typeof entry.gen === "number") {
      return (entry.rows && entry.cols)
        ? C.generateEx(entry.gen, entry.rows, entry.cols, entry.arrows || 0)
        : C.generate(entry.gen);
    }
    if (entry.rows && entry.cols && entry.arrows && entry.arrows.length) {
      var arrows = [];
      for (var i = 0; i < entry.arrows.length; i++) {
        var a = entry.arrows[i];
        if (a && a.length >= 3 && typeof a[0] === "number" && typeof a[1] === "number" && typeof a[2] === "number") {
          arrows.push([a[0] | 0, a[1] | 0, a[2] | 0]);
        }
      }
      if (!arrows.length) return null;
      return { rows: entry.rows | 0, cols: entry.cols | 0, arrows: arrows, par: entry.par || arrows.length, hard: !!entry.hard };
    }
    return null;
  }

  function installPack(meta) {
    return new Promise(function (resolve) {
      try {
        var packs = onlinePacks();
        var have = packs[meta.id];
        if (have && have.version >= (meta.version || 1)) { resolve("skip"); return; }
        var url = meta.url + (meta.url.indexOf("?") < 0 ? "?" : "&") + "t=" + Date.now();
        fetch(url, { cache: "no-store" })
          .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
          .then(function (data) {
            var raw = (data && data.levels) || [];
            var levels = [], bad = 0;
            for (var i = 0; i < raw.length; i++) {
              var lv = normalizeLevel(raw[i]);
              if (!lv || !C.isSolvable(lv.rows, lv.cols, lv.arrows)) { bad++; continue; }
              levels.push(lv);
            }
            if (!levels.length) { resolve("failed"); return; }
            packs[meta.id] = {
              version: meta.version || 1, name: meta.name || meta.id,
              desc: meta.desc || "", levels: levels, done: (have && have.done) || {}
            };
            resolve(have ? "updated" : "new");
          })
          .catch(function () { resolve("failed"); });
      } catch (e) { resolve("failed"); }
    });
  }

  function checkForPacks() {
    var status = $("packs-status");
    if (YT.env || !MANIFEST_URL) { status.textContent = "Online packs are unavailable here - all levels are built in."; return; }
    if (typeof fetch !== "function") { status.textContent = "This browser can't fetch packs - the built-in levels still work offline."; return; }
    status.textContent = "Checking for new packs...";
    var url = MANIFEST_URL + "?t=" + Date.now();
    fetch(url, { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (man) {
        var list = (man && man.packs) || [];
        return Promise.all(list.map(installPack)).then(function (res) {
          var added = 0, updated = 0, failed = 0;
          res.forEach(function (x) { if (x === "new") added++; else if (x === "updated") updated++; else if (x === "failed") failed++; });
          progress.online.checked = Date.now(); save(); renderPacks();
          if (!added && !updated) status.textContent = "You're up to date - no new packs right now.";
          else status.textContent = "Done: " + added + " new, " + updated + " updated" + (failed ? ", " + failed + " failed" : "") + ".";
        });
      })
      .catch(function () {
        status.textContent = "Couldn't reach the server (offline?). The built-in levels and any packs you already have still work.";
      });
  }

  function renderPacks() {
    var listEl = $("pack-list"); listEl.innerHTML = "";
    var packs = onlinePacks();
    var ids = Object.keys(packs);
    $("packs-note").textContent = ids.length ? ids.length + " installed" : "";
    if (!ids.length) {
      var d = document.createElement("div");
      d.className = "pack-empty";
      d.textContent = "No packs yet. Tap \"Check for new packs\" to fetch optional extra levels.";
      listEl.appendChild(d);
      return;
    }
    ids.forEach(function (id) {
      var p = packs[id];
      var done = p.done ? Object.keys(p.done).length : 0;
      var row = document.createElement("button");
      row.className = "pack-row";
      row.innerHTML = "<span class='pk-ico'>&#10022;</span>" +
        "<span class='pk-mid'><span class='pk-name'></span><span class='pk-desc'></span></span>" +
        "<span class='pk-prog'></span>";
      row.querySelector(".pk-name").textContent = p.name;
      row.querySelector(".pk-desc").textContent = (p.desc ? p.desc + "  " : "") + "(" + p.levels.length + " levels)";
      row.querySelector(".pk-prog").textContent = done + "/" + p.levels.length;
      row.onclick = function () { startPack(id, nextSlot(p)); };
      listEl.appendChild(row);
    });
  }
  function nextSlot(p) {
    for (var i = 0; i < p.levels.length; i++) if (!p.done || !p.done[i]) return i;
    return 0;
  }
  function showPacks() { renderPacks(); showScreen("screen-packs"); }

  /* ---------------- home ---------------- */
  function refreshHome() {
    $("play-sub").textContent = "Level " + Math.min(progress.unlocked, TOTAL);
    $("levels-sub").textContent = TOTAL.toLocaleString("en-IN");
    $("settings-sub").textContent = progress.sound ? "Sound on" : "Sound off";
    var n = Object.keys(onlinePacks()).length;
    $("packs-sub").textContent = n ? n + " installed" : "New levels";
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
  on("btn-packs", showPacks);
  on("btn-check-packs", checkForPacks);
  on("btn-settings", function () { refreshSettings(); showOverlay("ov-settings"); });
  on("btn-help", function () { showOverlay("ov-help"); });
  on("btn-hint", hint);
  on("btn-restart", restart);
  on("btn-pause", function () { refreshSettings(); showOverlay("ov-pause"); });
  on("btn-continue", function () {
    closeOverlays();
    if (S.ctx.type === "campaign" && S.ctx.index < TOTAL) startLevel(S.ctx.index + 1);
    else if (S.ctx.type === "pack" && S.ctx.slot + 1 < S.ctx.count) startPack(S.ctx.packId, S.ctx.slot + 1);
    else if (S.ctx.type === "pack") showPacks();
    else if (S.ctx.type === "campaign") showLevels();
    else showScreen("screen-home");
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
      progress.stars = {}; progress.unlocked = 1;
      var packs = onlinePacks();
      Object.keys(packs).forEach(function (k) { packs[k].done = {}; });
      save(); closeOverlays(); refreshHome(); toast("Progress reset");
    }
  });
  var backs = document.querySelectorAll("[data-back]");
  for (var i = 0; i < backs.length; i++) {
    backs[i].addEventListener("click", function () { closeOverlays(); refreshHome(); showScreen("screen-home"); });
  }

  /* ---------------- Playables lifecycle ---------------- */
  // Esc closes the pause / settings / help dialogs (never preventDefault).
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    var ov = document.querySelector(".overlay.show");
    if (!ov || ov.id === "ov-win" || ov.id === "ov-over") return;
    ov.classList.remove("show");
  });
  // Pause all input on onPause, resume only on onResume.
  YT.onPause(function () { paused = true; save(); });
  YT.onResume(function () { paused = false; });
  // No external calls are allowed inside Playables, so when packs are
  // unavailable (Playables bundle, or a host without packs-config.js) hide the
  // online-packs entry entirely.
  if (!packsAvailable || YT.env) {
    var packsTile = $("btn-packs");
    if (packsTile) packsTile.style.display = "none";
  }

  /* ---------------- boot ---------------- */
  function firstRunHelp() {
    if (!progress.seenHelp) { progress.seenHelp = true; save(); showOverlay("ov-help"); }
  }
  refreshHome();
  refreshSettings();
  showScreen("screen-home");
  YT.firstFrame();          // frames are being drawn now
  if (YT.env) {
    // Load cloud progress first; only then is it safe to save.
    YT.load().then(function (raw) {
      if (raw) { try { progress = normalize(JSON.parse(raw)); } catch (e) {} }
      cloudReady = true;
      refreshHome(); refreshSettings();
      firstRunHelp();
      YT.ready();           // the home screen is now interactive
    });
  } else {
    firstRunHelp();
  }

  window.__ArrowEscape = {
    state: S, core: C, total: TOTAL,
    startLevel: startLevel, startDaily: startDaily, startPack: startPack,
    canRemoveAt: canRemoveAt, arrOf: arrOf, firstRemovableAt: firstRemovableAt,
    normalizeLevel: normalizeLevel, installPack: installPack, checkForPacks: checkForPacks,
    onlinePacks: onlinePacks, manifestUrl: MANIFEST_URL
  };
  // `progress` is replaced when cloud data loads, so expose it via a getter.
  Object.defineProperty(window.__ArrowEscape, "progress", { get: function () { return progress; } });
})();
