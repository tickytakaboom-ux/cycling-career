import type {CalendarRace,ContractOffer,GameState,RaceResult,RaceStrategy,Rider,RiderProfile,RiderStats,TrainingType} from '../game/models';
import {careerTeams} from '../data/careerTeams';
import {starterTeam} from '../data/teams';
import {raceTemplates} from '../data/races';
import {generateOpponents} from '../data/riders';
import {careerLevel,seasonSummary,updateObjectives} from '../game/career/careerProgression';
import {generateOffers,resolveOffer} from '../game/career/contracts';
import {fieldRange,generateTeamCalendar} from '../game/career/teams';
import {fatigueConfig,injuryConfig,moraleConfig} from '../game/config';
import {canTrain,healOneDay,rollInjury} from '../game/injuries/injurySystem';
import {applyRaceProgression,applyTraining,recoverDay,trainingAllowed} from '../game/progression/training';
import {simulateRace} from '../game/simulation/raceSimulation';
import type {RandomSource} from '../game/simulation/random';
import {generateWeather} from '../game/weather/weather';

export const SAVE_KEY='cycling-career-v1';
const GAME_VERSION=3;
const iso=(date:Date)=>date.toISOString().slice(0,10),toDate=(date:string)=>new Date(`${date}T12:00:00`);
const addDays=(date:string,days:number)=>{const next=toDate(date);next.setDate(next.getDate()+days);return iso(next)};
const daysBetween=(from:string,to:string)=>Math.max(0,Math.round((+toDate(to)-+toDate(from))/86400000));
const updateStatuses=(calendar:CalendarRace[],currentDate:string)=>calendar.map(race=>({...race,status:race.status==='completed'?'completed':race.date===currentDate?'available':'planned'} as CalendarRace));
const advanceRiderDay=(rider:Rider,rest:boolean)=>healOneDay(rest?recoverDay(rider):rider);
const recoverAcrossDays=(rider:Rider,days:number)=>{let value=rider;for(let day=0;day<days;day++)value=advanceRiderDay(value,true);return value};
const season=(year=2027)=>({year,startDate:`${year}-02-01`,endDate:`${year}-11-30`,status:'active' as const});
const unaffiliated={...careerTeams[0],id:'unaffiliated',name:'Sans équipe',roster:[]};

export function createCareer(rider:Rider):GameState{const current=season();return {gameVersion:GAME_VERSION,careerId:crypto.randomUUID(),currentDate:current.startDate,season:current,rider,team:unaffiliated,career:{level:1,balance:0,totalEarnings:0,offers:generateOffers(rider,current.year)},selectedTraining:'endurance',calendar:[]}}

// Compatibilité de l'API V1.3 : les tests et anciennes intégrations obtiennent une saison directement jouable.
export function createGame(rider:Rider):GameState{const start='2027-02-01',contract={...resolveOffer(generateOffers(rider)[2]??generateOffers(rider)[0]).contract};return {gameVersion:GAME_VERSION,careerId:crypto.randomUUID(),currentDate:start,season:season(),rider,team:starterTeam,career:{level:1,balance:0,totalEarnings:0,offers:[],contract},selectedTraining:'endurance',calendar:raceTemplates.map((race,index)=>({...race,date:addDays(start,index*12+7),status:'planned',competitionLevel:2,weather:generateWeather(race),maxAltitude:race.terrain==='montagne'?1850+index*110:350+index*60}))}}

