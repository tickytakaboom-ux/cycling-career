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

  it("associe chaque action à son propre libellé et à sa propre conséquence", () => {
    const game = createGame(rider());
    const mate = game.team.roster[0];
    const base = {
      ...startInteractiveRace(
        game.calendar[0],
        game.rider,
        "normal",
        "action-log",
        mate,
      ),
      teamMateAccessible: true,
    };
    const expectedLabels = {
      attack: "Attaquer",
      follow: "Suivre le mouvement",
      conserve: "Économiser",
      teamwork: `Aider ${mate.name}`,
    } as const;
    const descriptions = interactiveChoiceDescriptions(
      base,
      game.rider,
      game.calendar[0],
    );
    expect(Object.keys(descriptions)).toEqual([
      "attack",
      "follow",
      "conserve",
      "teamwork",
    ]);
    expect(descriptions.teamwork.disabled).toBe(false);
    for (const choice of [
      "attack",
      "follow",
      "conserve",
      "teamwork",
    ] as const) {
      const next = resolveInteractivePhase(base, game.rider, choice);
      expect(next.log[0].choice).toBe(choice);
      expect(next.log[0].text.startsWith(expectedLabels[choice])).toBe(true);
      expect(next.log[0].consequence).toContain("avantage");
      expect(next.log[0].consequence).toContain("fatigue");
    }
  });

  it("distingue une réussite nette d'une réussite difficile", () => {
    const game = createGame(rider());
    const base = startInteractiveRace(
      game.calendar[0],
      game.rider,
      "normal",
      "outcome-level",
    );
    const strongRider = {
      ...game.rider,
      fatigue: 0,
      form: 88,
      stats: Object.fromEntries(
        Object.keys(game.rider.stats).map((key) => [key, 90]),
      ) as unknown as typeof game.rider.stats,
    };
    const clear = resolveInteractivePhase(base, strongRider, "follow");
    expect(clear.log[0].text).toContain("sans rupture");
    expect(clear.log[0].text).toContain("tactique (point fort)");

    const balancedRider = {
      ...strongRider,
      form: 50,
      fatigue: 60,
      stats: Object.fromEntries(
        Object.keys(game.rider.stats).map((key) => [key, 60]),
      ) as unknown as typeof game.rider.stats,
    };
    const narrow = Array.from({ length: 40 }, (_, index) =>
      resolveInteractivePhase(
        startInteractiveRace(
          game.calendar[0],
          balancedRider,
          "normal",
          `narrow-${index}`,
        ),
        balancedRider,
        "follow",
      ),
    ).find((state) => state.log[0].text.includes("avec difficulté"));
    expect(narrow).toBeDefined();
    expect(narrow!.log[0].text).toContain("tactique (niveau limité)");
  });

  it("fait dépendre l'économie du rythme de la phase", () => {
    const game = createGame(rider());
    const base = startInteractiveRace(
      game.calendar[0],
      game.rider,
      "normal",
      "conserve-context",
    );
    const phase = { ...base.phases[0], id: "same-conserve-phase" };
    const calm = resolveInteractivePhase(
      {
        ...base,
        phases: [{ ...phase, situation: "steady" }, ...base.phases.slice(1)],
      },
      game.rider,
      "conserve",
    );
    const acceleration = resolveInteractivePhase(
      {
        ...base,
        phases: [
          { ...phase, situation: "acceleration" },
          ...base.phases.slice(1),
        ],
      },
      game.rider,
      "conserve",
    );
    expect(acceleration.log[0].performanceDelta).toBeLessThanOrEqual(
      calm.log[0].performanceDelta,
    );
    expect(acceleration.gapSeconds).toBeGreaterThanOrEqual(calm.gapSeconds);
    expect(acceleration.log[0].text).toContain("réserves");
  });

  it("fait évoluer les écarts progressivement et de façon déterministe", () => {
    const game = createGame(rider());
    const state = startInteractiveRace(
      game.calendar[0],
      game.rider,
      "normal",
      "natural-gaps",
    );
    const first = resolveInteractivePhase(state, game.rider, "attack");
    const replay = resolveInteractivePhase(state, game.rider, "attack");
    expect(first.gapSeconds).toBe(replay.gapSeconds);
    expect(Math.abs(first.gapSeconds - state.gapSeconds)).toBeLessThanOrEqual(
      12,
    );
  });

  it("laisse des trajectoires nettement différentes selon les choix", () => {
    const game = createGame(rider());
    const base = startInteractiveRace(
      game.calendar[0],
      game.rider,
      "normal",
      "meaningful-choices",
    );
    const playPlan = (choice: "attack" | "follow" | "conserve") => {
      let state = base;
      while (state.phaseIndex < state.phases.length)
        state = resolveInteractivePhase(state, game.rider, choice);
      return state;
    };
    const attack = playPlan("attack");
    const follow = playPlan("follow");
    const conserve = playPlan("conserve");
    expect(
      new Set([attack.position, follow.position, conserve.position]).size,
    ).toBeGreaterThan(1);
    expect(
      new Set([
        attack.performanceDelta,
        follow.performanceDelta,
        conserve.performanceDelta,
      ]).size,
    ).toBe(3);
    expect(attack.fatigueDelta).toBeGreaterThan(conserve.fatigueDelta);
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
    expect(descriptions.attack.description).toContain("fatigue cumulée");
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

  it("cite les qualités réelles et l'avantage actuel du coureur", () => {
    const game = createGame(rider());
    const base = startInteractiveRace(
      { ...game.calendar[0], terrain: "montagne" },
      game.rider,
      "normal",
      "rider-specific",
    );
    const state = {
      ...base,
      performanceDelta: 1.5,
      phases: base.phases.map((phase, index) =>
        index === 0 ? { ...phase, keyStat: "mountain" as const } : phase,
      ),
    };
    const descriptions = interactiveChoiceDescriptions(
      state,
      {
        ...game.rider,
        stats: { ...game.rider.stats, mountain: 80 },
      },
      { ...game.calendar[0], terrain: "montagne" },
    );
    expect(descriptions.attack.description).toContain("montagne (point fort)");
    expect(descriptions.attack.description).toContain("avantage déjà acquis");
  });

  it("décrit la caractéristique de la phase courante sans reprendre la précédente", () => {
    const game = createGame(rider());
    const race = { ...game.calendar[0], terrain: "montagne" as const };
    const base = startInteractiveRace(race, game.rider, "normal", "phase-stat");
    const ascent = interactiveChoiceDescriptions(
      { ...base, phaseIndex: 2 },
      game.rider,
      race,
    );
    const valley = interactiveChoiceDescriptions(
      { ...base, phaseIndex: 3 },
      game.rider,
      race,
    );
    expect(ascent.follow.description).toContain("ascension");
    expect(valley.follow.description).toContain("endurance");
    expect(valley.follow.description).not.toContain("ascension");
    expect(valley.follow.description).not.toContain(
      "La course reste équilibrée",
    );
  });

  it("affiche Retardataires sans changer l'identifiant technique du groupe", () => {
    const game = createGame(rider());
    const state = startInteractiveRace(
      game.calendar[0],
      game.rider,
      "normal",
      "group-label",
    );
    expect(state.groups.find((group) => group.id === "dropped")?.label).toBe(
      "Retardataires",
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
    expect(next.log[0].text).toContain("55 s de retard");
    expect(next.log[0].text).toContain("29e place");
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
    ).toHaveLength(7);
    expect(game.lastResult!.events).toContain("Décisions et conséquences");
    expect(
      game.lastResult!.events.filter((event) => event.startsWith("↳")),
    ).toHaveLength(28);
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

  it("ne reconvertit pas une seconde fois le placement en pénalité", () => {
    const game = createGame(rider());
    const state = {
      ...startInteractiveRace(
        game.calendar[0],
        game.rider,
        "normal",
        "no-double",
      ),
      startPosition: 19,
      position: 25,
      performanceDelta: -0.3,
    };
    expect(interactiveFinalModifier(state)).toBeCloseTo(-0.3);
  });

  it("transmet uniquement l'avantage interactif sur un échantillon déterministe", () => {
    const gaps: number[] = [];
    for (let sample = 0; sample < 36; sample++) {
      let game = advanceToNextRace(createGame(rider()));
      game = { ...game, careerId: `coherence-${sample}` };
      game = beginInteractiveRace(game, game.calendar[0].id, "normal");
      const plan = [
        "follow",
        sample % 2 ? "attack" : "conserve",
        "follow",
        sample % 3 ? "conserve" : "attack",
        "follow",
        "attack",
        "conserve",
      ] as const;
      for (const choice of plan)
        game = chooseInteractiveRaceAction(game, choice);
      const interactive = game.activeRace!;
      const finished = finishInteractiveRace(game);
      expect(finished.lastResult?.breakdown.interactive).toBeCloseTo(
        interactive.performanceDelta,
      );
      gaps.push(Math.abs(finished.lastResult!.position - interactive.position));
    }
    const averageGap = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
    expect(averageGap).toBeLessThan(8);
    expect(Math.max(...gaps)).toBeLessThan(12);
  });

  it("rend visible le bénéfice collectif dans le résultat final", () => {
    let game = advanceToNextRace(createGame(rider()));
    const mate = game.team.roster[0];
    game = {
      ...game,
      calendar: game.calendar.map((race, index) =>
        index === 0 ? { ...race, selectedTeamMateIds: [mate.id] } : race,
      ),
    };
    game = beginInteractiveRace(game, game.calendar[0].id, "normal");
    game = {
      ...game,
      activeRace: { ...game.activeRace!, teamMateAccessible: true },
    };
    game = chooseInteractiveRaceAction(game, "teamwork");
    while (game.activeRace!.phaseIndex < game.activeRace!.phases.length)
      game = chooseInteractiveRaceAction(game, "follow");
    const finished = finishInteractiveRace(game);
    expect(finished.lastResult?.events).toContain("Impact collectif");
    expect(
      finished.lastResult?.events.some(
        (event) => event.includes(mate.name) && event.includes("bonus +"),
      ),
    ).toBe(true);
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
