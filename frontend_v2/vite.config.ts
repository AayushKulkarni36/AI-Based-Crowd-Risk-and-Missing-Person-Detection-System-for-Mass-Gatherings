import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        proxy: {
            '/api': {
                target: 'http://localhost:5000',
                changeOrigin: true,
                // Do NOT rewrite — backend serves routes under /api
            },
            '/uploads': {
                target: 'http://localhost:5000',
                changeOrigin: true,
            },
            '/results': {
                target: 'http://localhost:5000',
                changeOrigin: true,
            },
            '/video': {
                target: 'http://localhost:5000',
                changeOrigin: true,
            },
            '/socket.io': {
                target: 'http://localhost:5000',
                changeOrigin: true,
                ws: true, // WebSocket proxy for Socket.io
            }
        }
    }
})