export function signContract(game:GameState,offerId:string):GameState{const offer=game.career.offers.find(item=>item.id===offerId);if(!offer)return {...game,notice:'Cette offre n’est plus disponible.'};const {team,contract}=resolveOffer(offer);return {...game,team,career:{...game.career,contract,offers:[]},calendar:generateTeamCalendar(team,game.season.year),notice:`Contrat signé avec ${team.name}. Votre première saison commence.`}}
export function saveGame(game:GameState){localStorage.setItem(SAVE_KEY,JSON.stringify(game))}
function defaultPotentials(stats:RiderStats){const potentials={} as RiderStats;Object.entries(stats).forEach(([key,value])=>potentials[key as keyof RiderStats]=Math.min(96,value+22));return potentials}
function migrateResult(result:Partial<RaceResult>|undefined):RaceResult|undefined{if(!result)return undefined;return {...result,reputationGained:result.reputationGained??.05,moraleChange:result.moraleChange??0,strategy:result.strategy??'normal',fatigueCost:result.fatigueCost??16,strategySummary:result.strategySummary??'Plan équilibré.',events:result.events??[]} as RaceResult}
export function migrateGame(saved:GameState):GameState{
 const legacyProfile=saved.rider.profile as RiderProfile|'complet';const profile:RiderProfile=legacyProfile==='complet'||legacyProfile==='etapes'?'rouleur':legacyProfile==='classiqueur'?'baroudeur':legacyProfile;
 const legacyHidden=saved.rider.hidden as Rider['hidden']&{potential?:number};const hidden={...legacyHidden,potentials:legacyHidden.potentials??defaultPotentials(saved.rider.stats)};
 const legacyTeam=saved.team??starterTeam;const team=careerTeams.find(item=>item.id===legacyTeam.id)??{...starterTeam,...legacyTeam};
 const calendar=(saved.calendar??[]).map(race=>({...race,competitionLevel:race.competitionLevel??Math.min(4,Math.max(1,Math.round(race.prestige/20))) as 1|2|3|4,weather:race.weather??generateWeather(race),result:migrateResult(race.result)}));
 const earliest=calendar.filter(race=>race.status!=='completed').sort((a,b)=>a.date.localeCompare(b.date))[0],currentDate=earliest&&earliest.date<saved.currentDate?earliest.date:saved.currentDate;
 const contract=saved.career?.contract??resolveOffer(generateOffers(saved.rider)[0]).contract;
 const career=saved.career??{level:careerLevel(saved.rider.reputation,saved.rider.experience),balance:0,totalEarnings:0,offers:[],contract};
 return {...saved,gameVersion:GAME_VERSION,currentDate,season:saved.season??season(),rider:{...saved.rider,profile,hidden},team,career:{...career,level:careerLevel(saved.rider.reputation,saved.rider.experience)},calendar:updateStatuses(calendar,currentDate)};
}
export function loadGame():GameState|undefined{try{const raw=localStorage.getItem(SAVE_KEY);if(!raw)return;return migrateGame(JSON.parse(raw) as GameState)}catch{return undefined}}
export function deleteSave(){localStorage.removeItem(SAVE_KEY)}
function salaryForDate(game:GameState,date:string){if(!game.career.contract)return game;const month=date.slice(0,7);if(game.lastSalaryMonth===month)return game;const salary=game.career.contract.monthlySalary;return {...game,lastSalaryMonth:month,career:{...game.career,balance:game.career.balance+salary,totalEarnings:game.career.totalEarnings+salary}}}
export function nextDay(game:GameState):GameState{if(game.calendar.some(race=>race.status==='available'))return {...game,notice:'Une course est prévue aujourd’hui. Vous devez la disputer avant de continuer.'};const currentDate=addDays(game.currentDate,1),rider=advanceRiderDay(game.rider,true);return salaryForDate({...game,currentDate,rider,notice:'Journée de repos : fatigue réduite et forme légèrement améliorée.',calendar:updateStatuses(game.calendar,currentDate)},currentDate)}
export function trainingBlockReason(game:GameState,type:TrainingType){if(!game.career.contract)return 'Signez un contrat avant de commencer la saison.';if(game.calendar.some(race=>race.status==='available'))return 'Une course est prévue aujourd’hui.';if(game.lastTrainingDate===game.currentDate)return 'Une activité a déjà été effectuée aujourd’hui.';if(!canTrain(game.rider,type))return `Votre blessure (${game.rider.injury?.name}) interdit cette séance.`;if(!trainingAllowed(game.rider,type))return `Fatigue trop élevée : cette séance dépasserait le seuil de ${fatigueConfig.trainingLimit}. Le repos est recommandé.`;return undefined}
export function train(game:GameState,type:TrainingType,random:RandomSource=Math.random):GameState{const reason=trainingBlockReason(game,type);if(reason)return {...game,notice:reason};const trained=applyTraining(game.rider,type,game.team.trainingQuality/65),injury=rollInjury(trained,game.currentDate,{kind:'training',type},random),morale=injury?Math.max(0,trained.morale-moraleConfig.injuryLoss[injury.severity]):trained.morale,rider=advanceRiderDay({...trained,morale,injury:injury??trained.injury},false),currentDate=addDays(game.currentDate,1);return salaryForDate({...game,currentDate,rider,lastTrainingDate:game.currentDate,notice:injury?`Séance terminée, mais ${injury.name} détectée (${injury.daysRemaining} jours).`:`Séance terminée. Fatigue +${trained.fatigue-game.rider.fatigue}; progression enregistrée.`,calendar:updateStatuses(game.calendar,currentDate)},currentDate)}
export function race(game:GameState,raceId:string,strategy:RaceStrategy,random:RandomSource=Math.random):GameState{const target=game.calendar.find(item=>item.id===raceId);if(!target||target.status!=='available'||target.date!==game.currentDate)return {...game,notice:'Cette course ne peut être disputée qu’à sa date prévue.'};const range=fieldRange(target.competitionLevel??game.team.level),field=generateOpponents((range.average[0]+range.average[1])/2),result=simulateRace(game.rider,field,target,strategy,random),afterRace=applyRaceProgression(game.rider,result,target),currentDate=addDays(game.currentDate,1),rider=advanceRiderDay(afterRace,false),calendar=game.calendar.map(item=>item.id===raceId?{...item,status:'completed',result} as CalendarRace:item),objectives=updateObjectives(game.career.contract?.objectives??[],result,afterRace.reputation),allDone=calendar.every(item=>item.status==='completed'),nextCareer={...game.career,level:careerLevel(afterRace.reputation,afterRace.experience),contract:game.career.contract?{...game.career.contract,objectives}:undefined};const next={...game,currentDate,lastResult:result,rider,career:nextCareer,notice:result.injury?`Course terminée : ${result.injury.name}.`:'Course terminée.',calendar:updateStatuses(calendar,currentDate),season:allDone?{...game.season,status:'completed' as const}:game.season};return allDone?{...next,career:{...nextCareer,seasonEvaluation:seasonSummary(next).evaluation}}:next}
export function advanceToNextRace(game:GameState):GameState{if(game.calendar.some(race=>race.status==='available'))return {...game,notice:'La course du jour doit être disputée.'};const nextRace=game.calendar.filter(race=>race.status!=='completed'&&race.date>=game.currentDate).sort((a,b)=>a.date.localeCompare(b.date))[0];if(!nextRace)return game;const days=daysBetween(game.currentDate,nextRace.date),rider=recoverAcrossDays(game.rider,days);return {...game,currentDate:nextRace.date,rider,notice:`Repos automatique pendant ${days} jour${days>1?'s':''}.`,calendar:updateStatuses(game.calendar,nextRace.date)}}
export function startNextSeason(game:GameState,offerId:string):GameState{const offer=game.career.offers.find(item=>item.id===offerId);if(!offer)return game;const year=game.season.year+1,{team,contract}=resolveOffer(offer);return {...game,currentDate:`${year}-02-01`,season:season(year),team,calendar:generateTeamCalendar(team,year),career:{...game.career,contract:{...contract,startYear:year},offers:[],seasonEvaluation:undefined},rider:{...game.rider,age:game.rider.age+1},notice:`Bienvenue chez ${team.name} pour la saison ${year}.`}}
export function prepareNextSeasonOffers(game:GameState):GameState{return {...game,career:{...game.career,offers:generateOffers(game.rider,game.season.year+1)}}}
export {injuryConfig};
