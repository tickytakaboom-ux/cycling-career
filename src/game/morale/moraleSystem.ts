import { clamp, moraleConfig } from "../config";
import type { MoraleCategory, Rider } from "../models";

export interface MoraleEventInput {
  id: string;
  date: string;
  delta: number;
  reason: string;
  category: MoraleCategory;
}

export function applyMoraleEvent(rider: Rider, input: MoraleEventInput): Rider {
  const applied = rider.moraleAppliedEventIds ?? [];
  if (applied.includes(input.id)) return rider;
  const before = rider.morale;
  const after = clamp(
    before + input.delta,
    moraleConfig.minimum,
    moraleConfig.maximum,
  );
  const delta = after - before;
  const history = rider.moraleHistory ?? [];
  return {
    ...rider,
    morale: after,
    moraleAppliedEventIds: [...applied, input.id],
    moraleHistory:
      delta === 0
        ? history
        : [{ ...input, before, after, delta }, ...history].slice(0, 30),
  };
}

export function restMoraleDelta(fatigue: number) {
  if (fatigue <= 30) return moraleConfig.restGain.fresh;
  if (fatigue <= 60) return moraleConfig.restGain.moderate;
  if (fatigue < 75) return 0;
  return -0.45;
}

export function injuryMoraleDelta(
  severity: keyof typeof moraleConfig.injuryLoss,
) {
  return -moraleConfig.injuryLoss[severity];
}

export function annualProgressionMoraleDelta(ratingDelta: number) {
  if (ratingDelta >= 2) return 1.5;
  if (ratingDelta >= 1) return 0.5;
  if (ratingDelta <= -1) return -1.5;
  return 0;
}

export function moraleLabel(value: number) {
  if (value >= 80) return "Très motivé";
  if (value >= 60) return "Confiant";
  if (value >= 40) return "Neutre";
  if (value >= 20) return "En difficulté";
  return "Moral critique";
}

export function moralePerformancePercent(value: number) {
  return (
    ((value - moraleConfig.neutral) / 50) * moraleConfig.performanceRange * 100
  );
}

export function resultMoraleReason(position: number, fieldSize: number) {
  if (position === 1) return "Victoire";
  if (position <= 3) return "Podium";
  if (position <= 10) return "Top 10";
  if (position / fieldSize > 0.85) return "Résultat difficile";
  if (position <= 20) return "Top 20";
  return "Résultat conforme aux attentes";
}
