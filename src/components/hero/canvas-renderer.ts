import type { DecodedFrame } from './frame-loader'

export function imagePlacement(width: number, height: number, sourceWidth: number, sourceHeight: number) {
  const ratio = width / height
  // Preserve the source mark and entrance on portrait and extreme-wide screens.
  const cover = width >= 1024 && ratio >= 1.45 && ratio <= 2
  const scale = (cover ? Math.max : Math.min)(width / sourceWidth, height / sourceHeight)
  const drawWidth = sourceWidth * scale
  const drawHeight = sourceHeight * scale
  return {
    fit: cover ? 'cover' : 'contain',
    x: cover ? width - drawWidth : (width - drawWidth) / 2,
    y: cover ? height - drawHeight : (height - drawHeight) * 0.45,
    width: drawWidth, height: drawHeight,
  }
}

export function paintFrame(canvas: HTMLCanvasElement, frame: DecodedFrame, width: number, height: number, background: string,
  overlay?: DecodedFrame, alpha = 0) {
  if (!width || !height || !frame.width || !frame.height) return false
  const context = canvas.getContext('2d', { alpha: false })
  if (!context || (typeof context.isContextLost === 'function' && context.isContextLost())) return false
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const pixelsWide = Math.max(1, Math.round(width * dpr))
  const pixelsHigh = Math.max(1, Math.round(height * dpr))
  if (canvas.width !== pixelsWide || canvas.height !== pixelsHigh) {
    canvas.width = pixelsWide
    canvas.height = pixelsHigh
  }
  const placement = imagePlacement(width, height, frame.width, frame.height)
  context.setTransform(pixelsWide / width, 0, 0, pixelsHigh / height, 0, 0)
  context.globalAlpha = 1
  context.fillStyle = background
  context.fillRect(0, 0, width, height)
  try {
    context.drawImage(frame.image, placement.x, placement.y, placement.width, placement.height)
    if (overlay && alpha > 0 && alpha < 1 && overlay.width === frame.width && overlay.height === frame.height) {
      context.globalAlpha = alpha
      context.drawImage(overlay.image, placement.x, placement.y, placement.width, placement.height)
    }
  } finally {
    context.globalAlpha = 1
  }
  return true
}
