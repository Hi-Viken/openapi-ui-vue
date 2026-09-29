import { ref, computed } from 'vue'
import {
  workspaceReducer,
  restoreWorkspace,
  persistWorkspace,
  workspaceKey as getWorkspaceKey,
} from '@/lib/workspace'
import { migrateLegacy } from '@/lib/platform'
import { makeDraft } from '@/lib/api'
import type { StorageLike, Operation } from '@/types'

export function useWorkspace(
  storage: StorageLike,
  source: string,
  spec: any,
  operations: Operation[]
) {
  const key = getWorkspaceKey(source, spec)
  const initialState = () => {
    const restored = restoreWorkspace(storage, key, operations)
    const migrated = !storage.getItem(key)
      ? migrateLegacy(storage, spec, operations, makeDraft)
      : {}
    return {
      ...restored,
      ...migrated,
      tabs: restored.tabs.map((tab: any) => ({
        ...tab,
        draft: {
          ...makeDraft(operations.find((op) => op.id === tab.id), spec),
          ...tab.draft,
        },
      })),
    }
  }

  const state = ref(initialState())

  function dispatch(action: any) {
    state.value = workspaceReducer(state.value, action)
    persistWorkspace(storage, key, state.value)
  }

  const active = computed(() => state.value.tabs.find((tab: any) => tab.id === state.value.active))

  return {
    state,
    dispatch,
    active,
    key,
  }
}
