import ISO6391 from 'iso-639-1'
import { iso6393To1 } from 'iso-639-3'
import { franc } from 'franc-min'

export const languages = ISO6391.getAllCodes()
  .map((code) => ({ code, name: ISO6391.getName(code) }))
  .sort((left, right) => left.name.localeCompare(right.name, 'tr'))

const supportedCodes = new Set(languages.map(({ code }) => code))

export function detectLanguage(text) {
  const detectedCode = franc(text, { minLength: 80 })
  const languageCode = iso6393To1[detectedCode]
  return supportedCodes.has(languageCode) ? languageCode : null
}

export function countWords(text) {
  return (text.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) ?? []).length
}
