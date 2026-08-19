import { useEffect, useState } from "react";
import {
  Activity,
  Bike,
  Building2,
  CalendarDays,
  Flag,
  Gauge,
  Globe2,
  Medal,
  Save,
  Trash2,
  Trophy,
  UserRound,
} from "lucide-react";
import { CreateCareer } from "../components/CreateCareer";
import { teamById } from "../data/careerTeams";
import { trainingConfig } from "../game/config";
import { seasonSummary } from "../game/career/careerProgression";
import { overallRating } from "../game/career/riderRating";
import { injuryRisk } from "../game/injuries/injurySystem";
import {
  moraleLabel,
  moralePerformancePercent,
} from "../game/morale/moraleSystem";
import type {
  CalendarRace,
  GameState,
  InteractiveRaceChoice,
  RaceStrategy,
  Rider,
  RiderStats,
  TrainingType,
} from "../game/models";
import { restPreview, trainingPreview } from "../game/progression/previews";
import { rainLabels, weatherEffect, windLabels } from "../game/weather/weather";
import {
  interactiveChoiceDescriptions,
  interactiveTendency,
} from "../game/simulation/interactiveRace";
import { participantsNearPosition } from "../game/simulation/raceField";
import {
  riderRankings,
  teamRankings,
  u23Rankings,
} from "../game/world/rankings";
import {
  createCareer,
  beginInteractiveRace,
  chooseInteractiveRaceAction,
  deleteSave,
  finishInteractiveRace,
  loadGame,
  nextDay,
  prepareNextSeasonOffers,
  saveGame,
  signContract,
  startNextSeason,
  train,
  trainingBlockReason,
  unlockScouting,
} from "../state/gameStore";

type Tab =
  "dashboard" | "training" | "races" | "calendar" | "team" | "world" | "rider";
const profileLabels = {
  grimpeur: "Grimpeur",
  puncheur: "Puncheur",
  sprinteur: "Sprinteur",
  rouleur: "Rouleur",
  baroudeur: "Baroudeur",
  classiqueur: "Baroudeur",
  etapes: "Rouleur",
};
const terrainLabels = {
  sprint: "Sprint",
  plaine: "Plaine",
  vallons: "Vallons",
  montagne: "Montagne",
  chrono: "Chrono",
  paves: "Pavés",
};
const careerLabels = [
  "",
  "Débutant",
  "Espoir",
  "Coureur confirmé",
  "Leader",
  "Élite",
];
const statLabels: Record<keyof RiderStats, string> = {
  mountain: "Montagne",
  sprint: "Sprint",
  climbing: "Côtes",
  timeTrial: "Chrono",
  pavement: "Pavés",
  endurance: "Endurance",
  explosiveness: "Explosivité",
  recovery: "Récupération",
  descending: "Descente",
  tactics: "Tactique",
  resistance: "Résistance",
  weather: "Météo",
};
const statHelp: Record<keyof RiderStats, string> = {
  mountain: "Ascensions longues.",
  sprint: "Vitesse sur les arrivées rapides.",
  climbing: "Bosses et changements de pente.",
  timeTrial: "Effort régulier en solitaire.",
  pavement: "Rendement sur les pavés.",
  endurance: "Maintien d’un effort long.",
  explosiveness: "Accélérations.",
  recovery: "Récupération entre les efforts.",
  descending: "Pilotage en descente.",
  tactics: "Lecture de course.",
  resistance: "Tolérance aux efforts répétés.",
  weather: "Adaptation aux conditions.",
};
const trainingDetails: Record<
  Exclude<TrainingType, "recuperation">,
  { icon: string; intensity: string; duration: string }
> = {
  endurance: { icon: "🚴", intensity: "Modérée", duration: "2h15" },
  montagne: { icon: "🏔️", intensity: "Élevée", duration: "2h45" },
  sprint: { icon: "⚡", intensity: "Élevée", duration: "1h45" },
  explosivite: { icon: "🔥", intensity: "Très élevée", duration: "1h30" },
  chrono: { icon: "⏱️", intensity: "Élevée", duration: "2h00" },
  technique: { icon: "🪨", intensity: "Élevée", duration: "2h10" },
};

