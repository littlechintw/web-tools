import { describe, expect, it } from 'vitest'
import { bmi, bmiCategory, bmr, calorieGoals, healthyWeightRange, imperialToMetric, tdee } from '@/lib/bmi'

describe('bmi', () => {
  it('computes BMI', () => {
    expect(bmi(70, 175)).toBeCloseTo(22.857, 3) // 70 / 1.75^2
    expect(bmi(100, 200)).toBeCloseTo(25, 10)
  })
  it('rejects invalid input', () => {
    expect(bmi(0, 175)).toBeNull()
    expect(bmi(70, 0)).toBeNull()
    expect(bmi(NaN, 170)).toBeNull()
    expect(bmi(-5, 170)).toBeNull()
  })
})

describe('categories', () => {
  it('uses Taiwan HPA boundaries (lower bound inclusive)', () => {
    expect(bmiCategory(18.4, 'tw')).toBe('under')
    expect(bmiCategory(18.5, 'tw')).toBe('normal')
    expect(bmiCategory(23.99, 'tw')).toBe('normal')
    expect(bmiCategory(24, 'tw')).toBe('over')
    expect(bmiCategory(27, 'tw')).toBe('obese1')
    expect(bmiCategory(30, 'tw')).toBe('obese2')
    expect(bmiCategory(35, 'tw')).toBe('obese3')
  })
  it('uses WHO boundaries', () => {
    expect(bmiCategory(24.5, 'who')).toBe('normal')
    expect(bmiCategory(25, 'who')).toBe('over')
    expect(bmiCategory(30, 'who')).toBe('obese1')
    expect(bmiCategory(35, 'who')).toBe('obese2')
    expect(bmiCategory(40, 'who')).toBe('obese3')
  })
})

describe('bmr / tdee', () => {
  it('Mifflin-St Jeor reference values', () => {
    // 10*70 + 6.25*175 - 5*30 + 5
    expect(bmr({ sex: 'male', age: 30, cm: 175, kg: 70 })).toBeCloseTo(1648.75, 6)
    // 10*55 + 6.25*160 - 5*30 - 161
    expect(bmr({ sex: 'female', age: 30, cm: 160, kg: 55 })).toBeCloseTo(1239, 6)
  })
  it('Harris-Benedict (revised) reference values', () => {
    expect(bmr({ sex: 'male', age: 30, cm: 175, kg: 70 }, 'harris')).toBeCloseTo(1695.667, 3)
    // 447.593 + 9.247*55 + 3.098*160 - 4.33*30 = 447.593+508.585+495.68-129.9
    expect(bmr({ sex: 'female', age: 30, cm: 160, kg: 55 }, 'harris')).toBeCloseTo(1321.958, 3)
  })
  it('null on bad input', () => {
    expect(bmr({ sex: 'male', age: 0, cm: 175, kg: 70 })).toBeNull()
    expect(bmr({ sex: 'male', age: 30, cm: NaN, kg: 70 })).toBeNull()
  })
  it('tdee and goals', () => {
    expect(tdee(1600, 1.5)).toBeCloseTo(2400, 10)
    expect(calorieGoals(2000)).toEqual({ lose: 1500, mildLose: 1750, maintain: 2000, gain: 2300 })
  })
})

describe('range and units', () => {
  it('healthy weight range for 175 cm', () => {
    const tw = healthyWeightRange(175, 'tw')!
    expect(tw.min).toBeCloseTo(56.65625, 5)
    expect(tw.max).toBeCloseTo(73.5, 5)
    expect(healthyWeightRange(175, 'who')!.max).toBeCloseTo(76.5625, 5)
    expect(healthyWeightRange(0, 'tw')).toBeNull()
  })
  it('imperial conversion', () => {
    const r = imperialToMetric(5, 10, 154)
    expect(r.cm).toBeCloseTo(177.8, 6) // 70 in * 2.54
    expect(r.kg).toBeCloseTo(69.853, 3)
  })
})
