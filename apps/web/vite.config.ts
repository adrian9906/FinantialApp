import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { fileURLToPath } from 'node:url'

const defaultApiTarget = 'https://finantialapp.onrender.com'
const rootDir = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, rootDir, '')

  return {
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        '/api': {
          target: env.VITE_API_BASE_URL?.trim() || defaultApiTarget,
          changeOrigin: true,
          secure: true,
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(rootDir, './src'),
        '@plata/shared': path.resolve(rootDir, '../../packages/shared/src/index.ts'),
      },
    },
  }
})
