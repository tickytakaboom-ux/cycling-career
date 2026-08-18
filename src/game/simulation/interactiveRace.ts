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
  const teamMateSituation = teamMate
    ? createTeamMateSituation(seed, race, teamMate, startPosition, 6)
    : undefined;
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
    ...teamMateSituation,
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
    label: "Retardataires",
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

const terrainProfileFit: Record<
  Terrain,
  Partial<Record<Rider["profile"], number>>
> = {
  montagne: { grimpeur: 8, puncheur: 3, baroudeur: 2 },
  sprint: { sprinteur: 8, rouleur: 3 },
  paves: { classiqueur: 8, rouleur: 4, baroudeur: 3 },
  chrono: { rouleur: 8 },
  plaine: { sprinteur: 7, rouleur: 5, classiqueur: 2 },
  vallons: { puncheur: 8, classiqueur: 4, grimpeur: 2, baroudeur: 3 },
};

const terrainStat: Record<Terrain, keyof Rider["stats"]> = {
  montagne: "mountain",
  sprint: "sprint",
  paves: "pavement",
  chrono: "timeTrial",
  plaine: "endurance",
  vallons: "explosiveness",
};

export function selectInteractiveTeamMate(
  race: Race,
  roster: TeamMate[],
  selectedIds: string[],
) {
  const selected = new Set(selectedIds);
  const roleValue: Record<TeamMate["role"], number> = {
    Leader: 8,
    "Coureur protégé": 6,
    Équipier: 2,
    "Jeune espoir": 1,
  };
  const keyStat = terrainStat[race.terrain];
  return roster
    .filter((mate) => selected.has(mate.id))
    .map((mate) => ({
      mate,
      score:
        mate.level * 0.45 +
        mate.stats[keyStat] * 0.25 +
        mate.form * 0.12 +
        (terrainProfileFit[race.terrain][mate.profile] ?? 0) +
        roleValue[mate.role] +
        (race.distance >= 160 ? mate.stats.endurance * 0.08 : 0),
    }))
    .sort((a, b) => b.score - a.score || a.mate.id.localeCompare(b.mate.id))[0]
    ?.mate;
}

function groupForPosition(position: number) {
  return position <= 7
    ? "Groupe de tête"
    : position <= 20
      ? "Peloton principal"
      : position <= 27
        ? "Groupe poursuivant"
        : "Groupe retardataire";
}

const isDroppedGroup = (group: string) =>
  group === "Groupe retardataire" || group === "Groupe attardé";

function gapForPosition(position: number) {
  return position <= 7
    ? 0
    : position <= 20
      ? 5 + Math.max(0, position - 12) * 1.2
      : position <= 27
        ? 16 + (position - 20) * 3.2
        : 48 + (position - 27) * 7;
}

function teamMateIsAccessible(
  julianGroup: string,
  julianGap: number,
  mateGroup: string,
  mateGap: number,
) {
  return julianGroup === mateGroup && Math.abs(julianGap - mateGap) <= 10;
}

function createTeamMateSituation(
  seed: number,
  race: Race,
  mate: TeamMate,
  julianPosition: number,
  julianGap: number,
) {
  const roll = seededRandom(hash(`${seed}-${mate.id}-situation`))();
  const suitability =
    mate.level * 0.35 +
    mate.stats[terrainStat[race.terrain]] * 0.35 +
    mate.form * 0.2 +
    (terrainProfileFit[race.terrain][mate.profile] ?? 0);
  const teamMatePosition = clamp(
    Math.round(31 - suitability / 4 + (roll - 0.5) * 8),
    3,
    30,
  );
  const teamMateGroup = groupForPosition(teamMatePosition);
  const teamMateGapSeconds = Math.max(
    0,
    Math.round(gapForPosition(teamMatePosition) + (roll - 0.5) * 5),
  );
  return {
    teamMatePosition,
    teamMateGroup,
    teamMateGapSeconds,
    teamMateAccessible: teamMateIsAccessible(
      groupForPosition(julianPosition),
      julianGap,
      teamMateGroup,
      teamMateGapSeconds,
    ),
  };
}

export interface InteractiveChoiceDescription {
  label: string;
  description: string;
  indicators: string;
  disabled?: boolean;
}

const statLabels: Record<keyof Rider["stats"], string> = {
  mountain: "montagne",
  sprint: "sprint",
  climbing: "ascension",
  timeTrial: "contre-la-montre",
  pavement: "pavés",
  endurance: "endurance",
  explosiveness: "explosivité",
  recovery: "récupération",
  descending: "descente",
  tactics: "tactique",
  resistance: "résistance",
  weather: "adaptation météo",
};

