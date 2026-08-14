import type {
  CalendarRace,
  Rider,
  RiderStats,
  TeamMate,
  TeamRaceResult,
} from "../models";
import { clamp, terrainWeights } from "../config";
import { performance } from "../simulation/raceSimulation";
import type { RandomSource } from "../simulation/random";

const suitability = (mate: TeamMate, race: CalendarRace) =>
  Object.entries(terrainWeights[race.terrain]).reduce(
    (sum, [key, weight]) =>
      sum + mate.stats[key as keyof RiderStats] * (weight ?? 0),
    0,
  );
const roleFactor = {
  Leader: 1.22,
  "Coureur protégé": 1.14,
  Équipier: 1,
  "Jeune espoir": 0.94,
};
const seededRandom = (seed: string): RandomSource => {
  let state = 2166136261;
  for (const char of seed)
    state = Math.imul(state ^ char.charCodeAt(0), 16777619);
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
};
export function selectionWeight(mate: TeamMate, race: CalendarRace) {
  const fit = suitability(mate, race) / 100,
    levelFactor = 0.75 + mate.level / 170,
    formFactor = 0.85 + mate.form / 400;
  return Math.max(
    0.001,
    fit ** 2.6 * roleFactor[mate.role] * levelFactor * formFactor,
  );
}
export function competitionRank(scores: number[], score: number) {
  return 1 + scores.filter((value) => value > score).length;
}
export function selectTeamMates(
  roster: TeamMate[],
  race: CalendarRace,
  count = 5,
  source?: RandomSource,
) {
  const random = source ?? seededRandom(`${race.id}-${race.date}`),
    pool = [...roster],
    selected: string[] = [];
  while (pool.length && selected.length < count) {
    const weighted = pool.map((mate) => ({
        mate,
        weight: selectionWeight(mate, race),
      })),
      total = weighted.reduce((sum, item) => sum + item.weight, 0);
    let draw = random() * total,
      index = weighted.findIndex((item) => (draw -= item.weight) <= 0);
    if (index < 0) index = weighted.length - 1;
    selected.push(weighted[index].mate.id);
    pool.splice(
      pool.findIndex((mate) => mate.id === weighted[index].mate.id),
      1,
    );
  }
  return selected;
}
const asRider = (mate: TeamMate): Rider => ({
  id: mate.id,
  firstName: mate.name.split(" ")[0],
  lastName: mate.name.split(" ").slice(1).join(" "),
  nationality: "Europe",
  age: mate.age,
  height: 178,
  weight: 68,
  profile: mate.profile,
  stats: mate.stats,
  hidden: {
    potentials: mate.potentials,
    consistency: 65,
    injuryResistance: 70,
    learning: 68,
    mental: 68,
  },
  form: mate.form,
  fatigue: 12,
  morale: 65,
  reputation: 5,
  experience: Math.max(0, (mate.age - 18) * 160),
});
export function simulateTeamMates(
  roster: TeamMate[],
  selectedIds: string[],
  race: CalendarRace,
  field: Rider[],
  random: RandomSource = Math.random,
  playerScore?: number,
): TeamRaceResult[] {
  const opponentScores = field.map(
      (rider) => +performance(rider, race, "normal", random).final.toFixed(1),
    ),
    mates = roster
      .filter((mate) => selectedIds.includes(mate.id))
      .map((mate) => ({
        mate,
        score: +performance(
          asRider(mate),
          race,
          "normal",
          random,
        ).final.toFixed(1),
      })),
    allScores = [
      ...opponentScores,
      ...mates.map((item) => item.score),
      ...(playerScore === undefined ? [] : [+playerScore.toFixed(1)]),
    ];
  return mates
    .map(({ mate, score }) => ({
      riderId: mate.id,
      riderName: mate.name,
      position: competitionRank(allScores, score),
      score,
      selected: true,
    }))
    .sort((a, b) => a.position - b.position || b.score - a.score);
}
export function updateTeamMateForms(
  roster: TeamMate[],
  selectedIds: string[],
  difficulty: number,
) {
  return roster.map((mate) => ({
    ...mate,
    form: clamp(
      selectedIds.includes(mate.id)
        ? mate.form - difficulty * 0.018
        : mate.form + (65 - mate.form) * 0.08,
      45,
      82,
    ),
  }));
}
