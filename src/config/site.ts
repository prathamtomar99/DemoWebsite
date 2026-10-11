export const siteConfig = {
  brandName: 'Aether Estates',
  description: 'A concept real-estate agency for exceptional homes.',
  sourceVideoPath: 'assets/source/DroneVideo.mp4',
  hero: {
    preparation: import.meta.env?.VITE_HERO_PREPARATION !== 'off',
    preparationTimeoutMs: Number(import.meta.env?.VITE_HERO_PREPARATION_TIMEOUT_MS) || 45000,
    decodedBudgetMiB: { desktop: 160, mobile: 80 },
    manifestPath: '/frames/manifest.json',
    mobileManifestPath: '/frames/v2/mobile/manifest.json',
    posterPath: '/media/hero-poster.webp',
    // Build-time comparison switch: off | continuous | narrow (default).
    blending: {
      desktop: import.meta.env?.VITE_HERO_BLEND !== 'off',
      mobile: import.meta.env?.VITE_HERO_BLEND !== 'off',
      start: import.meta.env?.VITE_HERO_BLEND === 'continuous' ? 0 : 0.35,
      end: import.meta.env?.VITE_HERO_BLEND === 'continuous' ? 1 : 0.65,
      curve: import.meta.env?.VITE_HERO_BLEND === 'continuous' ? 'linear' : 'smoothstep',
    },
  },
} as const
