export type RiderProfile =
  | "grimpeur"
  | "puncheur"
  | "sprinteur"
  | "rouleur"
  | "baroudeur"
  | "classiqueur"
  | "etapes";
export type Terrain =
  "sprint" | "plaine" | "vallons" | "montagne" | "chrono" | "paves";
export type TrainingType =
  | "recuperation"
  | "endurance"
  | "montagne"
  | "sprint"
  | "explosivite"
  | "chrono"
  | "technique";
export type RaceStrategy = "economiser" | "normal" | "agressif";
export type InteractiveRaceChoice =
  "attack" | "follow" | "conserve" | "teamwork";
export type InteractivePhaseKind =
  | "start"
  | "breakaway"
  | "difficulty"
  | "descent"
  | "feed"
  | "finale"
  | "sprint";
export type RaceStatus = "planned" | "available" | "completed";
export type InjurySeverity = "minor" | "moderate" | "serious" | "severe";
export type WindDirection = "headwind" | "tailwind" | "crosswind";
export type RainLevel = "none" | "light" | "moderate" | "heavy";
export interface WeatherConditions {
  temperature: number;
  windSpeed: number;
  windDirection: WindDirection;
  rain: RainLevel;
  humidity: number;
  cloudCover: number;
}

export interface RiderStats {
  mountain: number;
  sprint: number;
  climbing: number;
  timeTrial: number;
  pavement: number;
  endurance: number;
  explosiveness: number;
  recovery: number;
  descending: number;
  tactics: number;
  resistance: number;
  weather: number;
}
export interface HiddenStats {
  potentials: RiderStats;
  consistency: number;
  injuryResistance: number;
  learning: number;
  mental: number;
}
export interface Injury {
  id: string;
  name: string;
  severity: InjurySeverity;
  startDate: string;
  endDate: string;
  daysRemaining: number;
  trainingRestriction: "none" | "light-only" | "blocked";
  performancePenalty: number;
}
export type MoraleCategory =
  | "race"
  | "training"
  | "rest"
  | "injury"
  | "objective"
  | "progression"
  | "contract"
  | "role"
  | "streak";
export interface MoraleEvent {
  id: string;
  date: string;
  before: number;
  after: number;
  delta: number;
  reason: string;
  category: MoraleCategory;
}
export interface Rider {
  id: string;
  firstName: string;
  lastName: string;
  nationality: string;
  age: number;
  height: number;
  weight: number;
  profile: RiderProfile;
  stats: RiderStats;
  hidden: HiddenStats;
  form: number;
  fatigue: number;
  morale: number;
  moraleHistory?: MoraleEvent[];
  moraleAppliedEventIds?: string[];
  reputation: number;
  experience: number;
  injury?: Injury;
}
export type TeamLevel = 1 | 2 | 3 | 4;
export type TeamRole =
  "Jeune espoir" | "Équipier" | "Coureur protégé" | "Leader";
