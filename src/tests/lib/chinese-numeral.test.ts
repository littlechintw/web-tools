import { describe, it, expect } from 'vitest'
import { normalizeAmount, parseChinese, toChineseUpper } from '@/lib/chinese-numeral'

describe('toChineseUpper', () => {
  const cases: [string, string][] = [
    ['0', '零元整'],
    ['1', '壹元整'],
    ['10', '壹拾元整'],
    ['11', '壹拾壹元整'],
    ['100', '壹佰元整'],
    ['101', '壹佰零壹元整'],
    ['110', '壹佰壹拾元整'],
    ['1001', '壹仟零壹元整'],
    ['1010', '壹仟零壹拾元整'],
    ['10000', '壹萬元整'],
    ['10001', '壹萬零壹元整'],
    ['10100', '壹萬零壹佰元整'],
    ['100000', '壹拾萬元整'],
    ['100005', '壹拾萬零伍元整'],
    ['123456', '壹拾貳萬參仟肆佰伍拾陸元整'],
    ['1000000', '壹佰萬元整'],
    ['1000001', '壹佰萬零壹元整'],
    ['1020000', '壹佰零貳萬元整'],
    ['10000000', '壹仟萬元整'],
    ['100000000', '壹億元整'],
    ['100010000', '壹億零壹萬元整'],
    ['100000005', '壹億零伍元整'],
    ['120000000', '壹億貳仟萬元整'],
    ['102000000', '壹億零貳佰萬元整'],
    ['1000000000000', '壹兆元整'],
    ['1000100000000', '壹兆零壹億元整'],
    ['9999999999999999', '玖仟玖佰玖拾玖兆玖仟玖佰玖拾玖億玖仟玖佰玖拾玖萬玖仟玖佰玖拾玖元整'],
    ['1234567890', '壹拾貳億參仟肆佰伍拾陸萬柒仟捌佰玖拾元整'],
  ]
  for (const [n, want] of cases) it(`${n} -> ${want}`, () => expect(toChineseUpper(n)).toBe(want))

  it('handles decimals', () => {
    expect(toChineseUpper('0.5')).toBe('伍角整')
    expect(toChineseUpper('0.05')).toBe('伍分')
    expect(toChineseUpper('0.56')).toBe('伍角陸分')
    expect(toChineseUpper('1.5')).toBe('壹元伍角整')
    expect(toChineseUpper('1.05')).toBe('壹元零伍分')
    expect(toChineseUpper('12.34')).toBe('壹拾貳元參角肆分')
    expect(toChineseUpper('100.00')).toBe('壹佰元整')
  })
  it('rounds half up beyond cents, including carry', () => {
    expect(toChineseUpper('1.005')).toBe('壹元零壹分')
    expect(toChineseUpper('1.004')).toBe('壹元整')
    expect(toChineseUpper('0.999')).toBe('壹元整')
    expect(toChineseUpper('0.004')).toBe('零元整')
  })
  it('supports prefix and 圓', () => {
    expect(toChineseUpper('123456', { twd: true })).toBe('新台幣壹拾貳萬參仟肆佰伍拾陸元整')
    expect(toChineseUpper('5', { unit: '圓' })).toBe('伍圓整')
    expect(toChineseUpper('0', { twd: true })).toBe('新台幣零元整')
  })
  it('accepts commas, symbols and rejects junk', () => {
    expect(toChineseUpper('1,234')).toBe('壹仟貳佰參拾肆元整')
    expect(toChineseUpper('NT$ 10')).toBe('壹拾元整')
    expect(toChineseUpper('00012')).toBe('壹拾貳元整')
    expect(toChineseUpper('.5')).toBe('伍角整')
    for (const bad of ['', 'abc', '-5', '1e5', '1.2.3', '.', '12345678901234567']) expect(toChineseUpper(bad)).toBeNull()
  })
})

describe('normalizeAmount', () => {
  it('keeps big values exact as strings', () => {
    expect(normalizeAmount('9007199254740993')).toEqual({ int: '9007199254740993', frac: '00' })
  })
})

describe('parseChinese', () => {
  it('parses uppercase and lowercase numerals', () => {
    expect(parseChinese('壹拾貳萬參仟肆佰伍拾陸元整')).toBe('123456')
    expect(parseChinese('新台幣壹拾萬零伍元整')).toBe('100005')
    expect(parseChinese('一百二十三')).toBe('123')
    expect(parseChinese('十')).toBe('10')
    expect(parseChinese('十五')).toBe('15')
    expect(parseChinese('一億零五')).toBe('100000005')
    expect(parseChinese('三萬五千')).toBe('35000')
    expect(parseChinese('兩千')).toBe('2000')
    expect(parseChinese('零')).toBe('0')
    expect(parseChinese('二〇二四')).toBe('2024')
    expect(parseChinese('壹兆零壹億元整')).toBe('1000100000000')
  })
  it('parses decimals', () => {
    expect(parseChinese('三點一四')).toBe('3.14')
    expect(parseChinese('壹元伍角整')).toBe('1.5')
    expect(parseChinese('壹元零伍分')).toBe('1.05')
    expect(parseChinese('伍角陸分')).toBe('0.56')
    expect(parseChinese('伍分')).toBe('0.05')
    expect(parseChinese('壹拾貳元參角肆分')).toBe('12.34')
  })
  it('round-trips with toChineseUpper', () => {
    for (const n of ['0', '1', '10', '100005', '1000000', '100000000', '123456789012', '9999999999999999', '12.34', '1.05', '0.5', '0.05']) {
      const up = toChineseUpper(n)!
      expect(parseChinese(up)).toBe(n === '0' ? '0' : n)
    }
  })
  it('rejects nonsense', () => {
    for (const bad of ['', 'abc', '壹佰壹佰', '萬', '三萬億五億', '十百', '壹元零', '角', '點', '三點']) expect(parseChinese(bad)).toBeNull()
  })
})
