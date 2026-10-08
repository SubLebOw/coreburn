// ads.js
// Ads, Android app only (on the website every function here does nothing).
//
// Where ads appear (kept deliberately light so the game stays fun):
//   * Interstitial: only between runs, when you press "Play again" on the game over
//     screen, at most every 3rd game over and at most once every 2 minutes.
//     Never during a fight.
//   * Rewarded (optional): on the game over screen a "Revive" button lets you watch
//     an ad to come back once per run with half health. You never have to.
//
// All IDs live in ads-config.js (currently Google's official TEST IDs).
import { ADS_CONFIG } from './ads-config.js';
import { getPlugin } from './native.js';

const AdMob = ADS_CONFIG.enabled ? getPlugin('AdMob') : null;

// Wait for one of several plugin events (or give up after `timeoutMs`)
function waitForEvent(names, timeoutMs) {
  return new Promise((resolve) => {
    const handles = [];
    let done = false;
    const finish = (name, info) => {
      if (done) return;
      done = true;
      handles.forEach((h) => h.then((x) => x.remove()).catch(() => {}));
      resolve({ name, info });
    };
    for (const n of names) handles.push(Promise.resolve(AdMob.addListener(n, (info) => finish(n, info))));
    setTimeout(() => finish('timeout'), timeoutMs);
  });
}

export const ads = {
  available: false,       // true once the AdMob SDK is ready (Android app only)
  canRequestAds: true,    // set by the consent check
  interstitialReady: false,
  rewardedReady: false,
  deaths: 0,
  lastInterstitialAt: 0,
  showingAd: false,

  async init() {
    if (!AdMob) return;
    try {
      await AdMob.initialize({
        initializeForTesting: ADS_CONFIG.testMode,
        testingDevices: ADS_CONFIG.testDeviceIds,
      });
      await this.checkConsent();
      if (!this.canRequestAds) return;
      this.available = true;
      this.loadInterstitial();
      this.loadRewarded();
    } catch (err) {
      console.warn('[ads] init failed', err);
    }
  },

  // ---------- Consent (Google UMP) ----------
  // In the EEA/UK (and some US states) Google requires asking for consent before
  // showing personalised ads. The consent form itself is designed in the AdMob
  // dashboard (Privacy & messaging). This hook asks Google whether a form is needed
  // and shows it if so. With the test IDs there is usually no form, which is fine.
  async checkConsent() {
    try {
      const info = await AdMob.requestConsentInfo({
        // debugGeography: 1, // uncomment to test the EEA consent form on your own phone
        testDeviceIdentifiers: ADS_CONFIG.testDeviceIds,
      });
      let status = info;
      if (info.isConsentFormAvailable && info.status === 'REQUIRED') status = await AdMob.showConsentForm();
      this.canRequestAds = status.canRequestAds !== false;
      this.privacyOptionsRequired = info.privacyOptionsRequirementStatus === 'REQUIRED';
    } catch (err) {
      console.warn('[ads] consent check skipped', err);
      this.canRequestAds = true; // no consent form configured yet (normal with test IDs)
    }
  },

  // Lets players change their consent later (Google requires this entry point when
  // privacyOptionsRequired is true). main.js shows a button for it on the title screen.
  async showPrivacyOptions() {
    if (!AdMob) return;
    try { await AdMob.showPrivacyOptionsForm(); } catch (err) { console.warn('[ads] privacy options', err); }
  },

  // ---------- Interstitial ----------
  async loadInterstitial() {
    try {
      await AdMob.prepareInterstitial({ adId: ADS_CONFIG.INTERSTITIAL_ID_ANDROID, isTesting: ADS_CONFIG.testMode });
      this.interstitialReady = true;
    } catch (err) {
      this.interstitialReady = false;
      console.warn('[ads] interstitial load failed', err);
    }
  },

  onGameOver() { this.deaths++; },

  // Called when the player presses "Play again". Resolves after the ad is closed
  // (or straight away if no ad is due).
  async maybeShowInterstitial() {
    const n = ADS_CONFIG.interstitialEveryNDeaths;
    const cooledDown = Date.now() - this.lastInterstitialAt > ADS_CONFIG.minSecondsBetweenInterstitials * 1000;
    if (!this.available || !this.interstitialReady || this.deaths % n !== 0 || !cooledDown) return;
    this.showingAd = true;
    this.interstitialReady = false;
    try {
      const closed = waitForEvent(['interstitialAdDismissed', 'interstitialAdFailedToShow'], 60000);
      await AdMob.showInterstitial();
      await closed;
      this.lastInterstitialAt = Date.now();
    } catch (err) {
      console.warn('[ads] interstitial show failed', err);
    } finally {
      this.showingAd = false;
      this.loadInterstitial(); // get the next one ready
    }
  },

  // ---------- Rewarded (revive) ----------
  async loadRewarded() {
    try {
      await AdMob.prepareRewardVideoAd({ adId: ADS_CONFIG.REWARDED_ID_ANDROID, isTesting: ADS_CONFIG.testMode });
      this.rewardedReady = true;
    } catch (err) {
      this.rewardedReady = false;
      console.warn('[ads] rewarded load failed', err);
    }
  },

  get canRevive() { return this.available && this.rewardedReady; },

  // Shows the rewarded ad. Resolves true only if the player watched it to the end.
  async showRewarded() {
    if (!this.canRevive) return false;
    this.showingAd = true;
    this.rewardedReady = false;
    let rewarded = false;
    try {
      const rewardHandle = await AdMob.addListener('onRewardedVideoAdReward', () => { rewarded = true; });
      const closed = waitForEvent(['onRewardedVideoAdDismissed', 'onRewardedVideoAdFailedToShow'], 120000);
      await AdMob.showRewardVideoAd();
      await closed;
      rewardHandle.remove();
    } catch (err) {
      console.warn('[ads] rewarded show failed', err);
    } finally {
      this.showingAd = false;
      this.loadRewarded();
    }
    return rewarded;
  },
};
