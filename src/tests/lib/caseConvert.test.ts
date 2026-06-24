import { describe, it, expect } from 'vitest'
import { words, cap, toCases } from '@/lib/caseConvert'

describe('words()', () => {
  it('splits camelCase', () => {
    expect(words('helloWorld')).toEqual(['hello', 'world'])
  })

  it('splits PascalCase', () => {
    expect(words('HelloWorld')).toEqual(['hello', 'world'])
  })

  it('splits kebab-case', () => {
    expect(words('my-variable-name')).toEqual(['my', 'variable', 'name'])
  })

  it('splits snake_case', () => {
    expect(words('my_variable_name')).toEqual(['my', 'variable', 'name'])
  })

  it('splits CONSTANT_CASE', () => {
    expect(words('HTTP_REQUEST')).toEqual(['http', 'request'])
  })

  it('splits consecutive capitals (acronym)', () => {
    expect(words('parseHTMLContent')).toEqual(['parse', 'html', 'content'])
  })

  it('handles spaces', () => {
    expect(words('hello world')).toEqual(['hello', 'world'])
  })

  it('empty string', () => {
    expect(words('')).toEqual([])
  })

  it('single word', () => {
    expect(words('hello')).toEqual(['hello'])
  })

  it('filters empty segments', () => {
    expect(words('--foo--bar--')).toEqual(['foo', 'bar'])
  })
})

describe('cap()', () => {
  it('capitalizes first letter', () => {
    expect(cap('hello')).toBe('Hello')
  })

  it('leaves rest unchanged', () => {
    expect(cap('hELLO')).toBe('HELLO')
  })

  it('empty string', () => {
    expect(cap('')).toBe('')
  })
})

describe('toCases()', () => {
  const result = toCases('hello world')

  const get = (key: string) => result.find((r) => r.key === key)?.value

  it('camelCase', () => {
    expect(get('camelCase')).toBe('helloWorld')
  })

  it('PascalCase', () => {
    expect(get('PascalCase')).toBe('HelloWorld')
  })

  it('snake_case', () => {
    expect(get('snake_case')).toBe('hello_world')
  })

  it('kebab-case', () => {
    expect(get('kebab-case')).toBe('hello-world')
  })

  it('CONSTANT_CASE', () => {
    expect(get('CONSTANT_CASE')).toBe('HELLO_WORLD')
  })

  it('dot.case', () => {
    expect(get('dot.case')).toBe('hello.world')
  })

  it('Title Case', () => {
    expect(get('Title Case')).toBe('Hello World')
  })

  it('lowercase preserves original casing intent', () => {
    const r = toCases('Hello World')
    expect(r.find((x) => x.key === 'lowercase')?.value).toBe('hello world')
  })

  it('UPPERCASE', () => {
    expect(toCases('hello').find((x) => x.key === 'UPPERCASE')?.value).toBe('HELLO')
  })

  it('Sentence case', () => {
    expect(get('Sentence case')).toBe('Hello world')
  })

  it('returns 10 rows', () => {
    expect(result.length).toBe(10)
  })

  it('empty input returns empty values for word-based cases', () => {
    const empty = toCases('')
    expect(empty.find((r) => r.key === 'camelCase')?.value).toBe('')
    expect(empty.find((r) => r.key === 'snake_case')?.value).toBe('')
    expect(empty.find((r) => r.key === 'Sentence case')?.value).toBe('')
  })
})
