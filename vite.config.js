import { VitePWA } from 'vite-plugin-pwa'

export default {
     plugins: [
       VitePWA({
         registerType: 'autoUpdate',
            devOptions: {
              enabled: true
            },
         includeAssets: ['/images/favicon.ico', '/images/favicon.svg', '/images/apple-touch-icon.png', '/images/mask-icon.svg'],
         manifest: {
           name: 'Flock 3D Blocks',
           short_name: 'Flock',
           description: 'Create 3D apps with blocks',
           theme_color: '#800080',
           start_url: '.',
           icons: [
             {
               src: '/images/icon_192x192.png',
               sizes: '192x192',
               type: 'image/png'
             },
             {
               src: '/images/icon_512x512.png',
               sizes: '512x512',
               type: 'image/png'
             }
           ]
         },
         workbox: {
           runtimeCaching: [
             {
               urlPattern: ({ request }) => request.destination === 'images',
               handler: 'CacheFirst',
               options: {
                 cacheName: 'images-cache',
                 expiration: {
                   maxEntries: 10,
                   maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
                 },
               },
             },
           ],
         },
       })
       ],
  server: {
	   host: '0.0.0.0',
  }
}