import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: {
          isCustomElement: (tag) => tag === 'lord-icon',
        },
      },
    }),
    tailwindcss(),
  ],
  optimizeDeps: {
    include: ['gsap', 'gsap/dist/Flip'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return
          }

          if (id.includes('@lordicon') || id.includes('lottie-web')) {
            return 'icon-player-v2'
          }

          if (id.includes('gsap')) {
            return 'motion-stack-v2'
          }

          if (id.includes('@tiptap') || id.includes('highlight.js') || id.includes('markdown-it')) {
            return 'editor-stack-v2'
          }

          if (id.includes('vue') || id.includes('pinia') || id.includes('vue-router')) {
            return 'vue-core-v2'
          }

          if (id.includes('@tanstack') || id.includes('axios') || id.includes('@vueuse')) {
            return 'data-stack-v2'
          }

          if (id.includes('@headlessui') || id.includes('lucide-vue-next')) {
            return 'ui-stack-v2'
          }

          return 'vendor-v2'
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/static': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
