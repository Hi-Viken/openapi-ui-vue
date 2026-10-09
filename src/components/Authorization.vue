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
          <span v-if="satisfied(resolveRef(value, spec), credentials[name])" class="status-dot" />
        </button>
      </div>
      <div class="auth-form" :key="selected">
        <div class="section-heading">
          <h2>{{ selected }}</h2>
          <span :class="satisfied(scheme, credential) ? 'success' : 'muted'">
            {{ credentialLabel }}
          </span>
        </div>
        <Markdown>{{ scheme.description }}</Markdown>
        <template v-if="basic">
          <label>
            {{ $t('auth.username') }}
            <VariableInput
              autocomplete="off"
              :model-value="credential.username || ''"
              :variables="variables"
              :output-definitions="outputDefinitions"
              :aria-label="$t('auth.username')"
              @update:model-value="changeCredential({ username: $event })"
            />
          </label>
          <label>
            {{ $t('auth.password') }}
            <div class="token-field">
              <VariableInput
                :type="showToken ? 'text' : 'password'"
                autocomplete="off"
                :model-value="credential.password || ''"
                :variables="variables"
                :output-definitions="outputDefinitions"
                :aria-label="$t('auth.password')"
                @update:model-value="changeCredential({ password: $event })"
              />
              <IconButton
                :label="showToken ? $t('request.hideValue') : $t('request.showValue')"
                @click="showToken = !showToken"
              >
                <component :is="showToken ? EyeOff : Eye" :size="16" />
              </IconButton>
            </div>
          </label>
        </template>
        <label v-else>
          {{ scheme.type === 'apiKey' ? `${scheme.name} (${scheme.in})` : $t('auth.accessToken') }}
          <div class="token-field">
            <VariableInput
              :type="showToken ? 'text' : 'password'"
              autocomplete="off"
              :model-value="credential.token || ''"
              :variables="variables"
              :output-definitions="outputDefinitions"
              :aria-label="$t('auth.accessToken')"
              @update:model-value="changeCredential({ token: $event, expiresAt: undefined })"
            />
            <IconButton
              :label="showToken ? $t('request.hideValue') : $t('request.showValue')"
              @click="showToken = !showToken"
            >
              <component :is="showToken ? EyeOff : Eye" :size="16" />
            </IconButton>
          </div>
        </label>
        <p class="muted">{{ variableHint }}</p>
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
            <div class="token-field">
              <VariableInput
                :type="showToken ? 'text' : 'password'"
                autocomplete="off"
                :model-value="config.clientSecret || ''"
                :variables="variables"
                :output-definitions="outputDefinitions"
                :aria-label="$t('auth.clientSecret')"
                @update:model-value="changeConfig({ clientSecret: $event })"
              />
              <IconButton
                :label="showToken ? $t('request.hideValue') : $t('request.showValue')"
                @click="showToken = !showToken"
              >
                <component :is="showToken ? EyeOff : Eye" :size="16" />
              </IconButton>
            </div>
          </label>
          <template v-if="flowName === 'password'">
            <label>
              {{ $t('auth.resourceUsername') }}
              <VariableInput
                :model-value="config.username || ''"
                :variables="variables"
                :output-definitions="outputDefinitions"
                :aria-label="$t('auth.resourceUsername')"
                @update:model-value="changeConfig({ username: $event })"
              />
            </label>
            <label>
              {{ $t('auth.resourcePassword') }}
              <div class="token-field">
                <VariableInput
                  :type="showToken ? 'text' : 'password'"
                  :model-value="config.password || ''"
                  :variables="variables"
                  :output-definitions="outputDefinitions"
                  :aria-label="$t('auth.resourcePassword')"
                  @update:model-value="changeConfig({ password: $event })"
                />
                <IconButton
                  :label="showToken ? $t('request.hideValue') : $t('request.showValue')"
                  @click="showToken = !showToken"
                >
                  <component :is="showToken ? EyeOff : Eye" :size="16" />
                </IconButton>
              </div>
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
import { useI18n } from 'vue-i18n'
import { KeyRound, LogOut, Eye, EyeOff } from 'lucide-vue-next'
import Markdown from './ui/Markdown.vue'
import VariableInput from './ui/VariableInput.vue'
import IconButton from './ui/IconButton.vue'
import {
  credentialSatisfied,
  replaceVariables,
  resolveRef,
  securitySchemes,
  credentialIssueMessages,
} from '@/lib/api'
import { authorizationUrl, completeAuthorization, defaultClientId, discoverOidc, requestToken } from '@/lib/oauth'
import type { Credentials, KeyValueRow, Notify, OpenApiDocument, Operation, Variables } from '@/types'

const props = defineProps<{
  spec: OpenApiDocument
  credentials: Credentials
  workspace: string
  remember: boolean
  notify: Notify
  operation?: Operation
  enabled?: boolean
  variables?: Variables
  outputDefinitions?: KeyValueRow[]
}>()

const emit = defineEmits<{
  change: [credentials: Credentials]
  'update:remember': [remember: boolean]
  'update:enabled': [enabled: boolean]
}>()

const { t } = useI18n()

// 花括号不能写进模板字面量（Vue 编译器会把 {{ 当成插值起始符），所以在脚本里拼好
const variableHint = computed(() => t('auth.variableHint', { open: '{{', close: '}}' }))

const schemes = computed(() => Object.entries(securitySchemes(props.spec)))
const selected = ref(schemes.value[0]?.[0] || '')
const configs = ref<Record<string, Record<string, any>>>({})
const busy = ref(false)
const callback = ref('')
const showToken = ref(false)

const hostWindow = typeof window !== 'undefined' ? window : {} as any
const currentLocation = typeof location !== 'undefined' ? location : {} as any

const scheme = computed(() => resolveRef(securitySchemes(props.spec)[selected.value], props.spec))
const credential = computed(() => props.credentials[selected.value] || {})
const config = computed<Record<string, any>>(() => ({ clientId: defaultClientId(scheme.value), ...configs.value[selected.value] }))
const flowName = computed(() => config.value.flow || Object.keys(scheme.value.flows || {})[0] || 'authorizationCode')
const flow = computed(() => scheme.value.flows?.[flowName.value])
const oauth = computed(() => scheme.value.type === 'oauth2' || scheme.value.type === 'openIdConnect')
const basic = computed(() => scheme.value.type === 'basic' || scheme.value.scheme === 'basic')

// 令牌里写 {{token}} 而变量没定义时，credentialPresent 只看字符串非空，
// 会照常显示"已配置"，请求却发出字面量 `Bearer {{token}}`。这里带上变量一起判。
function satisfied(scheme: any, value: any): boolean {
  return credentialSatisfied(scheme, value, props.variables ?? [], props.outputDefinitions ?? [])
}

const credentialLabel = computed(() => {
  if (satisfied(scheme.value, credential.value)) return t('auth.configured')
  const messages = credentialIssueMessages(
    credential.value,
    props.variables ?? [],
    props.outputDefinitions ?? [],
    t as any
  )
  return messages.length ? messages.join(' ') : t('auth.notConfigured')
})

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
    // clientId / clientSecret / 资源所有者密码等也允许来自变量
    const variables = props.variables ?? []
    const values = Object.fromEntries(
      Object.entries({
        ...config.value,
        flow: flowName.value,
        scope: config.value.scope ?? Object.keys(endpoints.scopes || {}).join(' '),
      }).map(([key, value]) => [
        key,
        typeof value === 'string' ? replaceVariables(value, variables) : value,
      ])
    )
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
