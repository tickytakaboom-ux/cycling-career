import { describe, expect, it } from "vitest";
import { createRider } from "../data/riders";
import {
  createRacePhases,
  interactiveChoiceDescriptions,
  interactiveFinalModifier,
  interactiveTendency,
  resolveInteractivePhase,
  selectInteractiveTeamMate,
  startInteractiveRace,
} from "../game/simulation/interactiveRace";
import {
  advanceToNextRace,
  beginInteractiveRace,
  chooseInteractiveRaceAction,
  createGame,
  finishInteractiveRace,
  migrateGame,
} from "../state/gameStore";

const rider = () =>
  createRider({
    firstName: "Julian",
    lastName: "Stehlin",
    nationality: "France",
    height: 178,
    weight: 66,
    profile: "grimpeur",
  });

describe("phases de course V1.7", () => {
  it("génère sept moments ordonnés adaptés à la distance", () => {
    const race = createGame(rider()).calendar[0];
    const phases = createRacePhases(race);
    expect(phases).toHaveLength(7);
    expect(
      phases.every(
        (phase, index) => index === 0 || phase.km > phases[index - 1].km,
      ),
    ).toBe(true);
    expect(phases.at(-1)!.km).toBeLessThanOrEqual(race.distance);
  });

  it("est reproductible pour les mêmes conditions et le même choix", () => {
    const race = createGame(rider()).calendar[0];
    const julian = rider();
    const a = startInteractiveRace(race, julian, "normal", "career-2027");
    const b = startInteractiveRace(race, julian, "normal", "career-2027");
    expect(resolveInteractivePhase(a, julian, "follow")).toEqual(
      resolveInteractivePhase(b, julian, "follow"),
    );
  });

  it("donne des compromis mesurables aux décisions", () => {
    const race = createGame(rider()).calendar[0];
    const julian = rider();
    const state = startInteractiveRace(race, julian, "normal", "career-2027");
    const attack = resolveInteractivePhase(state, julian, "attack");
    const conserve = resolveInteractivePhase(state, julian, "conserve");
    expect(attack.fatigueDelta).toBeGreaterThan(conserve.fatigueDelta);
    expect(attack.position).not.toBe(conserve.position);
    expect(attack.performanceDelta).not.toBe(conserve.performanceDelta);
    expect(attack.log).toHaveLength(1);
    expect(attack.log[0].consequence).toContain("avantage");
  });

  it("tient compte du terrain, de la fatigue et de la situation", () => {
    const race = {
      ...createGame(rider()).calendar[0],
      terrain: "montagne" as const,
    };
    const julian = rider();
    const base = startInteractiveRace(race, julian, "normal", "context");
    const mountain = {
      ...base,
      phases: base.phases.map((phase, index) =>
        index === 0
          ? {
              ...phase,
              keyStat: "mountain" as const,
              id: "same-phase",
              situation: "acceleration" as const,
            }
          : phase,
      ),
    };
    const sprint = {
      ...mountain,
      phases: mountain.phases.map((phase, index) =>
        index === 0 ? { ...phase, keyStat: "sprint" as const } : phase,
      ),
    };
    const suitable = resolveInteractivePhase(mountain, julian, "attack");
    const unsuitable = resolveInteractivePhase(
      sprint,
      { ...julian, fatigue: 80 },
      "attack",
    );
    expect(suitable.position).toBeLessThan(unsuitable.position);
    expect(suitable.performanceDelta).toBeGreaterThan(
      unsuitable.performanceDelta,
    );
  });

  it("fait évoluer les écarts progressivement et contextualise l'équipier", () => {
    const game = createGame(rider());
    const mate = game.team.roster[0];
    const state = startInteractiveRace(
      game.calendar[0],
      game.rider,
      "normal",
      "groups",
      mate,
    );
    const accessible = { ...state, teamMateAccessible: true };
    const next = resolveInteractivePhase(accessible, game.rider, "teamwork");
    expect(next.gapSeconds).not.toBe(state.gapSeconds);
    expect(next.groups).not.toEqual(state.groups);
    expect(next.teamMateName).toBe(mate.name);
    expect(next.teamSupport).toBeGreaterThan(0);
  });

  it("sélectionne parmi les coureurs effectivement engagés selon la course", () => {
    const game = createGame(rider());
    const race = { ...game.calendar[0], terrain: "montagne" as const };
    const selected = game.team.roster.slice(0, 3);
    const target = selectInteractiveTeamMate(
      race,
      game.team.roster,
      selected.map((mate) => mate.id),
    );
    expect(target).toBeDefined();
    expect(selected.map((mate) => mate.id)).toContain(target!.id);
    expect(
      selectInteractiveTeamMate(race, game.team.roster, [selected[1].id])?.id,
    ).toBe(selected[1].id);
  });

  it("décrit le contexte sans autoriser un équipier hors de portée", () => {
    const game = createGame(rider());
    const mate = game.team.roster[0];
    const state = {
      ...startInteractiveRace(
        game.calendar[0],
        game.rider,
        "normal",
        "context",
        mate,
      ),
      position: 23,
      group: "Groupe poursuivant",
      gapSeconds: 28,
      fatigueDelta: 20,
      teamMateAccessible: false,
      teamMateGroup: "Peloton principal",
    };
    const descriptions = interactiveChoiceDescriptions(
      state,
      { ...game.rider, fatigue: 65 },
      game.calendar[0],
    );
    expect(descriptions.attack.description).toContain("ressources");
    expect(descriptions.conserve.description).toContain("écart");
    expect(descriptions.teamwork.disabled).toBe(true);
    expect(descriptions.teamwork.label).not.toContain(mate.name);
    expect(descriptions.teamwork.description).toBe(
      "Impossible d’aider cet équipier depuis votre groupe",
    );
    expect(resolveInteractivePhase(state, game.rider, "teamwork")).toEqual(
      state,
    );
  });

  it("explique une attaque ratée avec le facteur réellement défavorable", () => {
    const game = createGame(rider());
    const state = {
      ...startInteractiveRace(
        game.calendar[0],
        game.rider,
        "normal",
        "failed-attack",
      ),
      position: 29,
      group: "Groupe attardé",
      gapSeconds: 55,
    };
    const next = resolveInteractivePhase(
      state,
      { ...game.rider, fatigue: 95 },
      "attack",
    );
    expect(next.log[0].text).toContain("le groupe était trop loin");
  });
});

