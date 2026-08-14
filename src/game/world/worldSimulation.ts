import type {
  CalendarRace,
  GameState,
  RetirementRecord,
  Team,
  TeamMate,
  TransferRecord,
  WorldRider,
  WorldState,
} from "../models";
import { careerTeams } from "../../data/careerTeams";
import { generateTeamMate } from "../career/riderGeneration";
import { evolveTeamMate } from "../career/teamEvolution";
import { overallRating, profileRatingWeights } from "../career/riderRating";
import { riderRankings, teamRankings } from "./rankings";

const hash = (text: string) => {
  let value = 2166136261;
  for (const char of text)
    value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return value >>> 0;
};
const random = (seed: string) => hash(seed) / 4294967295;
const toWorld = (mate: TeamMate, teamId: string): WorldRider => ({
  ...mate,
  teamId,
  reputation: Math.max(1, (mate.level - 42) * 0.7),
  experience: Math.max(0, (mate.age - 18) * 150),
  seasonPoints: 0,
  victories: 0,
  top10: 0,
  previousLevel: mate.level,
});
const cloneTeam = (team: Team): Team => ({
  ...team,
  roster: team.roster.map((mate) => ({
    ...mate,
    stats: { ...mate.stats },
    potentials: { ...mate.potentials },
  })),
});
export function createWorld(year = 2027): WorldState {
  const teams = careerTeams.map(cloneTeam),
    riders = teams.flatMap((team) =>
      team.roster.map((mate) => toWorld(mate, team.id)),
    );
  return {
    year,
    teams,
    riders,
    transfers: [],
    retirements: [],
    youngTalentIds: [],
  };
}
const terrainFit = (rider: WorldRider, race: CalendarRace) =>
  Object.entries(profileRatingWeights[rider.profile]).reduce(
    (sum, [key, weight]) =>
      sum + rider.stats[key as keyof typeof rider.stats] * weight,
    0,
  );
export function recordWorldRace(
  world: WorldState,
  race: CalendarRace,
): WorldState {
  const ranked = world.riders
      .map((rider) => ({
        id: rider.id,
        score:
          terrainFit(rider, race) +
          rider.form * 0.06 +
          (random(`${world.year}-${race.id}-${rider.id}`) - 0.5) * 9,
      }))
      .sort((a, b) => b.score - a.score),
    places = new Map(ranked.map((entry, index) => [entry.id, index + 1]));
  race.teamResults?.forEach((result) =>
    places.set(result.riderId, result.position),
  );
  const riders = world.riders.map((rider) => {
    const place = places.get(rider.id)!,
      points = Math.max(0, 31 - place) * (1 + race.prestige / 100);
    return {
      ...rider,
      seasonPoints: rider.seasonPoints + points,
      victories: rider.victories + (place === 1 ? 1 : 0),
      top10: rider.top10 + (place <= 10 ? 1 : 0),
      experience:
        rider.experience + Math.max(2, Math.round(race.prestige / 10)),
    };
  });
  return { ...world, riders };
}
export function retirementProbability(rider: WorldRider) {
  const base =
    rider.age < 32
      ? 0
      : rider.age === 32
        ? 0.02
        : rider.age === 33
          ? 0.04
          : rider.age === 34
            ? 0.07
            : rider.age === 35
              ? 0.12
              : rider.age === 36
                ? 0.22
                : rider.age === 37
                  ? 0.35
                  : 0.52;
  return base * (rider.role === "Leader" ? 0.65 : 1);
}
const rebuildTeams = (teams: Team[], riders: WorldRider[]) =>
  teams.map((team) => {
    const members = riders.filter((rider) => rider.teamId === team.id),
      roster = members.map(
        ({
          teamId: _,
          reputation: __,
          experience: ___,
          seasonPoints: ____,
          victories: _____,
          top10: ______,
          previousLevel: _______,
          ...mate
        }) => mate,
      ),
      averageRiderLevel = Math.round(
        members.reduce((sum, rider) => sum + rider.level, 0) /
          Math.max(1, members.length),
      ),
      targetLevel =
        averageRiderLevel >= 66
          ? 4
          : averageRiderLevel >= 59
            ? 3
            : averageRiderLevel >= 52
              ? 2
              : 1,
      level = Math.max(
        team.level - 1,
        Math.min(team.level + 1, targetLevel),
      ) as 1 | 2 | 3 | 4;
    return {
      ...team,
      level,
      roster,
      averageRiderLevel,
      prestige: Math.max(
        10,
        Math.min(
          90,
          Math.round(
            team.prestige + (averageRiderLevel - team.averageRiderLevel) * 0.25,
          ),
        ),
      ),
    };
  });
