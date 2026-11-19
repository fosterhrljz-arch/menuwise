const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
// Inline all local dependencies: file:// launch works without fetch or a server.
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
html = html.replace('<link rel="stylesheet" href="src/style.css">', '<style>' + fs.readFileSync(path.join(root, 'src/style.css'), 'utf8') + '</style>');
for (const file of ['vendor/exceljs.min.js', 'src/engine.js', 'src/import.js', 'src/data.js', 'src/decisions.js', 'src/i18n.js', 'src/charts.js', 'src/ui.js']) {
  const source = fs.readFileSync(path.join(root, file), 'utf8').replace(/<\/script/gi, '<\\/script');
  html = html.replace(`<script defer src="${file}"></script>`, () => `<script>${source}</script>`);
}
// Scripts need the DOM. Move inlined scripts to the bottom, retaining dependency order.
const scripts = [...html.matchAll(/<script>[\s\S]*?<\/script>/g)].map(m => m[0]);
html = html.replace(/<script>[\s\S]*?<\/script>/g, '').replace('</body>', () => scripts.join('\n') + '\n</body>');
fs.mkdirSync(path.join(root, 'dist'), {recursive:true});
fs.writeFileSync(path.join(root, 'dist/index.html'), html);
fs.writeFileSync(path.join(root, 'MenuWise.html'), html);
fs.copyFileSync(path.join(root, 'vendor/EXCELJS-LICENSE.txt'), path.join(root, 'dist/EXCELJS-LICENSE.txt'));
console.log('Built self-contained MenuWise.html and deployable dist/index.html (' + Buffer.byteLength(html) + ' bytes).');
