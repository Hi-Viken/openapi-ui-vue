import { createApp } from 'vue'
import { createPinia } from 'pinia'
import i18n from './i18n'
import App from './App.vue'
import './styles/main.css'
import './styles/code-font.css'
import './styles/tab-context-menu.css'

declare const __SPEC_URL__: string
declare const __SPEC_NAME__: string

const urlParams = new URLSearchParams(location.search)

// 宿主配置：由服务端（如 .NET 的 UseDocUi 中间件）在 index.html 里注入
// <script id="docui-config" type="application/json">{"spec":"/openapi/v1.json"}</script>
// 没有该节点时返回空对象，独立部署行为不变
function readHostConfig(): { spec?: string; name?: string } {
  try {
    const el = document.getElementById('docui-config')
    return el?.textContent ? JSON.parse(el.textContent) : {}
  } catch {
    return {}
  }
}
const hostConfig = readHostConfig()

// 优先级：URL 参数 > 宿主注入 > 构建期 define > 同目录 swagger.json
const source = urlParams.get('spec') || urlParams.get('url') || hostConfig.spec
  || (typeof __SPEC_URL__ !== 'undefined' ? __SPEC_URL__ : 'swagger.json')
const specName = urlParams.get('name') || hostConfig.name
  || (typeof __SPEC_NAME__ !== 'undefined' ? __SPEC_NAME__ : '')

const app = createApp(App, { initialSource: source, specName })
app.use(createPinia())
app.use(i18n)
app.mount('#app')
