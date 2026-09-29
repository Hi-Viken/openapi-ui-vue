import type { StorageLike } from '@/types'

export function browserStorage(): StorageLike {
  return {
    getItem(key) {
      if ((window as any).openapiHost?.storage && Object.hasOwn((window as any).openapiHost.storage, key))
        return (window as any).openapiHost.storage[key]
      try {
        return window.localStorage.getItem(key)
      } catch {
        return null
      }
    },
    setItem(key, value) {
      let localError
      try {
        window.localStorage.setItem(key, value)
      } catch (error) {
        localError = error
      }
      if ((window as any).openapiHost?.save) {
        (window as any).openapiHost.storage[key] = value
        const saveFn = (window as any).openapiHost.save
        saveFn(key, value)
      } else if (localError) throw localError
    },
    removeItem(key) {
      try {
        window.localStorage.removeItem(key)
      } catch {}
      if ((window as any).openapiHost?.save) {
        delete ((window as any).openapiHost.storage[key])
        const saveFn = (window as any).openapiHost.save
        saveFn(key, null)
      }
    },
  }
}

export function readJson<T = any>(storage: StorageLike, key: string, fallback: T): T {
  try {
    return JSON.parse(storage.getItem(key)!) ?? fallback
  } catch {
    return fallback
  }
}

export function migrateLegacy(
  storage: StorageLike,
  spec: any,
  operations: any[],
  makeDraft: (operation: any, spec: any) => any
): any {
  const plain = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '_')
  const snake = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-zA-Z0-9.]+/g, '_')
      .replace(/^_+|_+$/g, '')
  const title = spec.info?.title || 'api'
  const version = spec.info?.version || '1.0.0'
  const prefix = `${plain(title)}_${plain(version)}`
  const variables = Object.entries(readJson(storage, `${prefix}_variables`, {})).map(
    ([name, value]) => ({ name, value, enabled: true })
  )
  const outputs = Object.entries(readJson(storage, `${prefix}_output_variables`, {})).map(
    ([name, value]) => ({ name: `@${name}`, value, enabled: true })
  )
  const collections = Object.entries(
    readJson(storage, `${snake(title)}_${snake(version)}_collections`, {})
  ).map(([name, collection]: [string, any]) => ({
    id: crypto.randomUUID(),
    name,
    delay: collection.delay || 0,
    requests: (collection.requests || []).flatMap((request: any) => {
      const operation = operations.find(
        (item) => item.path === request.path && item.method === request.method?.toLowerCase()
      )
      if (!operation) return []
      const draft = makeDraft(operation, spec)
      const parameters = draft.parameters.map((param: any) => ({
        ...param,
        value:
          (param.location === 'path' ? request.pathParams : request.queryParams)?.[param.name] ??
          param.value,
      }))
      return [
        {
          id: crypto.randomUUID(),
          operationId: operation.id,
          enabled: request.enabled !== false,
          draft: {
            ...draft,
            parameters,
            body:
              typeof request.body === 'string'
                ? request.body
                : request.body
                  ? JSON.stringify(request.body, null, 2)
                  : draft.body,
            headers: Object.entries(request.headers || {}).map(([header, value]) => ({
              name: header,
              value,
              enabled: true,
            })),
            outputs: (request.outputParameters || []).map((output: any) => ({
              name: output.name,
              path: output.jsonPath || output.path,
            })),
          },
        },
      ]
    }),
  }))
  const favoritePrefix = `${title.toLowerCase().replace(/\s+/g, '_')}_${version
    .toLowerCase()
    .replace(/\s+/g, '_')}`
  const favorites = readJson(storage, `${favoritePrefix}_favorites`, []).flatMap(
    (favorite: any) => {
      const operation = operations.find(
        (item) => item.path === favorite.path && item.method === favorite.method?.toLowerCase()
      )
      return operation ? [operation.id] : []
    }
  )
  return { variables: [...variables, ...outputs], collections, favorites }
}

export function initialTheme(storage: StorageLike): string {
  const saved = storage.getItem('openapi-ui:theme')
  return [
    'system',
    'light',
    'dark-plus',
    'dark-modern',
    'graphite',
    'github-light',
    'github-dark',
    'visual-studio-light',
    'visual-studio-dark',
    'contrast',
  ].includes(saved!)
    ? saved!
    : 'system'
}
