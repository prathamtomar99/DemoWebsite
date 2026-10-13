/** Full-sequence scheduling and compressed-payload bounds shared by loader and transport. */
export const fullFrameLoading = {
  downloads: 4,
  decodes: 2,
  compressedSlots: 8,
  // Enforced while reading each response, including absent/incorrect Content-Length.
  // Eight fetch/buffer reservations plus two decode inputs: <= 2.5 MiB payload.
  maxFrameBytes: 256 * 1024,
} as const

/** RGBA estimate, excluding Canvas/GPU/browser overhead; not a free-memory detector. */
export function decodedSequenceBytes(count: number, width: number, height: number) {
  return count * width * height * 4
}
export function sequenceBudget(mobile: boolean, deviceMemory: number | undefined, desktopMiB = 160, mobileMiB = 80) {
  const profile = mobile ? mobileMiB : desktopMiB
  const device = deviceMemory !== undefined && deviceMemory <= 2 ? 32 : deviceMemory !== undefined && deviceMemory <= 4 ? 80 : profile
  return Math.min(profile, device) * 1024 ** 2
}
export interface PreparationProgress { downloaded: number; decoded: number; total: number; ready: boolean }
export function preparationPercent(p: PreparationProgress) {
  if (p.ready && p.total > 0 && p.downloaded === p.total && p.decoded === p.total) return 100
  return p.total ? Math.min(99, Math.floor(100 * (p.downloaded + p.decoded) / (2 * p.total + 1))) : 0
}
