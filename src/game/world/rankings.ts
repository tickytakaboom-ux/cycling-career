import type { GameState, Team, WorldRider, WorldState } from "../models";
import { overallRating } from "../career/riderRating";

export interface RiderRankingEntry {
  id: string;
  position: number;
  name: string;
  age: number;
  teamId: string;
  teamName: string;
  profile: string;
  rating: number;
  points: number;
  u23: boolean;
  isPlayer: boolean;
}
export interface TeamRankingEntry {
  id: string;
  position: number;
  name: string;
  level: number;
  points: number;
  victories: number;
  top10: number;
}
const playerSeasonPoints = (game: GameState) =>
  game.calendar.reduce((sum, race) => {
    if (!race.result) return sum;
    const place = Math.max(0, 32 - race.result.position),
      prestige = 1 + race.prestige / 100;
    return sum + place * prestige;
  }, 0);
export function rankingScore(
  rider: Pick<WorldRider, "seasonPoints" | "experience" | "reputation">,
) {
  return +(
    rider.seasonPoints +
    rider.experience * 0.015 +
    rider.reputation * 2
  ).toFixed(1);
}
export function riderRankings(world: WorldState, game?: GameState) {
  const teamNames = new Map(world.teams.map((team) => [team.id, team.name])),
    entries: RiderRankingEntry[] = world.riders.map((rider) => ({
      id: rider.id,
      position: 0,
      name: rider.name,
      age: rider.age,
      teamId: rider.teamId,
      teamName: teamNames.get(rider.teamId) ?? "Sans équipe",
      profile: rider.profile,
      rating: overallRating(rider.stats, rider.profile),
      points: rankingScore(rider),
      u23: rider.age < 23,
      isPlayer: false,
    }));
  if (game && game.career.contract)
    entries.push({
      id: game.rider.id,
      position: 0,
      name: `${game.rider.firstName} ${game.rider.lastName}`,
      age: game.rider.age,
      teamId: game.team.id,
      teamName: game.team.name,
      profile: game.rider.profile,
      rating: overallRating(game.rider.stats, game.rider.profile),
      points: +(
        playerSeasonPoints(game) +
        game.rider.experience * 0.015 +
        game.rider.reputation * 2
      ).toFixed(1),
      u23: game.rider.age < 23,
      isPlayer: true,
    });
  return entries
    .sort((a, b) => b.points - a.points || b.rating - a.rating)
    .map((entry, index) => ({ ...entry, position: index + 1 }));
}
export function u23Rankings(world: WorldState, game?: GameState) {
  return riderRankings(world, game)
    .filter((entry) => entry.u23)
    .map((entry, index) => ({ ...entry, position: index + 1 }));
}
export function teamRankings(world: WorldState, game?: GameState) {
  const riders = riderRankings(world, game);
  return world.teams
    .map((team: Team) => {
      const members = riders.filter((rider) => rider.teamId === team.id),
        worldMembers = world.riders.filter((rider) => rider.teamId === team.id),
        playerResults =
          game && game.team.id === team.id
            ? game.calendar.map((race) => race.result).filter(Boolean)
            : [];
      return {
        id: team.id,
        position: 0,
        name: team.name,
        level: team.level,
        points: +members
          .reduce((sum, rider) => sum + rider.points, 0)
          .toFixed(1),
        victories:
          worldMembers.reduce((sum, rider) => sum + rider.victories, 0) +
          playerResults.filter((result) => result!.position === 1).length,
        top10:
          worldMembers.reduce((sum, rider) => sum + rider.top10, 0) +
          playerResults.filter((result) => result!.position <= 10).length,
      };
    })
    .sort((a, b) => b.points - a.points)
    .map((entry, index) => ({ ...entry, position: index + 1 }));
}
