// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import i18n from '@/i18n'
import Workspace from './Workspace.vue'

/**
 * 回归测试：Authorization 面板里填的访问令牌必须真的写回 Workspace 的 credentials。
 * 曾经 `onCredentialsChange(credentials)` 的参数名与 credentials ref 同名，
 * 函数体 `credentials.value = credentials` 实际是给参数对象挂了个自引用的 .value，
 * ref 从未更新 —— 表现为「填完就被清空，怎么都存不住」。
 */

function memoryStorage() {
  const map = new Map<string, string>()
  return {
    map,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
  }
}

const spec: any = {
  openapi: '3.0.3',
  info: { title: 'Demo', version: '1.0.0' },
  paths: {
    '/ping': {
      get: {
        operationId: 'ping',
        summary: 'Ping',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'ok' } },
      },
    },
  },
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer' } },
  },
}

async function mountAuthView() {
  const storage = memoryStorage()
  const wrapper = mount(Workspace, {
    props: { spec, source: 'test', storage, theme: 'system', notify: () => {} },
    global: { plugins: [i18n] },
  })
  ;(wrapper.vm as any).view = 'auth'
  await nextTick()
  return { wrapper, storage }
}

// 未勾「记住凭据」时凭据落在 window.sessionStorage，同一个 jsdom 里跨用例会串味，
// 不清理的话后一个用例开局就是「已配置」状态。
beforeEach(() => {
  window.sessionStorage.clear()
})

describe('访问令牌保存', () => {
  it('填入令牌后输入框保留该值（不被回写冲掉）', async () => {
    const { wrapper } = await mountAuthView()
    const input = wrapper.find('input[type="password"]')
    await input.setValue('my-token')
    await nextTick()
    expect((input.element as HTMLInputElement).value).toBe('my-token')
    wrapper.unmount()
  })

  it('填入令牌后该 scheme 显示为已配置', async () => {
    const { wrapper } = await mountAuthView()
    // 侧栏页脚另有一个同名的「已加载」小圆点，必须收敛到鉴权标签页里找
    expect(wrapper.find('.subtabs .status-dot').exists()).toBe(false)
    await wrapper.find('input[type="password"]').setValue('my-token')
    await nextTick()
    expect(wrapper.find('.subtabs .status-dot').exists()).toBe(true)
    wrapper.unmount()
  })

  it('勾选记住凭据后写入 storage，重新挂载能读回', async () => {
    const first = await mountAuthView()
    await first.wrapper.find('input[type="checkbox"]').setValue(true)
    await nextTick()
    await first.wrapper.find('input[type="password"]').setValue('stored-token')
    await nextTick()
    await nextTick()

    const saved = [...first.storage.map.entries()].find(([key]) => key.endsWith(':credentials'))
    expect(saved).toBeTruthy()
    expect(JSON.parse(saved![1])).toEqual({ bearerAuth: { token: 'stored-token' } })
    first.wrapper.unmount()

    // 换个挂载，storage 复用：凭据应被读回并显示在输入框里
    const second = mount(Workspace, {
      props: { spec, source: 'test', storage: first.storage, theme: 'system', notify: () => {} },
      global: { plugins: [i18n] },
    })
    ;(second.vm as any).view = 'auth'
    await nextTick()
    expect((second.find('input[type="password"]').element as HTMLInputElement).value).toBe(
      'stored-token'
    )
    second.unmount()
  })

  it('未勾记住凭据时落在 sessionStorage，重新挂载仍在', async () => {
    const first = await mountAuthView()
    await first.wrapper.find('input[type="password"]').setValue('session-token')
    await nextTick()
    await nextTick()

    // 不该写进长期存储
    expect([...first.storage.map.keys()].some((key) => key.endsWith(':credentials'))).toBe(false)
    const cached = [...Array(window.sessionStorage.length).keys()]
      .map((_, i) => window.sessionStorage.key(i)!)
      .filter((key) => key.endsWith(':credentials'))
    expect(cached).toHaveLength(1)
    expect(window.sessionStorage.getItem(cached[0])).toContain('session-token')
    first.wrapper.unmount()

    const second = await mountAuthView()
    expect((second.wrapper.find('input[type="password"]').element as HTMLInputElement).value).toBe(
      'session-token'
    )
    second.wrapper.unmount()
  })
})
