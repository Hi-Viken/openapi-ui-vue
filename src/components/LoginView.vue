<template>
  <div class="login-screen">
    <main class="login-card">
      <div class="brand">
        <span class="brand-logo">⚙</span>
        <span class="brand-name">OpenAPI UI</span>
      </div>

      <h1>{{ t('login.title') }}</h1>
      <p class="sub">{{ t('login.subtitle') }}</p>

      <div class="error" v-if="hasError">{{ t('login.error') }}</div>

      <!-- 与参考页一致：表单直接 POST 回当前路径，由后端校验账号密码、下发登录态 cookie 并回跳。
           action="" 解析为当前 URL（如 /login 或 /docs/login），无需前端写死端点。 -->
      <form method="post" action="">
        <label>
          <span>{{ t('login.username') }}</span>
          <input
            type="text"
            name="username"
            autocomplete="username"
            :placeholder="t('login.username')"
            required
            autofocus
          />
        </label>
        <label>
          <span>{{ t('login.password') }}</span>
          <input
            type="password"
            name="password"
            autocomplete="current-password"
            :placeholder="t('login.password')"
            required
          />
        </label>
        <input type="hidden" name="return" :value="returnUrl" />
        <button type="submit" class="primary">{{ t('login.submit') }}</button>
      </form>

      <!-- 语言选择：与主页面（Workspace 的 .locale-picker）共用同一 i18n 实例与 localStorage('openapi-ui:locale')，切换即双向同步 -->
      <div class="login-footer">
        <span class="footer-label">{{ t('code.language') }}</span>
        <select
          class="locale-picker"
          :aria-label="t('code.language')"
          :value="locale"
          @change="onLocaleChange"
        >
          <option value="en">{{ t('lang.en') }}</option>
          <option value="zh-CN">{{ t('lang.zhCN') }}</option>
          <option value="zh-TW">{{ t('lang.zhTW') }}</option>
        </select>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t, locale } = useI18n()

// 读取 ?error / ?return：后端校验失败会带 ?error=1 重定向回来；未登录访问受保护页会带 ?return=原路径
const params = new URLSearchParams(location.search)
const hasError = params.has('error')
const returnUrl = params.get('return') || ''

// 与 Workspace.vue 的 onLocaleChange 完全一致：写回 i18n.locale 与 localStorage，登录页与主页语言互相同步
function onLocaleChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  locale.value = value
  localStorage.setItem('openapi-ui:locale', value)
}
</script>

<style scoped>
/* 背景/文字/配色全部吃主页的主题变量（main.css 里的 --surface/--text/--accent 等），
   因此登录页会随用户已选主题（含暗色 graphite）自动保持一致。 */
.login-screen {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: var(--surface);
  color: var(--text);
  color-scheme: var(--color-scheme);
}

.login-card {
  width: 100%;
  max-width: 380px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 28px 26px 22px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
}

.brand {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-bottom: 20px;
}

.brand-logo {
  width: 28px;
  height: 28px;
  border-radius: 7px;
  background: var(--accent);
  color: var(--accent-text);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  line-height: 1;
}

.brand-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
}

.login-card h1 {
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 6px;
  color: var(--text);
}

.sub {
  margin: 0 0 22px;
  font-size: 13px;
  color: var(--muted);
}

.error {
  background: color-mix(in srgb, var(--error) 12%, var(--surface));
  color: var(--error);
  border: 1px solid color-mix(in srgb, var(--error) 40%, transparent);
  border-radius: 4px;
  padding: 10px 12px;
  font-size: 13px;
  margin-bottom: 16px;
}

form {
  display: flex;
  flex-direction: column;
  gap: 16px;
  text-align: left;
}

label {
  display: flex;
  flex-direction: column;
  gap: 7px;
  font-size: 13px;
  color: var(--muted);
}

input[type='text'],
input[type='password'] {
  width: 100%;
  padding: 9px 11px;
}

button.primary {
  width: 100%;
  margin-top: 4px;
  padding: 10px;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 2px;
}

.login-footer {
  margin-top: 22px;
  padding-top: 18px;
  border-top: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.footer-label {
  font-size: 12px;
  color: var(--muted);
}
</style>
