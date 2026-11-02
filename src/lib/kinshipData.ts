// Title table for the kinship calculator.
//
// Keys are normalised chains (see kinship.ts) joined with spaces. Every entry
// is hand-written; only relations we are confident about are included.
//   confidence 'regional'  -> customs differ between families / regions
//   uncertain  true        -> the Hokkien form (han / Tâi-lô) needs native review
// Hokkien forms and 臺羅 follow the MOE 《臺灣台語常用詞辭典》 headwords; forms
// the dictionary does not list are flagged `uncertain` and carry no `moe`.

export type Confidence = 'sure' | 'regional'
export type CaveatKey = 'polite' | 'rank' | 'yima' | 'grand' | 'inlaw' | 'cousin'

export interface Title {
  /** Taiwan Mandarin */
  zh: string
  zhAlt: string[]
  /** Taiwanese Hokkien in Han characters */
  tw: string
  /** Tâi-lô (no tone marks) */
  tl: string
  twAlt: string[]
  confidence: Confidence
  /** Hokkien form needs native review */
  uncertain: boolean
  caveats: CaveatKey[]
  /** Exact MOE dictionary headword (only for forms confirmed there; never set when uncertain) */
  moe?: string
}

export interface AgeEntry {
  older: Title
  younger: Title
}
export type Entry = Title | AgeEntry

export const isAgeEntry = (e: Entry): e is AgeEntry => 'older' in e

interface Opt {
  alt?: string[]
  twAlt?: string[]
  regional?: boolean
  uncertain?: boolean
  cav?: CaveatKey[]
  /** headword confirmed in the MOE dictionary: true = same as `tw`, string = other headword */
  moe?: string | true
}
const T = (zh: string, tw: string, tl: string, o: Opt = {}): Title => ({
  zh,
  zhAlt: o.alt ?? [],
  tw,
  tl,
  twAlt: o.twAlt ?? [],
  confidence: o.regional ? 'regional' : 'sure',
  uncertain: !!o.uncertain,
  caveats: o.cav ?? [],
  ...(o.moe && !o.uncertain ? { moe: o.moe === true ? tw : o.moe } : {}),
})

export const TABLE = new Map<string, Entry>()
const add = (key: string, e: Entry) => TABLE.set(key, e)
const addAll = (keys: string[], e: Entry) => keys.forEach((k) => add(k, e))

// --- direct line, upwards -------------------------------------------------
add('f', T('爸爸', '阿爸', 'a-pah', { alt: ['父親'], moe: true }))
add('m', T('媽媽', '阿母', 'a-bú', { alt: ['母親'], moe: true }))
add('f f', T('爺爺', '阿公', 'a-kong', { alt: ['阿公', '祖父'], regional: true, cav: ['grand'], moe: true }))
add('f m', T('奶奶', '阿媽', 'a-má', { alt: ['阿嬤', '祖母'], regional: true, cav: ['grand'], moe: true }))
add('m f', T('外公', '外公', 'guā-kong', { alt: ['外祖父'], twAlt: ['阿公 a-kong'], regional: true, cav: ['grand'], moe: true }))
add('m m', T('外婆', '外媽', 'guā-má', { alt: ['外祖母'], twAlt: ['阿媽 a-má'], regional: true, cav: ['grand'], moe: true }))
add('f f f', T('曾祖父', '阿祖', 'a-tsóo', { regional: true, moe: true }))
add('f f m', T('曾祖母', '阿祖', 'a-tsóo', { regional: true, moe: true }))

// --- direct line, downwards ----------------------------------------------
add('so', T('兒子', '後生', 'hāu-senn', { alt: ['兒'], twAlt: ['囝 kiánn'], moe: true }))
add('d', T('女兒', '查某囝', 'tsa-bóo-kiánn', { moe: true }))
add('so so', T('孫子', '孫仔', 'sun-á', { twAlt: ['孫 sun'], moe: true }))
add('so d', T('孫女', '查某孫', 'tsa-bóo-sun', { moe: true }))
add('d so', T('外孫', '外孫', 'guā-sun', { moe: true }))
add('d d', T('外孫女', '外孫', 'guā-sun', { moe: true }))
add('so so so', T('曾孫', '曾孫', 'tsing-sun', { regional: true, uncertain: true }))
add('so so d', T('曾孫女', '查某曾孫', 'tsa-bóo-tsing-sun', { regional: true, uncertain: true }))

// --- spouse ---------------------------------------------------------------
add('h', T('丈夫', '翁', 'ang', { alt: ['老公', '先生'], regional: true, moe: true }))
add('w', T('太太', '某', 'bóo', { alt: ['老婆', '妻子'], regional: true, moe: true }))

