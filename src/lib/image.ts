/**
 * Browser-only helpers for turning local image files into compact data URLs.
 * Nothing here touches the network — images never leave the device.
 */

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(String(fr.result ?? ''))
    fr.onerror = () => reject(new Error('Could not read the file'))
    fr.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not decode the image'))
    img.src = src
  })
}

/**
 * Read an image File into a `data:` URL, downscaling so the longest edge is at
 * most `maxDim` px and normalizing uncommon formats to PNG/JPEG (falling back to
 * the original if canvas is unavailable).
 */
export async function readImageAsDataUrl(
  file: File,
  opts: { maxDim?: number; quality?: number } = {},
): Promise<string> {
  const { maxDim = 1600, quality = 0.8 } = opts
  const raw = await fileToDataUrl(file)
  const sourceType = (file.type || '').toLowerCase()
  // Every vision provider accepts PNG/JPEG; other formats (gif/webp/bmp/tiff) can be
  // rejected with a 400, so they are re-encoded through the canvas even when no
  // downscale is needed.
  const providerSafe = sourceType === 'image/png' || sourceType === 'image/jpeg'
  try {
    const img = await loadImage(raw)
    const longest = Math.max(img.width, img.height)
    const scale = longest > 0 ? Math.min(1, maxDim / longest) : 1
    if (scale >= 1 && providerSafe) return raw

    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.width * scale))
    canvas.height = Math.max(1, Math.round(img.height * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) return raw
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    // PNGs keep crisp UI; everything else re-encodes smaller as JPEG
    const type = sourceType === 'image/png' ? 'image/png' : 'image/jpeg'
    return canvas.toDataURL(type, quality)
  } catch {
    return raw
  }
}

/** Rough decoded byte size of a base64 data URL, computed without decoding it. */
export function dataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(',')
  if (comma < 0) return dataUrl.length
  const b64 = dataUrl.slice(comma + 1)
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0
  return Math.max(0, Math.floor((b64.length * 3) / 4) - padding)
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}
