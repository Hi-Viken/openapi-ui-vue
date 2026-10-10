// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import i18n from '@/i18n'
import Workspace from './Workspace.vue'

/**
 * 回归测试：从 Runner 打开「集合里的请求」并编辑 参数 / 请求头 / 请求体 后，
 * 改动必须即时写回集合，不能等用户点「保存到集合」才生效。
 *
 * 旧逻辑：集合请求的 draft 只有点「保存到集合」才会回写；编辑后不点保存就切换/刷新/运行，
 * 改动会丢，且重新从 Runner 打开还会用集合里那份旧 draft 把 tab 里已改内容覆盖掉
 * （表现为「集合中配置的参数/请求头/请求体没有保存」）。
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
    '/thing': {
      post: {
        operationId: 'createThing',
        summary: 'Create Thing',
        parameters: [{ name: 'id', in: 'query', schema: { type: 'string' } }],
        requestBody: {
          content: { 'application/json': { schema: { type: 'object' } } },
        },
        responses: { '200': { description: 'ok' } },
      },
    },
  },
}

async function mountWorkspace(storage = memoryStorage()) {
  const wrapper = mount(Workspace, {
    props: { spec, source: 'test', storage, theme: 'system', notify: () => {} },
    global: { plugins: [i18n] },
  })
  await nextTick()
  return { wrapper, storage }
}

describe('集合请求配置自动保存', () => {
  let mounted: ReturnType<typeof mount> | null = null
  afterEach(() => mounted?.unmount())

  it('编辑集合请求的参数/请求头/请求体后，无需点保存即写回集合', async () => {
    const { wrapper, storage } = await mountWorkspace()
    mounted = wrapper
    const vm = wrapper.vm as any

    const collectionId = 'col-1'
    const requestId = 'req-1'
    const initialDraft = {
      path: '/thing',
      parameters: [{ name: 'id', location: 'query', value: '1', enabled: true }],
      headers: [{ name: 'X-Test', value: '', enabled: true }],
      body: '{}',
      contentType: 'application/json',
      form: [],
      outputs: [],
      authEnabled: true,
    }
    const operation = vm.operations[0]
    vm.state.collections = [
      {
        id: collectionId,
        name: 'My Collection',
        requests: [{ id: requestId, operationId: operation.id, draft: initialDraft, enabled: true }],
        delay: 0,
      },
    ]
    await nextTick()

    // 以「来自集合」的方式打开该请求（Runner 的 openRequest 同款）
    vm.openOperation(operation, initialDraft, { collectionId, requestId })
    await nextTick()
    expect(vm.savedRequest).toBeTruthy()

    // 模拟 RequestView 的 @change：同时改 请求体 / 请求头 / 参数
    vm.onDraftChange({
      body: '{"name":"forged"}',
      headers: [{ name: 'X-Test', value: 'secret', enabled: true }],
      parameters: [{ name: 'id', location: 'query', value: '999', enabled: true }],
    })
    await nextTick()
    await nextTick()

    // 不点「保存到集合」，直接读持久化结果
    const key = vm.key
    const persisted = JSON.parse(storage.getItem(key)!)
    const req = persisted.collections[0].requests.find((r: any) => r.id === requestId)
    expect(req.draft.body).toBe('{"name":"forged"}')
    expect(req.draft.headers[0].value).toBe('secret')
    expect(req.draft.parameters[0].value).toBe('999')
  })

  it('手动「保存到集合」仍然生效（兼容旧路径）', async () => {
    const { wrapper, storage } = await mountWorkspace()
    mounted = wrapper
    const vm = wrapper.vm as any

    const collectionId = 'col-2'
    const requestId = 'req-2'
    const initialDraft = {
      path: '/thing',
      parameters: [],
      headers: [],
      body: '{}',
      contentType: 'application/json',
      form: [],
      outputs: [],
      authEnabled: true,
    }
    const operation = vm.operations[0]
    vm.state.collections = [
      {
        id: collectionId,
        name: 'C2',
        requests: [{ id: requestId, operationId: operation.id, draft: initialDraft, enabled: true }],
        delay: 0,
      },
    ]
    await nextTick()

    vm.openOperation(operation, initialDraft, { collectionId, requestId })
    await nextTick()

    // 仅改 tab，不触发 onDraftChange 的自动回写，改完直接点保存
    vm.state.tabs.find((t: any) => t.id === operation.id).draft.body = '{"manual":true}'
    await nextTick()
    vm.saveToCollection()
    await nextTick()
    await nextTick()

    const persisted = JSON.parse(storage.getItem(vm.key)!)
    const req = persisted.collections[0].requests.find((r: any) => r.id === requestId)
    expect(req.draft.body).toBe('{"manual":true}')
  })
})
