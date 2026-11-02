import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

/** App version from package.json, shown in the UI and written into saves. */
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

export default defineConfig({
  base: './',
  server: { host: true },
  define: { __APP_VERSION__: JSON.stringify(version) },
});
