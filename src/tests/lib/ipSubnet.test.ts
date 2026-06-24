import { describe, it, expect } from 'vitest'
import { parseIp, intToIp, ipClass, calcSubnet } from '@/lib/ipSubnet'

describe('parseIp()', () => {
  it('parses valid IPs', () => {
    expect(parseIp('0.0.0.0')).toBe(0)
    expect(parseIp('255.255.255.255')).toBe(0xffffffff)
    expect(parseIp('192.168.1.1')).toBe((192 << 24 | 168 << 16 | 1 << 8 | 1) >>> 0)
  })

  it('returns null for invalid IPs', () => {
    expect(parseIp('256.0.0.0')).toBeNull()
    expect(parseIp('192.168.1')).toBeNull()
    expect(parseIp('192.168.1.1.1')).toBeNull()
    expect(parseIp('abc.def.ghi.jkl')).toBeNull()
    expect(parseIp('')).toBeNull()
  })

  it('trims whitespace', () => {
    expect(parseIp('  10.0.0.1  ')).toBe((10 << 24 | 1) >>> 0)
  })
})

describe('intToIp()', () => {
  it('converts back correctly', () => {
    expect(intToIp(0)).toBe('0.0.0.0')
    expect(intToIp(0xffffffff)).toBe('255.255.255.255')
    expect(intToIp((192 << 24 | 168 << 16 | 1 << 8 | 10) >>> 0)).toBe('192.168.1.10')
  })

  it('round-trips with parseIp', () => {
    const ips = ['10.0.0.1', '172.16.0.1', '192.168.100.254', '8.8.8.8']
    for (const ip of ips) {
      expect(intToIp(parseIp(ip)!)).toBe(ip)
    }
  })
})

describe('ipClass()', () => {
  it('class A: 0-127', () => {
    expect(ipClass(0)).toBe('A')
    expect(ipClass(10)).toBe('A')
    expect(ipClass(127)).toBe('A')
  })

  it('class B: 128-191', () => {
    expect(ipClass(128)).toBe('B')
    expect(ipClass(172)).toBe('B')
    expect(ipClass(191)).toBe('B')
  })

  it('class C: 192-223', () => {
    expect(ipClass(192)).toBe('C')
    expect(ipClass(203)).toBe('C')
    expect(ipClass(223)).toBe('C')
  })

  it('class D: 224-239', () => {
    expect(ipClass(224)).toBe('D (multicast)')
    expect(ipClass(239)).toBe('D (multicast)')
  })

  it('class E: 240-255', () => {
    expect(ipClass(240)).toBe('E (reserved)')
    expect(ipClass(255)).toBe('E (reserved)')
  })
})

describe('calcSubnet()', () => {
  it('192.168.1.10/24', () => {
    const r = calcSubnet('192.168.1.10', 24)
    expect(r).not.toBeNull()
    expect(r!.network).toBe('192.168.1.0')
    expect(r!.broadcast).toBe('192.168.1.255')
    expect(r!.netmask).toBe('255.255.255.0')
    expect(r!.wildcard).toBe('0.0.0.255')
    expect(r!.firstHost).toBe('192.168.1.1')
    expect(r!.lastHost).toBe('192.168.1.254')
    expect(r!.totalHosts).toBe(256)
    expect(r!.usableHosts).toBe(254)
    expect(r!.ipClass).toBe('C')
  })

  it('10.0.0.0/8', () => {
    const r = calcSubnet('10.0.0.0', 8)
    expect(r!.network).toBe('10.0.0.0')
    expect(r!.broadcast).toBe('10.255.255.255')
    expect(r!.totalHosts).toBe(16777216)
    expect(r!.usableHosts).toBe(16777214)
    expect(r!.ipClass).toBe('A')
  })

  it('/32 single host', () => {
    const r = calcSubnet('192.168.1.1', 32)
    expect(r!.network).toBe('192.168.1.1')
    expect(r!.broadcast).toBe('192.168.1.1')
    expect(r!.totalHosts).toBe(1)
    expect(r!.usableHosts).toBe(1)
  })

  it('/31 point-to-point', () => {
    const r = calcSubnet('10.0.0.0', 31)
    expect(r!.totalHosts).toBe(2)
    expect(r!.usableHosts).toBe(2)
  })

  it('/0 default route', () => {
    const r = calcSubnet('0.0.0.0', 0)
    expect(r!.network).toBe('0.0.0.0')
    expect(r!.broadcast).toBe('255.255.255.255')
    expect(r!.netmask).toBe('0.0.0.0')
    expect(r!.totalHosts).toBe(4294967296)
  })

  it('returns null for invalid IP', () => {
    expect(calcSubnet('999.0.0.0', 24)).toBeNull()
    expect(calcSubnet('not-an-ip', 24)).toBeNull()
  })

  it('returns null for invalid prefix', () => {
    expect(calcSubnet('192.168.1.1', 33)).toBeNull()
    expect(calcSubnet('192.168.1.1', -1)).toBeNull()
  })
})
