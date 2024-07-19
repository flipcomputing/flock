import { VitePWA } from 'vite-plugin-pwa'
import { viteStaticCopy } from 'vite-plugin-static-copy';

// Determine if we are in production mode
const isProduction = process.env.NODE_ENV === 'production';

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
        },
        {
          src: 'images/*.*',
          dest: 'images'
        },
      ]
    }),
    VitePWA({
      base: isProduction ? '/flock/' : '/',
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
       
        start_url: isProduction ? '/flock/' : '/', // Ensure this reflects the base URL
        scope: isProduction ? '/flock/' : '/', // Ensure this reflects the base URL

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
        globPatterns: [
          '**/*.{js,css,html,ico,png,svg,glb,gltf,ogg}'
        ],
        modifyURLPrefix: isProduction ? {
          '': '/flock/' // Prepend the base URL to all cached assets in production
        } : {},
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