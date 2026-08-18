import { describe, expect, it } from "vitest";
import { createRider, opponents } from "../data/riders";
import type { Race, RiderStats, WeatherConditions } from "../game/models";
import {
  resolveInteractivePhase,
  seededRandom,
  startInteractiveRace,
} from "../game/simulation/interactiveRace";
import { performance, simulateRace } from "../game/simulation/raceSimulation";
import { weatherEffect } from "../game/weather/weather";
import {
  advanceToNextRace,
  beginInteractiveRace,
  chooseInteractiveRaceAction,
  createGame,
  finishInteractiveRace,
} from "../state/gameStore";

const julian = () =>
  createRider({
    firstName: "Julian",
    lastName: "Audit",
    nationality: "France",
    height: 178,
    weight: 66,
    profile: "grimpeur",
  });

const statsAt = (stats: RiderStats, value: number): RiderStats =>
  Object.fromEntries(
    Object.keys(stats).map((key) => [key, value]),
  ) as unknown as RiderStats;

const weather = (
  override: Partial<WeatherConditions> = {},
): WeatherConditions => ({
  temperature: 17,
  windSpeed: 8,
  windDirection: "tailwind",
  rain: "none",
  humidity: 55,
  cloudCover: 40,
  ...override,
});

describe("audit tactique V1.7", () => {
  it("rend Économiser utile dans le peloton pendant une phase calme", () => {
    const game = createGame(julian());
    const base = startInteractiveRace(
      game.calendar[0],
      game.rider,
      "normal",
      "audit-conserve-calm",
    );
    const state = {
      ...base,
      position: 15,
      group: "Peloton principal",
      gapSeconds: 8,
      fatigueDelta: 3,
      phases: base.phases.map((phase, index) =>
        index === 0 ? { ...phase, situation: "steady" as const } : phase,
      ),
    };
    const next = resolveInteractivePhase(state, game.rider, "conserve");
    expect(next.fatigueDelta).toBeLessThan(state.fatigueDelta);
    expect(next.performanceDelta).toBeGreaterThanOrEqual(
      state.performanceDelta,
    );
    expect(next.log[0].text).toContain("récupère");
  });

  it("rend Économiser risqué lorsque Julian est décroché pendant une accélération", () => {
    const game = createGame(julian());
    const base = startInteractiveRace(
      game.calendar[0],
      game.rider,
      "normal",
      "audit-conserve-dropped",
    );
    const state = {
      ...base,
      position: 25,
      group: "Groupe poursuivant",
      gapSeconds: 28,
      fatigueDelta: 3,
      phases: base.phases.map((phase, index) =>
        index === 0 ? { ...phase, situation: "acceleration" as const } : phase,
      ),
    };
    const next = resolveInteractivePhase(state, game.rider, "conserve");
    expect(next.fatigueDelta).toBeLessThan(state.fatigueDelta);
    expect(next.performanceDelta).toBeLessThan(state.performanceDelta);
    expect(next.gapSeconds).toBeGreaterThan(state.gapSeconds);
  });

  it("différencie Suivre avec une caractéristique correcte ou faible en montée", () => {
    const game = createGame(julian());
    const race = { ...game.calendar[0], terrain: "montagne" as const };
    const base = startInteractiveRace(
      race,
      game.rider,
      "normal",
      "audit-follow",
    );
    const state = {
      ...base,
      phases: base.phases.map((phase, index) =>
        index === 0
          ? {
              ...phase,
              id: "audit-follow-climb",
              keyStat: "climbing" as const,
              situation: "acceleration" as const,
            }
          : phase,
      ),
    };
    const capable = {
      ...game.rider,
      stats: { ...game.rider.stats, climbing: 68 },
    };
    const weak = {
      ...game.rider,
      stats: { ...game.rider.stats, climbing: 35 },
    };
    const good = resolveInteractivePhase(state, capable, "follow");
    const bad = resolveInteractivePhase(state, weak, "follow");
    expect(good.position).toBeLessThan(bad.position);
    expect(good.performanceDelta).toBeGreaterThan(bad.performanceDelta);
    expect(bad.log[0].text).toContain("déficit en ascension");
  });

  it("rend Attaquer puissant dans un bon contexte et risqué dans un mauvais", () => {
    const game = createGame(julian());
    const base = startInteractiveRace(
      game.calendar[0],
      game.rider,
      "normal",
      "audit-attack",
    );
    const favorableRider = {
      ...game.rider,
      fatigue: 5,
      form: 82,
      stats: statsAt(game.rider.stats, 80),
    };
    const unfavorableRider = {
      ...game.rider,
      fatigue: 88,
      form: 42,
      stats: statsAt(game.rider.stats, 35),
    };
    const favorable = resolveInteractivePhase(
      { ...base, position: 7, group: "Groupe de tête", gapSeconds: 0 },
      favorableRider,
      "attack",
    );
    const unfavorable = resolveInteractivePhase(
      {
        ...base,
        position: 25,
        group: "Groupe poursuivant",
        gapSeconds: 30,
        performanceDelta: -1,
      },
      unfavorableRider,
      "attack",
    );
    expect(favorable.position).toBeLessThan(7);
    expect(favorable.performanceDelta).toBeGreaterThan(0);
    expect(unfavorable.position).toBeGreaterThan(25);
    expect(unfavorable.performanceDelta).toBeLessThan(-1);
  });
});