export function evolveWorld(
  world: WorldState,
  game: GameState,
  nextYear: number,
): WorldState {
  const beforeRiders = riderRankings(world,game),
    beforeTeams = teamRankings(world,game),
    retirements: RetirementRecord[] = [],
    survivors: WorldRider[] = [];
  for (const rider of world.riders) {
    if (random(`retire-${nextYear}-${rider.id}`) < retirementProbability(rider))
      retirements.push({
        riderId: rider.id,
        riderName: rider.name,
        age: rider.age,
        teamId: rider.teamId,
        season: nextYear,
      });
    else {
      const team = world.teams.find((item) => item.id === rider.teamId)!,
        evolved = evolveTeamMate(rider, team.trainingQuality);
      survivors.push({
        ...rider,
        ...evolved,
        previousLevel: rider.level,
        seasonPoints: 0,
        victories: 0,
        top10: 0,
      });
    }
  }
  const transfers: TransferRecord[] = [];
  for (const rider of survivors) {
    const potential = overallRating(rider.potentials, rider.profile),
      chance =
        0.08 +
        (rider.age < 24 && potential - rider.level > 8 ? 0.1 : 0) +
        (rider.role === "Leader" ? 0.04 : 0);
    if (random(`transfer-${nextYear}-${rider.id}`) >= chance) continue;
    const current = world.teams.find((team) => team.id === rider.teamId)!,
      direction =
        rider.level > current.averageRiderLevel + 3
          ? 1
          : random(`direction-${rider.id}-${nextYear}`) < 0.25
            ? -1
            : 0,
      candidates = world.teams.filter(
        (team) =>
          team.id !== current.id &&
          Math.abs(team.level - (current.level + direction)) <= 1,
      );
    if (!candidates.length) continue;
    const target =
      candidates[hash(`${rider.id}-${nextYear}`) % candidates.length];
    transfers.push({
      riderId: rider.id,
      riderName: rider.name,
      fromTeamId: rider.teamId,
      toTeamId: target.id,
      season: nextYear,
    });
    rider.teamId = target.id;
    rider.seasonsWithTeam = 0;
  }
  const youngTalentIds: string[] = [];
  for (const team of world.teams) {
    const count = survivors.filter((rider) => rider.teamId === team.id).length,
      needed = Math.max(1, 8 - count);
    for (let index = 0; index < needed; index++) {
      const mate = generateTeamMate(
          team.id,
          team.level,
          team.averageRiderLevel,
          100 + index,
          nextYear,
        ),
        young = {
          ...toWorld(
            {
              ...mate,
              age: 18 + (hash(`${nextYear}-${team.id}-${index}`) % 3),
            },
            team.id,
          ),
          previousLevel: mate.level,
        };
      survivors.push(young);
      youngTalentIds.push(young.id);
    }
  }
  const teams = rebuildTeams(world.teams, survivors),
    playerRating = overallRating(game.rider.stats, game.rider.profile),
    recap = {
      year: world.year,
      champion: beforeRiders[0]?.name ?? "—",
      bestTeam: beforeTeams[0]?.name ?? "—",
      transfers,
      youngRevelations: beforeRiders
        .filter((rider) => rider.age < 23)
        .slice(0, 3)
        .map((rider) => rider.name),
      retirements,
      julianEvolution:
        playerRating - (world.playerPreviousRating ?? playerRating),
    };
  return {
    year: nextYear,
    teams,
    riders: survivors,
    transfers,
    retirements,
    youngTalentIds,
    playerPreviousRating: playerRating,
    recap,
  };
}
