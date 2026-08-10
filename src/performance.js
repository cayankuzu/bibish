export const QUALITY_ORDER = ['performance', 'balanced', 'high', 'ultra'];

export const QUALITY_PROFILES = {
  performance: {
    label: 'Düşük',
    pixelRatio: 0.52,
    minPixelRatio: 0.38,
    maxPixelRatio: 0.72,
    shadows: false,
    shadowSize: 512,
    paintLimit: 420,
    effectDensity: 0.45,
    far: 620,
    fogDensity: 0.0019,
  },
  balanced: {
    label: 'Orta',
    pixelRatio: 0.82,
    minPixelRatio: 0.62,
    maxPixelRatio: 1,
    shadows: true,
    shadowSize: 768,
    paintLimit: 760,
    effectDensity: 0.7,
    far: 980,
    fogDensity: 0.0015,
  },
  high: {
    label: 'Yüksek',
    pixelRatio: 0.96,
    minPixelRatio: 0.72,
    maxPixelRatio: 1.1,
    shadows: true,
    shadowSize: 1024,
    paintLimit: 1150,
    effectDensity: 0.88,
    far: 920,
    fogDensity: 0.00135,
  },
  ultra: {
    label: 'Ultra',
    pixelRatio: 1.12,
    minPixelRatio: 0.82,
    maxPixelRatio: 1.25,
    shadows: true,
    shadowSize: 1536,
    paintLimit: 1280,
    effectDensity: 0.9,
    far: 1080,
    fogDensity: 0.0013,
  },
};

export function isMobileDevice() {
  const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches;
  const narrowTouchScreen = navigator.maxTouchPoints > 0 && Math.min(screen.width, screen.height) < 900;
  const mobileAgent = /Android|iPhone|iPad|iPod|Mobile|IEMobile|Opera Mini/i.test(navigator.userAgent);
  return Boolean(mobileAgent || (coarsePointer && narrowTouchScreen));
}

export function detectDeviceQuality() {
  const cores = navigator.hardwareConcurrency || 4;
  const memory = navigator.deviceMemory || 4;
  const pixels = window.innerWidth * window.innerHeight * Math.min(window.devicePixelRatio || 1, 2) ** 2;
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  let score = 0;

  if (cores >= 12) score += 3;
  else if (cores >= 8) score += 2;
  else if (cores >= 6) score += 1;
  else if (cores <= 2) score -= 2;
  else if (cores <= 4) score -= 1;

  if (memory >= 16) score += 3;
  else if (memory >= 8) score += 2;
  else if (memory >= 6) score += 1;
  else if (memory <= 2) score -= 2;
  else if (memory <= 4) score -= 1;

  if (pixels > 7_000_000) score -= 2;
  else if (pixels > 4_000_000) score -= 1;
  if (reducedMotion) score -= 1;

  let tier = 'balanced';
  if (score <= -2) tier = 'performance';
  else if (score >= 5) tier = 'ultra';
  else if (score >= 2) tier = 'high';

  return {
    tier,
    cores,
    memory,
    pixels,
    reducedMotion,
    label: QUALITY_PROFILES[tier].label,
  };
}

export function loadGraphicsPreference() {
  try {
    const saved = JSON.parse(localStorage.getItem('bibish-graphics') || '{}');
    return {
      mode: saved.mode || 'auto',
      dynamicResolution: saved.dynamicResolution !== false,
      showStats: saved.showStats !== false,
    };
  } catch {
    return { mode: 'auto', dynamicResolution: true, showStats: true };
  }
}

export function saveGraphicsPreference(preference) {
  try {
    localStorage.setItem('bibish-graphics', JSON.stringify(preference));
  } catch {
    // Private browsing can deny storage. The current session still works.
  }
}

export class AdaptivePerformance {
  constructor(renderer, { tier, dynamicResolution = true, onTierChange, onStats }) {
    this.renderer = renderer;
    this.tier = tier;
    this.dynamicResolution = dynamicResolution;
    this.onTierChange = onTierChange;
    this.onStats = onStats;
    this.samples = [];
    this.elapsed = 0;
    this.goodWindows = 0;
    this.badWindows = 0;
    this.lastPixelRatio = 1;
    this.displayHz = 60;
  }

  setTier(tier) {
    this.tier = tier;
    this.samples.length = 0;
    this.goodWindows = 0;
    this.badWindows = 0;
  }

  setDynamicResolution(enabled) {
    this.dynamicResolution = enabled;
  }

  frame(delta, drawCalls, triangles) {
    if (!Number.isFinite(delta) || delta <= 0 || delta > 0.25) return;
    this.samples.push(delta);
    this.elapsed += delta;
    if (this.elapsed < 0.75) return;

    const sorted = this.samples.slice().sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)] || 1 / 60;
    const average = this.samples.reduce((sum, value) => sum + value, 0) / this.samples.length;
    const fps = Math.round(1 / average);
    const medianFps = Math.round(1 / median);
    this.displayHz = Math.max(30, Math.min(165, medianFps));
    this.onStats?.({ fps, drawCalls, triangles, pixelRatio: this.renderer.getPixelRatio(), tier: this.tier });

    if (this.dynamicResolution) {
      const profile = QUALITY_PROFILES[this.tier];
      const target = Math.min(this.displayHz, 60);
      const ratio = this.renderer.getPixelRatio();
      if (fps < target * 0.78) {
        this.badWindows += 1;
        this.goodWindows = 0;
      } else if (fps > target * 0.96) {
        this.goodWindows += 1;
        this.badWindows = Math.max(0, this.badWindows - 1);
      }

      if (this.badWindows >= 1 && ratio > profile.minPixelRatio) {
        const pressureStep = fps < target * 0.52 ? 0.18 : 0.1;
        this.lastPixelRatio = Math.max(profile.minPixelRatio, ratio - pressureStep);
        this.renderer.setPixelRatio(this.lastPixelRatio);
        this.renderer.setSize(window.innerWidth, Math.max(1, window.innerHeight - 28), false);
        this.badWindows = 0;
      } else if (this.goodWindows >= 6 && ratio < profile.maxPixelRatio) {
        this.lastPixelRatio = Math.min(profile.maxPixelRatio, ratio + 0.05);
        this.renderer.setPixelRatio(this.lastPixelRatio);
        this.renderer.setSize(window.innerWidth, Math.max(1, window.innerHeight - 28), false);
        this.goodWindows = 0;
      } else if (this.badWindows >= 5 && ratio <= profile.minPixelRatio + 0.01) {
        const tierIndex = QUALITY_ORDER.indexOf(this.tier);
        if (tierIndex > 0) {
          this.badWindows = 0;
          this.onTierChange?.(QUALITY_ORDER[tierIndex - 1], 'runtime');
        }
      }
    }

    this.samples.length = 0;
    this.elapsed = 0;
  }
}
