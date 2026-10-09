<template>
  <Modal :title="title" @close="$emit('close')">
    <!-- 模式一：从请求加号 / 右键菜单进入，选目标运行器（或新建） -->
    <div v-if="mode === 'select-runner'" class="add-runner">
      <p class="modal-intro">
        {{ $t('runner.addToCollectionIntro', { operation: operationLabel || '' }) }}
      </p>
      <ul class="pick-list">
        <li v-for="item in collections" :key="item.id">
          <button type="button" class="pick-row" @click="$emit('add-to-runner', item.id)">
            <span class="pick-name">{{ item.name }}</span>
            <span class="muted">{{ item.requests.length }} {{ $t('runner.requestCount') }}</span>
          </button>
        </li>
        <li v-if="!collections?.length" class="empty">{{ $t('runner.noCollections') }}</li>
      </ul>
      <div class="runner-new">
        <label>
          {{ $t('runner.createNewCollection') }}
          <input
            v-model="newName"
            :placeholder="$t('runner.newCollectionName')"
            @keyup.enter="createNew"
          />
        </label>
        <button type="button" class="primary" :disabled="!newName.trim()" @click="createNew">
          {{ $t('runner.createAndAdd') }}
        </button>
      </div>
      <div class="modal-actions">
        <button type="button" class="text-button" @click="$emit('close')">
          {{ $t('request.cancel') }}
        </button>
      </div>
    </div>

    <!-- 模式二：从运行器页面进入，往当前集合里加接口（分组 / 折叠 / 全选） -->
    <div v-else class="add-operations">
      <div class="op-toolbar">
        <input
          class="op-search"
          v-model="query"
          :placeholder="$t('runner.operationSearch')"
          :aria-label="$t('runner.operationSearch')"
        />
        <label class="global-select" :title="allSelected ? $t('runner.deselectAll') : $t('runner.selectAll')">
          <input
            type="checkbox"
            :checked="allSelected"
            :indeterminate="someSelected"
            :aria-label="allSelected ? $t('runner.deselectAll') : $t('runner.selectAll')"
            @change="toggleAll"
          />
          {{ allSelected ? $t('runner.deselectAll') : $t('runner.selectAll') }}
        </label>
      </div>

      <div class="op-groups">
        <div v-for="[group, ops] in grouped" :key="group" class="op-group">
          <div class="group-head" @click="toggleOpen(group)">
            <div class="group-head-row">
              <ChevronRight class="expand-chevron" :class="{ open: isOpen(group) }" :size="14" />
              <span class="group-name">{{ group }}</span>
              <div class="group-tools">
                <span class="count">{{ ops.length }}</span>
                <label class="group-select" :title="groupSelectedAll(group) ? $t('runner.deselectAll') : $t('runner.selectAll')" @click.stop>
                  <input
                    type="checkbox"
                    :checked="groupSelectedAll(group)"
                    :indeterminate="groupSomeSelected(group)"
                    :aria-label="(groupSelectedAll(group) ? $t('runner.deselectAll') : $t('runner.selectAll')) + ' ' + group"
                    @change="toggleGroup(group)"
                  />
                </label>
              </div>
            </div>
            <p v-if="tagDescription(group)" class="group-desc">{{ tagDescription(group) }}</p>
            <a
              v-if="tagDocs(group)"
              class="group-docs"
              :href="tagDocs(group)!.url"
              target="_blank"
              rel="noopener noreferrer"
              @click.stop
              >{{ tagDocs(group)!.description || $t('runner.tagDocs') }}
              <ExternalLink :size="11" /></a
            >
          </div>
          <div v-show="isOpen(group)" class="group-body">
            <label
              v-for="op in ops"
              :key="op.id"
              class="op-pick"
              :class="{ already: existingCount(op.id) > 0 }"
            >
              <input type="checkbox" :value="op.id" v-model="selected" />
              <Method :method="op.method" />
              <span class="op-summary">{{ op.summary || op.path }}</span>
              <code class="op-path">{{ op.path }}</code>
              <span v-if="existingCount(op.id) > 0" class="already-tag">
                {{ $t('runner.alreadyAdded', { n: existingCount(op.id) }) }}
              </span>
            </label>
          </div>
        </div>
        <p v-if="!grouped.length" class="empty">{{ $t('runner.noOperationsMatch') }}</p>
      </div>

      <div class="modal-actions">
        <button type="button" class="text-button" @click="$emit('close')">
          {{ $t('request.cancel') }}
        </button>
        <button
          type="button"
          class="primary"
          :disabled="!selected.length"
          @click="confirmOperations"
        >
          {{ $t('runner.addSelected', { n: selected.length }) }}
        </button>
      </div>
    </div>
  </Modal>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronRight, ExternalLink } from 'lucide-vue-next'