function riderQuality(rider: Rider, key: keyof Rider["stats"]) {
  const value = rider.stats[key];
  const label = statLabels[key];
  if (value >= 72) return `${label} (point fort)`;
  if (value >= 62) return `${label} (niveau solide)`;
  if (value < 50) return `${label} (point faible)`;
  return `${label} (niveau limité)`;
}

function currentRaceGuidance(state: InteractiveRaceState) {
  const advantage = state.performanceDelta ?? 0;
  if (advantage >= 1)
    return "L’avantage acquis lui permet d’exploiter une situation favorable.";
  if (advantage <= -1)
    return "Son désavantage actuel l’oblige surtout à limiter les pertes.";
  return "La course reste équilibrée et chaque dépense peut encore compter.";
}

export function interactiveChoiceDescriptions(
  state: InteractiveRaceState,
  rider: Rider,
  race: Race,
): Record<InteractiveRaceChoice, InteractiveChoiceDescription> {
  const phase = state.phases[state.phaseIndex];
  const fatigue = rider.fatigue + state.fatigueDelta;
  const affinity = phase ? terrainAffinity(rider, phase) : 50;
  const underPressure =
    phase?.situation === "acceleration" || phase?.situation === "final";
  const poorlyPlaced =
    state.position > 20 || state.group.includes("poursuivant");
  const tired = fatigue >= 65;
  const favorable = affinity >= 65 || (state.performanceDelta ?? 0) >= 1.5;
  const keyStat = phase?.keyStat ?? terrainStat[race.terrain];
  const quality = riderQuality(rider, keyStat);
  const guidance = currentRaceGuidance(state);
  const phaseContext =
    phase?.situation === "technical"
      ? "dans ce passage technique"
      : phase?.situation === "team"
        ? "dans cette phase collective"
        : phase?.situation === "final"
          ? "dans le final"
          : underPressure
            ? "face à l'accélération"
            : "dans cette phase calme";
  const attack = tired
    ? `Attaque très risquée ${phaseContext} : avec ${quality}, Julian dispose surtout de ressources limitées par sa fatigue. ${guidance}`
    : poorlyPlaced
      ? `Avec ${quality}, Julian peut tenter de combler des places, mais son groupe et l'écart avec l'avant rendent l'effort incertain. ${guidance}`
      : favorable
        ? `Le passage sollicite ${quality} : Julian peut prendre l'initiative sans garantie de réussite. ${guidance}`
        : `Le passage sollicite ${quality} : une attaque est moins intéressante et reste risquée. ${guidance}`;
  const follow = underPressure
    ? poorlyPlaced
      ? `Décroché dans le ${state.group.toLowerCase()}, Julian doit s'appuyer sur ${quality} pour limiter les pertes, mais revenir au contact sera difficile. ${guidance}`
      : `Répondre au changement de rythme sollicite ${quality} et protège le placement, au prix d'un effort mesuré. ${guidance}`
    : tired
      ? `Suivre défend la position, mais la fatigue rend tout effort en ${quality} plus risqué. ${guidance}`
      : `Rester dans les roues en s'appuyant sur ${quality} consolide le groupe sans prendre l'initiative. ${guidance}`;
  const conserve = poorlyPlaced
    ? `Réduit l'effort malgré une position défavorable, mais risque d'augmenter l'écart avec les groupes de devant. ${guidance}`
    : underPressure
      ? `Préserve les ressources de Julian, avec un risque de perdre des places pendant l'accélération. ${guidance}`
      : `Profite de l'accalmie pour récupérer, au risque de céder un peu de terrain. ${guidance}`;
  const accessible = Boolean(
    state.teamMateId && state.teamMateAccessible !== false,
  );
  const mateSituation = accessible
    ? `${state.teamMateName} est accessible dans le ${state.teamMateGroup?.toLowerCase()}${state.teamMatePosition ? ` autour de la ${state.teamMatePosition}e place` : ""}.`
    : "Impossible d’aider cet équipier depuis votre groupe";
  return {
    attack: {
      label: "Attaquer",
      description: attack,
      indicators: "Placement ↑↑ · Fatigue ↑↑ · Risque élevé",
    },
    follow: {
      label: "Suivre le mouvement",
      description: follow,
      indicators: "Placement ↑ / = · Fatigue ↑ · Risque modéré",
    },
    conserve: {
      label: "Économiser",
      description: conserve,
      indicators: "Placement = / ↓ · Fatigue ↓ · Risque de perte d'écart",
    },
    teamwork: {
      label: accessible ? `Aider ${state.teamMateName}` : "Aider un équipier",
      description: mateSituation,
      indicators: accessible
        ? "Placement = / ↓ · Fatigue ↑ · Impact collectif ↑↑"
        : "Action indisponible",
      disabled: !accessible,
    },
  };
}

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
  if (choice === "teamwork" && state.teamMateAccessible === false) return state;
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
  const group = groupForPosition(position);
  const targetGap = gapForPosition(position);
  const gapSeconds = Math.max(
    0,
    Math.round(state.gapSeconds * 0.45 + targetGap * 0.55 + (roll - 0.5) * 4),
  );
  const teamImpact =
    choice === "teamwork" && state.teamMateId ? (success ? 0.8 : 0.35) : 0;
  const teamSupport = clamp((state.teamSupport ?? 0) + teamImpact, 0, 4);
  const mateRoll = seededRandom(
    hash(`${state.seed}-${current.id}-${state.teamMateId ?? "none"}-mate`),
  )();
  const teamMatePosition = state.teamMatePosition
    ? clamp(state.teamMatePosition + Math.round((mateRoll - 0.5) * 4), 1, 31)
    : undefined;
  const teamMateGroup = teamMatePosition
    ? groupForPosition(teamMatePosition)
    : undefined;
  const teamMateGapSeconds = teamMatePosition
    ? Math.max(
        0,
        Math.round(
          (state.teamMateGapSeconds ?? gapForPosition(teamMatePosition)) *
            0.55 +
            gapForPosition(teamMatePosition) * 0.45 +
            (mateRoll - 0.5) * 4,
        ),
      )
    : undefined;
  const teamMateAccessible = Boolean(
    teamMateGroup &&
    teamMateGapSeconds !== undefined &&
    teamMateIsAccessible(group, gapSeconds, teamMateGroup, teamMateGapSeconds),
  );
  const failedAttackReason = attackFailureReason(
    state,
    rider,
    current,
    affinity,
    currentFatigue,
  );
  const reason = success
    ? choice === "attack"
      ? `Julian exploite ${riderQuality(rider, current.keyStat)} pour créer une accélération efficace.`
      : choice === "follow"
        ? `Son niveau en ${riderQuality(rider, current.keyStat)} lui permet de suivre le rythme sans rupture.`
        : choice === "conserve"
          ? `Julian profite de cette situation pour récupérer à l'abri du groupe.`
          : `${state.teamMateName ?? "L'équipier"} gagne du terrain grâce au travail de Julian.`
    : choice === "attack"
      ? failedAttackReason
      : choice === "follow"
        ? followFailureReason(state, rider, current, affinity, currentFatigue)
        : choice === "conserve"
          ? `Le groupe accélère pendant que Julian temporise : son écart augmente malgré l'énergie économisée.`
          : `L'effort collectif coûte du placement à Julian, mais améliore la situation de ${state.teamMateName ?? "son équipier"}.`;
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
    teamMatePosition,
    teamMateGroup,
    teamMateGapSeconds,
    teamMateAccessible,
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

