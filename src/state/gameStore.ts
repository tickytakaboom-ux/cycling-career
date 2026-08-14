import type {
  CalendarRace,
  ContractObjective,
  GameState,
  InteractiveRaceChoice,
  RaceResult,
  RaceStrategy,
  Rider,
  RiderProfile,
  RiderStats,
  TrainingType,
} from "../game/models";
import { careerTeams } from "../data/careerTeams";
import { starterTeam } from "../data/teams";
import { raceTemplates } from "../data/races";
import { generateOpponents } from "../data/riders";
import {
  careerLevel,
  claimObjectiveBonuses,
  seasonSummary,
  updateObjectives,
} from "../game/career/careerProgression";
import { generateOffers, resolveOffer } from "../game/career/contracts";
import { fieldRange, generateTeamCalendar } from "../game/career/teams";
import {
  selectTeamMates,
  simulateTeamMates,
  updateTeamMateForms,
} from "../game/career/teamSimulation";
import { evolveTeam } from "../game/career/teamEvolution";
import { evaluateRole } from "../game/career/roles";
import { overallRating, teammateStats } from "../game/career/riderRating";
import { fatigueConfig, injuryConfig, moraleConfig } from "../game/config";
import {
  canTrain,
  healOneDay,
  rollInjury,
} from "../game/injuries/injurySystem";
import {
  applyRaceProgression,
  applyTraining,
  recoverDay,
  trainingAllowed,
} from "../game/progression/training";
import { simulateRace } from "../game/simulation/raceSimulation";
import {
  resolveInteractivePhase,
  seededRandom,
  startInteractiveRace as createInteractiveRace,
} from "../game/simulation/interactiveRace";
import type { RandomSource } from "../game/simulation/random";
import { generateWeather } from "../game/weather/weather";
import {
  createWorld,
  evolveWorld,
  recordWorldRace,
} from "../game/world/worldSimulation";
import {
  applyMoraleEvent,
  annualProgressionMoraleDelta,
  injuryMoraleDelta,
  restMoraleDelta,
  resultMoraleReason,
} from "../game/morale/moraleSystem";

export const SAVE_KEY = "cycling-career-v1";
const GAME_VERSION = 3;
const iso = (date: Date) => date.toISOString().slice(0, 10),
  toDate = (date: string) => new Date(`${date}T12:00:00`),
  addDays = (date: string, days: number) => {
    const next = toDate(date);
    next.setDate(next.getDate() + days);
    return iso(next);
  },
  daysBetween = (from: string, to: string) =>
    Math.max(0, Math.round((+toDate(to) - +toDate(from)) / 86400000));
const updateStatuses = (calendar: CalendarRace[], date: string) =>
  calendar.map(
    (race) =>
      ({
        ...race,
        status:
          race.status === "completed"
            ? "completed"
            : race.date === date
              ? "available"
              : "planned",
      }) as CalendarRace,
  );
const advanceRiderDay = (rider: Rider, rest: boolean) =>
    healOneDay(rest ? recoverDay(rider) : rider),
  recoverAcrossDays = (rider: Rider, days: number, startDate: string) => {
    let value = rider;
    for (let day = 0; day < days; day++) {
      const date = addDays(startDate, day),
        fatigue = value.fatigue;
      value = advanceRiderDay(value, true);
      value = applyMoraleEvent(value, {
        id: `rest-${date}`,
        date,
        delta: restMoraleDelta(fatigue),
        reason:
          fatigue <= 30
            ? "Repos avec fatigue faible"
            : fatigue <= 60
              ? "Récupération maîtrisée"
              : fatigue >= 75
                ? "Fatigue élevée"
                : "Repos",
        category: "rest",
      });
    }
    return value;
  };
const season = (year = 2027) => ({
    year,
    startDate: `${year}-02-01`,
    endDate: `${year}-11-30`,
    status: "active" as const,
  }),
  unaffiliated = {
    ...careerTeams[0],
    id: "unaffiliated",
    name: "Sans équipe",
    roster: [],
  };
