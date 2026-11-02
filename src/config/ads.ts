/**
 * Google AdSense configuration. Modelled on the toilets project
 * (littlechintw/where-toilets): quiet, fixed-size, bottom-of-page, non-personalised.
 *
 * Rules:
 *  - Manual slots only, on pages that never touch user data (home, settings).
 *    No Auto ads — anchor / vignette / side-rail ads overlay the screen and
 *    must be switched OFF for this site in the AdSense console.
 *  - Never on a tool page. The ad script runs with full access to the page it
 *    is loaded in, so once it has loaded, leaving an ad page does a FULL page
 *    load (see shouldReloadForAds) which discards it before any tool opens.
 *  - If ADSENSE_CLIENT or the slot id is empty, nothing loads and nothing renders.
 *
 * To enable (needs the AdSense console — not something the code can do):
 *  1. Add tools.littlechin.tw as a site and get it approved; turn Auto ads off for it.
 *  2. Create two display ad units (home-bottom, settings-bottom) and paste their
 *     data-ad-slot numbers into AD_SLOTS below.
 *  3. Confirm public/ads.txt carries the same pub-… id as ADSENSE_CLIENT.
 *  4. "Privacy & messaging › European regulations": turn on Google's GDPR message
 *     (only EEA/UK visitors see it).
 */

/** Publisher id (code needs the ca- prefix; the console shows pub-…). Empty = no ads site-wide. */
export const ADSENSE_CLIENT = 'ca-pub-5042600791806925'

/** data-ad-slot per placement. Empty = that placement renders nothing. */
export const AD_SLOTS = {
  home: '', // home-bottom — create the unit in AdSense, then paste its id here
  settings: '', // settings-bottom
} as const

export const adsEnabled = (slot: string): boolean => Boolean(ADSENSE_CLIENT && slot)

/** Route names that may show ads. Everything else must never run with the ad script loaded. */
export const AD_ROUTE_NAMES: ReadonlySet<string> = new Set(['home', 'settings'])

/**
 * After the ad script has loaded, any navigation to a page outside AD_ROUTE_NAMES
 * must be a full page load so the script is dropped. Pure so it can be tested.
 */
export function shouldReloadForAds(adScriptLoaded: boolean, toRouteName: unknown): boolean {
  return adScriptLoaded && !(typeof toRouteName === 'string' && AD_ROUTE_NAMES.has(toRouteName))
}
