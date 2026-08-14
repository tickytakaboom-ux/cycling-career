import { describe, expect, it } from "vitest";
import { createRider } from "../data/riders";
import {
  createRacePhases,
  resolveInteractivePhase,
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
    ] as const)
      game = chooseInteractiveRaceAction(game, choice);
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
    ).toHaveLength(7);
    expect(game.calendar[0].result?.events).toEqual(game.lastResult?.events);
    expect(game.currentDate).toBe("2027-02-09");
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
      ] as const)
        game = chooseInteractiveRaceAction(game, choice);
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