const careerBase = () => ({
  level: 1 as const,
  balance: 0,
  totalEarnings: 0,
  objectiveBonuses: 0,
  scoutingUnlocked: false,
  moraleStreak: { top20: 0, poor: 0 },
});
export function createCareer(rider: Rider): GameState {
  const current = season(),
    world = {
      ...createWorld(current.year),
      playerPreviousRating: overallRating(rider.stats, rider.profile),
    };
  return {
    gameVersion: GAME_VERSION,
    careerId: crypto.randomUUID(),
    currentDate: current.startDate,
    season: current,
    rider,
    team: unaffiliated,
    world,
    career: { ...careerBase(), offers: generateOffers(rider, current.year) },
    selectedTraining: "endurance",
    calendar: [],
  };
}
export function createGame(rider: Rider): GameState {
  const start = "2027-02-01",
    world = {
      ...createWorld(),
      playerPreviousRating: overallRating(rider.stats, rider.profile),
    },
    offer = generateOffers(rider)[2] ?? generateOffers(rider)[0],
    contract = resolveOffer(offer).contract;
  return {
    gameVersion: GAME_VERSION,
    careerId: crypto.randomUUID(),
    currentDate: start,
    season: season(),
    rider,
    team: starterTeam,
    world,
    career: { ...careerBase(), offers: [], contract },
    selectedTraining: "endurance",
    calendar: raceTemplates.map((race, index) => ({
      ...race,
      date: addDays(start, index * 12 + 7),
      status: "planned",
      competitionLevel: 2,
      weather: generateWeather(race),
      maxAltitude:
        race.terrain === "montagne" ? 1850 + index * 110 : 350 + index * 60,
    })),
  };
}
export function signContract(game: GameState, offerId: string): GameState {
  const offer = game.career.offers.find((item) => item.id === offerId);
  if (!offer) return { ...game, notice: "Cette offre n’est plus disponible." };
  const { team, contract } = resolveOffer(offer, game.world.teams);
  return {
    ...game,
    team,
    career: { ...game.career, contract, offers: [] },
    calendar: generateTeamCalendar(team, game.season.year),
    notice: `Contrat signé avec ${team.name}.`,
  };
}
export function saveGame(game: GameState) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(game));
}
export function deleteSave() {
  localStorage.removeItem(SAVE_KEY);
}
function defaultPotentials(stats: RiderStats) {
  const potentials = {} as RiderStats;
  Object.entries(stats).forEach(
    ([key, value]) =>
      (potentials[key as keyof RiderStats] = Math.min(96, value + 22)),
  );
  return potentials;
}
function migrateResult(
  result: Partial<RaceResult> | undefined,
): RaceResult | undefined {
  if (!result) return undefined;
  return {
    ...result,
    reputationGained: result.reputationGained ?? 0.05,
    moraleChange: result.moraleChange ?? 0,
    strategy: result.strategy ?? "normal",
    fatigueCost: result.fatigueCost ?? 16,
    strategySummary: result.strategySummary ?? "Plan équilibré.",
    events: result.events ?? [],
  } as RaceResult;
}
export function migrateGame(saved: GameState): GameState {
  const legacy = saved.rider.profile as RiderProfile | "complet",
    profile: RiderProfile =
      legacy === "complet" || legacy === "etapes"
        ? "rouleur"
        : legacy === "classiqueur"
          ? "baroudeur"
          : legacy,
    legacyHidden = saved.rider.hidden as Rider["hidden"] & {
      potential?: number;
    },
    hidden = {
      ...legacyHidden,
      potentials:
        legacyHidden.potentials ?? defaultPotentials(saved.rider.stats),
    },
    legacyTeam = saved.team ?? starterTeam,
    source = careerTeams.find((item) => item.id === legacyTeam.id),
    baseTeam = source ?? { ...starterTeam, ...legacyTeam },
    roster = baseTeam.roster.map((mate, index) => {
      const stats =
        mate.stats ?? teammateStats(mate.profile, mate.level, index);
      return {
        ...mate,
        stats,
        potentials: mate.potentials ?? defaultPotentials(stats),
        form: mate.form ?? 62,
        seasonsWithTeam: mate.seasonsWithTeam ?? 0,
      };
    }),
    team = { ...baseTeam, roster },
    calendar = (saved.calendar ?? []).map((race) => {
      const migrated = {
        ...race,
        competitionLevel:
          race.competitionLevel ??
          (Math.min(4, Math.max(1, Math.round(race.prestige / 20))) as
            1 | 2 | 3 | 4),
        weather: race.weather ?? generateWeather(race),
        result: migrateResult(race.result),
      } as CalendarRace;
      return {
        ...migrated,
        selectedTeamMateIds:
          migrated.selectedTeamMateIds ?? selectTeamMates(roster, migrated),
      };
    }),
    earliest = calendar
      .filter((race) => race.status !== "completed")
      .sort((a, b) => a.date.localeCompare(b.date))[0],
    currentDate =
      earliest && earliest.date < saved.currentDate
        ? earliest.date
        : saved.currentDate,
    defaultContract = resolveOffer(generateOffers(saved.rider)[0]).contract,
    oldCareer = saved.career ?? {
      ...careerBase(),
      offers: [],
      contract: defaultContract,
    },
    contract = oldCareer.contract
      ? {
          ...oldCareer.contract,
          objectives: oldCareer.contract.objectives.map((objective) => ({
            ...objective,
            reward: objective.reward ?? 200,
            rewarded: objective.rewarded ?? false,
          })),
        }
      : undefined,
    world = saved.world ?? {
      ...createWorld(saved.season?.year ?? 2027),
      playerPreviousRating: overallRating(
        saved.rider.stats,
        saved.rider.profile,
      ),
    };
  return {
    ...saved,
    gameVersion: GAME_VERSION,
    currentDate,
    season: saved.season ?? season(),
    rider: {
      ...saved.rider,
      profile,
      hidden,
      moraleHistory: saved.rider.moraleHistory ?? [],
      moraleAppliedEventIds: saved.rider.moraleAppliedEventIds ?? [],
    },
    team,
    world,
    career: {
      ...oldCareer,
      contract,
      objectiveBonuses: oldCareer.objectiveBonuses ?? 0,
      scoutingUnlocked: oldCareer.scoutingUnlocked ?? false,
      moraleStreak: oldCareer.moraleStreak ?? { top20: 0, poor: 0 },
      level: careerLevel(saved.rider.reputation, saved.rider.experience),
    },
    calendar: updateStatuses(calendar, currentDate),
  };
}
export function loadGame(): GameState | undefined {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? migrateGame(JSON.parse(raw) as GameState) : undefined;
  } catch {
    return undefined;
  }
}
function salaryForDate(game: GameState, date: string) {
  if (!game.career.contract || game.lastSalaryMonth === date.slice(0, 7))
    return game;
  const salary = game.career.contract.monthlySalary;
  return {
    ...game,
    lastSalaryMonth: date.slice(0, 7),
    career: {
      ...game.career,
      balance: game.career.balance + salary,
      totalEarnings: game.career.totalEarnings + salary,
    },
  };
}
export function nextDay(game: GameState): GameState {
  if (game.calendar.some((race) => race.status === "available"))
    return { ...game, notice: "Une course est prévue aujourd’hui." };
  const currentDate = addDays(game.currentDate, 1),
    fatigue = game.rider.fatigue,
    recovered = advanceRiderDay(game.rider, true),
    rider = applyMoraleEvent(recovered, {
      id: `rest-${game.currentDate}`,
      date: game.currentDate,
      delta: restMoraleDelta(fatigue),
      reason:
        fatigue <= 30
          ? "Repos avec fatigue faible"
          : fatigue <= 60
            ? "Récupération maîtrisée"
            : fatigue >= 75
              ? "Fatigue élevée"
              : "Repos",
      category: "rest",
    });
  return salaryForDate(
    {
      ...game,
      currentDate,
      rider,
      notice: "Journée de récupération.",
      calendar: updateStatuses(game.calendar, currentDate),
    },
    currentDate,
  );
}
export function trainingBlockReason(game: GameState, type: TrainingType) {
  if (!game.career.contract)
    return "Signez un contrat avant de commencer la saison.";
  if (game.calendar.some((race) => race.status === "available"))
    return "Une course est prévue aujourd’hui.";
  if (game.lastTrainingDate === game.currentDate)
    return "Une activité a déjà été effectuée aujourd’hui.";
  if (!canTrain(game.rider, type))
    return `Votre blessure (${game.rider.injury?.name}) interdit cette séance.`;
  if (!trainingAllowed(game.rider, type))
    return `Fatigue trop élevée : cette séance dépasserait le seuil de ${fatigueConfig.trainingLimit}.`;
  return undefined;
}
export function train(
  game: GameState,
  type: TrainingType,
  random: RandomSource = Math.random,
): GameState {
  const reason = trainingBlockReason(game, type);
  if (reason) return { ...game, notice: reason };
  const trained = applyTraining(
      game.rider,
      type,
      game.team.trainingQuality / 65,
    ),
    injury = rollInjury(
      trained,
      game.currentDate,
      { kind: "training", type },
      random,
    ),
    advanced = advanceRiderDay(
      { ...trained, injury: injury ?? trained.injury },
      false,
    ),
    currentDate = addDays(game.currentDate, 1);
  let rider = applyMoraleEvent(advanced, {
    id: `training-${game.currentDate}`,
    date: game.currentDate,
    delta: moraleConfig.trainingGain,
    reason: "Entraînement réussi",
    category: "training",
  });
  if (injury)
    rider = applyMoraleEvent(rider, {
      id: `injury-training-${injury.id}`,
      date: game.currentDate,
      delta: injuryMoraleDelta(injury.severity),
      reason: `Blessure : ${injury.name}`,
      category: "injury",
    });
  return salaryForDate(
    {
      ...game,
      currentDate,
      rider,
      lastTrainingDate: game.currentDate,
      notice: injury ? `Séance terminée : ${injury.name}.` : "Séance terminée.",
      calendar: updateStatuses(game.calendar, currentDate),
    },
    currentDate,
  );
}
function applyRaceMorale(
  game: GameState,
  rider: Rider,
  result: RaceResult,
  objectives: ContractObjective[],
  seasonFinished: boolean,
) {
  let value = applyMoraleEvent(rider, {
    id: `race-result-${result.raceId}`,
    date: game.currentDate,
    delta: result.moraleChange,
    reason: resultMoraleReason(result.position, result.fieldSize),
    category: "race",
  });
  if (result.injury)
    value = applyMoraleEvent(value, {
      id: `injury-race-${result.injury.id}`,
      date: game.currentDate,
      delta: injuryMoraleDelta(result.injury.severity),
      reason: `Blessure en course : ${result.injury.name}`,
      category: "injury",
    });
  const previous = game.career.contract?.objectives ?? [];
  for (const objective of objectives) {
    if (
      objective.status === "completed" &&
      previous.find((item) => item.id === objective.id)?.status !== "completed"
    )
      value = applyMoraleEvent(value, {
        id: `objective-success-${game.season.year}-${objective.id}`,
        date: game.currentDate,
        delta: moraleConfig.objectiveSuccess,
        reason: `Objectif atteint : ${objective.label}`,
        category: "objective",
      });
  }
  const finalObjectives = objectives.map((objective) =>
    seasonFinished && objective.status !== "completed"
      ? { ...objective, status: "failed" as const }
      : objective,
  );
  if (seasonFinished)
    for (const objective of finalObjectives) {
      if (objective.status === "failed")
        value = applyMoraleEvent(value, {
          id: `objective-failed-${game.season.year}-${objective.id}`,
          date: game.currentDate,
          delta: moraleConfig.objectiveFailure,
          reason: `Objectif non atteint : ${objective.label}`,
          category: "objective",
        });
    }
  return { rider: value, objectives: finalObjectives };
}
export function race(
  game: GameState,
  raceId: string,
  strategy: RaceStrategy,
  random: RandomSource = Math.random,
  interactiveModifier = 0,
): GameState {
  const target = game.calendar.find((item) => item.id === raceId);
  if (
    !target ||
    target.status !== "available" ||
    target.date !== game.currentDate
  )
    return {
      ...game,
      notice: "Cette course ne peut être disputée qu’à sa date prévue.",
    };
  const range = fieldRange(target.competitionLevel ?? game.team.level),
    field = generateOpponents((range.average[0] + range.average[1]) / 2),
    selected = target.selectedTeamMateIds ?? [],
    result = simulateRace(
      game.rider,
      field,
      target,
      strategy,
      random,
      interactiveModifier,
    ),
    teamResults = simulateTeamMates(
      game.team.roster,
      selected,
      target,
      field,
      random,
      result.score,
    ),
    team = {
      ...game.team,
      roster: updateTeamMateForms(
        game.team.roster,
        selected,
        target.difficulty,
      ),
    },
    afterRace = applyRaceProgression(game.rider, result, target),
    currentDate = addDays(game.currentDate, 1),
    calendar = game.calendar.map((item) =>
      item.id === raceId
        ? ({
            ...item,
            status: "completed",
            result,
            teamResults,
          } as CalendarRace)
        : item,
    ),
    tracked = updateObjectives(
      game.career.contract?.objectives ?? [],
      result,
      afterRace.reputation,
    ),
    claimed = claimObjectiveBonuses(tracked),
    allDone = calendar.every((item) => item.status === "completed"),
    moraleOutcome = applyRaceMorale(
      game,
      advanceRiderDay(afterRace, false),
      result,
      claimed.objectives,
      allDone,
    ),
    contract = game.career.contract
      ? { ...game.career.contract, objectives: moraleOutcome.objectives }
      : undefined,
    nextCareer = {
      ...game.career,
      balance: game.career.balance + claimed.bonus,
      totalEarnings: game.career.totalEarnings + claimed.bonus,
      objectiveBonuses: game.career.objectiveBonuses + claimed.bonus,
      level: careerLevel(afterRace.reputation, afterRace.experience),
      contract,
    },
    next = {
      ...game,
      team,
      world: recordWorldRace(game.world, { ...target, teamResults }),
      currentDate,
      lastResult: result,
      rider: moraleOutcome.rider,
      career: nextCareer,
      notice: claimed.bonus
        ? `Prime d’objectif : +${claimed.bonus} €.`
        : "Course terminée.",
      calendar: updateStatuses(calendar, currentDate),
      season: allDone
        ? { ...game.season, status: "completed" as const }
        : game.season,
    };
  return allDone
    ? {
        ...next,
        career: {
          ...nextCareer,
          seasonEvaluation: seasonSummary(next).evaluation,
        },
      }
    : next;
}

