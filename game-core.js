export const MAX_HAIR = 100;
export const MAX_TUFTS = 32;

export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function hairStage(hair) {
  if (hair >= 100) return 'CHEVELURE ABSOLUE';
  if (hair >= 75) return 'MULET DE GUERRE';
  if (hair >= 50) return 'TOUPET STRATÉGIQUE';
  if (hair >= 25) return 'REPOUSSE ADMINISTRATIVE';
  if (hair > 0) return 'DUVET HOMOLOGUÉ';
  return 'CALVITIE IMPÉRIALE';
}

export function tuftCountForHair(hair) {
  return Math.round(clamp(hair, 0, MAX_HAIR) / MAX_HAIR * MAX_TUFTS);
}

export function killReward(type, wave = 1) {
  const base = {
    wig: { hair: 8, score: 140 },
    toupee: { hair: 12, score: 240 },
    braid: { hair: 16, score: 360 },
    boss: { hair: 45, score: 6000 }
  }[type] || { hair: 6, score: 100 };
  return {
    hair: base.hair,
    score: base.score + Math.max(0, wave - 1) * 15
  };
}

export function applyDamage(state, amount) {
  const hp = clamp(state.hp - amount, 0, 100);
  const hairLoss = Math.min(state.hair, Math.max(4, Math.round(amount * 0.75)));
  return { ...state, hp, hair: clamp(state.hair - hairLoss, 0, MAX_HAIR), hairLoss };
}

export function applyKill(state, type, wave) {
  const reward = killReward(type, wave);
  const combo = clamp(state.combo + 1, 1, 12);
  return {
    ...state,
    combo,
    hair: clamp(state.hair + reward.hair, 0, MAX_HAIR),
    score: state.score + reward.score * combo,
    hairGain: Math.min(reward.hair, MAX_HAIR - state.hair)
  };
}

export function consumeBankai(hair) {
  if (hair < MAX_HAIR) return { activated: false, hair };
  return { activated: true, hair: 35 };
}
