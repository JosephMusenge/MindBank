import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'MindBank',
        short_name: 'MindBank',
        description: 'Your personal knowledge archive for quotes and wisdom.',
        theme_color: '#1c1917', 
        background_color: '#FDFCF8',
        display: 'standalone', // removes the browser URL bar!
        orientation: 'portrait',
        icons: [
          {
            src: 'android-chrome-192x192.png', 
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'android-chrome-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
})
