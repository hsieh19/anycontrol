import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import fs from 'fs'

// 动态读取项目版本号 (优先根目录 package.json，其次当前 client/package.json)
let appVersion = '1.0.1'
try {
  const rootPkgPath = path.resolve(__dirname, '../package.json')
  if (fs.existsSync(rootPkgPath)) {
    appVersion = JSON.parse(fs.readFileSync(rootPkgPath, 'utf-8')).version || appVersion
  } else {
    const clientPkgPath = path.resolve(__dirname, './package.json')
    if (fs.existsSync(clientPkgPath)) {
      appVersion = JSON.parse(fs.readFileSync(clientPkgPath, 'utf-8')).version || appVersion
    }
  }
} catch (_) {}

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(appVersion)
  },
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true
      },
      '/ws': {
        target: 'ws://127.0.0.1:3000',
        ws: true
      }
    }
  }
})