export type CareerLevel = 1 | 2 | 3 | 4 | 5;
export interface TeamMate {
  id: string;
  name: string;
  age: number;
  profile: RiderProfile;
  stats: RiderStats;
  potentials: RiderStats;
  level: number;
  role: TeamRole;
  form: number;
  seasonsWithTeam: number;
}
export interface Team {
  id: string;
  name: string;
  country: string;
  level: TeamLevel;
  prestige: number;
  budget: number;
  staffQuality: number;
  trainingQuality: number;
  medicalQuality: number;
  recoveryQuality: number;
  specialties: string[];
  calendarSize: number;
  averageRiderLevel: number;
  color: string;
  roster: TeamMate[];
}
export interface Race {
  id: string;
  name: string;
  country: string;
  date: string;
  terrain: Terrain;
  distance: number;
  elevation: number;
  prestige: number;
  difficulty: number;
  competitionLevel?: TeamLevel;
  maxAltitude?: number;
  weather?: WeatherConditions;
}
export interface TeamRaceResult {
  riderId: string;
  riderName: string;
  position: number;
  score: number;
  selected: boolean;
}
export interface CalendarRace extends Race {
  status: RaceStatus;
  selectedTeamMateIds?: string[];
  teamResults?: TeamRaceResult[];
  result?: RaceResult;
}
export interface RaceBreakdown {
  base: number;
  form: number;
  fatigue: number;
  morale: number;
  age: number;
  experience: number;
  prestige: number;
  injury: number;
  weather: number;
  strategy: number;
  variance: number;
  interactive?: number;
  final: number;
}
export interface RaceResult {
  raceId: string;
  position: number;
  fieldSize: number;
  score: number;
  gap: string;
  xpGained: number;
  reputationGained: number;
  moraleChange: number;
  strategy: RaceStrategy;
  fatigueCost: number;
  strategySummary: string;
  injury?: Injury;
  events: string[];
  breakdown: RaceBreakdown;
}
export interface InteractiveRacePhase {
  id: string;
  kind: InteractivePhaseKind;
  km: number;
  title: string;
  description: string;
  keyStat: keyof RiderStats;
  intensity: number;
  situation: "steady" | "acceleration" | "technical" | "team" | "final";
}
export interface InteractiveRaceGroup {
  id: string;
  label: string;
  gapSeconds: number;
  size: number;
  kind: "breakaway" | "peloton" | "chase" | "dropped";
}
export interface InteractiveRaceLog {
  phaseId: string;
  km: number;
  choice: InteractiveRaceChoice;
  text: string;
  fatigueDelta: number;
  performanceDelta: number;
  consequence: string;
  teamImpact?: number;
  positionBefore: number;
  positionAfter: number;
}
export interface InteractiveRaceParticipant {
  riderId: string;
  name: string;
  profile: RiderProfile;
  source: "opponent" | "teamMate";
  expectedPosition: number;
  situationPosition?: number;
  situationGroup?: string;
  situationGapSeconds?: number;
  favoriteTier?: "favorite" | "contender" | "outsider";
}
export interface InteractiveRaceState {
  raceId: string;
  raceTerrain?: Terrain;
  seed: number;
  strategy: RaceStrategy;
  phaseIndex: number;
  phases: InteractiveRacePhase[];
  position: number;
  group: string;
  gapSeconds: number;
  fatigueDelta: number;
  performanceDelta: number;
  startPosition: number;
  groups: InteractiveRaceGroup[];
  participants?: InteractiveRaceParticipant[];
  teamMateId?: string;
  teamMateName?: string;
  teamMatePosition?: number;
  teamMateGroup?: string;
  teamMateGapSeconds?: number;
  teamMateAccessible?: boolean;
  teamSupport: number;
  choices: InteractiveRaceChoice[];
  log: InteractiveRaceLog[];
}
export interface SeasonState {
  year: number;
  startDate: string;
  endDate: string;
  status: "active" | "completed";
}
export type ObjectiveType = "races" | "top20" | "top10-terrain" | "reputation";
export interface ContractObjective {
  id: string;
  label: string;
  type: ObjectiveType;
  target: number;
  terrain?: Terrain;
  progress: number;
  reward: number;
  rewarded: boolean;
  status: "active" | "completed" | "failed";
}
export interface Contract {
  id: string;
  teamId: string;
  startYear: number;
  durationYears: number;
  monthlySalary: number;
  role: TeamRole;
  calendarDescription: string;
  opponentDescription: string;
  developmentRating: string;
  objectives: ContractObjective[];
}
export interface ContractOffer {
  id: string;
  teamId: string;
  contract: Contract;
  interestScore: number;
}
export interface MoraleStreak {
  top20: number;
  poor: number;
}
export interface CareerState {
  level: CareerLevel;
  balance: number;
  totalEarnings: number;
  objectiveBonuses: number;
  scoutingUnlocked: boolean;
  moraleStreak?: MoraleStreak;
  contract?: Contract;
  offers: ContractOffer[];
  seasonEvaluation?: string;
}
export interface WorldRider extends TeamMate {
  teamId: string;
  reputation: number;
  experience: number;
  seasonPoints: number;
  victories: number;
  top10: number;
  previousLevel: number;
}
export interface TransferRecord {
  riderId: string;
  riderName: string;
  fromTeamId: string;
  toTeamId: string;
  season: number;
}
export interface RetirementRecord {
  riderId: string;
  riderName: string;
  age: number;
  teamId: string;
  season: number;
}
export interface WorldRecap {
  year: number;
  champion: string;
  bestTeam: string;
  transfers: TransferRecord[];
  youngRevelations: string[];
  retirements: RetirementRecord[];
  julianEvolution: number;
}
export interface WorldState {
  year: number;
  teams: Team[];
  riders: WorldRider[];
  transfers: TransferRecord[];
  retirements: RetirementRecord[];
  youngTalentIds: string[];
  playerPreviousRating?: number;
  recap?: WorldRecap;
}
export interface GameState {
  gameVersion: number;
  careerId: string;
  currentDate: string;
  season: SeasonState;
  rider: Rider;
  team: Team;
  world: WorldState;
  career: CareerState;
  calendar: CalendarRace[];
  selectedTraining: TrainingType;
  activeRace?: InteractiveRaceState;
  lastTrainingDate?: string;
  lastSalaryMonth?: string;
  notice?: string;
  lastResult?: RaceResult;
}
