import { describe, expect, it } from "vitest";
import { createRider } from "../data/riders";
import { moraleConfig } from "../game/config";
import {
  annualProgressionMoraleDelta,
  applyMoraleEvent,
  injuryMoraleDelta,
  moralePerformancePercent,
  nextMoraleStreak,
  restMoraleDelta,
} from "../game/morale/moraleSystem";
import {
  applyRaceProgression,
  applyTraining,
  recoverDay,
} from "../game/progression/training";
import { raceMoraleChange } from "../game/simulation/raceSimulation";
import type { RaceResult } from "../game/models";
import {
  advanceToNextRace,
  createGame,
  migrateGame,
  nextDay,
  race,
  train,
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
const result = (): RaceResult => ({
  raceId: "test",
  position: 8,
  fieldSize: 31,
  score: 55,
  gap: "+ 10 s",
  xpGained: 10,
  reputationGained: 0.2,
  moraleChange: 2,
  strategy: "normal",
  fatigueCost: 15,
  strategySummary: "Plan équilibré",
  events: [],
  breakdown: {
    base: 50,
    form: 0,
    fatigue: 0,
    morale: 0,
    age: 0,
    experience: 0,
    prestige: 0,
    injury: 0,
    weather: 0,
    strategy: 0,
    variance: 0,
    final: 55,
  },
});

describe("journal central du moral", () => {
  it("borne le moral à 0 et 100 et ignore les variations nulles", () => {
    const high = applyMoraleEvent(
      { ...rider(), morale: 99 },
      {
        id: "high",
        date: "2027-01-01",
        delta: 8,
        reason: "Victoire",
        category: "race",
      },
    );
    const low = applyMoraleEvent(
      { ...rider(), morale: 1 },
      {
        id: "low",
        date: "2027-01-02",
        delta: -8,
        reason: "Blessure",
        category: "injury",
      },
    );
    const zero = applyMoraleEvent(
      { ...high, morale: 100 },
      {
        id: "zero",
        date: "2027-01-03",
        delta: 2,
        reason: "Bonus",
        category: "race",
      },
    );
    expect(high.morale).toBe(100);
    expect(low.morale).toBe(0);
    expect(zero.moraleHistory).toHaveLength(high.moraleHistory!.length);
  });

  it("déduplique les événements et garde les 30 derniers", () => {
    const input = {
      id: "unique",
      date: "2027-01-01",
      delta: 1,
      reason: "Test",
      category: "objective" as const,
    };
    const once = applyMoraleEvent(rider(), input);
    expect(applyMoraleEvent(once, input)).toEqual(once);
    let value = rider();
    for (let index = 0; index < 35; index++)
      value = applyMoraleEvent(value, { ...input, id: `event-${index}` });
    expect(value.moraleHistory).toHaveLength(30);
  });

  it("permet à un moral nul de remonter", () => {
    const value = applyMoraleEvent(
      { ...rider(), morale: 0 },
      {
        id: "recovery",
        date: "2027-01-01",
        delta: 0.5,
        reason: "Repos avec fatigue faible",
        category: "rest",
      },
    );
    expect(value.morale).toBe(0.5);
  });
});

describe("causes V1.6.1", () => {
  it.each([
    [1, 31, 8],
    [3, 31, 5],
    [10, 31, 2],
    [20, 31, 0.8],
    [21, 31, 0.2],
    [29, 31, -2.5],
  ])(
    "attribue la variation attendue à la place %i",
    (position, field, expected) =>
      expect(raceMoraleChange(position, field)).toBe(expected),
  );
  it("applique les quatre paliers de repos", () =>
    expect([
      restMoraleDelta(30),
      restMoraleDelta(60),
      restMoraleDelta(74),
      restMoraleDelta(75),
    ]).toEqual([0.5, 0.25, 0, -0.45]));
  it("déclenche les séries uniquement au franchissement de trois", () => {
    expect(nextMoraleStreak({ top20: 2, poor: 0 }, 12, 31).delta).toBe(1.5);
    expect(nextMoraleStreak({ top20: 3, poor: 0 }, 12, 31).delta).toBe(0);
    expect(nextMoraleStreak({ top20: 0, poor: 2 }, 31, 31).delta).toBe(-1.5);
  });
  it("conserve les blessures et paliers annuels validés", () => {
    expect(injuryMoraleDelta("minor")).toBe(-1);
    expect(injuryMoraleDelta("severe")).toBe(-14);
    expect([
      annualProgressionMoraleDelta(2),
      annualProgressionMoraleDelta(1),
      annualProgressionMoraleDelta(0),
      annualProgressionMoraleDelta(-1),
    ]).toEqual([2, 1, -0.5, -1.5]);
  });
  it("conserve exactement le coefficient de performance 0,06", () => {
    expect(moraleConfig.performanceRange).toBe(0.06);
    expect(moralePerformancePercent(0)).toBeCloseTo(-6);
    expect(moralePerformancePercent(100)).toBeCloseTo(6);
  });
});

describe("intégration aux activités", () => {
  it("ajoute +0,25 après chaque entraînement réussi", () => {
    const game = createGame(rider());
    const trained = train(game, "endurance", () => 1);
    expect(trained.rider.morale - game.rider.morale).toBeCloseTo(0.25);
    const second = train(trained, "endurance", () => 1);
    expect(second.rider.morale - trained.rider.morale).toBeCloseTo(0.25);
  });

  it("applique les objectifs atteints et ratés sans duplication", () => {
    const base = { ...rider(), morale: 50 };
    const success = applyMoraleEvent(base, {
      id: "objective-success-2027-top10",
      date: "2027-10-01",
      delta: moraleConfig.objectiveSuccess,
      reason: "Objectif atteint : signer un top 10",
      category: "objective",
    });
    const failure = applyMoraleEvent(success, {
      id: "objective-failed-2027-victory",
      date: "2027-10-01",
      delta: moraleConfig.objectiveFailure,
      reason: "Objectif non atteint : remporter une course",
      category: "objective",
    });
    expect(failure.morale).toBe(51);
    expect(
      applyMoraleEvent(failure, {
        id: "objective-failed-2027-victory",
        date: "2027-10-01",
        delta: moraleConfig.objectiveFailure,
        reason: "Objectif non atteint : remporter une course",
        category: "objective",
      }),
    ).toEqual(failure);
  });
  it("centralise le repos et empêche les anciennes fonctions de doubler le moral", () => {
    const game = createGame({ ...rider(), fatigue: 20, morale: 40 });
    expect(nextDay(game).rider.morale).toBe(40.5);
    expect(applyTraining(game.rider, "endurance").morale).toBe(40);
    expect(recoverDay(game.rider).morale).toBe(40);
    expect(
      applyRaceProgression(game.rider, result(), game.calendar[0]).morale,
    ).toBe(40);
  });
  it("journalise une blessure survenue en course", () => {
    const ready = advanceToNextRace(
      createGame({ ...rider(), fatigue: 100, form: 40 }),
    );
    ready.calendar[0] = { ...ready.calendar[0], terrain: "paves" };
    const finished = race(ready, ready.calendar[0].id, "agressif", () => 0.01);
    expect(finished.lastResult?.injury).toBeDefined();
    expect(
      finished.rider.moraleHistory?.some((event) =>
        event.id.startsWith("injury-race-"),
      ),
    ).toBe(true);
  });
  it("migre les anciennes sauvegardes sans rejouer d'événement", () => {
    const game = createGame(rider());
    const legacy = {
      ...game,
      rider: {
        ...game.rider,
        moraleHistory: undefined,
        moraleAppliedEventIds: undefined,
      },
    };
    const migrated = migrateGame(legacy);
    expect(migrated.rider.moraleHistory).toEqual([]);
    expect(migrated.rider.moraleAppliedEventIds).toEqual([]);
  });
});