// --- parents' siblings ----------------------------------------------------
add('f eb', T('伯父', '阿伯', 'a-peh', { alt: ['伯伯'], cav: ['polite', 'rank'], moe: true }))
add('f eb w', T('伯母', '阿姆', 'a-ḿ', { cav: ['polite', 'rank'], moe: true }))
add('f yb', T('叔叔', '阿叔', 'a-tsik', { alt: ['叔父'], cav: ['polite', 'rank'], moe: true }))
add('f yb w', T('嬸嬸', '阿嬸', 'a-tsím', { alt: ['嬸母'], cav: ['polite', 'rank'], moe: true }))
addAll(['f es', 'f ys'], T('姑姑', '阿姑', 'a-koo', { alt: ['姑媽'], regional: true, cav: ['rank'], moe: true }))
addAll(['f es h', 'f ys h'], T('姑丈', '姑丈', 'koo-tiūnn', { alt: ['姑父'], regional: true, cav: ['rank'], moe: true }))
addAll(['m eb', 'm yb'], T('舅舅', '阿舅', 'a-kū', { alt: ['舅父'], cav: ['rank'], moe: true }))
addAll(['m eb w', 'm yb w'], T('舅媽', '阿妗', 'a-kīm', { alt: ['舅母'], cav: ['rank'], moe: true }))
addAll(['m es', 'm ys'], T('阿姨', '阿姨', 'a-î', { alt: ['姨媽'], regional: true, cav: ['polite', 'yima', 'rank'], moe: true }))
addAll(['m es h', 'm ys h'], T('姨丈', '姨丈', 'î-tiūnn', { alt: ['姨夫'], regional: true, cav: ['rank'], moe: true }))

// --- grandparents' siblings (paternal line only) --------------------------
add('f f eb', T('伯公', '伯公', 'peh-kong', { alt: ['伯祖父'], regional: true, moe: true }))
add('f f eb w', T('伯婆', '伯婆', 'peh-pô', { alt: ['伯祖母'], regional: true, uncertain: true }))
add('f f yb', T('叔公', '叔公', 'tsik-kong', { alt: ['叔祖父'], regional: true, moe: true }))
add('f f yb w', T('嬸婆', '嬸婆', 'tsím-pô', { alt: ['叔祖母'], regional: true, moe: true }))
addAll(['f f es', 'f f ys'], T('姑婆', '姑婆', 'koo-pô', { alt: ['姑祖母'], regional: true, moe: true }))
addAll(['f f es h', 'f f ys h'], T('姑公', '姑公', 'koo-kong', { alt: ['姑祖父'], regional: true, uncertain: true }))
addAll(['f m eb', 'f m yb'], T('舅公', '舅公', 'kū-kong', { alt: ['舅祖父'], regional: true, moe: true }))
addAll(['f m eb w', 'f m yb w'], T('舅婆', '舅婆', 'kū-pô', { alt: ['舅祖母'], regional: true, uncertain: true }))
addAll(['f m es', 'f m ys'], T('姨婆', '姨婆', 'î-pô', { alt: ['姨祖母'], regional: true, moe: true }))
addAll(['f m es h', 'f m ys h'], T('姨公', '姨公', 'î-kong', { alt: ['姨祖父'], regional: true, uncertain: true }))

// --- siblings -------------------------------------------------------------
add('eb', T('哥哥', '阿兄', 'a-hiann', { alt: ['大哥'], moe: true }))
add('yb', T('弟弟', '小弟', 'sió-tī', { alt: ['小弟'], moe: true }))
add('es', T('姊姊', '阿姊', 'a-tsí', { alt: ['姐姐'], moe: true }))
add('ys', T('妹妹', '小妹', 'sió-muē', { alt: ['小妹'], twAlt: ['sió-bē'], moe: true }))
add('eb w', T('嫂嫂', '阿嫂', 'a-só', { alt: ['嫂子', '大嫂'], moe: true }))
add('yb w', T('弟妹', '妗仔', 'kīm-á', { alt: ['弟媳'], regional: true, moe: true }))
add('es h', T('姊夫', '姊夫', 'tsí-hu', { alt: ['姐夫'], moe: true }))
add('ys h', T('妹夫', '妹婿', 'muē-sài', { alt: ['妹婿'], twAlt: ['bē-sài'], moe: true }))
addAll(['eb so', 'yb so'], T('姪子', '姪仔', 'ti̍t-á', { alt: ['姪兒'], moe: true }))
addAll(['eb d', 'yb d'], T('姪女', '查某孫', 'tsa-bóo-sun', { moe: true }))
addAll(['es so', 'ys so'], T('外甥', '外甥', 'guē-sing', { moe: true }))
addAll(['es d', 'ys d'], T('外甥女', '外甥女', 'guē-sing-lú', { uncertain: true }))

