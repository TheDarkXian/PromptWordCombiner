
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { createRequire } from 'module';

// Fix: Define __dirname for ESM environment
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const tauriConfig = require('./src-tauri/tauri.conf.json');

export default defineConfig(({ mode }) => {
    loadEnv(mode, '.', '');
    return {
      server: {
        port: 3004,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        __APP_VERSION__: JSON.stringify(tauriConfig.version),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
