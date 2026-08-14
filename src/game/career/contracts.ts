import { careerTeams } from "../../data/careerTeams";
import type {
  Contract,
  ContractObjective,
  ContractOffer,
  Rider,
  Team,
  TeamRole,
} from "../models";
import { overallRating } from "./riderRating";
const objectives = (team: Team): ContractObjective[] => [
  {
    id: "races",
    label: `Participer à ${Math.min(10, team.calendarSize)} courses`,
    type: "races",
    target: Math.min(10, team.calendarSize),
    progress: 0,
    reward: 150 + team.level * 75,
    rewarded: false,
    status: "active",
  },
  {
    id: "top20",
    label: `Obtenir ${team.level + 1} top 20`,
    type: "top20",
    target: team.level + 1,
    progress: 0,
    reward: 250 + team.level * 100,
    rewarded: false,
    status: "active",
  },
  {
    id: "reputation",
    label: `Atteindre ${3 + team.level} de réputation`,
    type: "reputation",
    target: 3 + team.level,
    progress: 0,
    reward: 200 + team.level * 100,
    rewarded: false,
    status: "active",
  },
];
export function contractFor(
  team: Team,
  year: number,
  role: TeamRole = team.level >= 3 ? "Équipier" : "Jeune espoir",
  interest = 50,
): Contract {
  return {
    id: `contract-${team.id}-${year}`,
    teamId: team.id,
    startYear: year,
    durationYears: 1,
    monthlySalary: Math.round(
      (300 + team.level * 200 + team.prestige * 4) *
        (1 + Math.max(0, interest - 50) / 250),
    ),
    role,
    calendarDescription: `${team.calendarSize} courses ${team.level === 1 ? "régionales et nationales" : team.level === 2 ? "nationales et internationales" : "principalement internationales"}`,
    opponentDescription:
      team.level === 1
        ? "Peloton accessible"
        : team.level === 2
          ? "Peloton national compétitif"
          : "Peloton international relevé",
    developmentRating:
      team.trainingQuality >= 68
        ? "Excellent"
        : team.trainingQuality >= 60
          ? "Très bon"
          : "Correct",
    objectives: objectives(team),
  };
}
export function generateOffers(
  rider: Rider,
  year = 2027,
  currentTeamId?: string,
  suggestedRole?: TeamRole,
  teamPool: Team[] = careerTeams,
): ContractOffer[] {
  const rating = overallRating(rider.stats, rider.profile),
    progress = rider.experience / 500,
    maxLevel =
      rating >= 64 && rider.reputation >= 12
        ? 4
        : rider.reputation >= 12 || (rating >= 57 && rider.reputation >= 6)
          ? 3
          : 2,
    candidates = teamPool.filter((team) => team.level <= maxLevel),
    renewal = currentTeamId
      ? candidates.find((team) => team.id === currentTeamId)
      : undefined;
  const scored = candidates
    .filter((team) => team.id !== currentTeamId)
    .map((team) => ({
      team,
      interest:
        30 +
        rider.reputation * 2 +
        rating -
        team.averageRiderLevel +
        progress +
        (rider.age <= 22 ? 3 : 0) +
        (team.specialties.includes(rider.profile) ? 5 : 0),
    }))
    .filter((item) => item.interest >= 35)
    .sort((a, b) => b.team.level - a.team.level || b.interest - a.interest);
  const fallback = candidates
    .filter(
      (team) =>
        team.id !== currentTeamId &&
        !scored.some((item) => item.team.id === team.id),
    )
    .map((team) => ({
      team,
      interest: 30 + rider.reputation + rating - team.averageRiderLevel,
    }));
  const eligible = [
    ...(renewal ? [{ team: renewal, interest: 55 + rider.reputation }] : []),
    ...scored,
    ...fallback,
  ].slice(0, 3);
  return eligible.map(({ team, interest }) => ({
    id: `offer-${team.id}-${year}`,
    teamId: team.id,
    contract: contractFor(
      team,
      year,
      team.id === currentTeamId && suggestedRole
        ? suggestedRole
        : team.level >= 3
          ? "Équipier"
          : "Jeune espoir",
      interest,
    ),
    interestScore: Math.round(interest),
  }));
}
export function resolveOffer(
  offer: ContractOffer,
  teamPool: Team[] = careerTeams,
) {
  const source = teamPool.find((team) => team.id === offer.teamId);
  if (!source) throw new Error("Équipe introuvable");
  return {
    team: {
      ...source,
      roster: source.roster.map((mate) => ({
        ...mate,
        stats: { ...mate.stats },
        potentials: { ...mate.potentials },
      })),
    },
    contract: offer.contract,
  };
}
