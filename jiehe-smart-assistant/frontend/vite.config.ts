import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';
import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';
import { VantResolver } from 'unplugin-vue-components/resolvers';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    vue(),
    // 自动导入Vue API和组件
    AutoImport({
      imports: ['vue', 'vue-router', 'pinia'],
      dts: true,
      eslintrc: {
        enabled: true,
      },
    }),
    // 自动导入组件
    Components({
      resolvers: [VantResolver()],
      dts: true,
    }),
    // PWA配置
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: false,  // 暂时禁用开发模式下的SW
        type: 'module'
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true
      },
      manifest: {
        name: '家和智能助手',
        short_name: '家和助手',
        description: '智能家庭协作管理助手',
        theme_color: '#667eea',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        lang: 'zh-CN',
        categories: ['productivity', 'utilities'],
        icons: [
          {
            src: '/favicon.ico',
            sizes: '48x48',
            type: 'image/x-icon'
          }
        ]
      }
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    open: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8081',
        changeOrigin: true,
        secure: false,
      },
      '/socket.io': {
        target: 'http://localhost:8081',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  build: {
    target: 'es2015',
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    rollupOptions: {
      output: {
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
        manualChunks: (id) => {
          // Vue核心库
          if (id.includes('node_modules/vue') || id.includes('vue-router') || id.includes('pinia')) {
            return 'vue-core'
          }
          // Vant UI组件库
          if (id.includes('node_modules/vant')) {
            return 'vant-ui'
          }
          // 工具库
          if (id.includes('node_modules/axios') || id.includes('node_modules/dayjs')) {
            return 'utils'
          }
          // Socket.IO
          if (id.includes('socket.io')) {
            return 'socket'
          }
          // Analytics相关模块
          if (id.includes('/views/Analytics') || id.includes('analytics')) {
            return 'analytics'
          }
          // AI相关模块
          if (id.includes('/views/AI') || id.includes('ai-service')) {
            return 'ai-features'
          }
          // 家庭管理模块
          if (id.includes('/views/Family') || id.includes('/views/Tasks')) {
            return 'family-management'
          }
          // 库存管理模块
          if (id.includes('/views/Inventory')) {
            return 'inventory'
          }
          // 点菜和日历模块
          if (id.includes('/views/Menu') || id.includes('/views/Calendar')) {
            return 'dining-calendar'
          }
          // 留言板模块
          if (id.includes('/views/Messages')) {
            return 'messages'
          }
          // 其他第三方库
          if (id.includes('node_modules')) {
            return 'vendor'
          }
        },
      },
    },
    chunkSizeWarningLimit: 1000,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log'],
      },
    },
  },
  css: {
    // PostCSS配置将从postcss.config.js文件中读取
  },
});