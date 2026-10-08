// updater.js
// Live updates for the Android app.
//
// The app always starts instantly from the copy of the game bundled inside it (works
// offline). Then, if online, it quietly checks
//   https://sublebow.github.io/coreburn/updates/latest.json
// and if there's a newer GAME_VERSION it downloads that zip in the background.
// The new version is switched on the next time the app is opened (right at startup,
// never in the middle of a run or while an ad is showing). If a new version ever
// fails to start, the updater automatically rolls back to the previous working one.
//
// Only game files (HTML/CSS/JS) can be updated this way. Changes to the Android side
// (app name, icon, permissions, AdMob App ID, plugins) still need a Play Store update.
import { GAME_VERSION } from './version.js';
import { getPlugin } from './native.js';

const MANIFEST_URL = 'https://sublebow.github.io/coreburn/updates/latest.json';

// "1.2.10" > "1.2.9"
function isNewer(a, b) {
  const pa = a.split('.').map(Number), pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d > 0;
  }
  return false;
}

export async function checkForUpdates() {
  const Updater = getPlugin('CapacitorUpdater');
  if (!Updater) return; // website, or plugin missing
  // Tell the updater this version started fine (otherwise it rolls back after 10s)
  try { await Updater.notifyAppReady(); } catch (err) { console.warn('[update] notifyAppReady', err); }

  // 1) A newer version was downloaded last time? Switch to it now, at startup.
  let bundles = [];
  try {
    ({ bundles } = await Updater.list());
    const ready = bundles
      .filter((bnd) => (bnd.status === 'pending' || bnd.status === 'success') && isNewer(bnd.version, GAME_VERSION))
      .sort((x, y) => (isNewer(x.version, y.version) ? -1 : 1));
    if (ready.length) {
      console.info('[update] switching to', ready[0].version);
      await Updater.set({ id: ready[0].id }); // reloads the game into the new version
      return;
    }
  } catch (err) { console.warn('[update] list failed', err); }

  // 2) Check the website for a newer version and download it for next time.
  try {
    const res = await fetch(`${MANIFEST_URL}?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return;
    const latest = await res.json();
    if (!latest.version || !latest.url || !isNewer(latest.version, GAME_VERSION)) return;

    // A version that already failed to start once is never retried (fix it and bump the version)
    if (bundles.some((bnd) => bnd.version === latest.version && bnd.status === 'error')) return;

    // Some updates need newer Android code than this install has: those wait for the store update
    const App = getPlugin('App');
    const info = App ? await App.getInfo() : null;
    if (latest.minNativeBuild && info && Number(info.build) < latest.minNativeBuild) return;

    await Updater.download({ url: latest.url, version: latest.version, checksum: latest.checksum });
    console.info('[update] downloaded', latest.version, '- will switch on next launch');
  } catch (err) {
    console.warn('[update] check failed (offline?)', err);
  }
}
