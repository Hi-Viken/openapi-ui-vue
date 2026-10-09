import { createI18n } from 'vue-i18n'
import en from './locales/en'
import zhCN from './locales/zh-CN'
import zhTW from './locales/zh-TW'

const SUPPORTED = ['en', 'zh-CN', 'zh-TW'] as const

function detectLocale(): string {
  const stored = localStorage.getItem('openapi-ui:locale')
  if (stored) {
    const normalized = normalizeLocale(stored)
    if (SUPPORTED.includes(normalized as any)) return normalized
  }
  const nav = (navigator.language || '').toLowerCase()
  // 默认英文：仅浏览器明确的中文变体回退到中文，其余一律英文
  if (nav.startsWith('zh-tw') || nav.startsWith('zh-hant') || nav === 'zh-hk') return 'zh-TW'
  if (nav.startsWith('zh')) return 'zh-CN'
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
