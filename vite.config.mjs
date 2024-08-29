import { VitePWA } from 'vite-plugin-pwa'
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { copyFileSync, readdirSync } from 'fs';
import { resolve } from 'path';
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
        {
          src: 'examples/*.json',
          dest: 'examples'
        },
        {
          src: 'textures/*.png',
          dest: 'textures'
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
      assetsInclude: ['**/*.glb', '**/*.gltf', '**/*.ogg', '**/*.json', '**/*.png',] ,
      includeAssets: ['**/*.glb', '**/*.gltf', '**/*.ogg', '**/*.json', '**/*.png',],
      manifest: {
        name: 'Flock 3D Blocks',
        short_name: 'Flock',
        description: 'Create 3D apps with blocks',
        theme_color: '#800080',
        display: 'standalone',
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
          '**/*.{js,css,html,ico,png,svg,glb,gltf,ogg,wasm,json}'
        ],
        modifyURLPrefix: isProduction ? {
          '': '/flock/' // Prepend the base URL to all cached assets in production
        } : {},
        runtimeCaching: [
          {
            urlPattern: new RegExp('^https://flipcomputing\\.github\\.io/flock/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'github-pages-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
              },
            },
          },
        ],
      },
    }),
    {
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
    rollupOptions: {
      input: 'index.html', 
    },
  },
}