import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        VitePWA({
          registerType: 'autoUpdate',
          includeAssets: ['icon-192x192.svg', 'icon-512x512.svg'],
          manifest: {
            name: 'Smart Invoice & Accounting AI',
            short_name: 'SmartInvoice',
            description: 'AI-powered invoicing and accounting application.',
            theme_color: '#ffffff',
            background_color: '#ffffff',
            display: 'standalone',
            icons: [
              {
                src: 'icon-192x192.svg',
                sizes: '192x192',
                type: 'image/svg+xml'
              },
              {
                src: 'icon-512x512.svg',
                sizes: '512x512',
                type: 'image/svg+xml'
              },
              {
                src: 'icon-512x512.svg',
                sizes: '512x512',
                type: 'image/svg+xml',
                purpose: 'any maskable'
              }
            ]
          }
        })
      ],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        chunkSizeWarningLimit: 1100,
        rollupOptions: {
          output: {
            // Vite 8 (Rolldown) only accepts manualChunks as a function.
            manualChunks(id: string) {
              if (!id.includes('node_modules')) return;
              const inPkg = (...names: string[]) =>
                names.some((n) => id.includes(`/node_modules/${n}/`));
              if (inPkg('react', 'react-dom', 'react-router-dom')) return 'react-vendor';
              if (inPkg('recharts')) return 'charts';
              if (inPkg('jspdf', 'jspdf-autotable')) return 'pdf-jspdf';
              if (inPkg('html2pdf.js')) return 'pdf-html2pdf';
              if (inPkg('motion')) return 'motion';
            },
          },
        },
      },
    };
});