import Modal from './Modal.vue'
import Method from './Method.vue'
import { tagMetaMap } from '@/lib/api'
import type { Operation, OpenApiDocument, RequestCollection } from '@/types'

const { t } = useI18n()

const props = defineProps<{
  mode: 'select-runner' | 'select-operations'
  collections?: RequestCollection[]
  operations?: Operation[]
  operationLabel?: string
  existingIds?: string[]
  collectionName?: string
  spec?: OpenApiDocument
}>()

/** spec.tags 的 name → { description, externalDocs } 映射；无对应 tag 时回退空记录（忽略） */
const tagMeta = computed(() => tagMetaMap(props.spec))
function tagDescription(group: string): string | undefined {
  return tagMeta.value.get(group)?.description
}
function tagDocs(group: string): { description?: string; url: string } | undefined {
  return tagMeta.value.get(group)?.externalDocs
}

const emit = defineEmits<{
  close: []
  'add-to-runner': [collectionId: string]
  'create-runner': [name: string]
  'add-operations': [operationIds: string[]]
}>()

const title = computed(() =>
  props.mode === 'select-runner'
    ? t('runner.selectRunner')
    : t('runner.addInterfaceTitle', { name: props.collectionName || '' })
)

const newName = ref('')
const selected = ref<string[]>([])
const query = ref('')
// 默认全折叠：记录「已展开」的分组，空集即所有分组都折叠
const openGroups = ref<Set<string>>(new Set())

/** 按 tag 分组（首个 tag，无 tag 归入「请求」），并应用搜索过滤；返回 [分组名, 接口[]][] 且保持出现顺序 */
const grouped = computed<[string, Operation[]][]>(() => {
  const q = query.value.trim().toLowerCase()
  const order: string[] = []
  const map = new Map<string, Operation[]>()
  for (const op of props.operations || []) {
    const hay = `${op.summary || ''} ${op.path} ${op.method} ${(op.tags || []).join(' ')}`.toLowerCase()
    if (q && !hay.includes(q)) continue
    const key = (op.tags && op.tags[0]) || t('workspace.requests')
    if (!map.has(key)) {
      map.set(key, [])
      order.push(key)
    }
    map.get(key)!.push(op)
  }
  return order.map((key) => [key, map.get(key)!])
})

const filteredOps = computed(() => grouped.value.flatMap(([, ops]) => ops))

const allSelected = computed(
  () => filteredOps.value.length > 0 && filteredOps.value.every((op) => selected.value.includes(op.id))
)
const someSelected = computed(
  () => filteredOps.value.some((op) => selected.value.includes(op.id)) && !allSelected.value
)

function toggleAll() {
  if (allSelected.value) {
    const visible = new Set(filteredOps.value.map((op) => op.id))
    selected.value = selected.value.filter((id) => !visible.has(id))
  } else {
    selected.value = Array.from(new Set([...selected.value, ...filteredOps.value.map((op) => op.id)]))
  }
}

function groupOps(group: string): Operation[] {
  return grouped.value.find(([g]) => g === group)?.[1] || []
}

function groupSelectedAll(group: string): boolean {
  const ops = groupOps(group)
  return ops.length > 0 && ops.every((op) => selected.value.includes(op.id))
}

function groupSomeSelected(group: string): boolean {
  const ops = groupOps(group)
  return ops.some((op) => selected.value.includes(op.id)) && !groupSelectedAll(group)
}

function toggleGroup(group: string) {
  const ops = groupOps(group)
  if (groupSelectedAll(group)) {
    const ids = new Set(ops.map((op) => op.id))
    selected.value = selected.value.filter((id) => !ids.has(id))
  } else {
    selected.value = Array.from(new Set([...selected.value, ...ops.map((op) => op.id)]))
  }
}

function isOpen(group: string): boolean {
  return openGroups.value.has(group)
}

function toggleOpen(group: string) {
  const next = new Set(openGroups.value)
  if (next.has(group)) next.delete(group)
  else next.add(group)
  openGroups.value = next
}

/** 该接口当前已在集合中的次数（允许重复添加，仅作提示，不禁用） */
function existingCount(opId: string): number {
  return (props.existingIds || []).filter((id) => id === opId).length
}

