import type { Rider, RiderProfile, RiderStats } from "../game/models";
import { clamp } from "../game/config";

type NewRiderInput = Pick<
  Rider,
  "firstName" | "lastName" | "nationality" | "height" | "weight" | "profile"
>;
const base: RiderStats = {
  mountain: 43,
  sprint: 43,
  climbing: 43,
  timeTrial: 42,
  pavement: 41,
  endurance: 46,
  explosiveness: 45,
  recovery: 48,
  descending: 43,
  tactics: 39,
  resistance: 44,
  weather: 41,
};
const bonuses: Record<RiderProfile, Partial<RiderStats>> = {
  grimpeur: {
    mountain: 14,
    climbing: 12,
    endurance: 5,
    recovery: 4,
    sprint: -6,
    pavement: -3,
  },
  puncheur: { climbing: 9, explosiveness: 14, sprint: 5, endurance: 4 },
  sprinteur: {
    sprint: 16,
    explosiveness: 11,
    endurance: 4,
    mountain: -8,
    climbing: -5,
  },
  rouleur: { timeTrial: 15, endurance: 10, resistance: 7, tactics: 5 },
  baroudeur: { endurance: 10, resistance: 10, explosiveness: 7, tactics: 8 },
  classiqueur: { pavement: 15, resistance: 9, weather: 7 },
  etapes: { mountain: 7, climbing: 6, timeTrial: 7, endurance: 8, recovery: 5 },
};
const potentialBonuses: Record<RiderProfile, Partial<RiderStats>> = {
  grimpeur: { mountain: 10, climbing: 9, endurance: 4, recovery: 4 },
  puncheur: { climbing: 6, explosiveness: 10, sprint: 4, endurance: 3 },
  sprinteur: { sprint: 11, explosiveness: 8, endurance: 3 },
  rouleur: { timeTrial: 11, endurance: 7, resistance: 5, tactics: 4 },
  baroudeur: { endurance: 8, resistance: 8, explosiveness: 5, tactics: 6 },
  classiqueur: { pavement: 11, resistance: 7, weather: 5 },
  etapes: { mountain: 6, climbing: 5, timeTrial: 6, endurance: 7, recovery: 5 },
};

export function createRider(input: NewRiderInput): Rider {
  const stats = { ...base };
  Object.entries(bonuses[input.profile]).forEach(
    ([key, value]) =>
      (stats[key as keyof RiderStats] = clamp(
        stats[key as keyof RiderStats] + (value ?? 0),
        32,
        62,
      )),
  );
  const potentials = {} as RiderStats;
  Object.entries(stats).forEach(([key, value]) => {
    const stat = key as keyof RiderStats;
    potentials[stat] = clamp(
      value + 24 + (potentialBonuses[input.profile][stat] ?? 0),
      value + 8,
      96,
    );
  });
  return {
    id: crypto.randomUUID(),
    ...input,
    age: 18,
    stats,
    hidden: {
      potentials,
      consistency: 68,
      injuryResistance: 72,
      learning: 76,
      mental: 70,
    },
    form: 62,
    fatigue: 10,
    morale: 68,
    moraleHistory: [],
    moraleAppliedEventIds: [],
    reputation: 2,
    experience: 0,
  };
}

const names = [
  ["Milo", "Verne"],
  ["Nico", "Aerts"],
  ["Luca", "Bellini"],
  ["Oscar", "Lind"],
  ["Tomas", "Kral"],
  ["Sven", "Meijer"],
  ["Hugo", "Costa"],
  ["Jonas", "Falk"],
  ["Enzo", "Martin"],
  ["Adam", "Nowak"],
  ["Iker", "Sola"],
  ["Sam", "Bennett"],
  ["Louis", "Fabre"],
  ["Marek", "Novak"],
  ["Rui", "Alves"],
  ["Noah", "Schmid"],
  ["Axel", "Jans"],
  ["Theo", "Mercier"],
  ["Leo", "Rossi"],
  ["Felix", "Bauer"],
  ["Pablo", "Vega"],
  ["Finn", "Eriksen"],
  ["Max", "Dumont"],
  ["Elias", "Voss"],
  ["Robin", "Willem"],
  ["David", "Kovac"],
  ["Anton", "Larsen"],
  ["Mateo", "Gil"],
  ["Jan", "Vos"],
  ["Ben", "Clarke"],
];
const profiles: RiderProfile[] = [
  "grimpeur",
  "puncheur",
  "sprinteur",
  "rouleur",
  "baroudeur",
];
const individualLevels = [
  0.5, 1, 1.5, 2, 2.5, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2, 2.5, 3, -1, 0, 1, 2,
  3, 3, 3.5, 4, 4.5, 5, 5.5, 6, 9, 10, 11,
];
const profileKeys: Record<RiderProfile, (keyof RiderStats)[]> = {
  grimpeur: ["mountain", "climbing", "endurance", "recovery"],
  puncheur: ["climbing", "explosiveness", "sprint", "endurance"],
  sprinteur: ["sprint", "explosiveness", "endurance"],
  rouleur: ["timeTrial", "endurance", "resistance", "tactics"],
  baroudeur: ["endurance", "resistance", "explosiveness", "tactics"],
  classiqueur: ["pavement", "resistance", "weather"],
  etapes: ["mountain", "climbing", "timeTrial", "endurance", "recovery"],
};
export const opponents = names.map((name, index) => {
  const age = 20 + (index % 13);
  const rider = createRider({
    firstName: name[0],
    lastName: name[1],
    nationality: "Europe",
    height: 174 + (index % 12),
    weight: 62 + (index % 13),
    profile: profiles[index % profiles.length],
  });
  const ageDevelopment = Math.min(5.6, (age - 18) * 0.4),
    individualLevel = individualLevels[index],
    profileMaturity = index % 3;
  Object.keys(rider.stats).forEach((key) => {
    const stat = key as keyof RiderStats;
    const maturity = profileKeys[rider.profile].includes(stat)
      ? profileMaturity
      : 0;
    rider.stats[stat] = clamp(
      rider.stats[stat] + ageDevelopment + individualLevel + maturity,
      32,
      82,
    );
  });
  return {
    ...rider,
    age,
    experience: (age - 18) * 180 + (index % 5) * 90,
    reputation: 18 + (index % 24),
    form: 58 + (index % 18),
    fatigue: 8 + (index % 16),
    morale: 45 + (index % 41),
  };
});

export function generateOpponents(targetLevel: number, count = 30): Rider[] {
  return Array.from({ length: count }, (_, index) => {
    const template = opponents[index % opponents.length],
      elite = index >= count - 3;
    const level =
      targetLevel +
      (elite
        ? 3 + (index - (count - 3)) * 1.5
        : (((index * 7) % 13) - 6) * 0.65);
    const delta =
      level -
      Object.values(template.stats).reduce((sum, value) => sum + value, 0) /
        Object.keys(template.stats).length;
    const stats = { ...template.stats };
    Object.keys(stats).forEach(
      (key) =>
        (stats[key as keyof RiderStats] = clamp(
          stats[key as keyof RiderStats] + delta,
          32,
          88,
        )),
    );
    return {
      ...template,
      id: `field-${index}-${targetLevel}`,
      stats,
      age: 20 + (index % 14),
      experience: 160 + (index % 12) * 120,
      form: 56 + (index % 17),
      fatigue: 5 + (index % 18),
    };
  });
}
