export type RiderProfile = 'grimpeur' | 'puncheur' | 'sprinteur' | 'rouleur' | 'baroudeur' | 'classiqueur' | 'etapes';
export type Terrain = 'sprint' | 'plaine' | 'vallons' | 'montagne' | 'chrono' | 'paves';
export type TrainingType = 'recuperation' | 'endurance' | 'montagne' | 'sprint' | 'explosivite' | 'chrono' | 'technique';
export type RaceStrategy = 'economiser' | 'normal' | 'agressif';
export type RaceStatus = 'planned' | 'available' | 'completed';
export type InjurySeverity = 'minor' | 'moderate' | 'serious' | 'severe';
export type WindDirection = 'headwind' | 'tailwind' | 'crosswind';
export type RainLevel = 'none' | 'light' | 'moderate' | 'heavy';
export interface WeatherConditions { temperature:number; windSpeed:number; windDirection:WindDirection; rain:RainLevel; humidity:number; cloudCover:number }

export interface RiderStats { mountain:number; sprint:number; climbing:number; timeTrial:number; pavement:number; endurance:number; explosiveness:number; recovery:number; descending:number; tactics:number; resistance:number; weather:number }
export interface HiddenStats { potentials:RiderStats; consistency:number; injuryResistance:number; learning:number; mental:number }
export interface Injury { id:string; name:string; severity:InjurySeverity; startDate:string; endDate:string; daysRemaining:number; trainingRestriction:'none'|'light-only'|'blocked'; performancePenalty:number }
export interface Rider { id:string; firstName:string; lastName:string; nationality:string; age:number; height:number; weight:number; profile:RiderProfile; stats:RiderStats; hidden:HiddenStats; form:number; fatigue:number; morale:number; reputation:number; experience:number; injury?:Injury }
export type TeamLevel=1|2|3|4;
export type TeamRole='Jeune espoir'|'Équipier'|'Coureur protégé'|'Leader';
export type CareerLevel=1|2|3|4|5;
export interface TeamMate { id:string; name:string; age:number; profile:RiderProfile; level:number; role:TeamRole }
export interface Team { id:string; name:string; country:string; level:TeamLevel; prestige:number; budget:number; staffQuality:number; trainingQuality:number; medicalQuality:number; recoveryQuality:number; specialties:string[]; calendarSize:number; averageRiderLevel:number; color:string; roster:TeamMate[] }
export interface Race { id:string; name:string; country:string; date:string; terrain:Terrain; distance:number; elevation:number; prestige:number; difficulty:number; competitionLevel?:TeamLevel; maxAltitude?:number; weather?:WeatherConditions }
export interface CalendarRace extends Race { status:RaceStatus; result?:RaceResult }
export interface RaceBreakdown { base:number; form:number; fatigue:number; morale:number; age:number; experience:number; prestige:number; injury:number; weather:number; strategy:number; variance:number; final:number }
export interface RaceResult { raceId:string; position:number; fieldSize:number; score:number; gap:string; xpGained:number; reputationGained:number; moraleChange:number; strategy:RaceStrategy; fatigueCost:number; strategySummary:string; injury?:Injury; events:string[]; breakdown:RaceBreakdown }
export interface SeasonState { year:number; startDate:string; endDate:string; status:'active'|'completed' }
export type ObjectiveType='races'|'top20'|'top10-terrain'|'reputation';
export interface ContractObjective { id:string; label:string; type:ObjectiveType; target:number; terrain?:Terrain; progress:number; status:'active'|'completed'|'failed' }
export interface Contract { id:string; teamId:string; startYear:number; durationYears:number; monthlySalary:number; role:TeamRole; calendarDescription:string; opponentDescription:string; developmentRating:string; objectives:ContractObjective[] }
export interface ContractOffer { id:string; teamId:string; contract:Contract; interestScore:number }
export interface CareerState { level:CareerLevel; balance:number; totalEarnings:number; contract?:Contract; offers:ContractOffer[]; seasonEvaluation?:string }
export interface GameState { gameVersion:number; careerId:string; currentDate:string; season:SeasonState; rider:Rider; team:Team; career:CareerState; calendar:CalendarRace[]; selectedTraining:TrainingType; lastTrainingDate?:string; lastSalaryMonth?:string; notice?:string; lastResult?:RaceResult }
