import { clamp } from "../config";
import type {
  InteractiveRaceChoice,
  InteractiveRaceGroup,
  InteractiveRacePhase,
  InteractiveRaceState,
  Race,
  RaceStrategy,
  Rider,
  TeamMate,
  Terrain,
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

type Moment = [
  InteractiveRacePhase["kind"],
  number,
  string,
  string,
  keyof Rider["stats"],
  number,
  InteractiveRacePhase["situation"],
];

const terrainMoments: Record<Terrain, Moment[]> = {
  montagne: [
    [
      "start",
      0.04,
      "Départ réel",
      "Le placement se joue avant les premières pentes.",
      "tactics",
      0.35,
      "steady",
    ],
    [
      "breakaway",
      0.18,
      "Formation de l'échappée",
      "Des baroudeurs ouvrent la route.",
      "tactics",
      0.55,
      "acceleration",
    ],
    [
      "difficulty",
      0.36,
      "Première ascension",
      "Le rythme augmente dans les premiers lacets.",
      "climbing",
      0.72,
      "acceleration",
    ],
    [
      "feed",
      0.53,
      "Vallée et ravitaillement",
      "Il faut se replacer sans gaspiller d'énergie.",
      "endurance",
      0.35,
      "team",
    ],
    [
      "descent",
      0.67,
      "Descente technique",
      "Les écarts peuvent se creuser dans les virages.",
      "descending",
      0.62,
      "technical",
    ],
    [
      "difficulty",
      0.83,
      "Ascension décisive",
      "Les favoris accélèrent dans le col final.",
      "mountain",
      0.9,
      "acceleration",
    ],
    [
      "finale",
      0.97,
      "Derniers kilomètres",
      "Chaque effort compte avant le sommet.",
      "resistance",
      0.85,
      "final",
    ],
  ],
  sprint: [
    [
      "start",
      0.04,
      "Départ réel",
      "Le peloton roule déjà rapidement.",
      "tactics",
      0.3,
      "steady",
    ],
    [
      "breakaway",
      0.2,
      "Échappée matinale",
      "L'équipe décide si elle contrôle les fuyards.",
      "endurance",
      0.4,
      "team",
    ],
    [
      "difficulty",
      0.39,
      "Route exposée",
      "Le vent rend le placement important.",
      "weather",
      0.55,
      "technical",
    ],
    [
      "feed",
      0.58,
      "Ravitaillement",
      "Les trains commencent à se regrouper.",
      "tactics",
      0.35,
      "team",
    ],
    [
      "finale",
      0.76,
      "Chasse à l'échappée",
      "Le peloton accélère franchement.",
      "resistance",
      0.7,
      "acceleration",
    ],
    [
      "finale",
      0.9,
      "Préparation du sprint",
      "Les sprinteurs cherchent la bonne roue.",
      "tactics",
      0.82,
      "team",
    ],
    [
      "sprint",
      0.99,
      "Sprint final",
      "La vitesse est maximale jusqu'à la ligne.",
      "sprint",
      0.95,
      "final",
    ],
  ],
  paves: [
    [
      "start",
      0.04,
      "Départ nerveux",
      "Tout le monde veut aborder les secteurs devant.",
      "tactics",
      0.45,
      "acceleration",
    ],
    [
      "breakaway",
      0.17,
      "Échappée matinale",
      "Quelques spécialistes prennent de l'avance.",
      "endurance",
      0.45,
      "steady",
    ],
    [
      "difficulty",
      0.34,
      "Premier secteur pavé",
      "Le peloton s'étire sur les vibrations.",
      "pavement",
      0.72,
      "technical",
    ],
    [
      "feed",
      0.51,
      "Retour sur l'asphalte",
      "Une courte accalmie permet de se replacer.",
      "recovery",
      0.35,
      "team",
    ],
    [
      "difficulty",
      0.69,
      "Enchaînement de secteurs",
      "Les cassures se multiplient.",
      "pavement",
      0.85,
      "acceleration",
    ],
    [
      "difficulty",
      0.85,
      "Dernier secteur majeur",
      "Les favoris lancent la bataille.",
      "resistance",
      0.92,
      "technical",
    ],
    [
      "finale",
      0.98,
      "Final sur route",
      "Les petits groupes jouent la victoire.",
      "explosiveness",
      0.82,
      "final",
    ],
  ],
  chrono: [
    [
      "start",
      0.03,
      "Rampe de départ",
      "Il faut trouver le bon rythme immédiatement.",
      "timeTrial",
      0.45,
      "steady",
    ],
    [
      "difficulty",
      0.18,
      "Premier intermédiaire",
      "L'allure doit rester maîtrisée.",
      "timeTrial",
      0.55,
      "steady",
    ],
    [
      "difficulty",
      0.36,
      "Secteur roulant",
      "La position aérodynamique devient essentielle.",
      "endurance",
      0.55,
      "steady",
    ],
    [
      "feed",
      0.54,
      "Mi-course",
      "Une mauvaise gestion se paiera dans le final.",
      "tactics",
      0.45,
      "steady",
    ],
    [
      "difficulty",
      0.7,
      "Secteur exposé",
      "Le vent perturbe le rythme.",
      "weather",
      0.7,
      "technical",
    ],
    [
      "finale",
      0.86,
      "Dernier intermédiaire",
      "Il faut décider quand accélérer.",
      "resistance",
      0.78,
      "acceleration",
    ],
    [
      "finale",
      0.98,
      "Dernière ligne droite",
      "Tout ce qui reste peut être dépensé.",
      "timeTrial",
      0.9,
      "final",
    ],
  ],
  plaine: [
    [
      "start",
      0.04,
      "Départ réel",
      "Les premières tentatives d'échappée commencent.",
      "tactics",
      0.35,
      "steady",
    ],
    [
      "breakaway",
      0.19,
      "Échappée formée",
      "Le peloton choisit son rythme de poursuite.",
      "endurance",
      0.45,
      "team",
    ],
    [
      "difficulty",
      0.37,
      "Vent de côté",
      "Une bordure menace de couper le peloton.",
      "weather",
      0.72,
      "technical",
    ],
    [
      "feed",
      0.55,
      "Ravitaillement",
      "Le placement peut changer sans effort maximal.",
      "tactics",
      0.32,
      "team",
    ],
    [
      "difficulty",
      0.72,
      "Nouvelle bordure",
      "Les équipes puissantes accélèrent.",
      "resistance",
      0.76,
      "acceleration",
    ],
    [
      "finale",
      0.88,
      "Regroupement",
      "Les trains remontent leurs leaders.",
      "tactics",
      0.7,
      "team",
    ],
    [
      "sprint",
      0.98,
      "Derniers kilomètres",
      "Le peloton fonce vers l'arrivée.",
      "sprint",
      0.86,
      "final",
    ],
  ],
  vallons: [
    [
      "start",
      0.04,
      "Départ réel",
      "Les attaquants se placent dès le départ.",
      "tactics",
      0.38,
      "steady",
    ],
    [
      "breakaway",
      0.18,
      "Échappée matinale",
      "Un groupe tente de prendre le large.",
      "endurance",
      0.5,
      "acceleration",
    ],
    [
      "difficulty",
      0.36,
      "Première côte",
      "Les puncheurs testent le peloton.",
      "climbing",
      0.68,
      "acceleration",
    ],
    [
      "feed",
      0.54,
      "Ravitaillement",
      "Une phase plus calme permet de réfléchir.",
      "recovery",
      0.3,
      "team",
    ],
    [
      "descent",
      0.68,
      "Descente sinueuse",
      "Le placement et la technique font la différence.",
      "descending",
      0.62,
      "technical",
    ],
    [
      "difficulty",
      0.84,
      "Côte décisive",
      "Une attaque de favori secoue le groupe.",
      "explosiveness",
      0.88,
      "acceleration",
    ],
    [
      "finale",
      0.98,
      "Final vallonné",
      "Les derniers kilomètres restent indécis.",
      "resistance",
      0.82,
      "final",
    ],
  ],
};

export function createRacePhases(race: Race): InteractiveRacePhase[] {
  return terrainMoments[race.terrain].map(
    (
      [kind, ratio, title, description, keyStat, intensity, situation],
      index,
    ) => ({
      id: `${race.id}-phase-${index}`,
      kind,
      km: Math.round(race.distance * ratio),
      title,
      description,
      keyStat,
      intensity,
      situation,
    }),
  );
}

export function startInteractiveRace(
  race: Race,
  rider: Rider,
  strategy: RaceStrategy,
  identity: string,
  teamMate?: TeamMate,
): InteractiveRaceState {
  const seed = hash(`${identity}-${race.id}-${race.date}-${strategy}`);
  const startPosition = clamp(
    Math.round(18 - (rider.stats.tactics - 45) / 5),
    8,
    25,
  );
  return {
    raceId: race.id,
    seed,
    strategy,
    phaseIndex: 0,
    phases: createRacePhases(race),
    position: startPosition,
    startPosition,
    group: "Peloton principal",
    gapSeconds: 6,
    fatigueDelta: 0,
    performanceDelta: 0,
    groups: initialGroups(),
    teamMateId: teamMate?.id,
    teamMateName: teamMate?.name,
    teamSupport: 0,
    choices: [],
    log: [],
  };
}

const initialGroups = (): InteractiveRaceGroup[] => [
  {
    id: "breakaway",
    label: "Échappée",
    gapSeconds: 0,
    size: 5,
    kind: "breakaway",
  },
  {
    id: "peloton",
    label: "Peloton",
    gapSeconds: 42,
    size: 18,
    kind: "peloton",
  },
  {
    id: "chase",
    label: "Poursuivants",
    gapSeconds: 58,
    size: 6,
    kind: "chase",
  },
  {
    id: "dropped",
    label: "Attardés",
    gapSeconds: 92,
    size: 3,
    kind: "dropped",
  },
];

const choiceCosts = {
  attack: 2.2,
  follow: 1.2,
  conserve: -0.8,
  teamwork: 0.7,
} as const;
const choiceLabels = {
  attack: "Attaquer",
  follow: "Suivre le mouvement",
  conserve: "Économiser",
  teamwork: "Aider l'équipe",
} as const;

function terrainAffinity(rider: Rider, phase: InteractiveRacePhase) {
  const key = rider.stats[phase.keyStat];
  const profileBonus =
    (rider.profile === "grimpeur" &&
      ["mountain", "climbing", "descending"].includes(phase.keyStat)) ||
    (rider.profile === "sprinteur" && phase.keyStat === "sprint") ||
    (rider.profile === "classiqueur" && phase.keyStat === "pavement") ||
    (rider.profile === "rouleur" && phase.keyStat === "timeTrial")
      ? 5
      : 0;
  return key + profileBonus;
}

export function resolveInteractivePhase(
  state: InteractiveRaceState,
  rider: Rider,
  choice: InteractiveRaceChoice,
): InteractiveRaceState {
  const current = state.phases[state.phaseIndex];
  if (!current) return state;
  const roll = seededRandom(hash(`${state.seed}-${current.id}-${choice}`))();
  const currentFatigue = rider.fatigue + state.fatigueDelta;
  const affinity = terrainAffinity(rider, current);
  const groupAdjustment =
    state.group === "Groupe poursuivant"
      ? choice === "follow"
        ? 5
        : choice === "attack"
          ? -2
          : 0
      : state.group === "Groupe de tête" && choice === "conserve"
        ? 4
        : 0;
  const situationAdjustment =
    current.situation === "acceleration" && choice === "follow"
      ? 5
      : current.situation === "final" && choice === "attack"
        ? 3
        : current.situation === "team" && choice === "teamwork"
          ? 7
          : 0;
  const actionDifficulty =
    { attack: 57, follow: 51, conserve: 43, teamwork: 49 }[choice] +
    current.intensity * (choice === "attack" ? 5 : 2);
  const evaluation =
    affinity * 0.72 +
    rider.stats.tactics * 0.18 +
    rider.form * 0.12 -
    currentFatigue * 0.13 +
    (state.performanceDelta ?? 0) * 2 +
    groupAdjustment +
    situationAdjustment +
    (roll - 0.5) * 10;
  const margin = evaluation - actionDifficulty;
  const success = margin >= 0;
  const magnitude =
    choice === "attack"
      ? clamp(3 + Math.round(Math.abs(margin) / 5), 3, 6)
      : choice === "follow"
        ? clamp(1 + Math.round(Math.max(0, margin) / 8), 1, 2)
        : 1;
  let positionChange = 0;
  if (choice === "attack")
    positionChange = success
      ? -magnitude
      : clamp(1 + Math.round(-margin / 7), 1, 3);
  if (choice === "follow")
    positionChange = success
      ? -(state.group === "Groupe poursuivant" ? 1 : magnitude)
      : clamp(1 + Math.round(-margin / 10), 1, 2);
  if (choice === "conserve")
    positionChange = success ? (state.position <= 12 ? 1 : 0) : 2;
  if (choice === "teamwork")
    positionChange = current.situation === "team" && success ? 0 : 1;
  const position = clamp(state.position + positionChange, 1, 31);
  const fatigueCost = choiceCosts[choice] * (0.75 + current.intensity * 0.35);
  const fatigueDelta = Math.max(0, state.fatigueDelta + fatigueCost);
  const advantageChange =
    choice === "attack"
      ? success
        ? 1.15
        : -0.75
      : choice === "follow"
        ? success
          ? 0.45
          : -0.35
        : choice === "conserve"
          ? success
            ? 0.2
            : -0.2
          : success
            ? 0.3
            : -0.15;
  const performanceDelta = clamp(
    (state.performanceDelta ?? 0) + advantageChange,
    -5,
    5,
  );
  const group =
    position <= 7
      ? "Groupe de tête"
      : position <= 20
        ? "Peloton principal"
        : position <= 27
          ? "Groupe poursuivant"
          : "Groupe attardé";
  const targetGap =
    group === "Groupe de tête"
      ? 0
      : group === "Peloton principal"
        ? 5 + Math.max(0, position - 12) * 1.2
        : group === "Groupe poursuivant"
          ? 16 + (position - 20) * 3.2
          : 48 + (position - 27) * 7;
  const gapSeconds = Math.max(
    0,
    Math.round(state.gapSeconds * 0.45 + targetGap * 0.55 + (roll - 0.5) * 4),
  );
  const teamImpact =
    choice === "teamwork" && state.teamMateId ? (success ? 0.8 : 0.35) : 0;
  const teamSupport = clamp((state.teamSupport ?? 0) + teamImpact, 0, 4);
  const reason = success
    ? choice === "attack"
      ? `Accélération efficace grâce à ${current.keyStat}.`
      : choice === "follow"
        ? `Le rythme est suivi sans rupture.`
        : choice === "conserve"
          ? `Bonne récupération à l'abri du groupe.`
          : `${state.teamMateName ?? "L'équipier"} profite du travail de Julian.`
    : choice === "attack"
      ? `L'attaque échoue : terrain ou énergie insuffisants.`
      : choice === "follow"
        ? `Le changement de rythme ouvre un petit écart.`
        : choice === "conserve"
          ? `Le groupe accélère pendant que Julian temporise.`
          : `L'effort collectif coûte du placement à Julian.`;
  const consequence = `${advantageChange >= 0 ? "+" : ""}${advantageChange.toFixed(2)} avantage · ${fatigueCost >= 0 ? "+" : ""}${fatigueCost.toFixed(1)} fatigue — ${reason}`;
  return {
    ...state,
    phaseIndex: state.phaseIndex + 1,
    position,
    group,
    gapSeconds,
    fatigueDelta,
    performanceDelta,
    teamSupport,
    groups: updateGroups(state.groups ?? initialGroups(), current, roll),
    choices: [...state.choices, choice],
    log: [
      ...state.log,
      {
        phaseId: current.id,
        km: current.km,
        choice,
        text: `${choiceLabels[choice]} — ${reason}`,
        consequence,
        fatigueDelta: fatigueCost,
        performanceDelta: advantageChange,
        teamImpact,
        positionBefore: state.position,
        positionAfter: position,
      },
    ],
  };
}

function updateGroups(
  groups: InteractiveRaceGroup[],
  phase: InteractiveRacePhase,
  roll: number,
) {
  return groups.map((group) => {
    if (group.kind === "breakaway") return { ...group, gapSeconds: 0 };
    const pressure = phase.intensity * (group.kind === "peloton" ? 8 : 13);
    const evolution = pressure + (roll - 0.5) * 8;
    return {
      ...group,
      gapSeconds: Math.max(
        3,
        Math.round(
          group.gapSeconds + evolution - (phase.situation === "steady" ? 6 : 0),
        ),
      ),
    };
  });
}

export function interactiveFinalModifier(state: InteractiveRaceState) {
  const positional = ((state.startPosition ?? 18) - state.position) * 0.28;
  return clamp((state.performanceDelta ?? 0) + positional, -6, 6);
}

export function interactiveTendency(state: InteractiveRaceState) {
  const value = interactiveFinalModifier(state) - state.fatigueDelta * 0.08;
  if (value >= 2)
    return {
      label: "Très favorable",
      symbol: "↑↑",
      text: "Vos décisions devraient nettement améliorer votre résultat.",
    };
  if (value >= 0.5)
    return {
      label: "Légèrement favorable",
      symbol: "↗",
      text: "Votre course interactive devrait avoir un impact positif.",
    };
  if (value <= -2)
    return {
      label: "Défavorable",
      symbol: "↓↓",
      text: "Les efforts et les pertes de placement devraient coûter des places.",
    };
  if (value <= -0.5)
    return {
      label: "Légèrement défavorable",
      symbol: "↘",
      text: "Votre situation avant l'arrivée est moins bonne qu'attendu.",
    };
  return {
    label: "Neutre",
    symbol: "→",
    text: "Votre course reste proche du niveau attendu.",
  };
}
