<template>
  <section class="tool-view">
    <header class="section-heading">
      <h1>{{ $t('auth.title') }}</h1>
      <KeyRound :size="22" />
    </header>
    <div v-if="operation" class="security-requirements">
      <strong>{{ operation.summary || operation.path }}</strong>
      <p>
        {{ operation.security.length
          ? operation.security.map((group: any) => Object.keys(group).join(' + ') || $t('auth.anonymous')).join(' OR ')
          : $t('auth.noAuthRequired') }}
      </p>
      <label class="check-label">
        <input type="checkbox" :checked="enabled !== false" @change="$emit('update:enabled', ($event.target as HTMLInputElement).checked)" />
        {{ $t('auth.applyAuth') }}
      </label>
    </div>
    <p v-if="!schemes.length" class="empty">{{ $t('auth.noSchemes') }}</p>
    <template v-else>
      <div class="subtabs" role="tablist" :aria-label="$t('auth.securitySchemes')">
        <button
          v-for="[name, value] in schemes"
          :key="name"
          role="tab"
          :aria-selected="name === selected"
          @click="selected = name"
        >
          {{ name }}
          <span v-if="credentialPresent(resolveRef(value, spec), credentials[name])" class="status-dot" />
        </button>
      </div>
      <div class="auth-form" :key="selected">
        <div class="section-heading">
          <h2>{{ selected }}</h2>
          <span :class="credentialPresent(scheme, credential) ? 'success' : 'muted'">
            {{ credentialPresent(scheme, credential) ? $t('auth.configured') : $t('auth.notConfigured') }}
          </span>
        </div>
        <Markdown>{{ scheme.description }}</Markdown>
        <template v-if="basic">
          <label>
            {{ $t('auth.username') }}
            <input autocomplete="off" :value="credential.username || ''" @input="changeCredential({ username: ($event.target as HTMLInputElement).value })" />
          </label>
          <label>
            {{ $t('auth.password') }}
            <input type="password" autocomplete="off" :value="credential.password || ''" @input="changeCredential({ password: ($event.target as HTMLInputElement).value })" />
          </label>
        </template>
        <label v-else>
          {{ scheme.type === 'apiKey' ? `${scheme.name} (${scheme.in})` : $t('auth.accessToken') }}
          <input type="password" autocomplete="off" :value="credential.token || ''" @input="changeCredential({ token: ($event.target as HTMLInputElement).value, expiresAt: undefined })" />
        </label>
        <p v-if="credential.expiresAt" class="muted">{{ $t('auth.expires') }} {{ new Date(credential.expiresAt).toLocaleString() }}</p>
        <template v-if="oauth">
          <label v-if="scheme.flows">
            {{ $t('auth.oauthFlow') }}
            <select :value="flowName" @change="changeConfig({ flow: ($event.target as HTMLSelectElement).value })">
              <option v-for="name in Object.keys(scheme.flows)" :key="name">{{ name }}</option>
            </select>
          </label>
          <label>
            {{ $t('auth.clientId') }}
            <input autocomplete="off" :value="config.clientId || ''" @input="changeConfig({ clientId: ($event.target as HTMLInputElement).value })" />
          </label>
          <label v-if="['clientCredentials', 'password'].includes(flowName)">
            {{ $t('auth.clientSecret') }}
            <input type="password" autocomplete="off" :value="config.clientSecret || ''" @input="changeConfig({ clientSecret: ($event.target as HTMLInputElement).value })" />
          </label>
          <template v-if="flowName === 'password'">
            <label>
              {{ $t('auth.resourceUsername') }}
              <input :value="config.username || ''" @input="changeConfig({ username: ($event.target as HTMLInputElement).value })" />
            </label>
            <label>
              {{ $t('auth.resourcePassword') }}
              <input type="password" :value="config.password || ''" @input="changeConfig({ password: ($event.target as HTMLInputElement).value })" />
            </label>
          </template>
          <label v-if="!['clientCredentials', 'password'].includes(flowName)">
            {{ $t('auth.redirectUri') }}
            <input :value="config.redirectUri ?? `${currentLocation.origin}${currentLocation.pathname}`" @input="changeConfig({ redirectUri: ($event.target as HTMLInputElement).value })" />
          </label>
          <label>
            {{ $t('auth.scopes') }}
            <input :value="config.scope ?? Object.keys(flow?.scopes || {}).join(' ')" @input="changeConfig({ scope: ($event.target as HTMLInputElement).value })" />
          </label>
          <button class="primary" :disabled="busy" @click="authorize">
            <KeyRound :size="16" />
            {{ busy ? $t('auth.authorizing') : $t('auth.authorize') }}
          </button>
          <template v-if="hostWindow.openapiHost">
            <label>
              {{ $t('auth.callbackUrl') }}
              <input :value="callback" @input="callback = ($event.target as HTMLInputElement).value" />
            </label>
            <button @click="completeAuth">{{ $t('auth.completeAuth') }}</button>
          </template>
        </template>
        <label class="check-label">
          <input type="checkbox" :checked="remember" @change="$emit('update:remember', ($event.target as HTMLInputElement).checked)" />
          {{ $t('auth.rememberCredentials') }}
        </label>
        <p v-if="remember" class="warning">{{ $t('auth.storageWarning') }}</p>
        <button class="text-button" @click="clearCredentials">
          <LogOut :size="16" />
          {{ $t('auth.clearCredentials') }}
        </button>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { KeyRound, LogOut } from 'lucide-vue-next'
