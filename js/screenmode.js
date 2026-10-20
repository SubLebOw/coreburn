// fullscreen.js (v1.29.1): small fullscreen toggle on the menu, pause menu and MORE section.
import { IS_NATIVE } from './native.js?v=1.30.1';

const d = document, el = d.documentElement;
const fsEl = () => d.fullscreenElement || d.webkitFullscreenElement || null;
const supported = () => !IS_NATIVE && !!(d.fullscreenEnabled || d.webkitFullscreenEnabled) && !!(el.requestFullscreen || el.webkitRequestFullscreen);
const ICON_ON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';
const ICON_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>';

function toggle() {
  try {
    if (fsEl()) (d.exitFullscreen || d.webkitExitFullscreen).call(d)?.catch?.(() => {});
    else (el.requestFullscreen || el.webkitRequestFullscreen).call(el, { navigationUI: 'hide' })?.catch?.(() => {});
  } catch (e) { /* ignore */ }
}
function refresh() {
  const on = !!fsEl();
  d.querySelectorAll('.fs-btn').forEach((b) => {
    b.querySelector('.fs-ico').innerHTML = on ? ICON_OFF : ICON_ON;
    b.querySelector('.fs-lbl').textContent = on ? 'EXIT FULLSCREEN' : 'FULLSCREEN';
    b.setAttribute('aria-pressed', String(on));
    b.title = on ? 'Exit fullscreen' : 'Fullscreen';
  });
}
export function initFullscreen() {
  if (!supported()) return; // iPhone Safari / Android app: buttons stay hidden
  d.querySelectorAll('.fs-btn').forEach((b) => {
    b.classList.remove('hidden');
    b.addEventListener('pointerdown', (e) => e.stopPropagation());
    b.addEventListener('click', (e) => { e.stopPropagation(); toggle(); });
  });
  d.addEventListener('fullscreenchange', refresh);
  d.addEventListener('webkitfullscreenchange', refresh);
  refresh();
}
initFullscreen();
