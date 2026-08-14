import { clamp } from "../config";
import type {
  InteractiveRaceChoice,
  InteractiveRacePhase,
  InteractiveRaceState,
  Race,
  RaceStrategy,
  Rider,
} from "../models";
import type { RandomSource } from "./random";

const hash = (text: string) => {
  let value = 2166136261;
  for (let index = 0; index < text.length; index++) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
};

export function seededRandom(seed: number): RandomSource {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

const phase = (
  race: Race,
  index: number,
  kind: InteractiveRacePhase["kind"],
  ratio: number,
  title: string,
  description: string,
  keyStat: InteractiveRacePhase["keyStat"],
): InteractiveRacePhase => ({
  id: `${race.id}-phase-${index}`,
  kind,
  km: Math.round(race.distance * ratio),
  title,
  description,
  keyStat,
});

export function createRacePhases(race: Race): InteractiveRacePhase[] {
  const difficulty =
    race.terrain === "montagne"
      ? [
          "Ascension principale",
          "Le rythme s'accélère dans le col.",
          "mountain",
        ]
      : race.terrain === "vallons"
        ? ["Côte décisive", "Les puncheurs se découvrent.", "climbing"]
        : race.terrain === "paves"
          ? ["Secteur pavé", "Le peloton s'étire sur les pavés.", "pavement"]
          : race.terrain === "chrono"
            ? [
                "Secteur exposé",
                "Il faut maintenir une allure régulière.",
                "timeTrial",
              ]
            : [
                "Relance du peloton",
                "La vitesse augmente sur le plat.",
                "endurance",
              ];
  const finishStat = race.terrain === "montagne" ? "mountain" : "sprint";
  return [
    phase(
      race,
      0,
      "start",
      0.04,
      "Départ réel",
      "Le placement se joue dès les premiers kilomètres.",
      "tactics",
    ),
    phase(
      race,
      1,
      "breakaway",
      0.2,
      "Formation de l'échappée",
      "Plusieurs coureurs tentent de sortir.",
      "tactics",
    ),
    phase(
      race,
      2,
      "difficulty",
      0.4,
      difficulty[0],
      difficulty[1],
      difficulty[2] as keyof Rider["stats"],
    ),
    phase(
      race,
      3,
      "feed",
      0.58,
      "Ravitaillement",
      "Le peloton ralentit brièvement avant la suite.",
      "endurance",
    ),
    phase(
      race,
      4,
      "difficulty",
      0.72,
      `Dernière difficulté`,
      "Les favoris commencent à se tester.",
      difficulty[2] as keyof Rider["stats"],
    ),
    phase(
      race,
      5,
      "finale",
      0.88,
      "Derniers kilomètres",
      "Les groupes se réorganisent pour le final.",
      "resistance",
    ),
    phase(
      race,
      6,
      "sprint",
      0.98,
      "Arrivée",
      "Il reste un dernier effort pour gagner des places.",
      finishStat,
    ),
  ];
}

export function startInteractiveRace(
  race: Race,
  rider: Rider,
  strategy: RaceStrategy,
  identity: string,
): InteractiveRaceState {
  const seed = hash(`${identity}-${race.id}-${race.date}-${strategy}`);
  return {
    raceId: race.id,
    seed,
    strategy,
    phaseIndex: 0,
    phases: createRacePhases(race),
    position: clamp(Math.round(18 - (rider.stats.tactics - 45) / 5), 8, 25),
    group: "Peloton principal",
    gapSeconds: 0,
    fatigueDelta: 0,
    performanceDelta: 0,
    choices: [],
    log: [],
  };
}

const choiceEffects = {
  attack: {
    fatigue: 4,
    position: -4,
    difficulty: 58,
    success: 1.2,
    failure: -0.6,
  },
  follow: {
    fatigue: 2.5,
    position: -2,
    difficulty: 50,
    success: 0.5,
    failure: -0.5,
  },
  conserve: {
    fatigue: -1,
    position: 2,
    difficulty: 38,
    success: 0.15,
    failure: -0.35,
  },
  teamwork: {
    fatigue: 1,
    position: -1,
    difficulty: 46,
    success: 0.3,
    failure: -0.2,
  },
} as const;

export function resolveInteractivePhase(
  state: InteractiveRaceState,
  rider: Rider,
  choice: InteractiveRaceChoice,
): InteractiveRaceState {
  const current = state.phases[state.phaseIndex];
  if (!current) return state;
  const effect = choiceEffects[choice];
  const roll = seededRandom(hash(`${state.seed}-${current.id}-${choice}`))();
  const skill = rider.stats[current.keyStat] + rider.stats.tactics * 0.2;
  const success = skill + (roll - 0.5) * 14 >= effect.difficulty;
  const positionChange = success
    ? effect.position
    : Math.max(1, -effect.position);
  const position = clamp(state.position + positionChange, 1, 31);
  const fatigueDelta = Math.max(0, state.fatigueDelta + effect.fatigue);
  const performanceDelta = clamp(
    (state.performanceDelta ?? 0) + (success ? effect.success : effect.failure),
    -3,
    3,
  );
  const group =
    position <= 6
      ? "Groupe de tête"
      : position <= 20
        ? "Peloton principal"
        : "Groupe poursuivant";
  const gapSeconds =
    group === "Groupe de tête"
      ? 0
      : group === "Peloton principal"
        ? Math.max(0, position - 12) * 2
        : 20 + (position - 20) * 5;
  const labels = {
    attack: success
      ? "L'attaque porte ses fruits."
      : "L'attaque coûte de l'énergie sans créer d'écart.",
    follow: success
      ? "Julian suit le bon mouvement."
      : "Julian doit combler un petit écart.",
    conserve: success
      ? "Julian récupère bien à l'abri."
      : "Julian recule dans un groupe nerveux.",
    teamwork: success
      ? "Le travail collectif améliore le placement."
      : "L'effort pour l'équipe coûte quelques places.",
  };
  return {
    ...state,
    phaseIndex: state.phaseIndex + 1,
    position,
    group,
    gapSeconds,
    fatigueDelta,
    performanceDelta,
    choices: [...state.choices, choice],
    log: [
      ...state.log,
      {
        phaseId: current.id,
        km: current.km,
        choice,
        text: labels[choice],
        fatigueDelta: effect.fatigue,
        performanceDelta: success ? effect.success : effect.failure,
        positionBefore: state.position,
        positionAfter: position,
      },
    ],
  };
}
