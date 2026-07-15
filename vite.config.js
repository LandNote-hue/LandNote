import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { jusoReturnMiddleware } from './plugins/jusoReturnMiddleware.js'
import { jusoSearchProxyPlugin } from './plugins/jusoSearchProxy.js'
import { googleCalendarIcalProxyPlugin } from './plugins/googleCalendarIcalProxy.js'

const BFF_TARGET = process.env.VITE_BFF_DEV_URL || 'http://localhost:3001'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const useBff = env.VITE_USE_BFF === 'true'

  return {
    plugins: [react(), jusoSearchProxyPlugin(), googleCalendarIcalProxyPlugin(), jusoReturnMiddleware()],
    server: {
      port: 5175,
      strictPort: true,
      host: true,
      proxy: useBff ? {
        '/api': { target: BFF_TARGET, changeOrigin: true },
        '/juso-return.html': { target: BFF_TARGET, changeOrigin: true },
      } : {
        '/api/public-data': {
          target: 'https://apis.data.go.kr',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/public-data/, ''),
        },
        '/api/vworld': {
          target: 'https://api.vworld.kr',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/vworld/, ''),
        },
        '/api/eum': {
          target: 'https://www.eum.go.kr',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/eum/, ''),
        },
        '/api/juso': {
          target: 'https://business.juso.go.kr',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/juso/, ''),
        },
      },
    },
  }
})
