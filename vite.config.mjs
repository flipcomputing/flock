import { VitePWA } from 'vite-plugin-pwa'
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default {
  plugins: [
    viteStaticCopy({
      targets: [
        {
          src: 'models/*.{glb,gltf}',
          dest: 'models'
        },
        {
          src: 'sounds/*.ogg',
          dest: 'sounds'
        }
      ]
    }),
    VitePWA({
      base: '/flock/',
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true
      },
      assetsInclude: ['**/*.glb', '**/*.gltf', '**/*.ogg'],
      includeAssets: ['**/*.glb', '**/*.gltf', '**/*.ogg'],
      manifest: {
        name: 'Flock 3D Blocks',
        short_name: 'Flock',
        description: 'Create 3D apps with blocks',
        theme_color: '#800080',
        start_url: './flock/',
        icons: [
          {
            src: '/flock/images/icon_192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/flock/images/icon_512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 15000000, 
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
    fs: {
      // Allow serving files outside of the root
      allow: [
        "../.."
      ]
    }
  },
  optimizeDeps: { exclude: ["@babylonjs/havok"] },
}