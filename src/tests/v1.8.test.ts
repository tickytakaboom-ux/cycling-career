import { describe, expect, it } from "vitest";
import { createRider } from "../data/riders";
import {
  createInteractiveParticipants,
  createRaceField,
  participantsNearPosition,
} from "../game/simulation/raceField";
import {
  advanceToNextRace,
  beginInteractiveRace,
  chooseInteractiveRaceAction,
  createGame,
} from "../state/gameStore";

const julian = () =>
  createRider({
    firstName: "Julian",
    lastName: "Stehlin",
    nationality: "France",
    height: 178,
    weight: 66,
    profile: "grimpeur",
  });

describe("plateau interactif V1.8", () => {
  it("réutilise exactement les adversaires du plateau simulé", () => {
    let game = advanceToNextRace(createGame(julian()));
    const race = game.calendar.find((item) => item.status === "available")!;
    const expectedField = createRaceField(race, game.team.level);
    game = beginInteractiveRace(game, race.id, "normal");
    const displayedOpponentIds = game
      .activeRace!.participants!.filter(
        (participant) => participant.source === "opponent",
      )
      .map((participant) => participant.riderId);
    expect(displayedOpponentIds.sort()).toEqual(
      expectedField.map((rider) => rider.id).sort(),
    );
  });

  it("produit des participants et favoris déterministes", () => {
    const game = advanceToNextRace(createGame(julian()));
    const race = game.calendar.find((item) => item.status === "available")!;
    const field = createRaceField(race, game.team.level);
    const first = createInteractiveParticipants(
      field,
      race,
      game.team.roster,
      race.selectedTeamMateIds ?? [],
    );
    const second = createInteractiveParticipants(
      field,
      race,
      game.team.roster,
      race.selectedTeamMateIds ?? [],
    );
    expect(second).toEqual(first);
    expect(
      first.filter((participant) => participant.favoriteTier === "favorite"),
    ).toHaveLength(3);
  });

  it("affiche un voisinage compact et stable autour de Julian", () => {
    const game = advanceToNextRace(createGame(julian()));
    const race = game.calendar.find((item) => item.status === "available")!;
    const participants = createInteractiveParticipants(
      createRaceField(race, game.team.level),
      race,
      game.team.roster,
      race.selectedTeamMateIds ?? [],
    );
    const group = participantsNearPosition(participants, 15);
    expect(group).toHaveLength(5);
    expect(group).toEqual(participantsNearPosition(participants, 15));
    expect(
      group.every(
        (participant) => Math.abs(participant.expectedPosition - 15) <= 3,
      ),
    ).toBe(true);
  });

  it("actualise une situation de groupe reproductible après chaque décision", () => {
    let game = advanceToNextRace(createGame(julian()));
    const race = game.calendar.find((item) => item.status === "available")!;
    game = beginInteractiveRace(game, race.id, "normal");
    const first = chooseInteractiveRaceAction(game, "follow");
    const second = chooseInteractiveRaceAction(game, "follow");
    expect(first.activeRace!.participants).toEqual(
      second.activeRace!.participants,
    );
    expect(
      first.activeRace!.participants!.every(
        (participant) =>
          participant.situationPosition !== undefined &&
          participant.situationGroup !== undefined &&
          participant.situationGapSeconds !== undefined,
      ),
    ).toBe(true);
    expect(
      participantsNearPosition(
        first.activeRace!.participants,
        first.activeRace!.position,
        5,
        first.activeRace!.group,
      ).every(
        (participant) => participant.situationGroup === first.activeRace!.group,
      ),
    ).toBe(true);
  });
});
