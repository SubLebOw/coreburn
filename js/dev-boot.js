// dev-boot.js - DEVELOPMENT ONLY (preview / localhost with ?dev=1). Never packaged (scripts/build-web.mjs
// skips dev-*.js) and never loaded on sublebow.github.io or in the Android app (gate in index.html).
// Runs BEFORE the game modules: swaps window.localStorage for a sandbox kept in sessionStorage under
// 'cbdev:' so a dev session can never write to (or alter) the real saved profile / progression.
// The sandbox starts as a copy of the real profile (read once) and is thrown away when the tab closes.
(function () {
  var P = 'cbdev:', ss = window.sessionStorage, real = window.localStorage;
  if (!ss.getItem(P + '__seeded')) {
    for (var i = 0; i < real.length; i++) { var k = real.key(i); ss.setItem(P + k, real.getItem(k)); }
    if (!ss.getItem(P + 'coreburn-rules')) ss.setItem(P + 'coreburn-rules', 'z'); // Phase 5 content is CoreBurnZ-only
    ss.setItem(P + '__seeded', '1');
  }
  var keys = function () { var a = []; for (var i = 0; i < ss.length; i++) { var k = ss.key(i); if (k.indexOf(P) === 0 && k !== P + '__seeded') a.push(k.slice(P.length)); } return a; };
  var box = {
    getItem: function (k) { return ss.getItem(P + k); },
    setItem: function (k, v) { ss.setItem(P + k, String(v)); },
    removeItem: function (k) { ss.removeItem(P + k); },
    clear: function () { keys().forEach(function (k) { ss.removeItem(P + k); }); },
    key: function (i) { return keys()[i] ?? null; },
    get length() { return keys().length; },
  };
  Object.defineProperty(window, 'localStorage', { value: box, configurable: true });
  window.__CB_DEV = { sandbox: true, resetSandbox: function () { keys().forEach(function (k) { ss.removeItem(P + k); }); ss.removeItem(P + '__seeded'); location.reload(); } };
})();
