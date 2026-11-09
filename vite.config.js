import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
// https://vite.dev/config/
export default defineConfig(({ command }) => {
  return {
    plugins: [
      vue(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icon.svg', 'apple-touch-icon.png'],
        manifest: {
          name: 'Tunniplaan · Techno TLN',
          short_name: 'Tunniplaan',
          description: 'Techno TLN Kesklinna õpperühmade ja õpetajate tunniplaan',
          lang: 'et',
          display: 'standalone',
          theme_color: '#3e1b86',
          // splash screen of the installed app; fixed at install time, so Techno dark's background suits every theme best
          background_color: '#170c30',
          icons: [
            { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
            // the wordmark sits inside the maskable safe zone, so the same image serves both
            { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          // Estonian only needs Onest's Latin subsets; the others still load on demand when online
          globPatterns: ['**/*.{js,css,html,svg,png}', 'assets/onest-latin*.woff2'],
          runtimeCaching: [
            {
              // Timetable snapshot: fresh when online, the last copy when offline or on a slow network
              urlPattern: ({ url }) => url.pathname.includes('/data/') && url.pathname.endsWith('.json'),
              handler: 'NetworkFirst',
              options: {
                cacheName: 'timetable-data',
                networkTimeoutSeconds: 4,
                expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },
          ],
        },
      }),
    ],
    base: command === 'build' ? '/tahvel-tunniplaan/' : '/'
  }
});
