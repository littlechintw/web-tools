import { describe, it, expect } from 'vitest'
import { maskName } from '@/lib/lottery'

describe('maskName()', () => {
  describe('middle masking', () => {
    it('3-char name, mask 1 from middle', () => {
      expect(maskName('張三丰', 'middle', 1, '*')).toBe('張*丰')
    })

    it('4-char name, mask 2 from middle', () => {
      expect(maskName('John', 'middle', 2, '*')).toBe('J**n')
    })

    it('5-char name, mask 1 from middle', () => {
      expect(maskName('abcde', 'middle', 1, '*')).toBe('ab*de')
    })

    it('2-char name, mask 1 — only one char can be masked', () => {
      expect(maskName('AB', 'middle', 1, '*')).toBe('*B')
    })

    it('custom mask char', () => {
      expect(maskName('張三丰', 'middle', 1, '#')).toBe('張#丰')
    })

    it('mask count capped at length-1', () => {
      // 3 chars, requesting 5 masks → safe = min(5, 2) = 2, start = floor((3-2)/2) = 0
      expect(maskName('abc', 'middle', 5, '*')).toBe('**c')
    })
  })

  describe('sides masking', () => {
    it('3-char name, mask 2 from sides', () => {
      expect(maskName('張三丰', 'sides', 2, '*')).toBe('*三*')
    })

    it('4-char name, mask 2 from sides', () => {
      // left=1, right=1
      expect(maskName('abcd', 'sides', 2, '*')).toBe('*bc*')
    })

    it('4-char name, mask 1 from sides — biases right', () => {
      // left=0, right=1 (floor(1/2)=0, right=1-0=1)
      expect(maskName('abcd', 'sides', 1, '*')).toBe('abc*')
    })

    it('5-char name, mask 3 from sides', () => {
      // left=1, right=2
      expect(maskName('abcde', 'sides', 3, '*')).toBe('*bc**')
    })
  })

  describe('edge cases', () => {
    it('single char always returns mask char', () => {
      expect(maskName('A', 'middle', 1, '*')).toBe('*')
      expect(maskName('A', 'sides', 1, '*')).toBe('*')
    })

    it('mask count = 0 returns original', () => {
      expect(maskName('hello', 'middle', 0, '*')).toBe('hello')
    })

    it('multi-char mask character — uses full string per slot', () => {
      // char = '**', repeat(1) = '**'
      expect(maskName('abc', 'middle', 1, '**')).toBe('a**c')
    })
  })
})
