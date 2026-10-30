import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig({build:{rollupOptions:{input:{main:'index.html',migration:'migration.html'}}},plugins:[react(),tailwindcss(),VitePWA({registerType:'prompt',includeAssets:['icon-192.png','icon-512.png'],manifest:{name:'Mindflow 知识卡片',short_name:'Mindflow',lang:'zh-CN',start_url:'/',display:'standalone',background_color:'#f6f5ef',theme_color:'#164e43',icons:[{src:'/icon-192.png',sizes:'192x192',type:'image/png'},{src:'/icon-512.png',sizes:'512x512',type:'image/png',purpose:'any maskable'}]},workbox:{globPatterns:['**/*.{js,css,html,png,svg,webmanifest}'],navigateFallback:'/index.html',cleanupOutdatedCaches:true}})],test:{include:['tests/**/*.test.ts'],environment:'node'}});
