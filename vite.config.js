import { defineConfig } from 'vite'
import { resolve } from 'path'
import fs from 'fs'
import path from 'path'

/* ── Gallery Manifest Plugin ──────────────────────────────────────
   Scans /public/gallery/ on every dev-server start and build,
   writes public/gallery/manifest.json so gallery.js can fetch it
   without any hardcoded filenames.
   ────────────────────────────────────────────────────────────── */
function galleryManifestPlugin() {
  const exts = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif'])

  function writeManifest() {
    const galleryDir = resolve(__dirname, 'public/gallery')
    if (!fs.existsSync(galleryDir)) return
    const files = fs.readdirSync(galleryDir)
      .filter(f => exts.has(path.extname(f).toLowerCase()))
      .sort()
    const manifest = { images: files.map(f => `/gallery/${f}`) }
    fs.writeFileSync(
      resolve(galleryDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2)
    )
    console.log(`[gallery] manifest written — ${files.length} image(s)`)
  }

  return {
    name: 'gallery-manifest',
    buildStart() { writeManifest() },
    configureServer(server) {
      writeManifest()
      server.watcher.on('add',    f => { if (f.includes('gallery')) writeManifest() })
      server.watcher.on('unlink', f => { if (f.includes('gallery')) writeManifest() })
    },
  }
}

export default defineConfig({
  base: '/',
  plugins: [galleryManifestPlugin()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        play: resolve(__dirname, 'play.html'),
      },
    },
  },
})