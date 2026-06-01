import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Configuração Vite para a aplicação Parlamento 3D
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true
  }
})
