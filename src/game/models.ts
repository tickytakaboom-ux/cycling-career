export type RiderProfile = 'grimpeur' | 'puncheur' | 'sprinteur' | 'rouleur' | 'classiqueur' | 'complet';
export type Terrain = 'sprint' | 'plaine' | 'vallons' | 'montagne' | 'chrono' | 'paves';
export type TrainingType = 'recuperation' | 'endurance' | 'montagne' | 'sprint' | 'explosivite' | 'chrono' | 'technique';
export type RaceStrategy = 'economiser' | 'normal' | 'agressif';
export type RaceStatus = 'planned' | 'available' | 'completed';
export interface RiderStats { mountain:number; sprint:number; climbing:number; timeTrial:number; pavement:number; endurance:number; explosiveness:number; recovery:number; descending:number; tactics:number; resistance:number; weather:number }
export interface HiddenStats { potential:number; consistency:number; injuryResistance:number; learning:number; mental:number }
export interface Rider { id:string; firstName:string; lastName:string; nationality:string; age:number; height:number; weight:number; profile:RiderProfile; stats:RiderStats; hidden:HiddenStats; form:number; fatigue:number; morale:number; reputation:number; experience:number }
export interface Team { id:string; name:string; country:string; level:number; prestige:number; staffQuality:number; trainingQuality:number; color:string }
export interface Race { id:string; name:string; country:string; date:string; terrain:Terrain; distance:number; elevation:number; prestige:number; difficulty:number }
export interface CalendarRace extends Race { status:RaceStatus; result?:RaceResult }
export interface RaceBreakdown { base:number; form:number; fatigue:number; strategy:number; variance:number; final:number }
export interface RaceResult { raceId:string; position:number; fieldSize:number; score:number; gap:string; xpGained:number; events:string[]; breakdown:RaceBreakdown }
export interface GameState { gameVersion:number; careerId:string; currentDate:string; rider:Rider; team:Team; calendar:CalendarRace[]; selectedTraining:TrainingType; lastResult?:RaceResult }
