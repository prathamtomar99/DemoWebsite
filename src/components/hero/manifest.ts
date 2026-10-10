export interface FrameManifest {
  frameCount: number
  fps: number
  durationSeconds: number
  width: number
  height: number
  filenamePattern: string
  firstFrame: string
  lastFrame: string
  posterUrl: string
}

export function publicAsset(path: string, base = import.meta.env?.BASE_URL ?? '/') {
  if (!/^\/(frames|media)\/[\w./%-]+$/.test(path) || path.split('/').includes('..')) {
    throw new Error('Invalid public media path')
  }
  return `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`
}

export function framePath(manifest: FrameManifest, index: number) {
  if (!Number.isInteger(index) || index < 0 || index >= manifest.frameCount) {
    throw new Error('Frame index is out of range')
  }
  return manifest.filenamePattern.replace('%04d', String(index + 1).padStart(4, '0'))
}

export function parseManifest(value: unknown): FrameManifest {
  if (!value || typeof value !== 'object') throw new Error('Invalid frame manifest')
  const m = value as Record<string, unknown>
  for (const key of ['frameCount', 'fps', 'durationSeconds', 'width', 'height']) {
    if (typeof m[key] !== 'number' || !Number.isFinite(m[key]) || m[key] <= 0) {
      throw new Error(`Invalid manifest ${key}`)
    }
  }
  if (!Number.isInteger(m.frameCount) || Number(m.frameCount) > 10000 ||
      !Number.isInteger(m.width) || !Number.isInteger(m.height) ||
      Number(m.width) > 8192 || Number(m.height) > 8192) throw new Error('Invalid sequence dimensions/count')
  for (const key of ['filenamePattern', 'firstFrame', 'lastFrame', 'posterUrl']) {
    if (typeof m[key] !== 'string') throw new Error(`Invalid manifest ${key}`)
    publicAsset(m[key] as string)
  }
  if (!/^\/frames\/[\w-]+_%04d\.jpg$/.test(String(m.filenamePattern))) throw new Error('Unsupported frame pattern')
  const manifest = m as unknown as FrameManifest
  if (manifest.firstFrame !== framePath(manifest, 0) ||
      manifest.lastFrame !== framePath(manifest, manifest.frameCount - 1)) throw new Error('Manifest endpoints do not match')
  return manifest
}

export function scrollProgress(top: number, height: number, viewportHeight: number) {
  const distance = height - viewportHeight
  if (!Number.isFinite(top) || !Number.isFinite(distance) || distance <= 0) return 0
  return Math.max(0, Math.min(1, -top / distance))
}

export function progressFrame(progress: number, count: number) {
  return Math.round(Math.max(0, Math.min(1, progress)) * (count - 1))
}
