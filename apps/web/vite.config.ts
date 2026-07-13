import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import legacy from '@vitejs/plugin-legacy'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'
import { fileURLToPath } from 'node:url'

const defaultApiTarget = 'https://finantialapp.onrender.com'
const rootDir = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, rootDir, '')

  return {
    plugins: [
      react(),
      tailwindcss(),
      legacy({
        targets: ['chrome >= 60', 'chromeAndroid >= 60', 'firefox >= 67', 'safari >= 12', 'ios >= 12'],
      }),
      VitePWA({
        injectRegister: 'auto',
        registerType: 'autoUpdate',
        manifestFilename: 'site.webmanifest',
        includeAssets: ['favicon.ico', 'favicon.svg', 'favicon-96x96.png', 'apple-touch-icon.png', 'icons.svg'],
        manifest: {
          name: 'Plata App',
          short_name: 'Plata App',
          description: 'Controla gastos, ahorros, deudas y proyecciones desde cualquier movil.',
          theme_color: '#0f172a',
          background_color: '#ffffff',
          display: 'standalone',
          orientation: 'portrait',
          scope: '/',
          start_url: '/',
          icons: [
            {
              src: '/web-app-manifest-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any maskable',
            },
            {
              src: '/web-app-manifest-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          runtimeCaching: [
            {
              urlPattern: ({ request }) => request.mode === 'navigate',
              handler: 'NetworkFirst',
              options: {
                cacheName: 'pages',
                networkTimeoutSeconds: 5,
              },
            },
            {
              urlPattern: ({ request }) =>
                request.destination === 'script' ||
                request.destination === 'style' ||
                request.destination === 'worker' ||
                request.destination === 'manifest',
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'static-assets',
              },
            },
            {
              urlPattern: ({ request }) => request.destination === 'image',
              handler: 'CacheFirst',
              options: {
                cacheName: 'images',
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 60 * 24 * 30,
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: true,
        },
      }),
    ],
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