function Metric({
  label,
  value,
  tone,
  help,
}: {
  label: string;
  value: number;
  tone?: string;
  help?: string;
}) {
  return (
    <div className="metric" title={help}>
      <div>
        <span>{label}</span>
        <strong>{Math.round(value)}</strong>
      </div>
      <div className="meter">
        <i style={{ width: `${value}%`, background: tone }} />
      </div>
      {help && <small>{help}</small>}
    </div>
  );
}
function InjuryCard({ rider }: { rider: Rider }) {
  if (!rider.injury) return null;
  return (
    <section className="injury-card">
      <b>🩹 {rider.injury.name}</b>
      <span>
        {rider.injury.severity} · {rider.injury.daysRemaining} jour(s)
      </span>
      <span>
        {rider.injury.trainingRestriction === "light-only"
          ? "Entraînement léger uniquement"
          : "Entraînement interdit"}
      </span>
      <span>
        Performance : −{Math.round(rider.injury.performancePenalty * 100)} %
      </span>
    </section>
  );
}
function WeatherCard({ race, rider }: { race: CalendarRace; rider: Rider }) {
  const effect = weatherEffect(rider, race),
    w = effect.conditions;
  return (
    <section className="weather-card">
      <b>Conditions de course</b>
      <span>🌡️ {w.temperature} °C</span>
      <span>
        💨 {w.windSpeed} km/h · {windLabels[w.windDirection]}
      </span>
      <span>🌧️ Pluie {rainLabels[w.rain]}</span>
      <span>
        ☁️ {w.cloudCover} % · humidité {w.humidity} %
      </span>
      <small>{effect.reasons.join(" ")}</small>
    </section>
  );
}
function RaceProfile({ race }: { race: CalendarRace }) {
  const points =
    race.terrain === "montagne"
      ? "0,70 70,55 120,65 190,20 250,60 320,8 380,52 440,18 500,45"
      : race.terrain === "vallons"
        ? "0,65 80,42 150,62 220,30 300,58 370,26 440,52 500,40"
        : "0,58 100,54 200,60 300,52 400,57 500,50";
  return (
    <div className={`profile-visual ${race.terrain}`}>
      <span>Départ</span>
      <svg viewBox="0 0 500 80" preserveAspectRatio="none">
        <polyline points={points} />
      </svg>
      <span>Arrivée</span>
    </div>
  );
}
function RaceSheet({
  race,
  rider,
  onStart,
}: {
  race: CalendarRace;
  rider: Rider;
  onStart?: (id: string) => void;
}) {
  return (
    <div className="race-sheet">
      <section className="panel race-hero">
        <div>
          <span className="eyebrow">
            {race.country} · {terrainLabels[race.terrain]}
          </span>
          <h1>{race.name}</h1>
          <p>
            {new Date(race.date + "T12:00").toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
        <div className="race-facts">
          <b>
            {race.distance}
            <small>KM</small>
          </b>
          <b>
            {race.elevation}
            <small>M D+</small>
          </b>
          <b>
            {race.difficulty}
            <small>DIFFICULTÉ</small>
          </b>
          <b>
            {race.prestige}
            <small>PRESTIGE</small>
          </b>
          <b>
            {race.competitionLevel ?? 1}
            <small>NIVEAU</small>
          </b>
          <b>
            31<small>COUREURS</small>
          </b>
        </div>
        <RaceProfile race={race} />
      </section>
      <WeatherCard race={race} rider={rider} />
      {onStart && race.status === "available" && (
        <button className="primary big" onClick={() => onStart(race.id)}>
          CHOISIR LA STRATÉGIE <Flag />
        </button>
      )}
    </div>
  );
}

function Offers({
  game,
  update,
  nextSeason = false,
}: {
  game: GameState;
  update: (g: GameState) => void;
  nextSeason?: boolean;
}) {
  const resolvedOffers = game.career.offers.map((offer) => ({
    offer,
    team:
      game.world.teams.find((team) => team.id === offer.teamId) ??
      teamById(offer.teamId)!,
  }));
  return (
    <main className="offers-screen">
      <div className="brand">
        <Bike />
        <span>CYCLING / CAREER</span>
      </div>
      <section className="page-intro">
        <span className="eyebrow">
          {nextSeason ? "NOUVELLE SAISON" : "PREMIER CONTRAT"}
        </span>
        <h1>Choisissez votre projet</h1>
        <p>
          Le prestige n’est pas tout : comparez le calendrier, le niveau sportif
          et la qualité de développement.
        </p>
      </section>
      {nextSeason && game.world.recap && (
        <section className="panel world-recap">
          <span className="eyebrow">
            BILAN DE LA SAISON {game.world.recap.year}
          </span>
          <h2>{game.world.recap.champion} · meilleur coureur</h2>
          <p>
            Meilleure équipe : <b>{game.world.recap.bestTeam}</b> · Transferts :{" "}
            {game.world.recap.transfers.length} · Retraites :{" "}
            {game.world.recap.retirements.length}
          </p>
          <p>
            Jeunes révélations :{" "}
            {game.world.recap.youngRevelations.join(", ") || "—"} · Évolution de
            Julian : {game.world.recap.julianEvolution >= 0 ? "+" : ""}
            {game.world.recap.julianEvolution}
          </p>
        </section>
      )}
      <section
        className="contract-comparison"
        aria-label="Comparaison des offres"
      >
        <span className="eyebrow">COMPARAISON RAPIDE</span>
        <div>
          {resolvedOffers.map(({ offer, team }) => (
            <article key={offer.id}>
              <b>{team.name}</b>
              <span>{offer.contract.role}</span>
              <span>{offer.contract.monthlySalary} €/mois</span>
              <span>
                Développement {offer.contract.developmentRating.toLowerCase()}
              </span>
            </article>
          ))}
        </div>
      </section>
      <div className="offer-grid">
        {resolvedOffers.map(({ offer, team }) => (
          <article
            className="panel offer-card"
            key={offer.id}
            style={{ borderTopColor: team.color }}
          >
            <div className="offer-card-heading">
              <div>
                <span className="eyebrow">NIVEAU {"★".repeat(team.level)}</span>
                <h2>{team.name}</h2>
                <p>{team.country}</p>
              </div>
              <small>Intérêt {offer.interestScore}</small>
            </div>
            <div className="contract-facts contract-summary">
              <span>
                Rôle <b>{offer.contract.role}</b>
              </span>
              <span>
                Salaire <b>{offer.contract.monthlySalary} €/mois</b>
              </span>
              <span>
                Développement <b>{offer.contract.developmentRating}</b>
              </span>
              <span>
                Calendrier <b>{team.calendarSize} courses</b>
              </span>
            </div>
            <details className="contract-details">
              <summary>Voir le projet complet</summary>
              <div className="contract-facts">
                <span>
                  Durée <b>{offer.contract.durationYears} saison</b>
                </span>
                <span>
                  Prestige <b>{team.prestige}</b>
                </span>
                <span>
                  Adversaires <b>{offer.contract.opponentDescription}</b>
                </span>
                <span>
                  Calendrier <b>{offer.contract.calendarDescription}</b>
                </span>
              </div>
              <p>
                <strong>Spécialités :</strong> {team.specialties.join(", ")}
              </p>
              <h3>Objectifs et primes</h3>
              {offer.contract.objectives.map((goal) => (
                <small className="goal-line" key={goal.id}>
                  ○ {goal.label} · {goal.reward} €
                </small>
              ))}
            </details>
            <button
              className="primary big"
              onClick={() =>
                update(
                  nextSeason
                    ? startNextSeason(game, offer.id)
                    : signContract(game, offer.id),
                )
              }
            >
              SIGNER AVEC CETTE ÉQUIPE
            </button>
          </article>
        ))}
      </div>
    </main>
  );
}

function TrainingPage({
  game,
  update,
}: {
  game: GameState;
  update: (g: GameState) => void;
}) {
  const types = (Object.keys(trainingConfig) as TrainingType[]).filter(
      (t): t is Exclude<TrainingType, "recuperation"> => t !== "recuperation",
    ),
    selected =
      game.selectedTraining === "recuperation"
        ? "endurance"
        : game.selectedTraining,
    preview = trainingPreview(
      game.rider,
      selected,
      game.team.trainingQuality / 65,
    ),
    block = trainingBlockReason(game, selected),
    rest = restPreview(game.rider);
  return (
    <div className="training-page">
      <section className="page-intro">
        <span className="eyebrow">ACTIVITÉ DU JOUR</span>
        <h1>Préparer le coureur</h1>
      </section>
      <div className="session-grid">
        {types.map((type) => {
          const d = trainingDetails[type],
            p = trainingPreview(
              game.rider,
              type,
              game.team.trainingQuality / 65,
            );
          return (
            <button
              key={type}
              className={`session-card ${selected === type ? "selected" : ""}`}
              onClick={() => update({ ...game, selectedTraining: type })}
            >
              <i>{d.icon}</i>
              <b>{trainingConfig[type].label}</b>
              <span>
                {d.intensity} · {d.duration}
              </span>
              <small>
                Fatigue +{p.fatigueChange} · Risque {(p.risk * 100).toFixed(1)}{" "}
                %
              </small>
            </button>
          );
        })}
      </div>
      <div className="preview-grid">
        <section className="panel preview">
          <h2>
            {trainingDetails[selected].icon} {trainingConfig[selected].label}
          </h2>
          <div className="estimate">
            <span>
              Fatigue <b>+{preview.fatigueChange.toFixed(0)}</b>
            </span>
            <span>
              Forme <b>{preview.formChange.toFixed(2)}</b>
            </span>
            <span>
              Risque <b>{(preview.risk * 100).toFixed(1)} %</b>
            </span>
            {preview.gains.map((g) => (
              <span key={g.stat}>
                {statLabels[g.stat]} <b>+{g.gain.toFixed(3)}</b>
              </span>
            ))}
          </div>
          {block && <p className="warning">⚠ {block}</p>}
          <button
            className="primary big"
            disabled={Boolean(block)}
            onClick={() => update(train(game, selected))}
          >
            VALIDER LA SÉANCE
          </button>
        </section>
        <section className="panel rest-preview">
          <h2>💤 Récupération</h2>
          <div className="before-after">
            <span>
              Fatigue{" "}
              <b>
                {rest.fatigueBefore.toFixed(0)} → {rest.fatigueAfter.toFixed(0)}
              </b>
            </span>
            <span>
              Forme{" "}
              <b>
                {rest.formBefore.toFixed(0)} → {rest.formAfter.toFixed(0)}
              </b>
            </span>
            <span>
              Moral{" "}
              <b>
                {rest.moraleBefore.toFixed(0)} → {rest.moraleAfter.toFixed(0)}
              </b>
            </span>
          </div>
          <button
            className="outline big"
            disabled={Boolean(
              game.calendar.find((r) => r.status === "available"),
            )}
            onClick={() => update(nextDay(game))}
          >
            PRENDRE DU REPOS
          </button>
        </section>
      </div>
    </div>
  );
}
function TeamView({
  game,
  update,
}: {
  game: GameState;
  update: (value: GameState) => void;
}) {
  const contract = game.career.contract!,
    results = game.calendar
      .filter((race) => race.teamResults?.length)
      .slice(-5)
      .reverse(),
    next = game.calendar.find((race) => race.status !== "completed");
  return (
    <div className="content-view">
      <section
        className="panel team-hero"
        style={{ borderTopColor: game.team.color }}
      >
        <span className="eyebrow">ÉQUIPE NIVEAU {game.team.level}</span>
        <h1>{game.team.name}</h1>
        <p>
          {game.team.country} · Prestige {game.team.prestige} · Niveau moyen{" "}
          {game.team.averageRiderLevel}
        </p>
        <div className="staff-grid">
          <span>
            Entraînement <b>{game.team.trainingQuality}</b>
          </span>
          <span>
            Médical <b>{game.team.medicalQuality}</b>
          </span>
          <span>
            Récupération <b>{game.team.recoveryQuality}</b>
          </span>
          <span>
            Budget <b>{game.team.budget.toLocaleString("fr-FR")} €</b>
          </span>
        </div>
      </section>
      <section className="panel">
        <h2>Votre contrat</h2>
        <div className="contract-facts">
          <span>
            Rôle <b>{contract.role}</b>
          </span>
          <span>
            Niveau général{" "}
            <b>{overallRating(game.rider.stats, game.rider.profile)}</b>
          </span>
          <span>
            Salaire <b>{contract.monthlySalary} €/mois</b>
          </span>
          <span>
            Solde <b>{game.career.balance.toLocaleString("fr-FR")} €</b>
          </span>
          <span>
            Primes <b>{game.career.objectiveBonuses} €</b>
          </span>
        </div>
        <h3>Objectifs et primes</h3>
        {contract.objectives.map((goal) => (
          <div className="objective" key={goal.id}>
            <span>
              {goal.status === "completed" ? "✓" : "○"} {goal.label} ·{" "}
              {goal.reward} €
            </span>
            <b>
              {Math.min(goal.progress, goal.target).toFixed(
                goal.type === "reputation" ? 1 : 0,
              )}
              /{goal.target}
            </b>
          </div>
        ))}
      </section>
      <section className="panel">
        <div className="panel-title">
          <h2>Effectif</h2>
          {!game.career.scoutingUnlocked && (
            <button
              className="outline"
              onClick={() => update(unlockScouting(game))}
            >
              ANALYSE AVANCÉE · 300 €
            </button>
          )}
        </div>
        {next && (
          <p className="selection-note">
            Sélection prévisionnelle (susceptible d’évoluer avant la course) :{" "}
            {next.selectedTeamMateIds
              ?.map(
                (id) => game.team.roster.find((mate) => mate.id === id)?.name,
              )
              .filter(Boolean)
              .join(", ")}
          </p>
        )}
        <div className="roster">
          <div className="player-roster-row">
            <b>
              {game.rider.firstName} {game.rider.lastName} <small>VOUS</small>
            </b>
            <span>
              {game.rider.age} ans · {profileLabels[game.rider.profile]} ·{" "}
              {contract.role}
            </span>
            <strong>
              {overallRating(game.rider.stats, game.rider.profile)}
            </strong>
          </div>
          {game.team.roster.map((mate) => (
            <div key={mate.id}>
              <b>{mate.name}</b>
              <span>
                {mate.age} ans · {profileLabels[mate.profile]} · {mate.role}
                {game.career.scoutingUnlocked && (
                  <small className="mate-stats">
                    Mont. {Math.round(mate.stats.mountain)} · Côtes{" "}
                    {Math.round(mate.stats.climbing)} · End.{" "}
                    {Math.round(mate.stats.endurance)} · Sprint{" "}
                    {Math.round(mate.stats.sprint)} · Forme{" "}
                    {Math.round(mate.form)}
                  </small>
                )}
              </span>
              <strong>{mate.level}</strong>
            </div>
          ))}
        </div>
      </section>
      <section className="panel">
        <h2>Résultats de l’équipe</h2>
        {results.length === 0 ? (
          <p>Aucune course disputée.</p>
        ) : (
          results.map((race) => (
            <div className="team-race-results" key={race.id}>
              <b>{race.name}</b>
              {[
                ...(race.result
                  ? [
                      {
                        id: "player",
                        name: `${game.rider.firstName} ${game.rider.lastName}`,
                        position: race.result.position,
                        score: race.result.score,
                        isPlayer: true,
                      },
                    ]
                  : []),
                ...race.teamResults!.map((result) => ({
                  id: result.riderId,
                  name: result.riderName,
                  position: result.position,
                  score: result.score,
                  isPlayer: false,
                })),
              ]
                .sort((a, b) => a.position - b.position)
                .map((result) => (
                  <span
                    key={result.id}
                    className={result.isPlayer ? "player-result" : undefined}
                  >
                    {result.position}e · {result.name}{" "}
                    <small>
                      {result.score.toFixed(1)}/100
                      {result.isPlayer ? " · VOUS" : ""}
                    </small>
                  </span>
                ))}
            </div>
          ))
        )}
      </section>
      <section className="panel">
        <h2>Mouvements de l’effectif</h2>
        {game.world.transfers.filter(
          (move) =>
            move.fromTeamId === game.team.id || move.toTeamId === game.team.id,
        ).length ? (
          game.world.transfers
            .filter(
              (move) =>
                move.fromTeamId === game.team.id ||
                move.toTeamId === game.team.id,
            )
            .map((move) => (
              <p key={`${move.riderId}-${move.season}`}>
                {move.riderName} ·{" "}
                {move.toTeamId === game.team.id ? "Arrivée" : "Départ"}
              </p>
            ))
        ) : (
          <p>Aucun mouvement récent.</p>
        )}
      </section>
    </div>
  );
}
function RiderView({ rider }: { rider: Rider }) {
  const impact = moralePerformancePercent(rider.morale);
  return (
    <div className="content-view">
      <section className="panel profile-summary">
        <div className="rider-mark large">
          {rider.firstName[0]}
          {rider.lastName[0]}
        </div>
        <div>
          <span className="eyebrow">
            {profileLabels[rider.profile]} · {rider.nationality}
          </span>
          <h1>
            {rider.firstName} {rider.lastName}
          </h1>
          <p>
            {rider.height} cm · {rider.weight} kg · {rider.age} ans
          </p>
          <p>
            <b>Niveau général {overallRating(rider.stats, rider.profile)}</b> ·
            indicateur pondéré selon le profil
          </p>
        </div>
      </section>
      <InjuryCard rider={rider} />
      <section className="panel morale-summary">
        <div>
          <span className="eyebrow">MORAL</span>
          <h2>
            {rider.morale.toFixed(0)}/100 — {moraleLabel(rider.morale)}
          </h2>
          <p>
            Impact actuel sur la performance : {impact >= 0 ? "+" : ""}
            {impact.toFixed(1).replace(".", ",")} %. Le moral est influencé par
            vos résultats, votre entraînement, votre récupération et votre
            situation dans l’équipe.
          </p>
        </div>
        <div className="morale-history">
          <h3>Dernières influences</h3>
          {rider.moraleHistory?.length ? (
            rider.moraleHistory.slice(0, 8).map((event) => (
              <div
                className={
                  event.delta > 0 ? "morale-positive" : "morale-negative"
                }
                key={event.id}
              >
                <b>
                  {event.delta > 0 ? "+" : "−"}
                  {Math.abs(event.delta).toFixed(1).replace(".", ",")}
                </b>
                <span>{event.reason}</span>
                <small>
                  {event.before.toFixed(1).replace(".", ",")} →{" "}
                  {event.after.toFixed(1).replace(".", ",")}
                </small>
              </div>
            ))
          ) : (
            <p>Aucune influence récente enregistrée.</p>
          )}
        </div>
      </section>
      <section className="panel">
        <h3>Caractéristiques</h3>
        <div className="stats-grid">
          {Object.entries(rider.stats).map(([key, value]) => (
            <Metric
              key={key}
              label={statLabels[key as keyof RiderStats]}
              value={value}
              help={statHelp[key as keyof RiderStats]}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
function CalendarView({
  game,
  onRace,
}: {
  game: GameState;
  onRace: (id: string) => void;
}) {
  return (
    <div className="calendar-list">
      {game.calendar.map((item, index) => (
        <article className={`calendar-card ${item.status}`} key={item.id}>
          <div className="race-no">{String(index + 1).padStart(2, "0")}</div>
          <div className="race-date">
            <b>{new Date(item.date + "T12:00").getDate()}</b>
            <span>
              {new Date(item.date + "T12:00").toLocaleDateString("fr-FR", {
                month: "short",
              })}
            </span>
          </div>
          <div className="race-name">
            <small>
              {item.country} · {terrainLabels[item.terrain]} · niveau{" "}
              {item.competitionLevel}
            </small>
            <h3>{item.name}</h3>
            <span>
              {item.distance} km · difficulté {item.difficulty} · prestige{" "}
              {item.prestige}
            </span>
          </div>
          <div className="race-state">
            {item.status === "completed" ? (
              <>
                <Medal />
                <b>{item.result?.position}e</b>
              </>
            ) : item.status === "available" ? (
              <button className="primary" onClick={() => onRace(item.id)}>
                COURIR
              </button>
            ) : (
              <span>À VENIR</span>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
function ResultToast({
  result,
  close,
}: {
  result: GameState["lastResult"];
  close: () => void;
}) {
  if (!result) return null;
  return (
    <div className="result">
      <button onClick={close}>×</button>
      <Trophy />
      <span>RÉSULTAT OFFICIEL</span>
      <h2>
        {result.position}
        <sup>e</sup>
      </h2>
      <p>
        sur {result.fieldSize} coureurs · {result.gap}
      </p>
      <div className="score">
        <b>{result.score}</b>
        <small>PERFORMANCE / 100</small>
      </div>
      {result.events.map((event, index) => (
        <p
          className={`event ${event === "Décisions" || event === "Conséquences" || event === "Décisions et conséquences" || event === "Impact collectif" || event === "Charge de course" ? "event-heading" : event.startsWith("Km ") ? "event-decision" : event.startsWith("↳") ? "event-detail" : ""}`}
          key={`${index}-${event}`}
        >
          {event}
        </p>
      ))}
      <div className="result-gains">
        <strong>+ {result.xpGained} XP</strong>
        <span>+ {result.reputationGained.toFixed(2)} réputation</span>
      </div>
    </div>
  );
}

function WorldView({ game }: { game: GameState }) {
  const [u23, setU23] = useState(false),
    riders = (
      u23 ? u23Rankings(game.world, game) : riderRankings(game.world, game)
    ).slice(0, 30),
    teams = teamRankings(game.world, game),
    teamNames = new Map(game.world.teams.map((team) => [team.id, team.name])),
    recap = game.world.recap;
  return (
    <div className="content-view world-view">
      <section className="page-intro">
        <span className="eyebrow">SAISON {game.world.year}</span>
        <h1>Monde du cyclisme</h1>
        <p>
          Classements construits à partir des résultats de la saison, de
          l’expérience et de la réputation.
        </p>
      </section>
      {recap && (
        <section className="panel world-recap">
          <span className="eyebrow">BILAN {recap.year}</span>
          <h2>{recap.champion} · champion</h2>
          <p>
            Meilleure équipe : <b>{recap.bestTeam}</b> · Évolution de Julian :{" "}
            <b>
              {recap.julianEvolution >= 0 ? "+" : ""}
              {recap.julianEvolution}
            </b>
          </p>
          <p>
            Révélations : {recap.youngRevelations.join(", ") || "—"} · Retraites
            : {recap.retirements.length}
          </p>
        </section>
      )}
      <div className="world-grid">
        <section className="panel">
          <div className="panel-title">
            <h2>Classement des coureurs</h2>
            <button className="outline" onClick={() => setU23(!u23)}>
              {u23 ? "VOIR LE GÉNÉRAL" : "VOIR LES U23"}
            </button>
          </div>
          <div className="ranking-table">
            <div className="ranking-head">
              <span>#</span>
              <span>Coureur</span>
              <span>Équipe</span>
              <span>Âge</span>
              <span>Profil</span>
              <span>NG</span>
              <span>Points</span>
            </div>
            {riders.map((rider) => (
              <div
                className={rider.isPlayer ? "ranking-player" : ""}
                key={rider.id}
              >
                <b>{rider.position}</b>
                <strong>
                  {rider.name}
                  {rider.isPlayer ? " · VOUS" : ""}
                </strong>
                <span>{rider.teamName}</span>
                <span>{rider.age}</span>
                <span>
                  {profileLabels[rider.profile as keyof typeof profileLabels]}
                </span>
                <span>{rider.rating}</span>
                <b>{rider.points}</b>
              </div>
            ))}
          </div>
        </section>
        <section className="panel">
          <h2>Classement des équipes</h2>
          <div className="team-ranking">
            {teams.map((team) => (
              <div key={team.id}>
                <b>{team.position}</b>
                <strong>{team.name}</strong>
                <span>Niv. {team.level}</span>
                <span>{team.victories} victoire(s)</span>
                <span>{team.top10} top 10</span>
                <b>{team.points} pts</b>
              </div>
            ))}
          </div>
        </section>
      </div>
      <div className="world-grid">
        <section className="panel">
          <h2>Transferts récents</h2>
          {game.world.transfers.length ? (
            game.world.transfers.map((move) => (
              <p key={`${move.riderId}-${move.season}`}>
                {move.riderName} · {teamNames.get(move.fromTeamId)} →{" "}
                <b>{teamNames.get(move.toTeamId)}</b>
              </p>
            ))
          ) : (
            <p>Aucun mouvement récent.</p>
          )}
        </section>
        <section className="panel">
          <h2>Jeunes talents</h2>
          {game.world.riders
            .filter((rider) => game.world.youngTalentIds.includes(rider.id))
            .slice(0, 8)
            .map((rider) => (
              <p key={rider.id}>
                <b>{rider.name}</b> · {rider.age} ans ·{" "}
                {profileLabels[rider.profile]} · NG {rider.level}
              </p>
            ))}
        </section>
        <section className="panel">
          <h2>Retraites</h2>
          {game.world.retirements.length ? (
            game.world.retirements.map((rider) => (
              <p key={rider.riderId}>
                {rider.riderName} · {rider.age} ans
              </p>
            ))
          ) : (
            <p>Aucune retraite récente.</p>
          )}
        </section>
      </div>
    </div>
  );
}
function RaceStatusBar({
  state,
}: {
  state: NonNullable<GameState["activeRace"]>;
}) {
  return (
    <div className="race-status-bar" aria-label="Situation de Julian">
      <div>
        <small>POSITION</small>
        <b>{state.position}e / 31</b>
      </div>
      <div>
        <small>GROUPE</small>
        <b>{state.group}</b>
      </div>
      <div>
        <small>ÉCART</small>
        <b>{state.gapSeconds ? `+${state.gapSeconds} s` : "—"}</b>
      </div>
      <div>
        <small>EFFORT</small>
        <b>+{state.fatigueDelta.toFixed(1)}</b>
      </div>
      <div>
        <small>AVANTAGE</small>
        <b>
          {(state.performanceDelta ?? 0) >= 0 ? "+" : ""}
          {(state.performanceDelta ?? 0).toFixed(1)}
        </b>
      </div>
    </div>
  );
}

function RaceSituationMap({
  state,
  progress,
  race,
}: {
  state: NonNullable<GameState["activeRace"]>;
  progress: number;
  race: CalendarRace;
}) {
  const profilePoints = [
    `0,${race.terrain === "montagne" ? 62 : 70}`,
    ...state.phases.map((phase) => {
      const terrainRelief =
        race.terrain === "montagne"
          ? 34
          : race.terrain === "vallons"
            ? 24
            : race.terrain === "paves"
              ? 14
              : 8;
      const height = Math.max(
        12,
        76 -
          phase.intensity * terrainRelief -
          (phase.kind === "difficulty" ? 18 : 0),
      );
      return `${(phase.km / race.distance) * 100},${height}`;
    }),
    `100,${race.terrain === "montagne" ? 28 : 68}`,
  ].join(" ");
  return (
    <section className="race-situation-map" aria-label="Situation en course">
      <div className="stage-profile-heading">
        <div>
          <span className="eyebrow">PROFIL SCHÉMATIQUE</span>
          <b>
            {race.distance} km · {race.elevation} m D+
          </b>
        </div>
        <small>{race.terrain}</small>
      </div>
      <div className="stage-profile" aria-label="Profil schématique de l'étape">
        <svg viewBox="0 0 100 84" preserveAspectRatio="none" aria-hidden="true">
          <polygon points={`0,84 ${profilePoints} 100,84`} />
          <polyline points={profilePoints} />
        </svg>
        {state.phases.map((phase, index) => (
          <span
            className={index === state.phaseIndex ? "current" : ""}
            key={phase.id}
            style={{ left: `${(phase.km / race.distance) * 100}%` }}
            title={`${phase.title} · km ${phase.km}`}
          />
        ))}
        <div className="stage-profile-rider" style={{ left: `${progress}%` }}>
          JS
        </div>
      </div>
      {race.terrain === "chrono" ? (
        <div className="time-trial-note">
          <b>Contre-la-montre individuel</b>
          <span>Julian roule seul contre le chronomètre.</span>
        </div>
      ) : (
        <div className="race-groups" aria-label="Groupes en course">
          {(state.groups ?? []).map((group) => (
            <div
              className={`race-group ${group.kind}`}
              key={group.id}
              style={{
                left: `${Math.min(97, Math.max(3, progress + (state.gapSeconds - group.gapSeconds) / 2))}%`,
              }}
            >
              <i />
              <span>{group.label}</span>
              <small>
                {group.gapSeconds ? `+${group.gapSeconds} s` : "Tête"}
              </small>
            </div>
          ))}
          <div className="race-group player" style={{ left: `${progress}%` }}>
            <i />
            <span>Julian</span>
            <small>
              {state.gapSeconds ? `+${state.gapSeconds} s` : "Tête"}
            </small>
          </div>
        </div>
      )}
      <div className="race-track" aria-label="Progression de la course">
        <div className="race-track-line" />
        {state.phases.map((item, index) => (
          <span
            className={
              index < state.phaseIndex
                ? "passed"
                : index === state.phaseIndex
                  ? "current"
                  : ""
            }
            key={item.id}
            style={{ left: `${(item.km / race.distance) * 100}%` }}
            title={item.title}
          />
        ))}
        <div className="rider-dot" style={{ left: `${progress}%` }}>
          JS
        </div>
      </div>
    </section>
  );
}

function CurrentGroupPanel({
  state,
}: {
  state: NonNullable<GameState["activeRace"]>;
}) {
  const riders = participantsNearPosition(
    state.participants,
    state.position,
    99,
    state.group,
  ).sort((a, b) => {
    const importance = (rider: typeof a) =>
      rider.source === "teamMate"
        ? 0
        : rider.favoriteTier === "favorite"
          ? 1
          : rider.favoriteTier === "contender"
            ? 2
            : rider.favoriteTier === "outsider"
              ? 3
              : 4;
    return (
      importance(a) - importance(b) ||
      Math.abs((a.situationPosition ?? a.expectedPosition) - state.position) -
        Math.abs((b.situationPosition ?? b.expectedPosition) - state.position)
    );
  });
  const visibleRiders = riders.slice(0, 3);
  const favorites = riders.filter((rider) => rider.favoriteTier).length;
  const riderLine = (rider: (typeof riders)[number]) => (
    <div className="group-rider" key={rider.riderId}>
      <span>
        {rider.source === "teamMate" ? "ÉQ" : rider.favoriteTier ? "★" : "·"}
      </span>
      <div>
        <b>{rider.name}</b>
        <small>
          {profileLabels[rider.profile]}
          {rider.source === "teamMate"
            ? " · équipier"
            : rider.favoriteTier === "favorite"
              ? " · favori"
              : rider.favoriteTier === "contender"
                ? " · prétendant"
                : rider.favoriteTier === "outsider"
                  ? " · outsider"
                  : ""}
        </small>
      </div>
    </div>
  );
  return (
    <section className="current-group-panel" aria-label="Coureurs avec Julian">
      <div className="current-group-heading">
        <div>
          <span className="eyebrow">DANS LE GROUPE DE JULIAN</span>
          <b>{state.group}</b>
        </div>
        <small>
          {favorites
            ? `★ ${favorites} favori${favorites > 1 ? "s" : ""} à proximité`
            : "Aucun favori à proximité"}
        </small>
      </div>
      <div className="group-rider-list">
        <div className="group-rider player">
          <span>JS</span>
          <div>
            <b>Julian</b>
            <small>{state.position}e · votre position</small>
          </div>
        </div>
        {visibleRiders.map(riderLine)}
      </div>
      {riders.length > visibleRiders.length && (
        <details className="group-rider-details">
          <summary>+{riders.length - visibleRiders.length} coureurs</summary>
          <div className="group-rider-list full">{riders.map(riderLine)}</div>
        </details>
      )}
    </section>
  );
}

function InteractiveRaceModal({
  game,
  update,
}: {
  game: GameState;
  update: (game: GameState) => void;
}) {
  const state = game.activeRace!;
  const raceData = game.calendar.find((item) => item.id === state.raceId)!;
  const current = state.phases[state.phaseIndex];
  const progress = current ? (current.km / raceData.distance) * 100 : 100;
  const choiceContent = interactiveChoiceDescriptions(
    state,
    game.rider,
    raceData,
  );
  const choices = (Object.keys(choiceContent) as InteractiveRaceChoice[]).map(
    (id) => [id, choiceContent[id]] as const,
  );
  return (
    <div className="modal-back interactive-back">
      <div className="modal interactive-race">
        <div className="interactive-header">
          <div>
            <span className="eyebrow">COURSE INTERACTIVE</span>
            <h2>{raceData.name}</h2>
          </div>
          <b>
            Km {current?.km ?? raceData.distance}/{raceData.distance}
          </b>
        </div>
        <RaceStatusBar state={state} />
        <div className="interactive-race-layout">
          <div className="interactive-race-context">
            <RaceSituationMap
              state={state}
              progress={progress}
              race={raceData}
            />
            {raceData.terrain !== "chrono" && (
              <CurrentGroupPanel state={state} />
            )}
          </div>
          <div className="interactive-race-actions">
            {current ? (
              <>
                <section className="race-moment">
                  <span className="eyebrow">
                    MOMENT CLÉ {state.phaseIndex + 1}/{state.phases.length}
                  </span>
                  <h2>{current.title}</h2>
                  <p>
                    {current.description} Julian est {state.position}e du{" "}
                    {state.group.toLowerCase()}.
                  </p>
                </section>
                <div className="race-choices">
                  {choices.map(([id, content]) => (
                    <button
                      key={id}
                      disabled={content.disabled}
                      onClick={() =>
                        update(chooseInteractiveRaceAction(game, id))
                      }
                    >
                      <b>{content.label}</b>
                      <small>{content.description}</small>
                      <em>{content.indicators}</em>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <section className="race-moment race-finish-ready">
                <span className="eyebrow">ARRIVÉE EN VUE</span>
                <h2>Les choix sont faits</h2>
                <p>
                  Le moteur va maintenant calculer le classement final à partir
                  de l’état obtenu en course.
                </p>
                {(() => {
                  const tendency = interactiveTendency(state);
                  return (
                    <div className="race-tendency">
                      <b>
                        {tendency.symbol} {tendency.label}
                      </b>
                      <span>{tendency.text}</span>
                    </div>
                  );
                })()}
                <button
                  className="primary big"
                  onClick={() => update(finishInteractiveRace(game))}
                >
                  CALCULER LE RÉSULTAT <Flag />
                </button>
              </section>
            )}
            {state.log.length > 0 && (
              <div className="race-last-event">
                <span className="eyebrow">DERNIÈRE DÉCISION</span>
                <b>{state.log.at(-1)?.text}</b>
                <span>{state.log.at(-1)?.consequence}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Dashboard({
  game,
  setGame,
  onReset,
}: {
  game: GameState;
  setGame: (g: GameState) => void;
  onReset: () => void;
}) {
  const [tab, setTab] = useState<Tab>("dashboard"),
    [racing, setRacing] = useState<string>(),
    [strategy, setStrategy] = useState<RaceStrategy>("normal");
  const available = game.calendar.find((r) => r.status === "available"),
    next = game.calendar.find((r) => r.status !== "completed"),
    update = (value: GameState) => {
      setGame(value);
      saveGame(value);
    },
    runRace = () => {
      if (racing) {
        update(beginInteractiveRace(game, racing, strategy));
        setRacing(undefined);
      }
    };
  const summary = seasonSummary(game),
    contract = game.career.contract!;
  return (
    <div className="shell">
      <aside>
        <div className="logo">
          <Bike />
          <b>C/C</b>
        </div>
        <nav>
          {(
            [
              ["dashboard", Gauge, "Dashboard"],
              ["training", Activity, "Entraînement"],
              ["races", Flag, "Courses"],
              ["calendar", CalendarDays, "Calendrier"],
              ["team", Building2, "Équipe"],
              ["world", Globe2, "Peloton"],
              ["rider", UserRound, "Coureur"],
            ] as const
          ).map(([id, Icon, label]) => (
            <button
              key={id}
              className={tab === id ? "active" : ""}
              onClick={() => setTab(id)}
            >
              <Icon />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="aside-bottom">
          <button onClick={() => saveGame(game)}>
            <Save />
            <span>Sauvegarder</span>
          </button>
          <button onClick={onReset}>
            <Trash2 />
            <span>Nouvelle carrière</span>
          </button>
        </div>
      </aside>
      <main className="main">
        <header>
          <div>
            <span className="eyebrow">
              {new Date(game.currentDate + "T12:00")
                .toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })
                .toUpperCase()}
            </span>
            <h2>
              {tab === "team"
                ? "Mon équipe"
                : tab === "world"
                  ? "Monde du cyclisme"
                  : tab === "rider"
                    ? "Mon coureur"
                    : tab === "training"
                      ? "Entraînement"
                      : tab === "calendar"
                        ? "Calendrier"
                        : tab === "races"
                          ? "Courses"
                          : "Journée du coureur"}
            </h2>
          </div>
        </header>
        {tab === "dashboard" && (
          <>
            <section className="hero-card">
              <div className="rider-mark">
                {game.rider.firstName[0]}
                {game.rider.lastName[0]}
              </div>
              <div className="rider-title">
                <span>
                  {game.team.name} · {contract.role}
                </span>
                <h1>
                  {game.rider.firstName}
                  <br />
                  <strong>{game.rider.lastName}</strong>
                </h1>
                <div className="chips">
                  <i>{game.rider.age} ANS</i>
                  <i>{profileLabels[game.rider.profile].toUpperCase()}</i>
                  <i>{careerLabels[game.career.level].toUpperCase()}</i>
                </div>
              </div>
              <div className="condition">
                <Metric label="FORME" value={game.rider.form} />
                <Metric
                  label="FATIGUE"
                  value={game.rider.fatigue}
                  tone="#ff7657"
                />
                <Metric
                  label="MORAL"
                  value={game.rider.morale}
                  tone="#6fa8ff"
                />
              </div>
            </section>
            <InjuryCard rider={game.rider} />
            {game.season.status === "completed" ? (
              <section className="panel season-end">
                <span className="eyebrow">FIN DE SAISON</span>
                <h1>{game.career.seasonEvaluation}</h1>
                <div className="season-strip">
                  <div>
                    <small>COURSES</small>
                    <b>{summary.races}</b>
                  </div>
                  <div>
                    <small>TOP 20</small>
                    <b>{summary.top20}</b>
                  </div>
                  <div>
                    <small>XP</small>
                    <b>{summary.xp}</b>
                  </div>
                  <div>
                    <small>OBJECTIFS</small>
                    <b>{summary.objectives}</b>
                  </div>
                </div>
                <button
                  className="primary big"
                  onClick={() => update(prepareNextSeasonOffers(game))}
                >
                  RECEVOIR LES OFFRES
                </button>
              </section>
            ) : (
              <section className={`today-card ${available ? "race-day" : ""}`}>
                <span className="eyebrow">AUJOURD’HUI</span>
                <h2>
                  {available
                    ? `🚴 ${available.name}`
                    : "🏋️ Entraînement ou récupération"}
                </h2>
                <p>
                  {available
                    ? "La course du jour doit être disputée."
                    : `Prochaine course : ${next?.name ?? "—"}`}
                </p>
                <button
                  className="primary"
                  onClick={() => setTab(available ? "races" : "training")}
                >
                  {available ? "VOIR LA COURSE" : "CHOISIR L’ACTIVITÉ"}
                </button>
              </section>
            )}
            <section className="season-strip">
              <div>
                <small>EXPÉRIENCE</small>
                <b>{game.rider.experience} XP</b>
              </div>
              <div>
                <small>RÉPUTATION</small>
                <b>{game.rider.reputation.toFixed(1)}</b>
              </div>
              <div>
                <small>SALAIRE</small>
                <b>{contract.monthlySalary} €/mois</b>
              </div>
              <div>
                <small>OBJECTIFS</small>
                <b>
                  {
                    contract.objectives.filter((g) => g.status === "completed")
                      .length
                  }
                  /{contract.objectives.length}
                </b>
              </div>
            </section>
          </>
        )}
        {tab === "training" && <TrainingPage game={game} update={update} />}{" "}
        {tab === "races" &&
          (available ? (
            <RaceSheet
              race={available}
              rider={game.rider}
              onStart={setRacing}
            />
          ) : next ? (
            <RaceSheet race={next} rider={game.rider} />
          ) : (
            <p>Saison terminée.</p>
          ))}{" "}
        {tab === "calendar" && (
          <CalendarView
            game={game}
            onRace={(id) => {
              setRacing(id);
              setTab("races");
            }}
          />
        )}
        {tab === "team" && <TeamView game={game} update={update} />}{" "}
        {tab === "world" && <WorldView game={game} />}{" "}
        {tab === "rider" && <RiderView rider={game.rider} />}
      </main>
      {game.activeRace && <InteractiveRaceModal game={game} update={update} />}
      {racing && !game.activeRace && (
        <div className="modal-back">
          <div className="modal">
            <span className="eyebrow">STRATÉGIE DE COURSE</span>
            <h2>{game.calendar.find((item) => item.id === racing)?.name}</h2>
            <div className="strategy">
              {(
                [
                  [
                    "economiser",
                    "Économiser",
                    "Fatigue et risque réduits, potentiel moindre",
                  ],
                  [
                    "normal",
                    "Normal",
                    "Équilibre entre performance, fatigue et risque",
                  ],
                  [
                    "agressif",
                    "Agressif",
                    "Potentiel, fatigue et risque accrus",
                  ],
                ] as const
              ).map((item) => (
                <button
                  className={strategy === item[0] ? "selected" : ""}
                  onClick={() => setStrategy(item[0])}
                  key={item[0]}
                >
                  <b>{item[1]}</b>
                  <small>{item[2]}</small>
                  <em>
                    Risque :{" "}
                    {(
                      injuryRisk(game.rider, {
                        kind: "race",
                        terrain: game.calendar.find((r) => r.id === racing)!
                          .terrain,
                        strategy: item[0],
                      }) * 100
                    ).toFixed(1)}{" "}
                    %
                  </em>
                </button>
              ))}
            </div>
            <button className="primary big" onClick={runRace}>
              PRENDRE LE DÉPART <Flag />
            </button>
            <button className="cancel" onClick={() => setRacing(undefined)}>
              Annuler
            </button>
          </div>
        </div>
      )}
      {game.lastResult && (
        <ResultToast
          result={game.lastResult}
          close={() => update({ ...game, lastResult: undefined })}
        />
      )}
    </div>
  );
}
export function App() {
  const [game, setGame] = useState<GameState | undefined>(() => loadGame());
  useEffect(() => {
    if (game) saveGame(game);
  }, [game]);
  if (!game) return <CreateCareer onCreate={(r) => setGame(createCareer(r))} />;
  if (!game.career.contract) return <Offers game={game} update={setGame} />;
  if (game.season.status === "completed" && game.career.offers.length)
    return <Offers game={game} update={setGame} nextSeason />;
  return (
    <Dashboard
      game={game}
      setGame={setGame}
      onReset={() => {
        if (confirm("Supprimer cette carrière et recommencer ?")) {
          deleteSave();
          setGame(undefined);
        }
      }}
    />
  );
}
