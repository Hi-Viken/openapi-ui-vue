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
const source = urlParams.get('spec') || urlParams.get('url') || (typeof __SPEC_URL__ !== 'undefined' ? __SPEC_URL__ : 'swagger.json')
const specName = urlParams.get('name') || (typeof __SPEC_NAME__ !== 'undefined' ? __SPEC_NAME__ : '')

const app = createApp(App, { initialSource: source, specName })
app.use(createPinia())
app.use(i18n)
app.mount('#app')
