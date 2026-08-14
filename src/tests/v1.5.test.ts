import { describe, expect, it } from "vitest";
import { careerTeams } from "../data/careerTeams";
import { createRider } from "../data/riders";
import { claimObjectiveBonuses } from "../game/career/careerProgression";
import { generateOffers } from "../game/career/contracts";
import { generateTeamMate } from "../game/career/riderGeneration";
import { overallRating } from "../game/career/riderRating";
import { evaluateRole } from "../game/career/roles";
import { evolveTeam, evolveTeamMate } from "../game/career/teamEvolution";
import {
  competitionRank,
  selectTeamMates,
  simulateTeamMates,
} from "../game/career/teamSimulation";
import { generateTeamCalendar } from "../game/career/teams";
import type { ContractObjective } from "../game/models";
import {
  advanceToNextRace,
  createCareer,
  prepareNextSeasonOffers,
  race as playRace,
  signContract,
  unlockScouting,
} from "../state/gameStore";

const player = () =>
  createRider({
    firstName: "Julian",
    lastName: "Stehlin",
    nationality: "France",
    height: 178,
    weight: 66,
    profile: "grimpeur",
  });
describe("génération semi-aléatoire des coureurs", () => {
  it("est reproductible pour une même identité de génération", () =>
    expect(generateTeamMate("x", 2, 52, 1, 2028)).toEqual(
      generateTeamMate("x", 2, 52, 1, 2028),
    ));
  it("produit des coureurs différents avec des valeurs bornées", () => {
    const a = generateTeamMate("x", 2, 52, 1, 2028),
      b = generateTeamMate("x", 2, 52, 2, 2028);
    expect(a.stats).not.toEqual(b.stats);
    expect(
      Object.values(a.stats).every((value) => value >= 30 && value <= 85),
    ).toBe(true);
    expect(a.level).toBe(overallRating(a.stats, a.profile));
  });
  it("donne aux profils des forces sportives cohérentes", () => {
    const riders = Array.from({ length: 20 }, (_, i) =>
        generateTeamMate("profiles", 2, 52, i, 2029),
      ),
      climbers = riders.filter((r) => r.profile === "grimpeur");
    expect(climbers.every((r) => r.stats.mountain > r.stats.sprint)).toBe(true);
  });
});
describe("courses des coéquipiers", () => {
  it("sélectionne cinq coureurs adaptés et simule uniquement leur résultat", () => {
    const team = careerTeams[2],
      race = generateTeamCalendar(team)[0],
      selected = selectTeamMates(team.roster, race),
      results = simulateTeamMates(team.roster, selected, race, [], () => 0.7);
    expect(selected).toHaveLength(5);
    expect(results).toHaveLength(5);
    expect(results.every((result) => selected.includes(result.riderId))).toBe(
      true,
    );
  });
  it("enregistre une sélection dans chaque course du calendrier", () =>
    expect(
      generateTeamCalendar(careerTeams[0]).every(
        (race) => race.selectedTeamMateIds?.length === 5,
      ),
    ).toBe(true));
  it("varie les groupes tout en restant reproductible pour une course", () => {
    const calendar = generateTeamCalendar(careerTeams[2]),
      groups = calendar.map((race) => race.selectedTeamMateIds!.slice().sort().join("|"));
    expect(new Set(groups).size).toBeGreaterThan(2);
    expect(selectTeamMates(careerTeams[2].roster, calendar[0])).toEqual(selectTeamMates(careerTeams[2].roster, calendar[0]));
  });
  it("applique un classement de compétition cohérent aux ex æquo", () => {
    const scores = [60, 58, 58, 55];
    expect(scores.map((score) => competitionRank(scores, score))).toEqual([1, 2, 2, 4]);
  });
  it("enregistre les résultats et la forme des sélectionnés dans la carrière", () => {
    let game = createCareer(player());
    game = signContract(game, game.career.offers[0].id);
    game = advanceToNextRace(game);
    const before = new Map(
        game.team.roster.map((mate) => [mate.id, mate.form]),
      ),
      completed = playRace(game, game.calendar[0].id, "normal", () => 0.7),
      race = completed.calendar[0];
    expect(race.teamResults).toHaveLength(5);
    expect(
      race.teamResults!.every((result) =>
        race.selectedTeamMateIds!.includes(result.riderId),
      ),
    ).toBe(true);
    expect(
      completed.team.roster.some(
        (mate) =>
          race.selectedTeamMateIds!.includes(mate.id) &&
          mate.form !== before.get(mate.id),
      ),
    ).toBe(true);
  });
});
describe("évolution et rôles", () => {
  it("fait vieillir et progresser modérément un jeune sans dépasser son potentiel", () => {
    const mate = { ...generateTeamMate("growth", 2, 52, 0), age: 19 },
      next = evolveTeamMate(mate, 68);
    expect(next.age).toBe(20);
    expect(next.level).toBeGreaterThanOrEqual(mate.level);
    for (const key of Object.keys(next.stats) as (keyof typeof next.stats)[])
      expect(next.stats[key]).toBeLessThanOrEqual(next.potentials[key]);
  });
  it("renouvelle, recalcule et hiérarchise un effectif sans changer sa taille", () => {
    const team = {
        ...careerTeams[0],
        roster: careerTeams[0].roster.map((mate, index) =>
          index === 0 ? { ...mate, age: 35, seasonsWithTeam: 3 } : mate,
        ),
      },
      next = evolveTeam(team, 2029);
    expect(next.roster).toHaveLength(team.roster.length);
    expect(next.roster.some((mate) => mate.id !== team.roster[0].id)).toBe(
      true,
    );
    expect(next.averageRiderLevel).toBe(
      Math.round(
        next.roster.reduce((sum, mate) => sum + mate.level, 0) /
          next.roster.length,
      ),
    );
    expect(next.roster.some((mate) => mate.role === "Leader")).toBe(true);
  });
  it("conserve un rôle fort quand le niveau reste suffisant et promeut rarement", () => {
    expect(evaluateRole("Leader", 60, 55, 26, 1, 1000)).toBe("Leader");
    expect(evaluateRole("Équipier", 62, 54, 24, 3, 1200)).toBe("Leader");
    expect(evaluateRole("Jeune espoir", 50, 52, 19, 0, 40)).toBe(
      "Jeune espoir",
    );
  });
});
describe("contrats, primes et argent", () => {
  it("verse une prime une seule fois", () => {
    const goals: ContractObjective[] = [
        {
          id: "x",
          label: "Objectif",
          type: "races",
          target: 1,
          progress: 1,
          reward: 350,
          rewarded: false,
          status: "completed",
        },
      ],
      first = claimObjectiveBonuses(goals),
      second = claimObjectiveBonuses(first.objectives);
    expect(first.bonus).toBe(350);
    expect(second.bonus).toBe(0);
  });
  it("propose le renouvellement avec le rôle évalué", () => {
    let game = createCareer(player());
    game = signContract(game, game.career.offers[0].id);
    game = {
      ...game,
      season: { ...game.season, status: "completed" },
      rider: { ...game.rider, reputation: 15, experience: 800 },
    };
    const offers = prepareNextSeasonOffers(game).career.offers;
    expect(offers.some((offer) => offer.teamId === game.team.id)).toBe(true);
  });
  it("fait dépendre les offres du niveau et de la réputation", () => {
    const low = generateOffers(player()),
      high = generateOffers({
        ...player(),
        reputation: 20,
        stats: Object.fromEntries(
          Object.keys(player().stats).map((key) => [key, 68]),
        ) as typeof player.prototype,
      });
    expect(Math.max(...high.map((o) => o.interestScore))).toBeGreaterThan(
      Math.max(...low.map((o) => o.interestScore)),
    );
  });
  it("donne une utilité informative à l’argent sans effet sportif", () => {
    let game = createCareer(player());
    game = { ...game, career: { ...game.career, balance: 500 } };
    const before = game.rider,
      unlocked = unlockScouting(game);
    expect(unlocked.career.balance).toBe(200);
    expect(unlocked.career.scoutingUnlocked).toBe(true);
    expect(unlocked.rider).toEqual(before);
  });
});
