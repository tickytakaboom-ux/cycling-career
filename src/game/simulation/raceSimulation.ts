import type { Race,RaceResult,RaceStrategy,Rider,RiderStats } from '../models';
import { clamp,strategyConfig,terrainWeights } from '../config';
import { gaussian,type RandomSource } from './random';

export function riderBaseScore(rider:Rider,race:Race) {
  return Object.entries(terrainWeights[race.terrain]).reduce((sum,[key,weight])=>sum+rider.stats[key as keyof RiderStats]*(weight??0),0);
}

export function performance(rider:Rider,race:Race,strategy:RaceStrategy='normal',random:RandomSource=Math.random) {
  const base=riderBaseScore(rider,race);
  const form=(rider.form-60)*.13;
  const fatigue=-rider.fatigue*.14;
  const prestigeScale=clamp((race.prestige-30)/40,0,1);
  const age=-Math.max(0,22-rider.age)*1.15*prestigeScale;
  const experience=clamp(rider.experience/900,0,2.5)*prestigeScale;
  const prestige=-Math.max(0,race.prestige-55)*.035;
  const strategyEffect=strategyConfig[strategy];
  const consistency=(rider.hidden.consistency-50)/50;
  const variance=gaussian(random)*(3.5-consistency)*strategyEffect.variance;
  const final=clamp(base+form+fatigue+age+experience+prestige+strategyEffect.performance+variance,1,100);
  return {base,form,fatigue,age,experience,prestige,strategy:strategyEffect.performance,variance,final};
}

export function simulateRace(player:Rider,field:Rider[],race:Race,strategy:RaceStrategy='normal',random:RandomSource=Math.random):RaceResult {
  const playerScore=performance(player,race,strategy,random);
  const scores=field.map(rider=>performance(rider,race,'normal',random).final);
  const position=1+scores.filter(score=>score>playerScore.final).length;
  const strategyEffect=strategyConfig[strategy];
  const xpGained=Math.max(6,18-Math.floor(position/3)+Math.round(race.prestige/12));
  const reputationGained=position===1?race.prestige/18:position<=3?race.prestige/35:position<=10?race.prestige/100:.05;
  const dayEvent=playerScore.variance>2.5?'Une journée exceptionnelle vous a permis de dépasser les attentes.':playerScore.variance<-2.5?'Un jour sans vous a coûté plusieurs places.':'Votre performance correspond au niveau attendu aujourd’hui.';
  return {raceId:race.id,position,fieldSize:field.length+1,score:+playerScore.final.toFixed(1),gap:position===1?'—':`+ ${Math.max(4,Math.round((Math.max(...scores)-playerScore.final)*9))} s`,xpGained,reputationGained:+reputationGained.toFixed(2),strategy,fatigueCost:strategyEffect.fatigue,strategySummary:strategyEffect.summary,events:[strategyEffect.summary,dayEvent],breakdown:playerScore};
}
