import { generateOpponents } from "../../data/riders";
import { fieldRange } from "../career/teams";
import type {
  CalendarRace,
  InteractiveRaceParticipant,
  InteractiveRaceState,
  Rider,
  TeamLevel,
  TeamMate,
} from "../models";
import { riderBaseScore } from "./raceSimulation";

export function createRaceField(race: CalendarRace, teamLevel: TeamLevel) {
  const range = fieldRange(race.competitionLevel ?? teamLevel);
  return generateOpponents((range.average[0] + range.average[1]) / 2);
}

export function createInteractiveParticipants(
  field: Rider[],
  race: CalendarRace,
  roster: TeamMate[],
  selectedIds: string[],
): InteractiveRaceParticipant[] {
  const ranked = field
    .map((rider) => ({ rider, score: riderBaseScore(rider, race) }))
    .sort((a, b) => b.score - a.score || a.rider.id.localeCompare(b.rider.id));
  const opponents = ranked.map(({ rider }, index) => ({
    riderId: rider.id,
    name: `${rider.firstName} ${rider.lastName}`,
    profile: rider.profile,
    source: "opponent" as const,
    expectedPosition: index + 1,
    favoriteTier:
      index < 3
        ? ("favorite" as const)
        : index < 7
          ? ("contender" as const)
          : index < 12
            ? ("outsider" as const)
            : undefined,
  }));
  const selectedMates = roster
    .filter((mate) => selectedIds.includes(mate.id))
    .map((mate, index) => ({
      riderId: mate.id,
      name: mate.name,
      profile: mate.profile,
      source: "teamMate" as const,
      expectedPosition: Math.min(
        field.length + 1,
        Math.max(1, Math.round(field.length + 2 - mate.level / 2) + index),
      ),
    }));
  return [...opponents, ...selectedMates];
}

export function participantsNearPosition(
  participants: InteractiveRaceParticipant[] | undefined,
  position: number,
  limit = 5,
  group?: string,
) {
  const available = (participants ?? []).filter(
    (participant) => !group || participant.situationGroup === group,
  );
  return [...available]
    .sort(
      (a, b) =>
        Math.abs(a.expectedPosition - position) -
          Math.abs(b.expectedPosition - position) ||
        a.expectedPosition - b.expectedPosition ||
        a.riderId.localeCompare(b.riderId),
    )
    .slice(0, limit)
    .sort(
      (a, b) =>
        a.expectedPosition - b.expectedPosition ||
        a.riderId.localeCompare(b.riderId),
    );
}

export function synchronizeParticipantSituations(
  participants: InteractiveRaceParticipant[],
  state: Pick<
    InteractiveRaceState,
    "position" | "startPosition" | "group" | "gapSeconds" | "groups"
  >,
) {
  const positionShift = Math.round(
    (state.position - state.startPosition) * 0.6,
  );
  return participants.map((participant) => {
    const situationPosition = Math.max(
      1,
      participant.expectedPosition + positionShift,
    );
    const distance = situationPosition - state.position;
    if (Math.abs(distance) <= 3)
      return {
        ...participant,
        situationPosition,
        situationGroup: state.group,
        situationGapSeconds: Math.max(0, state.gapSeconds + distance * 2),
      };
    const candidates = state.groups.filter((group) =>
      distance < 0
        ? group.gapSeconds <= state.gapSeconds
        : group.gapSeconds >= state.gapSeconds,
    );
    const nearest = [...candidates].sort(
      (a, b) =>
        Math.abs(a.gapSeconds - state.gapSeconds) -
        Math.abs(b.gapSeconds - state.gapSeconds),
    )[0];
    return {
      ...participant,
      situationPosition,
      situationGroup: nearest?.label ?? state.group,
      situationGapSeconds: nearest?.gapSeconds ?? state.gapSeconds,
    };
  });
}