export function beginInteractiveRace(
  game: GameState,
  raceId: string,
  strategy: RaceStrategy,
): GameState {
  const target = game.calendar.find((item) => item.id === raceId);
  if (
    !target ||
    target.status !== "available" ||
    target.date !== game.currentDate
  )
    return { ...game, notice: "Cette course ne peut être lancée aujourd’hui." };
  if (game.activeRace?.raceId === raceId) return game;
  return {
    ...game,
    activeRace: createInteractiveRace(
      target,
      game.rider,
      strategy,
      `${game.careerId}-${game.season.year}`,
    ),
    notice: `Départ de ${target.name}.`,
  };
}

export function chooseInteractiveRaceAction(
  game: GameState,
  choice: InteractiveRaceChoice,
): GameState {
  if (!game.activeRace) return game;
  return {
    ...game,
    activeRace: resolveInteractivePhase(game.activeRace, game.rider, choice),
  };
}

export function finishInteractiveRace(game: GameState): GameState {
  const active = game.activeRace;
  if (!active || active.phaseIndex < active.phases.length) return game;
  const prepared = {
    ...game,
    activeRace: undefined,
    rider: {
      ...game.rider,
      fatigue: Math.min(100, game.rider.fatigue + active.fatigueDelta),
    },
  };
  const finished = race(
    prepared,
    active.raceId,
    active.strategy,
    seededRandom(active.seed),
    active.performanceDelta,
  );
  if (!finished.lastResult) return finished;
  const result = {
    ...finished.lastResult,
    events: [
      ...active.log.map(
        (entry) =>
          `Km ${entry.km} : ${entry.text} (${entry.positionBefore}e → ${entry.positionAfter}e)`,
      ),
      ...finished.lastResult.events,
    ],
  };
  return {
    ...finished,
    lastResult: result,
    calendar: finished.calendar.map((item) =>
      item.id === active.raceId ? { ...item, result } : item,
    ),
  };
}
export function advanceToNextRace(game: GameState): GameState {
  if (game.calendar.some((race) => race.status === "available"))
    return { ...game, notice: "La course du jour doit être disputée." };
  const nextRace = game.calendar
    .filter(
      (race) => race.status !== "completed" && race.date >= game.currentDate,
    )
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  if (!nextRace) return game;
  const days = daysBetween(game.currentDate, nextRace.date);
  return {
    ...game,
    currentDate: nextRace.date,
    rider: recoverAcrossDays(game.rider, days, game.currentDate),
    notice: `Repos automatique pendant ${days} jour${days > 1 ? "s" : ""}.`,
    calendar: updateStatuses(game.calendar, nextRace.date),
  };
}
export function prepareNextSeasonOffers(game: GameState): GameState {
  const top10 = game.calendar.filter(
      (item) => (item.result?.position ?? 99) <= 10,
    ).length,
    rating = overallRating(game.rider.stats, game.rider.profile),
    previousRating = game.world.playerPreviousRating ?? rating,
    ratingDelta = rating - previousRating,
    role = evaluateRole(
      game.career.contract?.role ?? "Équipier",
      rating,
      game.team.averageRiderLevel,
      game.rider.age,
      top10,
      game.rider.experience,
    ),
    world = evolveWorld(game.world, game, game.season.year + 1),
    annualMorale = annualProgressionMoraleDelta(ratingDelta),
    rider = applyMoraleEvent(game.rider, {
      id: `annual-progression-${game.season.year}`,
      date: game.currentDate,
      delta: annualMorale,
      reason:
        ratingDelta >= 2
          ? "Forte progression annuelle"
          : ratingDelta >= 1
            ? "Progression annuelle"
            : ratingDelta <= -1
              ? "Régression annuelle"
              : "Niveau général stable",
      category: "progression",
    });
  return {
    ...game,
    rider,
    world,
    career: {
      ...game.career,
      offers: generateOffers(
        game.rider,
        game.season.year + 1,
        game.team.id,
        role,
        world.teams,
      ),
    },
  };
}
export function startNextSeason(game: GameState, offerId: string): GameState {
  const offer = game.career.offers.find((item) => item.id === offerId);
  if (!offer) return game;
  const year = game.season.year + 1,
    world =
      game.world.year === year
        ? game.world
        : evolveWorld(game.world, game, year),
    resolved = resolveOffer(offer, world.teams),
    team = resolved.team,
    contract = { ...resolved.contract, role: offer.contract.role },
    roleRanks = {
      "Jeune espoir": 0,
      Équipier: 1,
      "Coureur protégé": 2,
      Leader: 3,
    },
    oldRole = game.career.contract?.role ?? "Jeune espoir",
    roleDelta = roleRanks[contract.role] - roleRanks[oldRole],
    roleMorale = roleDelta > 0 ? 2 : roleDelta < 0 ? -2 : 0.5,
    roleRider = applyMoraleEvent(game.rider, {
      id: `contract-role-${year}-${contract.id}`,
      date: `${year}-02-01`,
      delta: roleMorale,
      reason:
        roleDelta > 0
          ? `Promotion : ${contract.role}`
          : roleDelta < 0
            ? `Rôle revu : ${contract.role}`
            : `Rôle confirmé : ${contract.role}`,
      category: "role",
    }),
    contractRider =
      team.level > game.team.level
        ? applyMoraleEvent(roleRider, {
            id: `contract-team-${year}-${contract.id}`,
            date: `${year}-02-01`,
            delta: 1,
            reason: `Nouveau défi chez ${team.name}`,
            category: "contract",
          })
        : roleRider;
  return {
    ...game,
    currentDate: `${year}-02-01`,
    season: season(year),
    team,
    world,
    calendar: generateTeamCalendar(team, year),
    career: {
      ...game.career,
      contract,
      offers: [],
      seasonEvaluation: undefined,
    },
    rider: { ...contractRider, age: game.rider.age + 1 },
    notice: `Bienvenue chez ${team.name} pour la saison ${year}.`,
  };
}
export function unlockScouting(game: GameState): GameState {
  const cost = 300;
  if (game.career.scoutingUnlocked) return game;
  if (game.career.balance < cost)
    return { ...game, notice: "Solde insuffisant." };
  return {
    ...game,
    career: {
      ...game.career,
      balance: game.career.balance - cost,
      scoutingUnlocked: true,
    },
    notice: "Analyse avancée débloquée.",
  };
}
export { injuryConfig };