import Markdown from './ui/Markdown.vue'
import { credentialPresent, resolveRef, securitySchemes } from '@/lib/api'
import { authorizationUrl, completeAuthorization, defaultClientId, discoverOidc, requestToken } from '@/lib/oauth'
import type { Credentials, Notify, OpenApiDocument, Operation } from '@/types'

const props = defineProps<{
  spec: OpenApiDocument
  credentials: Credentials
  workspace: string
  remember: boolean
  notify: Notify
  operation?: Operation
  enabled?: boolean
}>()

const emit = defineEmits<{
  change: [credentials: Credentials]
  'update:remember': [remember: boolean]
  'update:enabled': [enabled: boolean]
}>()

const schemes = computed(() => Object.entries(securitySchemes(props.spec)))
const selected = ref(schemes.value[0]?.[0] || '')
const configs = ref<Record<string, Record<string, any>>>({})
const busy = ref(false)
const callback = ref('')

const hostWindow = typeof window !== 'undefined' ? window : {} as any
const currentLocation = typeof location !== 'undefined' ? location : {} as any

const scheme = computed(() => resolveRef(securitySchemes(props.spec)[selected.value], props.spec))
const credential = computed(() => props.credentials[selected.value] || {})
const config = computed<Record<string, any>>(() => ({ clientId: defaultClientId(scheme.value), ...configs.value[selected.value] }))
const flowName = computed(() => config.value.flow || Object.keys(scheme.value.flows || {})[0] || 'authorizationCode')
const flow = computed(() => scheme.value.flows?.[flowName.value])
const oauth = computed(() => scheme.value.type === 'oauth2' || scheme.value.type === 'openIdConnect')
const basic = computed(() => scheme.value.type === 'basic' || scheme.value.scheme === 'basic')

function changeConfig(patch: Record<string, any>) {
  configs.value = { ...configs.value, [selected.value]: { ...config.value, ...patch } }
}

function changeCredential(patch: Record<string, any>) {
  emit('change', { ...props.credentials, [selected.value]: { ...credential.value, ...patch } })
}

async function authorize() {
  busy.value = true
  try {
    const endpoints = scheme.value.type === 'openIdConnect'
      ? await discoverOidc(scheme.value.openIdConnectUrl)
      : flow.value
    if (!endpoints) throw new Error('No OAuth flow configured.')
    const values = {
      ...config.value,
      flow: flowName.value,
      scope: config.value.scope ?? Object.keys(endpoints.scopes || {}).join(' '),
    }
    if (['password', 'clientCredentials'].includes(flowName.value)) {
      changeCredential(await requestToken(endpoints, values))
    } else {
      const url = await authorizationUrl(endpoints, values, selected.value, props.workspace)
      if (window.openapiHost) window.open(url, '_blank', 'noopener,noreferrer')
      else window.location.assign(url)
    }
  } catch (error) {
    props.notify(error instanceof Error ? error.message : String(error), true)
  } finally {
    busy.value = false
  }
}

async function completeAuth() {
  try {
    const result = await completeAuthorization(callback.value)
    if (!result || result.workspace !== props.workspace) throw new Error('Callback does not match this workspace.')
    emit('change', { ...props.credentials, [result.scheme]: result.credential })
    callback.value = ''
  } catch (error) {
    props.notify(error instanceof Error ? error.message : String(error), true)
  }
}

function clearCredentials() {
  const next = { ...props.credentials }
  delete next[selected.value]
  emit('change', next)
}
</script>
