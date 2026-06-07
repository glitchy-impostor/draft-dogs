// GitHub Pages doesn't know about client-side routes — a direct visit to
// /arcade/epl returns 404 unless we provide a fallback HTML that re-loads
// the SPA. Copying dist/index.html to dist/404.html is the standard fix.
// Also emit .nojekyll so Pages doesn't strip files that start with "_".

import fs from 'node:fs';
import path from 'node:path';

const dist = path.resolve(import.meta.dirname, '..', 'dist');
const index = path.join(dist, 'index.html');
if (!fs.existsSync(index)) {
  console.error('postbuild-spa-fallback: dist/index.html missing — build failed?');
  process.exit(1);
}
fs.copyFileSync(index, path.join(dist, '404.html'));
fs.writeFileSync(path.join(dist, '.nojekyll'), '');
console.log('postbuild-spa-fallback: wrote dist/404.html and dist/.nojekyll');
