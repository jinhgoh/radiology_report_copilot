// Optional localhost preview. Opening index.html directly also works.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const files = new Set(['index.html', 'style.css', 'app.js', 'desktop-controls.js', 'core.js', 'evaluations.js', 'reference-data.js', 'RadiologyReportCopilot.ico']);
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.ico': 'image/x-icon' };
const server = http.createServer((req, res) => {
  const name = new URL(req.url, 'http://localhost').pathname.slice(1) || 'index.html';
  if (!files.has(name)) { res.writeHead(404); res.end('Not found'); return; }
  fs.readFile(path.join(__dirname, name), (error, data) => {
    if (error) { res.writeHead(500); res.end('Unable to read file'); return; }
    const contentType = mime[path.extname(name)] + (name.endsWith('.ico') ? '' : '; charset=utf-8');
    res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-store' });
    res.end(data);
  });
});
server.listen(4173, '127.0.0.1', () => console.log('Open http://127.0.0.1:4173'));
