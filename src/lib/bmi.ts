/** BMI / BMR / TDEE maths. Pure and framework-free. General information only. */

export type Sex = 'male' | 'female'
export type BmiStandard = 'tw' | 'who'
export type BmiCategory = 'under' | 'normal' | 'over' | 'obese1' | 'obese2' | 'obese3'
export type BmrFormula = 'mifflin' | 'harris'

export const LB_TO_KG = 0.45359237
export const IN_TO_CM = 2.54

/** Upper bound (exclusive) of each category, in BMI units. */
export const BMI_BOUNDS: Record<BmiStandard, readonly [BmiCategory, number][]> = {
  // Taiwan Health Promotion Administration (adults)
  tw: [['under', 18.5], ['normal', 24], ['over', 27], ['obese1', 30], ['obese2', 35], ['obese3', Infinity]],
  // WHO
  who: [['under', 18.5], ['normal', 25], ['over', 30], ['obese1', 35], ['obese2', 40], ['obese3', Infinity]],
}

export const ACTIVITY_LEVELS = [1.2, 1.375, 1.55, 1.725, 1.9] as const

export function imperialToMetric(feet: number, inches: number, pounds: number): { cm: number; kg: number } {
  return { cm: (feet * 12 + inches) * IN_TO_CM, kg: pounds * LB_TO_KG }
}

export function bmi(kg: number, cm: number): number | null {
  if (!(kg > 0) || !(cm > 0) || !Number.isFinite(kg) || !Number.isFinite(cm)) return null
  const m = cm / 100
  return kg / (m * m)
}

export function bmiCategory(value: number, standard: BmiStandard): BmiCategory {
  for (const [cat, upper] of BMI_BOUNDS[standard]) if (value < upper) return cat
  return 'obese3'
}

/** Healthy-weight range [kg] for a height: BMI 18.5 up to the top of "normal". */
export function healthyWeightRange(cm: number, standard: BmiStandard): { min: number; max: number } | null {
  if (!(cm > 0) || !Number.isFinite(cm)) return null
  const m2 = (cm / 100) ** 2
  return { min: 18.5 * m2, max: BMI_BOUNDS[standard][1][1] * m2 }
}

export interface Body {
  sex: Sex
  age: number
  cm: number
  kg: number
}

/** Basal metabolic rate in kcal/day. Mifflin-St Jeor (1990) or revised Harris-Benedict (1984). */
export function bmr(b: Body, formula: BmrFormula = 'mifflin'): number | null {
  if (![b.age, b.cm, b.kg].every((n) => Number.isFinite(n) && n > 0)) return null
  if (formula === 'harris') {
    return b.sex === 'male'
      ? 88.362 + 13.397 * b.kg + 4.799 * b.cm - 5.677 * b.age
      : 447.593 + 9.247 * b.kg + 3.098 * b.cm - 4.33 * b.age
  }
  return 10 * b.kg + 6.25 * b.cm - 5 * b.age + (b.sex === 'male' ? 5 : -161)
}

export function tdee(bmrKcal: number, activity: number): number {
  return bmrKcal * activity
}

/** Daily calorie targets: lose ~0.5 kg/week (-500), mild loss (-250), maintain, gain (+300). */
export function calorieGoals(tdeeKcal: number) {
  return { lose: tdeeKcal - 500, mildLose: tdeeKcal - 250, maintain: tdeeKcal, gain: tdeeKcal + 300 }
}