describe("audit du moteur final", () => {
  const raceWithWeather = (conditions: WeatherConditions): Race => ({
    id: "audit-weather",
    name: "Audit météo",
    country: "France",
    date: "2027-02-08",
    terrain: "montagne",
    distance: 158,
    elevation: 3200,
    prestige: 55,
    difficulty: 65,
    weather: conditions,
  });

  it("fait réellement agir la météo et l'adaptation du coureur", () => {
    const rider = julian();
    const normal = raceWithWeather(weather());
    const hard = raceWithWeather(
      weather({
        temperature: 3,
        windSpeed: 30,
        windDirection: "headwind",
        rain: "heavy",
        humidity: 95,
      }),
    );
    expect(
      performance(rider, normal, "normal", () => 0.5).final,
    ).toBeGreaterThan(performance(rider, hard, "normal", () => 0.5).final);
    expect(
      weatherEffect({ ...rider, stats: { ...rider.stats, weather: 90 } }, hard)
        .modifier,
    ).toBeGreaterThan(
      weatherEffect({ ...rider, stats: { ...rider.stats, weather: 20 } }, hard)
        .modifier,
    );
  });

  it("fait baisser la performance quand la fatigue augmente", () => {
    const rider = julian();
    const race = raceWithWeather(weather());
    const fresh = performance(
      { ...rider, fatigue: 5 },
      race,
      "normal",
      () => 0.5,
    );
    const tired = performance(
      { ...rider, fatigue: 85 },
      race,
      "normal",
      () => 0.5,
    );
    expect(fresh.final).toBeGreaterThan(tired.final);
    expect(tired.fatigue).toBeLessThan(fresh.fatigue);
  });

  it("transmet l'avantage interactif sans pénalité de placement supplémentaire", () => {
    const rider = julian();
    const race = raceWithWeather(weather());
    const positive = simulateRace(
      rider,
      opponents,
      race,
      "normal",
      seededRandom(123),
      2,
    );
    const negative = simulateRace(
      rider,
      opponents,
      race,
      "normal",
      seededRandom(123),
      -2,
    );
    expect(positive.breakdown.interactive).toBe(2);
    expect(negative.breakdown.interactive).toBe(-2);
    expect(positive.score - negative.score).toBeCloseTo(4);
    expect(positive.position).toBeLessThanOrEqual(negative.position);
  });

  it("conserve un classement cohérent avec le score face au même peloton", () => {
    const rider = julian();
    const race = raceWithWeather(weather());
    const low = simulateRace(
      rider,
      opponents,
      race,
      "normal",
      seededRandom(987),
      -3,
    );
    const high = simulateRace(
      rider,
      opponents,
      race,
      "normal",
      seededRandom(987),
      3,
    );
    expect(high.score).toBeGreaterThan(low.score);
    expect(high.position).toBeLessThan(low.position);
  });

  it("rend visible la charge structurelle et interactive sans les additionner deux fois", () => {
    let game = advanceToNextRace(createGame(julian()));
    game = beginInteractiveRace(game, game.calendar[0].id, "normal");
    while (game.activeRace!.phaseIndex < game.activeRace!.phases.length)
      game = chooseInteractiveRaceAction(game, "follow");
    const interactiveFatigue = game.activeRace!.fatigueDelta;
    const finished = finishInteractiveRace(game);
    const summary = finished.lastResult!.events.find((event) =>
      event.startsWith("Fatigue structurelle"),
    );
    expect(summary).toContain(
      `Effort interactif : +${interactiveFatigue.toFixed(1)}`,
    );
    expect(finished.lastResult!.fatigueCost).toBeGreaterThan(0);
  });
});
