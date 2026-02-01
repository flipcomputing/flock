import { VitePWA } from 'vite-plugin-pwa'
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { copyFileSync } from 'fs';
import { resolve } from 'path';
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js';
import { writeFileSync } from 'fs';

// Determine if we are in production mode
const isProduction = process.env.NODE_ENV === 'production';
const BASE_URL = process.env.VITE_BASE_URL || '/';

export default {
  // Ensure assets/chunk URLs are correct in standalone/PWA and under subpaths
  base: BASE_URL,

  plugins: [
    cssInjectedByJsPlugin(),
    viteStaticCopy({
      targets: [
        { src: 'models/*.{glb,gltf}', dest: 'models' },
        { src: 'animations/*.{glb,gltf}', dest: 'animations' },
        { src: 'sounds/*.{ogg,mp3,aac,wav}', dest: 'sounds' },
        { src: 'images/*.*', dest: 'images' },
        { src: 'examples/*.json', dest: 'examples' },
        { src: 'examples/*.flock', dest: 'examples' },
        { src: 'textures/*.png', dest: 'textures' },
        { src: 'fonts/*.{json,woff2,ttf}', dest: 'fonts' },
        { src: 'node_modules/manifold-3d/manifold.wasm', dest: 'wasm' },
        { src: 'node_modules/blockly/media/*', dest: 'blockly/media' },
        { src: 'images/dropdown-arrow.svg', dest: 'blockly/media' },
        {
          src: 'node_modules/ses/dist/lockdown.umd.min.js',
          dest: 'vendor/ses', // => served at /vendor/ses/lockdown.umd.min.js
        },
        // Copy the Draco decoder files from Babylon's package
        {
          src: 'node_modules/@babylonjs/core/assets/Draco/*',
          dest: 'draco', // will be served from /draco/
        },
      ]
    }),
    VitePWA({
      base: BASE_URL,
      registerType: 'autoUpdate',
      devOptions: { enabled: false },

      assetsInclude: [
        '**/*.glb', '**/*.gltf', '**/*.ogg', '**/*.aac', '**/*.mp3',
        '**/*.json', '**/*.flock', '**/*.png', '**/*.woff', '**/*.woff2',
        '**/*.css', '**/*.svg', '**/*.wasm'
      ],
      includeAssets: [
        '**/*.glb', '**/*.gltf', '**/*.ogg', '**/*.aac', '**/*.mp3',
        '**/*.json', '**/*.flock', '**/*.png', '**/*.woff', '**/*.woff2',
        '**/*.css', '**/*.svg', '**/*.wasm'
      ],

      manifest: {
        name: 'Flock XR - Creative coding in 3D',
        short_name: 'Flock XR',
        description: 'Create 3D apps with code blocks',
        theme_color: '#511d91',
        background_color: '#ffffff',
        display: 'fullscreen',

        // Keep start route simple and within scope
        start_url: BASE_URL,
        id: BASE_URL,
        scope: BASE_URL,

        orientation: 'any',
        categories: ['education', 'games'],
        icons: [
          { src: 'images/icon_192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: 'images/icon_512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      },

      workbox: {
        maximumFileSizeToCacheInBytes: 25_000_000,
        navigateFallback: `${BASE_URL}index.html`,
        navigateFallbackAllowlist: [
          new RegExp(`^${BASE_URL.replace(/\/$/, '')}/(?!api|assets/)`)
        ],
        globPatterns: [
          '**/*.{js,css,html,ico,png,svg,glb,gltf,ogg,mp3,aac,wasm,json,woff,woff2}',
          'models/**/*',
          'sounds/**/*',
          'images/**/*',
          'examples/**/*',
          'textures/**/*',
          'fonts/**/*',
          'blockly/media/**/*'
        ],
        modifyURLPrefix: isProduction ? { '': BASE_URL } : {},

        // Safe runtime caching: NetworkFirst for navigations; CacheFirst for real static assets
        runtimeCaching: [
          {
            // HTML shell (navigations)
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'pages',
              networkTimeoutSeconds: 5
            },
          },
          {
            // Static assets by destination
            urlPattern: ({ request }) =>
              ['script', 'style', 'image', 'font', 'audio', 'video', 'worker']
                .includes(request.destination),
            handler: 'CacheFirst',
            options: {
              cacheName: 'static-assets',
              expiration: {
                maxEntries: 1000,
                maxAgeSeconds: 365 * 24 * 60 * 60,
              },
            },
          },
          // Optional: keep your fine-grained caches
          {
            urlPattern: /\/models\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'models-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 365 * 24 * 60 * 60 },
            },
          },
          {
            urlPattern: /\/sounds\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'sounds-cache',
              rangeRequests: true,
              expiration: { maxEntries: 100, maxAgeSeconds: 365 * 24 * 60 * 60 },
            },
          },
          {
            urlPattern: /\/textures\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'textures-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 365 * 24 * 60 * 60 },
            },
          },
          {
            urlPattern: /\/examples\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'examples-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 365 * 24 * 60 * 60 },
            },
          },
          {
            urlPattern: /\/blockly\/media\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'blockly-media',
              expiration: { maxEntries: 50, maxAgeSeconds: 365 * 24 * 60 * 60 },
            },
          },
        ],

        cleanupOutdatedCaches: true,
      },
    }),

    // Build-time proxy that generates a stable 'flock.js' re-export
    {
      name: 'create-flock-proxy',
      writeBundle(options, bundle) {
        let hashedFileName;
        for (const fileName in bundle) {
          if (fileName.startsWith('assets/index-') && fileName.endsWith('.js')) {
            hashedFileName = fileName;
            break;
          }
        }
        if (hashedFileName) {
          const proxyContent = `export * from './${hashedFileName}';\n`;
          const proxyPath = resolve(options.dir, 'flock.js');
          try {
            writeFileSync(proxyPath, proxyContent);
            console.log(`Generated proxy file: flock.js -> ${hashedFileName}`);
          } catch (error) {
            console.error(`Failed to create proxy file: ${error.message}`);
          }
        } else {
          console.error('No hashed flock file found in the bundle.');
        }
      },
    },

    // Copy demo files
    {
      name: 'copy-library-files',
      writeBundle() {
        copyFileSync('cubeart.html', 'dist/cubeart.html');
      },
    },
  ],

  server: {
    host: '0.0.0.0',
    fs: { allow: ['../..'] },
    allowedHosts: [
      '27c4c3b0-9860-47aa-a95d-03ca8acd6af0-00-2qj22wjmgrujn.picard.replit.dev',
      '1099a351-df60-40b5-bf61-4999bad0d153-00-4np7mg24c4rr.janeway.replit.dev'
    ]
  },

  optimizeDeps: { exclude: ['@babylonjs/havok', 'manifold-3d'] },

  build: {
    assetsInlineLimit: 100000,   // include font files inline if needed
    cssCodeSplit: false,         // inline CSS into JS
    rollupOptions: { input: 'index.html' },
  }
}
