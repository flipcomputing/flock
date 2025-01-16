import { VitePWA } from 'vite-plugin-pwa'
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { copyFileSync, readdirSync } from 'fs';
import { resolve } from 'path';
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js';
import { writeFileSync } from 'fs';

// Determine if we are in production mode
const isProduction = process.env.NODE_ENV === 'production';

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
          src: 'sounds/*.ogg',
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
          src: 'fonts/*.json',
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
      base: isProduction ? '/flock/' : '/',
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true
      },
      assetsInclude: ['**/*.glb', '**/*.gltf', '**/*.ogg', '**/*.json', '**/*.png', '**/*.woff', '**/*.woff2', '**/*.css', '**/*.svg',],
      includeAssets: ['**/*.glb', '**/*.gltf', '**/*.ogg', '**/*.json', '**/*.png', '**/*.woff', '**/*.woff2', '**/*.css', '**/*.svg',],
      manifest: {
        name: 'Flock XR - Creating coding in 3D',
        short_name: 'Flock XR',
        description: 'Create 3D apps with blocks',
        theme_color: '#511d91',
        display: 'fullscreen',
        start_url: isProduction ? '/flock/?fullscreen=true' : '/',
        id: isProduction ? '/flock/?fullscreen=true' : '/',
        scope: isProduction ? '/flock/' : '/',

        icons: [
          {
            src: 'images/icon_192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'images/icon_512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 20971520,
        globPatterns: [
          '**/*.{js,css,html,ico,png,svg,glb,gltf,ogg,wasm,json,woff,woff2}', // Precache all assets
        ],
        modifyURLPrefix: isProduction ? {
          '': '/flock/', // Prepend the base URL to all cached assets in production
        } : {},
        runtimeCaching: [
          {
            // Cache dynamically requested assets (models, images, sounds)
            urlPattern: /.*\.(glb|gltf|ogg|png|json|svg)$/,
            handler: 'CacheFirst', // Prioritise cache for faster offline availability
            options: {
              cacheName: 'dynamic-assets',
              expiration: {
                maxEntries: 500, // Store up to 500 assets
                maxAgeSeconds: 30 * 24 * 60 * 60, // Cache for 30 days
              },
            },
          },
          {
            // Cache assets from GitHub Pages
            urlPattern: new RegExp('^https://flipcomputing\\.github\\.io/flock/'),
            handler: 'CacheFirst', // Cache GitHub-hosted assets
            options: {
              cacheName: 'github-pages-cache',
              expiration: {
                maxEntries: 50, // Store up to 50 assets
                maxAgeSeconds: 30 * 24 * 60 * 60, // Cache for 30 days
              },
            },
          },
          {
            // Cache Blockly media files
            urlPattern: /blockly\/media\/.*/,
            handler: 'CacheFirst', // Serve Blockly media files from cache
            options: {
              cacheName: 'blockly-media',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 30 * 24 * 60 * 60, // Cache for 30 days
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
        copyFileSync('tutorial.html', 'dist/tutorial.html');
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
    }
  },
  optimizeDeps: { exclude: ["@babylonjs/havok"] },
  build: {
    assetsInlineLimit: 100000,  // Set high enough to include font files
    cssCodeSplit: false,  // Disables CSS code splitting and inlines CSS into JavaScript
    rollupOptions: {
      input: 'index.html',
      tutorial: 'tutorial.html'
    },
  },
}