describe("boucle interactive complète", () => {
  const play = () => {
    let game = advanceToNextRace(createGame(rider()));
    const raceId = game.calendar[0].id;
    game = beginInteractiveRace(game, raceId, "normal");
    for (const choice of [
      "follow",
      "conserve",
      "attack",
      "teamwork",
      "follow",
      "conserve",
      "attack",
    ] as const) {
      const availableChoice =
        choice === "teamwork" && game.activeRace?.teamMateAccessible === false
          ? "follow"
          : choice;
      game = chooseInteractiveRaceAction(game, availableChoice);
    }
    return finishInteractiveRace(game);
  };

  it("bloque le résultat jusqu'à ce que toutes les phases soient jouées", () => {
    let game = advanceToNextRace(createGame(rider()));
    game = beginInteractiveRace(game, game.calendar[0].id, "normal");
    expect(finishInteractiveRace(game).lastResult).toBeUndefined();
  });

  it("termine via le moteur existant et conserve le journal des choix", () => {
    const game = play();
    expect(game.activeRace).toBeUndefined();
    expect(game.lastResult).toBeDefined();
    expect(game.lastResult!.breakdown.interactive).toBeDefined();
    expect(
      game.lastResult!.events.filter((event) => event.startsWith("Km ")),
    ).toHaveLength(14);
    expect(game.lastResult!.events).toContain("Décisions");
    expect(game.lastResult!.events).toContain("Conséquences");
    expect(game.lastResult!.breakdown.interactive).toBeDefined();
    expect(game.calendar[0].result?.events).toEqual(game.lastResult?.events);
    expect(game.currentDate).toBe("2027-02-09");
  });

  it("relie placement, avantage et tendance au résultat final", () => {
    let game = advanceToNextRace(createGame(rider()));
    game = beginInteractiveRace(game, game.calendar[0].id, "normal");
    for (const choice of [
      "attack",
      "follow",
      "attack",
      "follow",
      "attack",
      "follow",
      "attack",
    ] as const)
      game = chooseInteractiveRaceAction(game, choice);
    const expected = interactiveFinalModifier(game.activeRace!);
    expect(interactiveTendency(game.activeRace!).label).toBeTruthy();
    const finished = finishInteractiveRace(game);
    expect(finished.lastResult?.breakdown.interactive).toBeCloseTo(expected);
  });

  it("produit le même résultat depuis exactement le même état et les mêmes choix", () => {
    let base = advanceToNextRace(createGame(rider()));
    base = { ...base, careerId: "fixed-career" };
    const run = () => {
      let game = beginInteractiveRace(
        structuredClone(base),
        base.calendar[0].id,
        "normal",
      );
      for (const choice of [
        "follow",
        "attack",
        "conserve",
        "teamwork",
        "follow",
        "attack",
        "conserve",
      ] as const) {
        const availableChoice =
          choice === "teamwork" && game.activeRace?.teamMateAccessible === false
            ? "follow"
            : choice;
        game = chooseInteractiveRaceAction(game, availableChoice);
      }
      return finishInteractiveRace(game);
    };
    expect(run().lastResult).toEqual(run().lastResult);
  });

  it("préserve une course en cours lors de la migration d'une sauvegarde", () => {
    let game = advanceToNextRace(createGame(rider()));
    game = beginInteractiveRace(game, game.calendar[0].id, "economiser");
    game = chooseInteractiveRaceAction(game, "conserve");
    expect(migrateGame(game).activeRace).toEqual(game.activeRace);
  });
});
