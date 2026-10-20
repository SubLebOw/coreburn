// ===========================================================================
//  ads-config.js  -  THE ONE PLACE FOR ALL ADMOB IDS
// ===========================================================================
//  Right now these are GOOGLE'S OFFICIAL TEST IDS. They always show "Test Ad"
//  banners and never pay out, so they are safe to use while developing.
//
//  When Caleb's AdMob account is ready:
//    1. Create an Android app in AdMob, plus one Interstitial and one Rewarded ad unit.
//    2. Paste the real IDs below and set testMode to false.
//    3. Rebuild the Android app (the App ID is read from this file at build time by
//       android/app/build.gradle, so a store update is needed when it changes).
//  Never click your own real ads - Google can ban the account for that.
//  On the plain website (GitHub Pages) ads are switched off automatically.
// ===========================================================================

export const ADS_CONFIG = {
  enabled: true,
  testMode: true, // TODO(Caleb): set to false only after pasting your real IDs

  // TODO(Caleb): replace with your real AdMob App ID (format ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY)
  ADMOB_APP_ID_ANDROID: 'ca-app-pub-3940256099942544~3347511713',

  // TODO(Caleb): replace with your real ad unit IDs (format ca-app-pub-XXXXXXXXXXXXXXXX/ZZZZZZZZZZ)
  INTERSTITIAL_ID_ANDROID: 'ca-app-pub-3940256099942544/1033173712',
  REWARDED_ID_ANDROID: 'ca-app-pub-3940256099942544/5224354917',

  // Put your own phone's test device ID here so you always see test ads on it
  // (AdMob prints it in Android Logcat the first time an ad loads).
  testDeviceIds: [],

  // Ad frequency rules
  interstitialEveryNDeaths: 3,    // show an interstitial at most on every 3rd game over
  minSecondsBetweenInterstitials: 120,
};
