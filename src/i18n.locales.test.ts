import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'
import zhCN from './i18n/locales/zh-CN'
import en from './i18n/locales/en'
import zhTW from './i18n/locales/zh-TW'

const messages = { en, 'zh-CN': zhCN, 'zh-TW': zhTW }
const locales = ['en', 'zh-CN', 'zh-TW'] as const

describe('locales', () => {
  it('exports the same auth keys in every language', () => {
    const keys = Object.keys(en.auth).sort()
    expect(Object.keys(zhCN.auth).sort()).toEqual(keys)
    expect(Object.keys(zhTW.auth).sort()).toEqual(keys)
  })

  /**
   * vue-i18n 的消息里出现裸 `@` 会被当成 linked message，导致整条消息的插值全部失效
   * （表现为页面上直接显示 {open}变量名{close}）。需要 @ 的地方必须写成字面量 {'@'}。
   */
  it('renders variableHint with real curly braces in every language', () => {
    const i18n = createI18n({ legacy: false, locale: 'en', messages })
    for (const locale of locales) {
      i18n.global.locale.value = locale
      const text = i18n.global.t('auth.variableHint', { open: '{{', close: '}}' })
      expect(text).toContain('{{')
      expect(text).toContain('}}')
      expect(text).not.toContain('{open}')
      expect(text).not.toContain('{close}')
      expect(text).toContain('@')
    }
  })
})
