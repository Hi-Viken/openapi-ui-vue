import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiBaseUrl = env.VITE_API_BASE_URL || ''
  const specPath = env.VITE_SPEC_PATH || '/v3/api-docs'
  const specName = env.VITE_SPEC_NAME || ''

  return {
    // 构建产物用相对路径（./assets/...），这样被 .NET 类库挂在任意前缀下（/docs、/api-docs）都能直接跑，
    // 不用改挂载路径就得重新构建。dev server 下仍用 '/' 保证 history fallback 正常。
    base: command === 'build' ? './' : '/',
    plugins: [vue()],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
    },
    server: {
      host: '127.0.0.1',
      port: 5173,
      proxy: apiBaseUrl
        ? {
            '/api-proxy': {
              target: apiBaseUrl,
              changeOrigin: true,
              rewrite: (path) => path.replace(/^\/api-proxy/, ''),
            },
          }
        : undefined,
    },
    define: {
      __SPEC_URL__: JSON.stringify(apiBaseUrl ? `/api-proxy${specPath}` : specPath),
      __SPEC_NAME__: JSON.stringify(specName),
    },
  }
})
