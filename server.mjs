// 依存ゼロの静的ファイルサーバー。
//   node server.mjs
// で起動し、ブラウザで http://localhost:5173 を開く。
// （ES モジュール + PNG からの getImageData のため、file:// ではなく http で開く必要がある）
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PORT = process.env.PORT || 5173;

const MIME = {
  '.html':'text/html; charset=utf-8',
  '.js':'text/javascript; charset=utf-8',
  '.mjs':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8',
  '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg',
  '.gif':'image/gif', '.svg':'image/svg+xml', '.json':'application/json',
  '.ico':'image/x-icon',
};

const server = createServer(async (req, res) => {
  try{
    let urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if(urlPath === '/') urlPath = '/index.html';
    // ディレクトリトラバーサル対策: ROOT の外へ出られないようにする
    const filePath = normalize(join(ROOT, urlPath));
    if(!filePath.startsWith(ROOT)){ res.writeHead(403); res.end('Forbidden'); return; }
    const data = await readFile(filePath);
    res.writeHead(200, {
      'Content-Type': MIME[extname(filePath).toLowerCase()] || 'application/octet-stream',
      // 開発用: ブラウザにキャッシュさせない(編集が即反映されるように)
      'Cache-Control': 'no-store, must-revalidate',
    });
    res.end(data);
  }catch{
    res.writeHead(404, { 'Content-Type':'text/plain; charset=utf-8' });
    res.end('404 Not Found');
  }
});

server.listen(PORT, () => {
  console.log(`\n  ゲームを起動しました → http://localhost:${PORT}\n  停止するには Ctrl+C\n`);
});
