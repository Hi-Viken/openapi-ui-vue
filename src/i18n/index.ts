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
  const nav = navigator.language || ''
  return normalizeLocale(nav)
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
