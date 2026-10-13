import ISO6391 from 'iso-639-1'
import { franc } from 'franc-min'
import { francToIso1 } from '../franc-map.generated.ts'

const displayNames = new Intl.DisplayNames(['tr'], { type: 'language' })

// Tesseract eğitim verisi olan diller (ISO 639-1 → tesseract kodu).
export const ocrLanguageCodes: Record<string, string> = {
  af: 'afr', am: 'amh', ar: 'ara', as: 'asm', az: 'aze', be: 'bel', bn: 'ben', bo: 'bod', bs: 'bos', bg: 'bul',
  ca: 'cat', cs: 'ces', zh: 'chi_sim', cy: 'cym', da: 'dan', de: 'deu', dz: 'dzo', el: 'ell', en: 'eng', eo: 'epo',
  et: 'est', eu: 'eus', fa: 'fas', fi: 'fin', fr: 'fra', ga: 'gle', gl: 'glg', gu: 'guj', ht: 'hat', he: 'heb',
  hi: 'hin', hr: 'hrv', hu: 'hun', iu: 'iku', id: 'ind', is: 'isl', it: 'ita', jv: 'jav', ja: 'jpn', kn: 'kan',
  ka: 'kat', kk: 'kaz', ky: 'kir', ko: 'kor', ku: 'kur', lo: 'lao', la: 'lat', lv: 'lav', lt: 'lit', ml: 'mal',
  mr: 'mar', mk: 'mkd', mt: 'mlt', mn: 'mon', my: 'mya', ne: 'nep', nl: 'nld', no: 'nor', or: 'ori', pa: 'pan',
  pl: 'pol', pt: 'por', ps: 'pus', ro: 'ron', ru: 'rus', sa: 'san', si: 'sin', sk: 'slk', sl: 'slv', es: 'spa',
  sq: 'sqi', sr: 'srp', sw: 'swa', sv: 'swe', ta: 'tam', te: 'tel', tg: 'tgk', tl: 'tgl', th: 'tha', ti: 'tir',
  tr: 'tur', ug: 'uig', uk: 'ukr', ur: 'urd', uz: 'uzb', vi: 'vie', yi: 'yid',
}

export function languageLabel(code: string, fallback?: string) {
  const localized = displayNames.of(code)
  if (localized && localized.toLocaleLowerCase('tr') !== code) return localized
  return fallback ?? ISO6391.getName(code) ?? code
}

export const allLanguages = ISO6391.getAllCodes()
  .map((code) => ({ code, name: ISO6391.getName(code) }))
  .sort((left, right) => languageLabel(left.code, left.name).localeCompare(languageLabel(right.code, right.name), 'tr'))

export function countWords(text: string) {
  return (text.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) ?? []).length
}

export function detectLanguageCode(text: string) {
  const detected = franc(text, { minLength: 80 })
  return francToIso1[detected] ?? null
}
