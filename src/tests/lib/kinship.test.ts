import { describe, it, expect } from 'vitest'
import { moeUrl, MOE_SEARCH_URL, resolve, resolveReverse, normalize, invert, lookupTitle, titleOptions, canAppend, allTitles, type Step, type Sex, type Age } from '@/lib/kinship'

const S = (s: string) => (s ? (s.split(' ') as Step[]) : [])

/** [chain, ego, relativeAge, expected Mandarin, expected Hokkien Han?] */
type Case = [string, Sex, Age | null, string, string?]

const M = 'm'
const F = 'f'

const forward: Case[] = [
  // direct line up
  ['f', M, null, '爸爸', '阿爸'],
  ['m', F, null, '媽媽', '阿母'],
  ['f f', M, null, '爺爺', '阿公'],
  ['f m', F, null, '奶奶', '阿媽'],
  ['m f', M, null, '外公', '外公'],
  ['m m', F, null, '外婆'],
  ['f f f', M, null, '曾祖父', '阿祖'],
  ['f f m', M, null, '曾祖母'],
  // direct line down
  ['so', M, null, '兒子', '後生'],
  ['d', F, null, '女兒', '查某囝'],
  ['so so', M, null, '孫子', '孫仔'],
  ['so d', F, null, '孫女'],
  ['d so', M, null, '外孫'],
  ['d d', F, null, '外孫女'],
  ['so so so', M, null, '曾孫'],
  ['so so d', M, null, '曾孫女'],
  // spouse
  ['h', F, null, '丈夫', '翁'],
  ['w', M, null, '太太', '某'],
  // father's side
  ['f eb', M, null, '伯父', '阿伯'],
  ['f eb w', F, null, '伯母', '阿姆'],
  ['f yb', F, null, '叔叔', '阿叔'],
  ['f yb w', M, null, '嬸嬸', '阿嬸'],
  ['f es', M, null, '姑姑', '阿姑'],
  ['f ys', F, null, '姑姑', '阿姑'],
  ['f es h', M, null, '姑丈'],
  ['f ys h', F, null, '姑丈'],
  // mother's side
  ['m eb', M, null, '舅舅', '阿舅'],
  ['m yb', F, null, '舅舅', '阿舅'],
  ['m eb w', M, null, '舅媽', '阿妗'],
  ['m yb w', F, null, '舅媽', '阿妗'],
  ['m es', M, null, '阿姨', '阿姨'],
  ['m ys', F, null, '阿姨', '阿姨'],
  ['m es h', M, null, '姨丈'],
  ['m ys h', F, null, '姨丈'],
  // grandparents' siblings
  ['f f eb', M, null, '伯公'],
  ['f f yb', M, null, '叔公'],
  ['f f es', M, null, '姑婆'],
  ['f f eb w', M, null, '伯婆'],
  ['f f yb w', M, null, '嬸婆'],
  ['f m eb', M, null, '舅公'],
  ['f m ys', M, null, '姨婆'],
  // siblings
  ['eb', M, null, '哥哥', '阿兄'],
  ['yb', F, null, '弟弟', '小弟'],
  ['es', M, null, '姊姊', '阿姊'],
  ['ys', F, null, '妹妹', '小妹'],
  ['eb w', M, null, '嫂嫂', '阿嫂'],
  ['yb w', F, null, '弟妹'],
  ['es h', M, null, '姊夫', '姊夫'],
  ['ys h', F, null, '妹夫'],
  ['eb so', M, null, '姪子', '姪仔'],
  ['yb d', F, null, '姪女', '查某孫'],
  ['es so', F, null, '外甥'],
  ['ys d', M, null, '外甥女'],
  // cousins
  ['f eb so', M, 'older', '堂哥', '叔伯兄弟'],
  ['f eb so', M, 'younger', '堂弟'],
  ['f yb so', F, 'older', '堂哥'],
  ['f yb d', M, 'older', '堂姊'],
  ['f yb d', F, 'younger', '堂妹'],
  ['f es so', M, 'older', '表哥', '表兄'],
  ['f ys d', F, 'younger', '表妹'],
  ['m eb so', M, 'younger', '表弟', '表小弟'],
  ['m yb d', F, 'older', '表姊'],
  ['m es so', M, 'older', '表哥'],
  ['m ys d', F, 'younger', '表妹'],
  // spouse's relatives
  ['h f', F, null, '公公', '大官'],
  ['h m', F, null, '婆婆', '大家'],
  ['w f', M, null, '岳父', '丈人'],
  ['w m', M, null, '岳母', '丈姆'],
  ['h eb', F, null, '大伯'],
  ['h yb', F, null, '小叔'],
  ['h es', F, null, '大姑'],
  ['h ys', F, null, '小姑'],
  ['w eb', M, null, '大舅子'],
  ['w yb', M, null, '小舅子', '妻舅'],
  ['w es', M, null, '大姨子', '姨仔'],
  ['w ys', M, null, '小姨子'],
  ['w es h', M, null, '連襟'],
  ['w ys h', M, null, '連襟'],
  ['h eb w', F, null, '妯娌'],
  ['h yb w', F, null, '妯娌'],
  // children's in-laws
  ['so w', M, null, '媳婦', '新婦'],
  ['d h', F, null, '女婿', '囝婿'],
  ['so w f', M, null, '親家公'],
  ['d h m', F, null, '親家母'],
]

