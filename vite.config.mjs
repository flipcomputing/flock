import { VitePWA } from 'vite-plugin-pwa'
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { copyFileSync, readdirSync } from 'fs';
import { resolve } from 'path';
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js';
import { writeFileSync } from 'fs';

// Determine if we are in production mode
const isProduction = process.env.NODE_ENV === 'production';
const BASE_URL = process.env.VITE_BASE_URL || '/';

export default {
  plugins: [
    cssInjectedByJsPlugin(),
    viteStaticCopy({
      targets: [
        {
          src: 'models/*.{glb,gltf}',
          dest: 'models'
        },
        {
          src: 'animations/*.{glb,gltf}',
          dest: 'animations'
        },
        {
          src: 'sounds/*.{ogg,mp3,aac,wav}',
          dest: 'sounds'
        },
        {
          src: 'images/*.*',
          dest: 'images'
        },
        {
          src: 'examples/*.json',
          dest: 'examples'
        },
        {
          src: 'textures/*.png',
          dest: 'textures'
        },
        {
          src: 'fonts/*.{json,woff2}',
          dest: 'fonts'
        },
        {
          src: 'node_modules/blockly/media/*',
          dest: 'blockly/media',
        },
        {
          src: 'images/dropdown-arrow.svg',
          dest: 'blockly/media',
        },
        /*{
          src: 'flock.js', 
          dest: ''      
        }*/
      ]
    }),
    VitePWA({
      base: BASE_URL,
      registerType: 'autoUpdate',
      devOptions: {
        enabled: false
      },
      assetsInclude: ['**/*.glb', '**/*.gltf', '**/*.ogg', '**/*.aac', '**/*.mp3', '**/*.json', '**/*.png', '**/*.woff', '**/*.woff2', '**/*.css', '**/*.svg', '**/*.wasm'],
      includeAssets: ['**/*.glb', '**/*.gltf', '**/*.ogg', '**/*.aac', '**/*.mp3', '**/*.json', '**/*.png', '**/*.woff', '**/*.woff2', '**/*.css', '**/*.svg', '**/*.wasm'],
      manifest: {
        name: 'Flock XR - Creative coding in 3D',
        short_name: 'Flock XR',
        description: 'Create 3D apps with code blocks',
        theme_color: '#511d91',
        background_color: '#ffffff',
        display: 'fullscreen',
        start_url: isProduction ? BASE_URL + '?fullscreen=true' : '/',
        id: isProduction ? BASE_URL + '?fullscreen=true' : '/',
        scope: BASE_URL,
        orientation: 'any',
        categories: ['education', 'games'],
        icons: [
          {
            src: 'images/icon_192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: 'images/icon_512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 25000000,
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
        modifyURLPrefix: isProduction ? {
          '': BASE_URL, // Prepend the base URL to all cached assets in production
        } : {},
        runtimeCaching: [
          {
            // Cache all static assets
            urlPattern: /.*\.(glb|gltf|ogg|mp3|aac|png|jpg|jpeg|svg|wasm|json|woff|woff2|css|js|html)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'static-assets',
              expiration: {
                maxEntries: 1000,
                maxAgeSeconds: 365 * 24 * 60 * 60, // Cache for 1 year
              },
            },
          },
          {
            // Cache models directory
            urlPattern: /\/models\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'models-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 365 * 24 * 60 * 60,
              },
            },
          },
          {
            // Cache sounds directory
            urlPattern: /\/sounds\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'sounds-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 365 * 24 * 60 * 60,
              },
            },
          },
          {
            // Cache textures directory
            urlPattern: /\/textures\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'textures-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 365 * 24 * 60 * 60,
              },
            },
          },
          {
            // Cache examples directory
            urlPattern: /\/examples\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'examples-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 365 * 24 * 60 * 60,
              },
            },
          },
          {
            // Cache Blockly media files
            urlPattern: /\/blockly\/media\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'blockly-media',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 365 * 24 * 60 * 60,
              },
            },
          },
          {
            // Cache same-origin requests
            urlPattern: ({ url }) => url.origin === self.location.origin,
            handler: 'CacheFirst',
            options: {
              cacheName: 'same-origin-cache',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 365 * 24 * 60 * 60,
              },
            },
          },
        ],
        cleanupOutdatedCaches: true, // Remove old cache versions
      },
    }),
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
    /*{
      name: 'copy-bundle-with-fixed-name',
      writeBundle(options, bundle) {
        let jsFileName;

        // Look for the main JavaScript file in the bundle
        for (const fileName in bundle) {
          if (fileName.endsWith('.js')) {
            jsFileName = fileName;
            break;  // Assuming the first .js file is the main one; adjust if needed
          }
        }

        if (jsFileName) {
          const srcPath = resolve(options.dir, jsFileName);
          const destPath = resolve(options.dir, 'flock.js');

          try {
            copyFileSync(srcPath, destPath);
            console.log(`Copied ${jsFileName} to flock.js`);
          } catch (error) {
            console.error(`Failed to copy file: ${error.message}`);
          }
        } else {
          console.error('No JavaScript file found in the bundle.');
        }
      },
    },*/
    {
      name: 'copy-library-files',
      writeBundle() {
        copyFileSync('example.html', 'dist/example.html');
        copyFileSync('flockdemo.html', 'dist/flockdemo.html');
      },
    },
  ],
  server: {
    host: '0.0.0.0',
    fs: {
      // Allow serving files outside of the root
      allow: [
        "../.."
      ]
    },
    allowedHosts: ['27c4c3b0-9860-47aa-a95d-03ca8acd6af0-00-2qj22wjmgrujn.picard.replit.dev', '1099a351-df60-40b5-bf61-4999bad0d153-00-4np7mg24c4rr.janeway.replit.dev'] //added this
  },
  optimizeDeps: { exclude: ["@babylonjs/havok"] },
  build: {
    assetsInlineLimit: 100000,  // Set high enough to include font files
    cssCodeSplit: false,  // Disables CSS code splitting and inlines CSS into JavaScript
    rollupOptions: {
      input: 'index.html',
    },
  }
}