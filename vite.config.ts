import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { handleApiRequest } from './server/api'

function prismaApiPlugin() {
  return {
    name: 'prisma-api',
    configureServer(server: import('vite').ViteDevServer) {
      server.middlewares.use((req, res, next) => {
        void handleApiRequest(req, res).then((handled) => {
          if (!handled) next()
        })
      })
    },
    configurePreviewServer(server: import('vite').PreviewServer) {
      server.middlewares.use((req, res, next) => {
        void handleApiRequest(req, res).then((handled) => {
          if (!handled) next()
        })
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), prismaApiPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
