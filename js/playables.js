/* New Arrow Puzzle - YouTube Playables SDK shim.
 *
 * The SDK itself is loaded by a <script src="https://www.youtube.com/game_api/v1">
 * tag placed BEFORE this file (the SDK must load before any game code). This shim
 * wraps the parts the game needs and degrades to no-ops everywhere else, so the
 * exact same build runs on the web, on GitHub Pages, and inside YouTube Playables.
 *
 * Required SDK surface used here:
 *   ytgame.IN_PLAYABLES_ENV, game.firstFrameReady, game.gameReady,
 *   game.loadData, game.saveData,
 *   system.isAudioEnabled, system.onAudioEnabledChange,
 *   system.onPause, system.onResume
 */
(function () {
  "use strict";
  var yt = (typeof ytgame !== "undefined") ? ytgame : null;
  var env = !!(yt && yt.IN_PLAYABLES_ENV);

  function safe(fn) { try { return fn(); } catch (e) { return undefined; } }

  var audio = true;
  var pauseCbs = [], resumeCbs = [], audioCbs = [];

  if (yt && yt.system) {
    var a = safe(function () { return yt.system.isAudioEnabled(); });
    audio = (a === undefined) ? true : !!a;
    safe(function () { yt.system.onAudioEnabledChange(function (v) { audio = !!v; audioCbs.forEach(function (c) { c(audio); }); }); });
    safe(function () { yt.system.onPause(function () { pauseCbs.forEach(function (c) { c(); }); }); });
    safe(function () { yt.system.onResume(function () { resumeCbs.forEach(function (c) { c(); }); }); });
  }

  window.YTPlay = {
    present: !!yt,
    env: env,
    // Notify YouTube that frames are being drawn (loading screen / first paint).
    firstFrame: function () { if (yt && yt.game && yt.game.firstFrameReady) safe(function () { yt.game.firstFrameReady(); }); },
    // Notify YouTube the game is interactive. MUST NOT be called while a
    // non-interactable screen (loading/splash) is still shown.
    ready: function () { if (yt && yt.game && yt.game.gameReady) safe(function () { yt.game.gameReady(); }); },
    load: function () {
      if (!yt || !yt.game || !yt.game.loadData) return Promise.resolve(null);
      return Promise.resolve(safe(function () { return yt.game.loadData(); })).catch(function () { return null; });
    },
    save: function (str) {
      if (!yt || !yt.game || !yt.game.saveData) return Promise.resolve();
      return Promise.resolve(safe(function () { return yt.game.saveData(str); })).catch(function () {});
    },
    audioEnabled: function () { return audio; },
    onAudio: function (cb) { audioCbs.push(cb); },
    onPause: function (cb) { pauseCbs.push(cb); },
    onResume: function (cb) { resumeCbs.push(cb); }
  };
})();