function attackFailureReason(
  state: InteractiveRaceState,
  rider: Rider,
  phase: InteractiveRacePhase,
  affinity: number,
  fatigue: number,
) {
  if (state.gapSeconds >= 35 || isDroppedGroup(state.group))
    return "Attaque ratée — le groupe était trop loin au moment de l’effort.";
  if (fatigue >= 70 && state.position > 18)
    return "Attaque ratée — fatigue trop élevée et position défavorable.";
  if (affinity < 55)
    return "Attaque ratée — terrain peu adapté au profil de Julian.";
  if (
    fatigue >= 60 ||
    (phase.situation === "acceleration" && rider.stats.resistance < 60)
  )
    return "Attaque ratée — Julian manque de ressources pour répondre à l’accélération.";
  if (state.position > 20)
    return "Attaque ratée — position trop défavorable pour atteindre l’avant du groupe.";
  return "Attaque ratée — le rythme du groupe neutralise l’effort de Julian.";
}

function followFailureReason(
  state: InteractiveRaceState,
  rider: Rider,
  phase: InteractiveRacePhase,
  affinity: number,
  fatigue: number,
) {
  if (state.gapSeconds >= 35 || isDroppedGroup(state.group))
    return "Julian suit le mouvement, mais son groupe est trop loin pour revenir complètement au contact.";
  if (fatigue >= 70)
    return "Julian suit le mouvement, mais sa fatigue ne lui permet pas de tenir complètement le rythme.";
  if (affinity < 55)
    return `Julian suit le mouvement, mais son déficit en ${statLabels[phase.keyStat]} ne lui permet pas de tenir complètement le rythme.`;
  if (state.position > 20)
    return "Julian suit le mouvement, mais sa position défavorable ouvre un petit écart.";
  return `Julian suit le mouvement, mais son niveau en ${riderQuality(rider, phase.keyStat)} ne suffit pas face à cette accélération.`;
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
  return clamp(state.performanceDelta ?? 0, -6, 6);
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
