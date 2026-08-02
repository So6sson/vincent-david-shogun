export const FACE_PROFILE = Object.freeze({
  cranium: [1.04, 1.18, 1.0],
  jaw: [0.88, 0.72, 0.9],
  eyeSpacing: 0.39,
  browAngle: 0.12,
  noseLength: 0.46,
  noseWidth: 0.16,
  earScale: [0.82, 1.18, 0.55],
  moustacheWidth: 0.46,
  goateeLength: 0.55,
  sideHairDensity: 92,
  regrowthDensity: 220,
  heroLockCount: 42
});

export const clamp01 = value => Math.max(0, Math.min(1, Number(value) || 0));

export function hairRenderState(progress) {
  const p = clamp01(progress / 100);
  const strands = Math.round(FACE_PROFILE.regrowthDensity * p);
  const heroLocks = Math.round(FACE_PROFILE.heroLockCount * Math.max(0, (p - 0.42) / 0.58));
  const length = 0.16 + Math.pow(p, 1.35) * 1.08;
  const sweep = Math.max(0, (p - 0.35) / 0.65);
  const gloss = 0.05 + p * 0.22;
  return { progress: p, strands, heroLocks, length, sweep, gloss };
}

export function scalpSample(index, total) {
  const golden = Math.PI * (3 - Math.sqrt(5));
  const t = (index + 0.5) / Math.max(1, total);
  const theta = Math.sqrt(t) * 1.18;
  const phi = index * golden;
  const frontBias = Math.cos(phi) * 0.11;
  const receding = theta < 0.62 && Math.sin(phi) > 0.45 ? 0.12 : 0;
  return { theta: theta + receding, phi, frontBias };
}

export function qualityForDevice({ width, height, pixelRatio }) {
  const pixels = Math.max(1, width * height * pixelRatio * pixelRatio);
  if (pixels > 4_500_000) return { pixelRatio: 1.15, shadows: 512, hairFactor: 0.72 };
  if (pixels > 2_500_000) return { pixelRatio: 1.35, shadows: 768, hairFactor: 0.86 };
  return { pixelRatio: Math.min(pixelRatio, 1.6), shadows: 1024, hairFactor: 1 };
}
