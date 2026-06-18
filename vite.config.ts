import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

const trimTrailingSlash = (value = "") => String(value || "").replace(/\/+$/, "");

const resolveBackendPublicUrl = () =>
  trimTrailingSlash(process.env.VITE_API_BASE_URL || process.env.VITE_API_URL || process.env.BACKEND_PUBLIC_URL || "https://zerodayguardian-backend.onrender.com");

const resolvePyApiPublicUrl = (backendPublicUrl: string) => {
  const explicitPyApi = trimTrailingSlash(process.env.VITE_PY_API_URL || process.env.PY_API_PUBLIC_URL || "");
  if (explicitPyApi) return explicitPyApi;
  return backendPublicUrl ? `${backendPublicUrl}/pyapi` : "";
};

const resolveSiteUrl = () =>
  trimTrailingSlash(process.env.VITE_SITE_URL || process.env.APP_BASE_URL || "https://zerodayguardian-delta.vercel.app");

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "https://zerodayguardian-backend.onrender.com",
        changeOrigin: true,
        secure: false,
      },
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') }
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 3000,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'router': ['react-router-dom'],
        }
      }
    }
  },
  define: {
    __BACKEND_PUBLIC_URL__: JSON.stringify(resolveBackendPublicUrl()),
    __PY_API_PUBLIC_URL__: JSON.stringify(resolvePyApiPublicUrl(resolveBackendPublicUrl())),
    __SITE_URL__: JSON.stringify(resolveSiteUrl()),
  }
});

