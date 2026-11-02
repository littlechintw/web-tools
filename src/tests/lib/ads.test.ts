import { describe, it, expect } from 'vitest'
import { AD_ROUTE_NAMES, AD_SLOTS, ADSENSE_CLIENT, adsEnabled, shouldReloadForAds } from '@/config/ads'

describe('ad policy', () => {
  it('only home and settings may show ads', () => {
    expect([...AD_ROUTE_NAMES].sort()).toEqual(['home', 'settings'])
  })

  it('never forces a reload before the ad script has loaded', () => {
    expect(shouldReloadForAds(false, 'tool-base64')).toBe(false)
    expect(shouldReloadForAds(false, 'home')).toBe(false)
  })

  it('keeps ad pages in the SPA once the script has loaded', () => {
    expect(shouldReloadForAds(true, 'home')).toBe(false)
    expect(shouldReloadForAds(true, 'settings')).toBe(false)
  })

  it('forces a full page load for every other page once the script has loaded', () => {
    for (const name of ['tool-base64', 'tool-totp', 'tool-twqr-generate', 'history', 'privacy', 'not-found']) {
      expect(shouldReloadForAds(true, name), name).toBe(true)
    }
    // an unnamed / unknown destination is treated as "not an ad page"
    expect(shouldReloadForAds(true, undefined)).toBe(true)
    expect(shouldReloadForAds(true, Symbol('x'))).toBe(true)
  })

  it('an ad slot needs both the publisher id and a slot id', () => {
    expect(adsEnabled('')).toBe(false)
    if (ADSENSE_CLIENT) expect(adsEnabled('123')).toBe(true)
  })

  it('slot keys match the allowed route names', () => {
    for (const key of Object.keys(AD_SLOTS)) expect(AD_ROUTE_NAMES.has(key), key).toBe(true)
  })
})
