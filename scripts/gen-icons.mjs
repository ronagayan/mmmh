/**
 * Generates pwa-192x192.png and pwa-512x512.png from mmmh.svg
 * Uses @resvg/resvg-js (pure WASM, no native deps)
 *
 * Run: node scripts/gen-icons.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root      = join(__dirname, '..')

// Dynamic import to handle ESM/CJS interop
const { Resvg } = await import('@resvg/resvg-js')

const svgSource = readFileSync(join(root, 'public', 'mmmh.svg'), 'utf8')

async function render(size, outFile) {
  const resvg = new Resvg(svgSource, {
    fitTo: { mode: 'width', value: size },
    font: { loadSystemFonts: false },
  })
  const png = resvg.render()
  const buffer = png.asPng()
  writeFileSync(outFile, buffer)
  console.log(`✓  ${outFile}  (${size}×${size})`)
}

mkdirSync(join(root, 'public'), { recursive: true })

await render(192, join(root, 'public', 'pwa-192x192.png'))
await render(512, join(root, 'public', 'pwa-512x512.png'))

console.log('Icons generated.')