function createNew() {
  const name = newName.value.trim()
  if (!name) return
  emit('create-runner', name)
}

function confirmOperations() {
  if (!selected.value.length) return
  emit('add-operations', [...selected.value])
}
</script>

<style scoped>
.modal-intro {
  margin: 0 0 12px;
  color: var(--text);
  font-size: 13px;
}
.pick-list {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 48vh;
  overflow: auto;
  border: 1px solid var(--border);
  border-radius: 6px;
}
.pick-list li {
  border-bottom: 1px solid var(--border);
}
.pick-list li:last-child {
  border-bottom: 0;
}
.pick-row {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  background: transparent;
  border: 0;
  text-align: left;
  color: var(--text);
  cursor: pointer;
}
.pick-row:hover {
  background: var(--surface-alt, #ffffff0d);
}
.pick-name {
  font-weight: 600;
}
.runner-new {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  margin-top: 16px;
}
.runner-new label {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
}
.runner-new input {
  padding: 8px 10px;
}

/* 模式二：添加接口（分组 / 折叠 / 全选） */
.op-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}
.op-search {
  flex: 1;
  padding: 8px 10px;
}
.global-select {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  white-space: nowrap;
  cursor: pointer;
  user-select: none;
  color: var(--muted);
}
.op-groups {
  max-height: 52vh;
  overflow: auto;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
}
.op-group {
  border-bottom: 1px solid var(--border);
}
.op-group:last-child {
  border-bottom: 0;
}
.group-head {
  padding: 9px 12px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  background: var(--surface-alt, #ffffff08);
  color: var(--text);
  user-select: none;
}
.group-head-row {
  display: grid;
  grid-template-columns: 18px 56px minmax(0, 1fr) minmax(0, 32%) auto;
  align-items: center;
  column-gap: 12px;
}
.group-head:hover {
  background: var(--surface-hover, #ffffff12);
}
.expand-chevron {
  grid-column: 1;
  transition: transform 0.15s ease;
  color: var(--muted);
}
.expand-chevron.open {
  transform: rotate(90deg);
}
.group-name {
  grid-column: 2 / 5;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.group-tools {
  grid-column: 5;
  display: flex;
  align-items: center;
  gap: 10px;
  justify-content: flex-end;
}
.count {
  font-size: 11px;
  color: var(--muted);
  font-weight: 400;
  padding: 1px 6px;
  background: var(--surface-hover);
  border-radius: 10px;
}
.group-select {
  display: flex;
  align-items: center;
  cursor: pointer;
}
.group-desc {
  margin: 6px 0 0;
  padding-left: 30px;
  color: var(--muted);
  font-size: 11px;
  font-weight: 400;
  line-height: 1.45;
}
.group-docs {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  margin: 5px 0 0 30px;
  font-size: 11px;
  font-weight: 400;
  color: var(--accent);
  text-decoration: none;
}
.group-docs:hover {
  text-decoration: underline;
}
.group-body {
  padding: 2px 0;
}
/* 每行拆成固定列：勾选 | 方法 | 描述 | 地址 | 状态，跨行严格对齐 */
.op-pick {
  display: grid;
  grid-template-columns: 18px 56px minmax(0, 1fr) minmax(0, 32%) auto;
  align-items: center;
  column-gap: 12px;
  padding: 8px 12px;
  cursor: pointer;
  font-size: 12px;
  text-align: left;
  border-top: 1px solid var(--border);
}
.op-pick:first-child {
  border-top: 0;
}
.op-pick:hover {
  background: var(--surface-alt, #ffffff08);
}
.op-pick input[type='checkbox'] {
  accent-color: var(--accent);
  width: 15px;
  height: 15px;
  margin: 0;
  justify-self: center;
}
.op-pick .method {
  font-size: 9px;
  justify-self: start;
}
.op-summary {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text);
}
.op-path {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  color: var(--muted);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
.already-tag {
  flex-shrink: 0;
  font-size: 10px;
  color: var(--warning, #d9a441);
  border: 1px solid var(--warning, #d9a44155);
  border-radius: 3px;
  padding: 1px 5px;
}
.op-pick.already {
  background: var(--warning-bg, #d9a4410d);
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 16px;
}
.empty {
  padding: 14px 12px;
  color: var(--text-muted, #8a8f98);
  font-size: 13px;
}
.muted {
  color: var(--text-muted, #8a8f98);
  font-size: 12px;
}
</style>
