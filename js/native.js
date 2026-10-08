// native.js
// Tiny helper to talk to Android-only features (ads, live updates) through Capacitor.
// In a normal web browser there is no Capacitor, so everything here returns null and
// the game simply skips those features.

const Cap = window.Capacitor;

// true only inside the Android app
export const IS_NATIVE = !!(Cap && typeof Cap.isNativePlatform === 'function' && Cap.isNativePlatform());

// Get a native plugin by name, e.g. getPlugin('AdMob'). Returns null on the web.
export function getPlugin(name) {
  if (!IS_NATIVE) return null;
  try {
    return (Cap.Plugins && Cap.Plugins[name]) || (Cap.registerPlugin ? Cap.registerPlugin(name) : null);
  } catch (err) {
    return null;
  }
}
