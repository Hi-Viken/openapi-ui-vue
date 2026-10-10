import { createI18n } from 'vue-i18n'
import en from './locales/en'
import zhCN from './locales/zh-CN'
import zhTW from './locales/zh-TW'

function detectLocale(): string {
  // 1) 用户曾显式选择的语言一定优先呈现（语言选择器只提供受支持三项，
  //    normalizeLocale 后必为 en/zh-CN/zh-TW 之一，绝不回退浏览器协商）
  const stored = localStorage.getItem('apirak:locale')
  if (stored) return normalizeLocale(stored)
  // 2) 从未设置过时按浏览器语言协商；语言包内不存在的语言回退英文
  return localeFromBrowser()
}

// 根据浏览器偏好语言协商默认语言；未在 SUPPORTED 内的语言一律回退英文
function localeFromBrowser(): string {
  const langs = (navigator.languages && navigator.languages.length
    ? navigator.languages
    : [navigator.language || '']) as string[]
  for (const raw of langs) {
    const lang = raw.toLowerCase()
    if (lang.startsWith('zh-tw') || lang.startsWith('zh-hant') || lang === 'zh-hk') return 'zh-TW'
    if (lang.startsWith('zh')) return 'zh-CN'
    if (lang.startsWith('en')) return 'en'
  }
  return 'en'
}

function normalizeLocale(lang: string): string {
  if (lang.startsWith('zh-TW') || lang.startsWith('zh-Hant') || lang === 'zh-HK') return 'zh-TW'
  if (lang.startsWith('zh')) return 'zh-CN'
  return 'en'
}

const i18n = createI18n({
  legacy: false,
  locale: detectLocale(),
  fallbackLocale: 'en',
  messages: {
    en,
    'zh-CN': zhCN,
    'zh-TW': zhTW,
    zh: zhCN,
  },
})

export default i18n
