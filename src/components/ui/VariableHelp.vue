<template>
  <InfoTip :label="$t('variableHelp.label')">
    {{ $t('variableHelp.description') }}
  </InfoTip>
</template>

<script setup lang="ts">
import InfoTip from './InfoTip.vue'
</script>
