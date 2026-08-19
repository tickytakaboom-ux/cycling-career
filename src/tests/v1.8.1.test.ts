import { describe, expect, it } from "vitest";
import { createRider } from "../data/riders";
import type { CalendarRace, TeamMate } from "../game/models";
import {
  createRacePhases,
  interactiveChoiceDescriptions,
  resolveInteractivePhase,
  startInteractiveRace,
} from "../game/simulation/interactiveRace";
import {
  createInteractiveParticipants,
  createRaceField,
  participantsNearPosition,
  synchronizeParticipantSituations,
} from "../game/simulation/raceField";
import {
  advanceToNextRace,
  beginInteractiveRace,
  chooseInteractiveRaceAction,
  createGame,
  finishInteractiveRace,
  migrateGame,
  projectInteractiveRaceResult,
} from "../state/gameStore";

const julian = () =>
  createRider({
    firstName: "Julian",
    lastName: "Stehlin",
    nationality: "France",
    height: 178,
    weight: 66,
    profile: "rouleur",
  });

const availableGame = () => advanceToNextRace(createGame(julian()));

describe("synchronisation V1.8.1", () => {
  it("conserve la projection déterministe et la rejoint au dernier moment", () => {
    let game = availableGame();
    const race = game.calendar.find((item) => item.status === "available")!;
    game = beginInteractiveRace(game, race.id, "normal");
    const seed = game.activeRace!.seed;
    const variance = projectInteractiveRaceResult(game, game.activeRace!)!
      .breakdown.variance;

    while (game.activeRace!.phaseIndex < game.activeRace!.phases.length) {
      game = chooseInteractiveRaceAction(game, "follow");
      const projection = projectInteractiveRaceResult(game, game.activeRace!)!;
      expect(game.activeRace!.seed).toBe(seed);
      expect(projection.breakdown.variance).toBe(variance);
    }

    const finalInteractivePosition = game.activeRace!.position;
    expect(finalInteractivePosition).toBe(
      projectInteractiveRaceResult(game, game.activeRace!)!.position,
    );
    const finished = finishInteractiveRace(game);
    expect(finished.lastResult!.position).toBe(finalInteractivePosition);
  });

  it("conserve exactement le plateau réellement simulé", () => {
    let game = availableGame();
    const race = game.calendar.find((item) => item.status === "available")!;
    const fieldIds = createRaceField(race, game.team.level).map(
      (rider) => rider.id,
    );
    game = beginInteractiveRace(game, race.id, "normal");
    const participantIds = game
      .activeRace!.participants!.filter(
        (participant) => participant.source === "opponent",
      )
      .map((participant) => participant.riderId);
    expect(participantIds.sort()).toEqual(fieldIds.sort());
  });
});

describe("favoris et groupes V1.8.1", () => {
  it("classe les favoris selon le terrain sans les injecter artificiellement", () => {
    const game = availableGame();
    const source = game.calendar.find((item) => item.status === "available")!;
    const mountain = { ...source, terrain: "montagne" as const };
    const sprint = { ...source, terrain: "sprint" as const };
    const field = createRaceField(source, game.team.level);
    const favorites = (race: CalendarRace) =>
      createInteractiveParticipants(field, race, [], [])
        .filter((participant) => participant.favoriteTier === "favorite")
        .map((participant) => participant.riderId);
    expect(favorites(mountain)).not.toEqual(favorites(sprint));
    expect(favorites(mountain)).toHaveLength(3);
    expect(favorites(sprint)).toHaveLength(3);
  });

  it("ne signale un favori que s'il appartient réellement au groupe projeté", () => {
    const game = availableGame();
    const race = game.calendar.find((item) => item.status === "available")!;
    const participants = createInteractiveParticipants(
      createRaceField(race, game.team.level),
      race,
      [],
      [],
    );
    const state = {
      position: 2,
      startPosition: 2,
      group: "Groupe de tête",
      gapSeconds: 0,
      groups: [],
    };
    const synchronized = synchronizeParticipantSituations(participants, state);
    const group = participantsNearPosition(
      synchronized,
      state.position,
      99,
      state.group,
    );
    expect(group.some((participant) => participant.favoriteTier)).toBe(true);
  });
});

describe("contre-la-montre V1.8.1", () => {
  const chronoRace = (): CalendarRace => ({
    ...availableGame().calendar.find((item) => item.status === "available")!,
    terrain: "chrono",
  });
  const mate = (): TeamMate => ({
    ...availableGame().team.roster[0],
    id: "mate-chrono",
    name: "Enzo Fontaine",
  });

  it("génère des phases individuelles sans tactique de peloton", () => {
    const phases = createRacePhases(chronoRace());
    expect(phases).toHaveLength(7);
    expect(phases.some((phase) => phase.keyStat === "tactics")).toBe(false);
    expect(phases.map((phase) => phase.description).join(" ")).not.toMatch(
      /peloton|équipier/i,
    );
  });

  it("supprime groupes et équipier et propose quatre actions adaptées", () => {
    const race = chronoRace();
    const rider = julian();
    const state = startInteractiveRace(race, rider, "normal", "chrono", mate());
    const choices = interactiveChoiceDescriptions(state, rider, race);
    expect(state.group).toBe("Effort individuel");
    expect(state.groups).toEqual([]);
    expect(state.teamMateId).toBeUndefined();
    expect(Object.values(choices).map((choice) => choice.label)).toEqual([
      "Maintenir le rythme",
      "Accélérer",
      "Gérer l'effort",
      "Prendre des risques",
    ]);
    expect(Object.values(choices).every((choice) => !choice.disabled)).toBe(
      true,
    );
  });

  it("traite la prise de risques sans bonus collectif", () => {
    const race = chronoRace();
    const rider = julian();
    const state = startInteractiveRace(race, rider, "normal", "chrono", mate());
    const next = resolveInteractivePhase(state, rider, "teamwork");
    expect(next.phaseIndex).toBe(1);
    expect(next.group).toBe("Effort individuel");
    expect(next.teamSupport).toBe(0);
    expect(next.log[0].text).toContain("Prendre des risques");
    expect(next.log[0].text).not.toMatch(/équipier|peloton/i);
  });

  it("migre une course active en conservant son type", () => {
    let game = availableGame();
    const available = game.calendar.find(
      (item) => item.status === "available",
    )!;
    game = {
      ...game,
      calendar: game.calendar.map((race) =>
        race.id === available.id ? { ...race, terrain: "chrono" } : race,
      ),
    };
    game = beginInteractiveRace(game, available.id, "normal");
    const legacy = {
      ...game,
      activeRace: { ...game.activeRace!, raceTerrain: undefined },
    };
    expect(migrateGame(legacy).activeRace?.raceTerrain).toBe("chrono");
  });
});