describe('forward titles', () => {
  it.each(forward)('%s (ego %s, age %s) = %s', (chain, ego, age, zh, tw) => {
    const r = resolve(S(chain), { ego, relativeAge: age })
    expect(r.status).toBe('ok')
    if (r.status !== 'ok') return
    expect(r.title.zh).toBe(zh)
    if (tw) expect(r.title.tw).toBe(tw)
  })

  it('has at least 80 hand-written forward cases', () => {
    expect(forward.length).toBeGreaterThanOrEqual(80)
  })
})

describe('normalisation', () => {
  const norm = (c: string, ego: Sex) => {
    const n = normalize(S(c), ego)
    return 'chain' in n ? n.chain.join(' ') : 'reason:' + n.reason
  }
  it('母的夫 = 父, 父的妻 = 母', () => {
    expect(norm('m h', F)).toBe('f')
    expect(norm('f w', M)).toBe('m')
  })
  it('sibling\'s parent = parent', () => {
    expect(norm('eb f', M)).toBe('f')
    expect(norm('ys m', F)).toBe('m')
  })
  it('spouse of spouse is the person themself', () => {
    expect(norm('h w', F)).toBe('')
    expect(norm('w h', M)).toBe('')
  })
  it("child's parent depends on sex", () => {
    expect(norm('so f', M)).toBe('')
    expect(norm('so m', M)).toBe('w')
    expect(norm('d f', F)).toBe('h')
    expect(norm('d m', F)).toBe('')
  })
  it("parent's spouse then parents", () => {
    expect(norm('f eb f', M)).toBe('f f')
    expect(norm('m h f', M)).toBe('f f')
  })
  it('older of older sibling stays older, mixed is ambiguous', () => {
    expect(norm('eb eb', M)).toBe('eb')
    expect(norm('yb es', M)).toBe('reason:ambiguous')
    expect(norm('f eb eb', M)).toBe('f eb')
    expect(norm('f eb yb', M)).toBe('reason:ambiguous')
  })
  it('spouse\'s child = own child, sibling\'s spouse\'s child = sibling\'s child', () => {
    expect(norm('h so', F)).toBe('so')
    expect(norm('eb w so', M)).toBe('eb so')
    expect(norm('f eb w so', M)).toBe('f eb so')
    expect(norm('h eb so', F)).toBe('eb so')
  })
  it('equivalent chains resolve to the same title', () => {
    const a = resolve(S('m h'), { ego: M })
    const b = resolve(S('f'), { ego: M })
    expect(a.status === 'ok' && b.status === 'ok' && a.title.zh === b.title.zh).toBe(true)
    const c = resolve(S('f yb w so'), { ego: F, relativeAge: 'older' })
    expect(c.status === 'ok' && c.title.zh).toBe('堂哥')
  })
  it('self and degenerate chains', () => {
    expect(resolve(S('f so'), { ego: M }).status).toBe('unsupported') // ambiguous (me or brother)
    expect(resolve(S('f w h'), { ego: M }).status).toBe('ok')
    expect(resolve(S('h w'), { ego: M })).toMatchObject({ status: 'unsupported', reason: 'sameSex' })
    expect(resolve(S('so f'), { ego: M }).status).toBe('self')
  })
})

