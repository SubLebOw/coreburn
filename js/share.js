// share.js
// "Share my score" on the game over screen.
//
// What happens when you press SHARE:
//   1. Android app with the native Share plugin (@capacitor/share): the phone's share sheet.
//      (The plugin is native code, so it only exists in app builds that include it.
//      Older app builds just fall through to the next options.)
//   2. Phone browsers with the Web Share API (navigator.share): the phone's share sheet.
//   3. Everywhere else (desktop, or anything without a share sheet): open a ready-made
//      post on X (twitter.com/intent/tweet). In the Android app this opens the X app or browser.
// COPY puts the same text + link on the clipboard, for anywhere else (Discord, WhatsApp...).
import { IS_NATIVE, getPlugin } from './native.js';

export const SHARE_URL = 'https://sublebow.github.io/coreburn/';

// e.g. "I reached wave 23 in COREBURN (score 18,450) in the Frozen Scrap Tundra and died to the Gulletworm. Can you beat it? 🔥"
export function shareText({ wave, score, killer, place }) {
  const where = place ? ` in ${place}` : '';
  const died = killer ? ` and died to ${killer}` : '';
  return `I reached wave ${wave} in COREBURN (score ${score.toLocaleString('en-US')})${where}${died}. Can you beat it? 🔥`;
}

export function xIntentUrl(text) {
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(SHARE_URL)}`;
}

const isPhone = () =>
  window.matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

const isCancel = (err) =>
  err && (err.name === 'AbortError' || /cancel/i.test(String(err.message || err)));

// Returns 'native' | 'webshare' | 'x' | 'cancelled'
export async function shareScore(run) {
  const text = shareText(run);

  // 1. Native share sheet in the Android app (only if this app build has the plugin)
  const Cap = window.Capacitor;
  if (IS_NATIVE && Cap && typeof Cap.isPluginAvailable === 'function' && Cap.isPluginAvailable('Share')) {
    try {
      await getPlugin('Share').share({ title: 'COREBURN', text, url: SHARE_URL, dialogTitle: 'Share your score' });
      return 'native';
    } catch (err) {
      if (isCancel(err)) return 'cancelled';
      // anything else: fall through to the other options
    }
  }

  // 2. Web Share API on phones
  if (isPhone() && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: 'COREBURN', text, url: SHARE_URL });
      return 'webshare';
    } catch (err) {
      if (isCancel(err)) return 'cancelled';
    }
  }

  // 3. A ready-made post on X
  window.open(xIntentUrl(text), '_blank', 'noopener');
  return 'x';
}

// Copy "text + link" to the clipboard. Returns true if it worked.
export async function copyScore(run) {
  const full = `${shareText(run)} ${SHARE_URL}`;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(full);
      return true;
    }
  } catch (err) { /* fall back below */ }
  // Old-school fallback (works in older WebViews / non-https pages)
  try {
    const ta = document.createElement('textarea');
    ta.value = full;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch (err) {
    return false;
  }
}
