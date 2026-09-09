import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DIST_DIR = path.join(__dirname, 'dist')
const PORT = parseInt(process.env.PORT || process.env.APP_PORT || '3008', 10)

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject'
}

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain' })
    res.end('Method Not Allowed')
    return
  }

  // Parse URL pathname safely
  const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
  let safePath = path.normalize(parsedUrl.pathname).replace(/^(\.\.[/\\])+/, '')
  if (safePath === '/' || safePath === '\\') {
    safePath = '/index.html'
  }

  let filePath = path.join(DIST_DIR, safePath)

  // Check if file exists in dist
  fs.stat(filePath, (err, stats) => {
    // If not found or is directory, fallback to index.html (SPA routing)
    if (err || !stats.isFile()) {
      filePath = path.join(DIST_DIR, 'index.html')
    }

    const ext = path.extname(filePath).toLowerCase()
    const contentType = MIME_TYPES[ext] || 'application/octet-stream'

    // Cache control policy
    let cacheControl = 'public, max-age=3600'
    if (filePath.includes(`${path.sep}assets${path.sep}`)) {
      cacheControl = 'public, max-age=31536000, immutable'
    } else if (filePath.endsWith('sw.js') || filePath.endsWith('registerSW.js') || filePath.endsWith('index.html') || filePath.endsWith('manifest.webmanifest')) {
      cacheControl = 'no-cache, no-store, must-revalidate'
    }

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500, { 'Content-Type': 'text/plain' })
        res.end('500 Internal Server Error')
        return
      }

      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': cacheControl,
        'X-Content-Type-Options': 'nosniff'
      })
      res.end(content)
    })
  })
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Kasir Web PWA] Server running on http://0.0.0.0:${PORT}`)
})
