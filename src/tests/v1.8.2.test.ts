import { describe, expect, it } from "vitest";
import { createRider } from "../data/riders";
import type {
  GameState,
  InteractiveRaceChoice,
  RiderStats,
} from "../game/models";
import {
  advanceToNextRace,
  beginInteractiveRace,
  chooseInteractiveRaceAction,
  createGame,
  finishInteractiveRace,
  projectInteractiveRaceResult,
} from "../state/gameStore";

const julian = () =>
  createRider({
    firstName: "Julian",
    lastName: "Stehlin",
    nationality: "France",
    height: 178,
    weight: 66,
    profile: "puncheur",
  });

const readyGame = () => advanceToNextRace(createGame(julian()));

function trajectory(
  source: GameState,
  choice: InteractiveRaceChoice,
  strategy: "economiser" | "normal" | "agressif" = "normal",
) {
  let game = structuredClone(source);
  const race = game.calendar.find((item) => item.status === "available")!;
  game = beginInteractiveRace(game, race.id, strategy);
  const positions = [game.activeRace!.position];
  while (game.activeRace!.phaseIndex < game.activeRace!.phases.length) {
    game = chooseInteractiveRaceAction(game, choice);
    positions.push(game.activeRace!.position);
  }
  return { game, positions };
}

function withStats(game: GameState, value: number) {
  const stats = Object.fromEntries(
    Object.keys(game.rider.stats).map((key) => [key, value]),
  ) as unknown as RiderStats;
  return { ...game, rider: { ...game.rider, stats } };
}

describe("trajectoires progressives V1.8.2", () => {
  it("fait diverger les trajectoires prudente, équilibrée et offensive", () => {
    const game = readyGame();
    const prudent = trajectory(game, "conserve", "economiser");
    const balanced = trajectory(game, "follow", "normal");
    const offensive = trajectory(game, "attack", "agressif");
    const paths = [prudent.positions, balanced.positions, offensive.positions];
    expect(new Set(paths.map((path) => JSON.stringify(path))).size).toBe(3);
    const largestPhaseSpread = Math.max(
      ...prudent.positions.map((_, index) => {
        const values = paths.map((path) => path[index]);
        return Math.max(...values) - Math.min(...values);
      }),
    );
    expect(largestPhaseSpread).toBeGreaterThanOrEqual(3);
  });

  it("fait diverger les trajectoires de coureurs faibles, moyens et forts", () => {
    const game = readyGame();
    const weak = trajectory(withStats(game, 42), "follow").positions;
    const average = trajectory(withStats(game, 58), "follow").positions;
    const strong = trajectory(withStats(game, 78), "follow").positions;
    expect(
      new Set([weak, average, strong].map((path) => JSON.stringify(path))).size,
    ).toBe(3);
    expect(strong.at(-1)!).toBeLessThan(weak.at(-1)!);
  });

  it("reste strictement déterministe à état, seed et décisions identiques", () => {
    const game = readyGame();
    const first = trajectory(game, "attack", "agressif");
    const second = trajectory(game, "attack", "agressif");
    expect(second.positions).toEqual(first.positions);
    expect(second.game.activeRace).toEqual(first.game.activeRace);
  });

  it.each([
    ["prudente", "conserve", "economiser"],
    ["équilibrée", "follow", "normal"],
    ["offensive", "attack", "agressif"],
  ] as const)(
    "synchronise la trajectoire %s avec le résultat officiel",
    (_, choice, strategy) => {
      const run = trajectory(readyGame(), choice, strategy);
      const projected = projectInteractiveRaceResult(
        run.game,
        run.game.activeRace!,
      )!;
      expect(run.positions.at(-1)).toBe(projected.position);
      expect(finishInteractiveRace(run.game).lastResult!.position).toBe(
        run.positions.at(-1),
      );
    },
  );
});
