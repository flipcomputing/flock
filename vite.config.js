import { VitePWA } from 'vite-plugin-pwa'

export default {
     plugins: [
         VitePWA({
           registerType: 'autoUpdate',
           devOptions: {
             enabled: true
           }
         })
       ],
  server: {
	   host: '0.0.0.0',
  }
}