// --- cousins (title depends on whether the cousin is older or younger than me)
const cousinCav: CaveatKey[] = ['cousin']
const cousinSet = (keys: string[], tang: boolean) => {
  const mk = (zh: string, tw: string, tl: string, o: Opt = {}) => T(zh, tw, tl, { regional: true, cav: cousinCav, ...o })
  for (const k of keys) {
    if (tang) {
      // The dictionary only has the general terms (no older/younger split).
      add(`${k} so`, { older: mk('堂哥', '叔伯兄弟', 'tsik-peh-hiann-tī', { moe: true }), younger: mk('堂弟', '叔伯兄弟', 'tsik-peh-hiann-tī', { moe: true }) })
      add(`${k} d`, { older: mk('堂姊', '叔伯姊妹', 'tsik-peh-tsí-muē', { alt: ['堂姐'], moe: true }), younger: mk('堂妹', '叔伯姊妹', 'tsik-peh-tsí-muē', { moe: true }) })
    } else {
      add(`${k} so`, { older: mk('表哥', '表兄', 'piáu-hiann', { moe: true }), younger: mk('表弟', '表小弟', 'piáu-sió-tī', { moe: true }) })
      add(`${k} d`, { older: mk('表姊', '表姊', 'piáu-tsí', { alt: ['表姐'], moe: true }), younger: mk('表妹', '表小妹', 'piáu-sió-muē', { twAlt: ['piáu-sió-bē'], moe: true }) })
    }
  }
}
cousinSet(['f eb', 'f yb'], true)
cousinSet(['f es', 'f ys', 'm eb', 'm yb', 'm es', 'm ys'], false)

// --- spouse's relatives ---------------------------------------------------
add('h f', T('公公', '大官', 'ta-kuann', { cav: ['inlaw'], moe: true }))
add('h m', T('婆婆', '大家', 'ta-ke', { cav: ['inlaw'], moe: true }))
add('w f', T('岳父', '丈人', 'tiūnn-lâng', { cav: ['inlaw'], moe: true }))
add('w m', T('岳母', '丈姆', 'tiūnn-ḿ', { cav: ['inlaw'], moe: true }))
add('h eb', T('大伯', '大伯', 'tuā-peh', { alt: ['大伯子'], regional: true, moe: true }))
add('h yb', T('小叔', '小叔', 'sió-tsik', { alt: ['小叔子'], twAlt: ['阿叔仔 a-tsik-á'], regional: true, moe: true }))
add('h es', T('大姑', '大姑', 'tuā-koo', { alt: ['大姑子'], regional: true, moe: true }))
add('h ys', T('小姑', '小姑', 'sió-koo', { alt: ['小姑子'], regional: true, moe: true }))
add('w eb', T('大舅子', '大舅', 'tuā-kū', { alt: ['內兄'], regional: true, moe: true }))
add('w yb', T('小舅子', '妻舅', 'tshe-kū', { alt: ['內弟'], regional: true, moe: true }))
add('w es', T('大姨子', '姨仔', 'î-á', { alt: ['妻姊'], regional: true, moe: true }))
add('w ys', T('小姨子', '姨仔', 'î-á', { alt: ['妻妹'], regional: true, moe: true }))
addAll(['w es h', 'w ys h'], T('連襟', '連襟', 'liân-khim', { alt: ['襟兄弟'], regional: true, uncertain: true }))
addAll(['h eb w', 'h yb w'], T('妯娌', '同姒仔', 'tâng-sāi-á', { regional: true, moe: true }))

// --- children's in-laws ---------------------------------------------------
add('so w', T('媳婦', '新婦', 'sin-pū', { alt: ['兒媳'], moe: true }))
add('d h', T('女婿', '囝婿', 'kiánn-sài', { moe: true }))
addAll(['so w f', 'd h f'], T('親家公', '親家公', 'tshin-ke-kong', { regional: true, moe: true }))
addAll(['so w m', 'd h m'], T('親家母', '親家姆', 'tshin-ke-ḿ', { regional: true, uncertain: true }))

/** Base URL of the MOE dictionary's exact-match search (link only; never fetched). */
export const MOE_SEARCH_URL = 'https://sutian.moe.edu.tw/zh-hant/tshiau/?lui=tai_su&tsha='
export const moeUrl = (headword: string) => MOE_SEARCH_URL + encodeURIComponent(headword)