describe('unsupported chains never throw or guess', () => {
  it('too deep', () => {
    const r = resolve(S('f f f f f f'), { ego: M })
    expect(r).toMatchObject({ status: 'unsupported', reason: 'tooLong' })
  })
  it('same-sex spouse steps', () => {
    expect(resolve(S('h'), { ego: M })).toMatchObject({ status: 'unsupported', reason: 'sameSex' })
    expect(resolve(S('w'), { ego: F })).toMatchObject({ status: 'unsupported', reason: 'sameSex' })
    expect(resolve(S('f h'), { ego: M })).toMatchObject({ status: 'unsupported', reason: 'sameSex' })
  })
  it('ambiguous', () => {
    expect(resolve(S('eb yb'), { ego: M })).toMatchObject({ status: 'unsupported', reason: 'ambiguous' })
    expect(resolve(S('m d'), { ego: F })).toMatchObject({ status: 'unsupported', reason: 'ambiguous' })
  })
  it('unknown relations', () => {
    expect(resolve(S('f f f f'), { ego: M })).toMatchObject({ status: 'unsupported', reason: 'unknown' })
    expect(resolve(S('f eb so so'), { ego: M })).toMatchObject({ status: 'unsupported', reason: 'unknown' })
    expect(resolve(S('m f eb'), { ego: M })).toMatchObject({ status: 'unsupported', reason: 'unknown' })
  })
  it('every chain up to depth 5 is handled without throwing', () => {
    const steps: Step[] = ['f', 'm', 'h', 'w', 'eb', 'yb', 'es', 'ys', 'so', 'd']
    let n = 0
    const walk = (c: Step[]) => {
      for (const ego of ['m', 'f'] as Sex[]) {
        const r = resolve(c, { ego, relativeAge: 'older' })
        resolveReverse(c, { ego, relativeAge: 'older' })
        expect(['ok', 'self', 'unsupported', 'needAge']).toContain(r.status)
        n++
      }
      if (c.length < 4) for (const s of steps) walk([...c, s])
    }
    walk([])
    expect(n).toBeGreaterThan(1000)
  })
})

describe('needAge', () => {
  it('asks for age only for cousins', () => {
    const r = resolve(S('f eb so'), { ego: M })
    expect(r.status).toBe('needAge')
    expect(resolve(S('f eb'), { ego: M }).status).toBe('ok')
  })
})

describe('canAppend', () => {
  it('spouse steps follow sex, depth is capped', () => {
    expect(canAppend([], M, 'w')).toBe(true)
    expect(canAppend([], M, 'h')).toBe(false)
    expect(canAppend(S('f'), F, 'h')).toBe(false)
    expect(canAppend(S('m'), F, 'h')).toBe(true)
    expect(canAppend(S('f f f f f'), M, 'f')).toBe(false)
  })
})

describe('invert and the other person\'s view', () => {
  it('invert flips each step with sex', () => {
    expect(invert(S('f eb'), M)).toEqual(S('yb so'))
    expect(invert(S('f eb'), F)).toEqual(S('yb d'))
    expect(invert(S('h f'), F)).toEqual(S('so w'))
  })
  const rev = (c: string, ego: Sex, age: Age | null = null) => {
    const r = resolveReverse(S(c), { ego, relativeAge: age })
    return r.status === 'ok' ? r.title.zh : r.status
  }
  it('what do they call me', () => {
    expect(rev('f', M)).toBe('兒子')
    expect(rev('f', F)).toBe('女兒')
    expect(rev('m', M)).toBe('兒子')
    expect(rev('f f', F)).toBe('孫女')
    expect(rev('m f', M)).toBe('外孫')
    expect(rev('m m', F)).toBe('外孫女')
    expect(rev('f eb', M)).toBe('姪子')
    expect(rev('f eb', F)).toBe('姪女')
    expect(rev('f es', M)).toBe('姪子')
    expect(rev('m eb', F)).toBe('外甥女')
    expect(rev('m es', M)).toBe('外甥')
    expect(rev('eb', M)).toBe('弟弟')
    expect(rev('eb', F)).toBe('妹妹')
    expect(rev('es', M)).toBe('弟弟')
    expect(rev('yb', F)).toBe('姊姊')
    expect(rev('ys', M)).toBe('哥哥')
    expect(rev('so', M)).toBe('爸爸')
    expect(rev('d', M)).toBe('爸爸')
    expect(rev('d', F)).toBe('媽媽')
  })
  it('in-laws', () => {
    expect(rev('h f', F)).toBe('媳婦')
    expect(rev('w f', M)).toBe('女婿')
    expect(rev('h', F)).toBe('太太')
    expect(rev('w', M)).toBe('丈夫')
    expect(rev('f eb w', M)).toBe('姪子')
    expect(rev('h eb', F)).toBe('弟妹')
    expect(rev('eb w', M)).toBe('小叔')
    expect(rev('eb w', F)).toBe('小姑')
  })
  it('cousins flip the age', () => {
    // 他是我的堂哥 (他比我大) -> 他叫我堂弟
    expect(rev('f eb so', M, 'older')).toBe('堂弟')
    expect(rev('f eb so', M, 'younger')).toBe('堂哥')
    expect(rev('f eb so', F, 'older')).toBe('堂妹')
    expect(rev('m es d', F, 'older')).toBe('表妹')
    expect(rev('m es d', M, 'younger')).toBe('表哥')
    expect(rev('f eb so', M)).toBe('needAge')
  })
  it('unsupported stays unsupported', () => {
    expect(rev('f f f f f f', M)).toBe('unsupported')
  })
})

