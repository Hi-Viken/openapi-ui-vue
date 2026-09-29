<template>
  <span :class="['info-tip', { 'variable-input': !!$slots.trigger }]"
    @mouseenter="show"
    @mouseleave="hide"
    @focus="show"
    @blur="onBlur"
    @keydown.escape="hide"
  >
    <slot name="trigger" />
    <IconButton v-if="active" :label="label" @click="show" :aria-describedby="position ? tooltipId : undefined">
      <Info :size="14" />
    </IconButton>
    <Teleport to="body" v-if="active && position">
      <div
        :id="tooltipId"
        role="tooltip"
        class="info-tooltip"
        :style="{ left: `${position.left}px`, top: `${position.top}px`, transform: position.above ? 'translateY(-100%)' : undefined }"
      >
        <slot />
      </div>
    </Teleport>
  </span>
</template>

<script setup lang="ts">
import { ref, onUnmounted, useId } from 'vue'
import IconButton from './IconButton.vue'
import { Info } from 'lucide-vue-next'

const props = withDefaults(defineProps<{ label: string; active?: boolean }>(), { active: true })

const tooltipId = useId()
const position = ref<{ left: number; top: number; above: boolean } | null>(null)
const anchor = ref<HTMLElement>()

function show() {
  if (!props.active) return
  const el = anchor.value as any
  if (!el?.getBoundingClientRect) return
  const rect = el.getBoundingClientRect()
  const above = rect.bottom > window.innerHeight / 2
  position.value = {
    left: Math.max(8, Math.min(rect.left, window.innerWidth - 368)),
    top: above ? rect.top - 6 : rect.bottom + 6,
    above,
  }
}

function hide() { position.value = null }
function onBlur(event: FocusEvent) {
  const current = event.currentTarget as HTMLElement
  if (!current.contains(event.relatedTarget as Node)) hide()
}

onUnmounted(() => hide())
</script>
