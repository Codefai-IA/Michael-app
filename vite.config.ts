import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      includeAssets: ['logo.jpeg', 'favicon.svg', 'expired-icon.png'],
      manifest: {
        name: 'Michael Cezar Nutricionista',
        short_name: 'MC Nutri',
        description: 'App de acompanhamento nutricional e treinos',
        theme_color: '#1c4c9b',
        background_color: '#f5f7fa',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/logo.jpeg',
            sizes: '192x192',
            type: 'image/jpeg'
          },
          {
            src: '/logo.jpeg',
            sizes: '512x512',
            type: 'image/jpeg'
          },
          {
            src: '/logo.jpeg',
            sizes: '512x512',
            type: 'image/jpeg',
            purpose: 'maskable'
          }
        ]
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,svg,jpeg,jpg,woff,woff2}'],
        globIgnores: ['**/card4.png'],
      },
      devOptions: {
        enabled: false
      },
    })
  ],
  server: {
    hmr: {
      protocol: 'ws',
      host: 'localhost',
    },
  },
})