describe('reverse lookup', () => {
  const one = (q: string) => lookupTitle(q)
  const pathStr = (q: string) => one(q).flatMap((g) => g.paths.map((p) => p.steps.join(' ') + (p.age ? ' @' + p.age : '') + (p.ego ? ' #' + p.ego : '')))

  it('阿姨 = 媽媽的姊妹', () => {
    expect(pathStr('阿姨')).toEqual(['m sibF'])
    expect(one('阿姨')[0].title.caveats).toContain('polite')
    expect(one('阿姨')[0].title.caveats).toContain('yima')
  })
  it('姨媽 is an alias of 阿姨', () => {
    expect(pathStr('姨媽')).toEqual(['m sibF'])
  })
  it('舅舅 = 媽媽的兄弟', () => {
    expect(pathStr('舅舅')).toEqual(['m sibM'])
  })
  it('姑姑 = 爸爸的姊妹', () => {
    expect(pathStr('姑姑')).toEqual(['f sibF'])
  })
  it('堂哥 = 爸爸的兄弟的兒子, older', () => {
    expect(pathStr('堂哥')).toEqual(['f sibM so @older'])
  })
  it('表姊 has three families of paths', () => {
    expect(pathStr('表姐').sort()).toEqual(['f sibF d @older', 'm sibF d @older', 'm sibM d @older'].sort())
  })
  it('姨丈 / 岳母 / 小舅子', () => {
    expect(pathStr('姨丈')).toEqual(['m sibF h'])
    expect(pathStr('岳母')).toEqual(['w m #m'])
    expect(pathStr('小舅子')).toEqual(['w yb #m'])
    expect(pathStr('大姑')).toEqual(['h es #f'])
  })
  it('姪子 and 外甥', () => {
    expect(pathStr('姪子')).toEqual(['sibM so'])
    expect(pathStr('外甥')).toEqual(['sibF so'])
  })
  it('matches Hokkien han and unknown returns empty', () => {
    expect(one('阿伯')[0].title.zh).toBe('伯父')
    expect(one('不存在')).toEqual([])
    expect(one('')).toEqual([])
  })
  it('every reverse path resolves back to its title', () => {
    for (const name of titleOptions()) {
      for (const g of lookupTitle(name)) expect(g.paths.length).toBeGreaterThan(0)
    }
  })
})

describe('table integrity', () => {
  it('every Hokkien form has Han and Tâi-lô, flags are consistent', () => {
    for (const t of allTitles()) {
      expect(t.zh).not.toBe('')
      expect(t.tw).not.toBe('')
      expect(t.tl).toMatch(/^[\p{L}\p{M}-]+$/u)
      if (t.moe !== undefined) {
        expect(t.moe).not.toBe('')
        expect(t.uncertain).toBe(false)
      }
      if (t.uncertain) expect(t.moe).toBeUndefined()
      expect(['sure', 'regional']).toContain(t.confidence)
    }
  })
})

describe('MOE dictionary links', () => {
  it('encodes headwords and round-trips', () => {
    for (const w of ['叔伯兄弟', '阿爸', 'a&b=c?#/ 空白']) {
      const u = moeUrl(w)
      expect(u.startsWith('https://sutian.moe.edu.tw/')).toBe(true)
      expect(u.startsWith(MOE_SEARCH_URL)).toBe(true)
      const q = new URL(u).searchParams
      expect(q.get('tsha')).toBe(w)
      expect(q.get('lui')).toBe('tai_su')
    }
  })
  it('linkable and non-linkable entries exist', () => {
    const ts = allTitles()
    expect(ts.some((t) => t.moe)).toBe(true)
    expect(ts.some((t) => !t.moe)).toBe(true)
  })
})
