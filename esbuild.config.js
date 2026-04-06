import { build } from 'esbuild';

await build({
  entryPoints: ['server.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outfile: 'dist/server.js',
  external: [
    'vite',
    '@vitejs/plugin-react',
    '@tailwindcss/vite',
  ],
  banner: {
    js: `
import { createRequire } from 'module';
import { fileURLToPath as __fileURLToPath } from 'url';
import { dirname as __dirname_fn } from 'path';
const require = createRequire(import.meta.url);
const __filename = __fileURLToPath(import.meta.url);
const __dirname = __dirname_fn(__filename);
`.trim(),
  },
  define: {
    'process.env.NODE_ENV': '"production"',
  },
});

console.log('Server bundled to dist/server.js');
