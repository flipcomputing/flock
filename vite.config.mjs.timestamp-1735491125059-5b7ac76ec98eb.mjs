// vite.config.mjs
import { VitePWA } from "file:///home/runner/Flock/node_modules/vite-plugin-pwa/dist/index.js";
import { viteStaticCopy } from "file:///home/runner/Flock/node_modules/vite-plugin-static-copy/dist/index.js";
import { copyFileSync, readdirSync } from "fs";
import { resolve } from "path";
import cssInjectedByJsPlugin from "file:///home/runner/Flock/node_modules/vite-plugin-css-injected-by-js/dist/esm/index.js";
var isProduction = process.env.NODE_ENV === "production";
var vite_config_default = {
  plugins: [
    cssInjectedByJsPlugin(),
    viteStaticCopy({
      targets: [
        {
          src: "models/*.{glb,gltf}",
          dest: "models"
        },
        {
          src: "sounds/*.ogg",
          dest: "sounds"
        },
        {
          src: "images/*.*",
          dest: "images"
        },
        {
          src: "examples/*.json",
          dest: "examples"
        },
        {
          src: "textures/*.png",
          dest: "textures"
        },
        {
          src: "fonts/*.json",
          dest: "fonts"
        },
        {
          src: "node_modules/blockly/media/*",
          dest: "blockly/media"
        },
        {
          src: "images/dropdown-arrow.svg",
          dest: "blockly/media"
        }
        /*{
          src: 'flock.js', 
          dest: ''      
        }*/
      ]
    }),
    VitePWA({
      base: isProduction ? "/flock/" : "/",
      registerType: "autoUpdate",
      devOptions: {
        enabled: true
      },
      assetsInclude: ["**/*.glb", "**/*.gltf", "**/*.ogg", "**/*.json", "**/*.png", "**/*.woff", "**/*.woff2", "**/*.css", "**/*.svg"],
      includeAssets: ["**/*.glb", "**/*.gltf", "**/*.ogg", "**/*.json", "**/*.png", "**/*.woff", "**/*.woff2", "**/*.css", "**/*.svg"],
      manifest: {
        name: "Flock XR - Creating coding in 3D",
        short_name: "Flock",
        description: "Create 3D apps with blocks",
        theme_color: "#800080",
        display: "fullscreen",
        start_url: isProduction ? "/flock/?fullscreen=true" : "/",
        id: isProduction ? "/flock/?fullscreen=true" : "/",
        scope: isProduction ? "/flock/" : "/",
        icons: [
          {
            src: "images/icon_192x192.png",
            sizes: "192x192",
            type: "image/png"
          },
          {
            src: "images/icon_512x512.png",
            sizes: "512x512",
            type: "image/png"
          }
        ]
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 20971520,
        globPatterns: [
          "**/*.{js,css,html,ico,png,svg,glb,gltf,ogg,wasm,json,woff,woff2}"
          // Precache all assets
        ],
        modifyURLPrefix: isProduction ? {
          "": "/flock/"
          // Prepend the base URL to all cached assets in production
        } : {},
        runtimeCaching: [
          {
            // Cache dynamically requested assets (models, images, sounds)
            urlPattern: /.*\.(glb|gltf|ogg|png|json|svg)$/,
            handler: "CacheFirst",
            // Prioritise cache for faster offline availability
            options: {
              cacheName: "dynamic-assets",
              expiration: {
                maxEntries: 500,
                // Store up to 500 assets
                maxAgeSeconds: 30 * 24 * 60 * 60
                // Cache for 30 days
              }
            }
          },
          {
            // Cache assets from GitHub Pages
            urlPattern: new RegExp("^https://flipcomputing\\.github\\.io/flock/"),
            handler: "CacheFirst",
            // Cache GitHub-hosted assets
            options: {
              cacheName: "github-pages-cache",
              expiration: {
                maxEntries: 50,
                // Store up to 50 assets
                maxAgeSeconds: 30 * 24 * 60 * 60
                // Cache for 30 days
              }
            }
          },
          {
            // Cache Blockly media files
            urlPattern: /blockly\/media\/.*/,
            handler: "CacheFirst",
            // Serve Blockly media files from cache
            options: {
              cacheName: "blockly-media",
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 30 * 24 * 60 * 60
                // Cache for 30 days
              }
            }
          }
        ],
        cleanupOutdatedCaches: true
        // Remove old cache versions
      }
    }),
    {
      name: "copy-bundle-with-fixed-name",
      writeBundle(options, bundle) {
        let jsFileName;
        for (const fileName in bundle) {
          if (fileName.endsWith(".js")) {
            jsFileName = fileName;
            break;
          }
        }
        if (jsFileName) {
          const srcPath = resolve(options.dir, jsFileName);
          const destPath = resolve(options.dir, "flock.js");
          try {
            copyFileSync(srcPath, destPath);
            console.log(`Copied ${jsFileName} to flock.js`);
          } catch (error) {
            console.error(`Failed to copy file: ${error.message}`);
          }
        } else {
          console.error("No JavaScript file found in the bundle.");
        }
      }
    },
    {
      name: "copy-library-files",
      writeBundle() {
        copyFileSync("example.html", "dist/example.html");
      }
    }
  ],
  server: {
    host: "0.0.0.0",
    fs: {
      // Allow serving files outside of the root
      allow: [
        "../.."
      ]
    }
  },
  optimizeDeps: { exclude: ["@babylonjs/havok"] },
  build: {
    assetsInlineLimit: 1e5,
    // Set high enough to include font files
    cssCodeSplit: false,
    // Disables CSS code splitting and inlines CSS into JavaScript
    rollupOptions: {
      input: "index.html"
    }
  }
};
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcubWpzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiL2hvbWUvcnVubmVyL0Zsb2NrXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvaG9tZS9ydW5uZXIvRmxvY2svdml0ZS5jb25maWcubWpzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9ob21lL3J1bm5lci9GbG9jay92aXRlLmNvbmZpZy5tanNcIjtpbXBvcnQgeyBWaXRlUFdBIH0gZnJvbSAndml0ZS1wbHVnaW4tcHdhJ1xuaW1wb3J0IHsgdml0ZVN0YXRpY0NvcHkgfSBmcm9tICd2aXRlLXBsdWdpbi1zdGF0aWMtY29weSc7XG5pbXBvcnQgeyBjb3B5RmlsZVN5bmMsIHJlYWRkaXJTeW5jIH0gZnJvbSAnZnMnO1xuaW1wb3J0IHsgcmVzb2x2ZSB9IGZyb20gJ3BhdGgnO1xuaW1wb3J0IGNzc0luamVjdGVkQnlKc1BsdWdpbiBmcm9tICd2aXRlLXBsdWdpbi1jc3MtaW5qZWN0ZWQtYnktanMnO1xuLy8gRGV0ZXJtaW5lIGlmIHdlIGFyZSBpbiBwcm9kdWN0aW9uIG1vZGVcbmNvbnN0IGlzUHJvZHVjdGlvbiA9IHByb2Nlc3MuZW52Lk5PREVfRU5WID09PSAncHJvZHVjdGlvbic7XG5cbmV4cG9ydCBkZWZhdWx0IHtcbiAgcGx1Z2luczogW1xuICAgIGNzc0luamVjdGVkQnlKc1BsdWdpbigpLFxuICAgIHZpdGVTdGF0aWNDb3B5KHtcbiAgICAgIHRhcmdldHM6IFtcbiAgICAgICAge1xuICAgICAgICAgIHNyYzogJ21vZGVscy8qLntnbGIsZ2x0Zn0nLFxuICAgICAgICAgIGRlc3Q6ICdtb2RlbHMnXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBzcmM6ICdzb3VuZHMvKi5vZ2cnLFxuICAgICAgICAgIGRlc3Q6ICdzb3VuZHMnXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBzcmM6ICdpbWFnZXMvKi4qJyxcbiAgICAgICAgICBkZXN0OiAnaW1hZ2VzJ1xuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgc3JjOiAnZXhhbXBsZXMvKi5qc29uJyxcbiAgICAgICAgICBkZXN0OiAnZXhhbXBsZXMnXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBzcmM6ICd0ZXh0dXJlcy8qLnBuZycsXG4gICAgICAgICAgZGVzdDogJ3RleHR1cmVzJ1xuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgc3JjOiAnZm9udHMvKi5qc29uJyxcbiAgICAgICAgICBkZXN0OiAnZm9udHMnXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBzcmM6ICdub2RlX21vZHVsZXMvYmxvY2tseS9tZWRpYS8qJyxcbiAgICAgICAgICBkZXN0OiAnYmxvY2tseS9tZWRpYScsXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBzcmM6ICdpbWFnZXMvZHJvcGRvd24tYXJyb3cuc3ZnJyxcbiAgICAgICAgICBkZXN0OiAnYmxvY2tseS9tZWRpYScsXG4gICAgICAgIH0sXG4gICAgICAgIC8qe1xuICAgICAgICAgIHNyYzogJ2Zsb2NrLmpzJywgXG4gICAgICAgICAgZGVzdDogJycgICAgICBcbiAgICAgICAgfSovXG4gICAgICBdXG4gICAgfSksXG4gICAgVml0ZVBXQSh7XG4gICAgICBiYXNlOiBpc1Byb2R1Y3Rpb24gPyAnL2Zsb2NrLycgOiAnLycsXG4gICAgICByZWdpc3RlclR5cGU6ICdhdXRvVXBkYXRlJyxcbiAgICAgIGRldk9wdGlvbnM6IHtcbiAgICAgICAgZW5hYmxlZDogdHJ1ZVxuICAgICAgfSxcbiAgICAgIGFzc2V0c0luY2x1ZGU6IFsnKiovKi5nbGInLCAnKiovKi5nbHRmJywgJyoqLyoub2dnJywgJyoqLyouanNvbicsICcqKi8qLnBuZycsICcqKi8qLndvZmYnLCAnKiovKi53b2ZmMicsICcqKi8qLmNzcycsICcqKi8qLnN2ZycsXSxcbiAgICAgIGluY2x1ZGVBc3NldHM6IFsnKiovKi5nbGInLCAnKiovKi5nbHRmJywgJyoqLyoub2dnJywgJyoqLyouanNvbicsICcqKi8qLnBuZycsICcqKi8qLndvZmYnLCAnKiovKi53b2ZmMicsICcqKi8qLmNzcycsICcqKi8qLnN2ZycsXSxcbiAgICAgIG1hbmlmZXN0OiB7XG4gICAgICAgIG5hbWU6ICdGbG9jayBYUiAtIENyZWF0aW5nIGNvZGluZyBpbiAzRCcsXG4gICAgICAgIHNob3J0X25hbWU6ICdGbG9jaycsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnQ3JlYXRlIDNEIGFwcHMgd2l0aCBibG9ja3MnLFxuICAgICAgICB0aGVtZV9jb2xvcjogJyM4MDAwODAnLFxuICAgICAgICBkaXNwbGF5OiAnZnVsbHNjcmVlbicsXG4gICAgICAgIHN0YXJ0X3VybDogaXNQcm9kdWN0aW9uID8gJy9mbG9jay8/ZnVsbHNjcmVlbj10cnVlJyA6ICcvJyxcbiAgICAgICAgaWQ6IGlzUHJvZHVjdGlvbiA/ICcvZmxvY2svP2Z1bGxzY3JlZW49dHJ1ZScgOiAnLycsXG4gICAgICAgIHNjb3BlOiBpc1Byb2R1Y3Rpb24gPyAnL2Zsb2NrLycgOiAnLycsXG5cbiAgICAgICAgaWNvbnM6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBzcmM6ICdpbWFnZXMvaWNvbl8xOTJ4MTkyLnBuZycsXG4gICAgICAgICAgICBzaXplczogJzE5MngxOTInLFxuICAgICAgICAgICAgdHlwZTogJ2ltYWdlL3BuZydcbiAgICAgICAgICB9LFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIHNyYzogJ2ltYWdlcy9pY29uXzUxMng1MTIucG5nJyxcbiAgICAgICAgICAgIHNpemVzOiAnNTEyeDUxMicsXG4gICAgICAgICAgICB0eXBlOiAnaW1hZ2UvcG5nJ1xuICAgICAgICAgIH1cbiAgICAgICAgXVxuICAgICAgfSxcbiAgICAgIHdvcmtib3g6IHtcbiAgICAgICAgbWF4aW11bUZpbGVTaXplVG9DYWNoZUluQnl0ZXM6IDIwOTcxNTIwLFxuICAgICAgICBnbG9iUGF0dGVybnM6IFtcbiAgICAgICAgICAnKiovKi57anMsY3NzLGh0bWwsaWNvLHBuZyxzdmcsZ2xiLGdsdGYsb2dnLHdhc20sanNvbix3b2ZmLHdvZmYyfScsIC8vIFByZWNhY2hlIGFsbCBhc3NldHNcbiAgICAgICAgXSxcbiAgICAgICAgbW9kaWZ5VVJMUHJlZml4OiBpc1Byb2R1Y3Rpb24gPyB7XG4gICAgICAgICAgJyc6ICcvZmxvY2svJywgLy8gUHJlcGVuZCB0aGUgYmFzZSBVUkwgdG8gYWxsIGNhY2hlZCBhc3NldHMgaW4gcHJvZHVjdGlvblxuICAgICAgICB9IDoge30sXG4gICAgICAgIHJ1bnRpbWVDYWNoaW5nOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgLy8gQ2FjaGUgZHluYW1pY2FsbHkgcmVxdWVzdGVkIGFzc2V0cyAobW9kZWxzLCBpbWFnZXMsIHNvdW5kcylcbiAgICAgICAgICAgIHVybFBhdHRlcm46IC8uKlxcLihnbGJ8Z2x0ZnxvZ2d8cG5nfGpzb258c3ZnKSQvLFxuICAgICAgICAgICAgaGFuZGxlcjogJ0NhY2hlRmlyc3QnLCAvLyBQcmlvcml0aXNlIGNhY2hlIGZvciBmYXN0ZXIgb2ZmbGluZSBhdmFpbGFiaWxpdHlcbiAgICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgICAgY2FjaGVOYW1lOiAnZHluYW1pYy1hc3NldHMnLFxuICAgICAgICAgICAgICBleHBpcmF0aW9uOiB7XG4gICAgICAgICAgICAgICAgbWF4RW50cmllczogNTAwLCAvLyBTdG9yZSB1cCB0byA1MDAgYXNzZXRzXG4gICAgICAgICAgICAgICAgbWF4QWdlU2Vjb25kczogMzAgKiAyNCAqIDYwICogNjAsIC8vIENhY2hlIGZvciAzMCBkYXlzXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgLy8gQ2FjaGUgYXNzZXRzIGZyb20gR2l0SHViIFBhZ2VzXG4gICAgICAgICAgICB1cmxQYXR0ZXJuOiBuZXcgUmVnRXhwKCdeaHR0cHM6Ly9mbGlwY29tcHV0aW5nXFxcXC5naXRodWJcXFxcLmlvL2Zsb2NrLycpLFxuICAgICAgICAgICAgaGFuZGxlcjogJ0NhY2hlRmlyc3QnLCAvLyBDYWNoZSBHaXRIdWItaG9zdGVkIGFzc2V0c1xuICAgICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgICBjYWNoZU5hbWU6ICdnaXRodWItcGFnZXMtY2FjaGUnLFxuICAgICAgICAgICAgICBleHBpcmF0aW9uOiB7XG4gICAgICAgICAgICAgICAgbWF4RW50cmllczogNTAsIC8vIFN0b3JlIHVwIHRvIDUwIGFzc2V0c1xuICAgICAgICAgICAgICAgIG1heEFnZVNlY29uZHM6IDMwICogMjQgKiA2MCAqIDYwLCAvLyBDYWNoZSBmb3IgMzAgZGF5c1xuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIC8vIENhY2hlIEJsb2NrbHkgbWVkaWEgZmlsZXNcbiAgICAgICAgICAgIHVybFBhdHRlcm46IC9ibG9ja2x5XFwvbWVkaWFcXC8uKi8sXG4gICAgICAgICAgICBoYW5kbGVyOiAnQ2FjaGVGaXJzdCcsIC8vIFNlcnZlIEJsb2NrbHkgbWVkaWEgZmlsZXMgZnJvbSBjYWNoZVxuICAgICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgICBjYWNoZU5hbWU6ICdibG9ja2x5LW1lZGlhJyxcbiAgICAgICAgICAgICAgZXhwaXJhdGlvbjoge1xuICAgICAgICAgICAgICAgIG1heEVudHJpZXM6IDIwLFxuICAgICAgICAgICAgICAgIG1heEFnZVNlY29uZHM6IDMwICogMjQgKiA2MCAqIDYwLCAvLyBDYWNoZSBmb3IgMzAgZGF5c1xuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgICBjbGVhbnVwT3V0ZGF0ZWRDYWNoZXM6IHRydWUsIC8vIFJlbW92ZSBvbGQgY2FjaGUgdmVyc2lvbnNcbiAgICAgIH0sXG4gICAgfSksXG4gICAge1xuICAgICAgbmFtZTogJ2NvcHktYnVuZGxlLXdpdGgtZml4ZWQtbmFtZScsXG4gICAgICB3cml0ZUJ1bmRsZShvcHRpb25zLCBidW5kbGUpIHtcbiAgICAgICAgbGV0IGpzRmlsZU5hbWU7XG5cbiAgICAgICAgLy8gTG9vayBmb3IgdGhlIG1haW4gSmF2YVNjcmlwdCBmaWxlIGluIHRoZSBidW5kbGVcbiAgICAgICAgZm9yIChjb25zdCBmaWxlTmFtZSBpbiBidW5kbGUpIHtcbiAgICAgICAgICBpZiAoZmlsZU5hbWUuZW5kc1dpdGgoJy5qcycpKSB7XG4gICAgICAgICAgICBqc0ZpbGVOYW1lID0gZmlsZU5hbWU7XG4gICAgICAgICAgICBicmVhazsgIC8vIEFzc3VtaW5nIHRoZSBmaXJzdCAuanMgZmlsZSBpcyB0aGUgbWFpbiBvbmU7IGFkanVzdCBpZiBuZWVkZWRcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoanNGaWxlTmFtZSkge1xuICAgICAgICAgIGNvbnN0IHNyY1BhdGggPSByZXNvbHZlKG9wdGlvbnMuZGlyLCBqc0ZpbGVOYW1lKTtcbiAgICAgICAgICBjb25zdCBkZXN0UGF0aCA9IHJlc29sdmUob3B0aW9ucy5kaXIsICdmbG9jay5qcycpO1xuXG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvcHlGaWxlU3luYyhzcmNQYXRoLCBkZXN0UGF0aCk7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgQ29waWVkICR7anNGaWxlTmFtZX0gdG8gZmxvY2suanNgKTtcbiAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihgRmFpbGVkIHRvIGNvcHkgZmlsZTogJHtlcnJvci5tZXNzYWdlfWApO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb25zb2xlLmVycm9yKCdObyBKYXZhU2NyaXB0IGZpbGUgZm91bmQgaW4gdGhlIGJ1bmRsZS4nKTtcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICB9LFxuICAgIHtcbiAgICAgIG5hbWU6ICdjb3B5LWxpYnJhcnktZmlsZXMnLFxuICAgICAgd3JpdGVCdW5kbGUoKSB7XG4gICAgICAgIGNvcHlGaWxlU3luYygnZXhhbXBsZS5odG1sJywgJ2Rpc3QvZXhhbXBsZS5odG1sJyk7XG4gICAgICB9LFxuICAgIH0sXG4gIF0sXG4gIHNlcnZlcjoge1xuICAgIGhvc3Q6ICcwLjAuMC4wJyxcbiAgICBmczoge1xuICAgICAgLy8gQWxsb3cgc2VydmluZyBmaWxlcyBvdXRzaWRlIG9mIHRoZSByb290XG4gICAgICBhbGxvdzogW1xuICAgICAgICBcIi4uLy4uXCJcbiAgICAgIF1cbiAgICB9XG4gIH0sXG4gIG9wdGltaXplRGVwczogeyBleGNsdWRlOiBbXCJAYmFieWxvbmpzL2hhdm9rXCJdIH0sXG4gIGJ1aWxkOiB7XG4gICAgYXNzZXRzSW5saW5lTGltaXQ6IDEwMDAwMCwgIC8vIFNldCBoaWdoIGVub3VnaCB0byBpbmNsdWRlIGZvbnQgZmlsZXNcbiAgICBjc3NDb2RlU3BsaXQ6IGZhbHNlLCAgLy8gRGlzYWJsZXMgQ1NTIGNvZGUgc3BsaXR0aW5nIGFuZCBpbmxpbmVzIENTUyBpbnRvIEphdmFTY3JpcHRcbiAgICByb2xsdXBPcHRpb25zOiB7XG4gICAgICBpbnB1dDogJ2luZGV4Lmh0bWwnLFxuICAgIH0sXG4gIH0sXG59Il0sCiAgIm1hcHBpbmdzIjogIjtBQUEwTyxTQUFTLGVBQWU7QUFDbFEsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyxjQUFjLG1CQUFtQjtBQUMxQyxTQUFTLGVBQWU7QUFDeEIsT0FBTywyQkFBMkI7QUFFbEMsSUFBTSxlQUFlLFFBQVEsSUFBSSxhQUFhO0FBRTlDLElBQU8sc0JBQVE7QUFBQSxFQUNi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
