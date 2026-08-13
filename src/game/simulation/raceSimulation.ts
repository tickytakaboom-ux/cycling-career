import type { Race,RaceResult,RaceStrategy,Rider,RiderStats } from '../models';
import { clamp,fatigueConfig,moraleConfig,raceConfig,strategyConfig,terrainWeights } from '../config';
import { injuryRisk,rollInjury } from '../injuries/injurySystem';
import { gaussian,type RandomSource } from './random';

export function riderBaseScore(rider:Rider,race:Race) {
  return Object.entries(terrainWeights[race.terrain]).reduce((sum,[key,weight])=>sum+rider.stats[key as keyof RiderStats]*(weight??0),0);
}

export function performance(rider:Rider,race:Race,strategy:RaceStrategy='normal',random:RandomSource=Math.random) {
  const base=riderBaseScore(rider,race);
  const formFactor=1+(rider.form-50)/50*raceConfig.formImpact;
  const fatigueFactor=1-(rider.fatigue/100)*raceConfig.fatigueMaxPenalty;
  const moraleFactor=1+((rider.morale-moraleConfig.neutral)/50)*moraleConfig.performanceRange;
  const prestigeScale=clamp((race.prestige-raceConfig.prestigeThreshold)/40,0,1);
  const age=-Math.max(0,22-rider.age)*raceConfig.agePenaltyPerYear*prestigeScale;
  const experience=clamp(rider.experience/raceConfig.experienceScale,0,raceConfig.experienceMaxBonus)*prestigeScale;
  const prestige=-Math.max(0,race.prestige-55)*.03;
  const injuryPenalty=rider.injury?-base*rider.injury.performancePenalty:0;
  const strategyEffect=strategyConfig[strategy];
  const consistency=(rider.hidden.consistency-50)/50;
  const variance=gaussian(random)*(raceConfig.randomStdDev-consistency)*strategyEffect.variance;
  const adjustedBase=base*formFactor*fatigueFactor*moraleFactor;
  const final=clamp(adjustedBase+age+experience+prestige+injuryPenalty+strategyEffect.performance+variance,1,100);
  return {base,form:base*(formFactor-1),fatigue:base*(fatigueFactor-1),morale:base*(moraleFactor-1),age,experience,prestige,injury:injuryPenalty,strategy:strategyEffect.performance,variance,final};
}

function moraleChange(position:number,fieldSize:number) {
  if(position===1)return moraleConfig.resultChanges.win;
  if(position<=3)return moraleConfig.resultChanges.podium;
  if(position<=10)return moraleConfig.resultChanges.top10;
  if(position/fieldSize>.85)return moraleConfig.resultChanges.poor;
  return moraleConfig.resultChanges.expected;
}

export function simulateRace(player:Rider,field:Rider[],race:Race,strategy:RaceStrategy='normal',random:RandomSource=Math.random):RaceResult {
  const playerScore=performance(player,race,strategy,random),scores=field.map(rider=>performance(rider,race,'normal',random).final);
  const position=1+scores.filter(score=>score>playerScore.final).length,fieldSize=field.length+1,strategyEffect=strategyConfig[strategy];
  const fatigueCost=Math.round((fatigueConfig.raceBaseCost+race.distance/fatigueConfig.distanceCostDivisor+race.difficulty/fatigueConfig.difficultyCostDivisor)*strategyEffect.fatigueMultiplier);
  const resultBonus=Math.max(0,raceConfig.xp.resultMax-position/2);
  const xpGained=Math.round(raceConfig.xp.base+race.distance/raceConfig.xp.distanceDivisor+race.prestige/raceConfig.xp.prestigeDivisor+resultBonus);
  const reputationGained=position===1?race.prestige/raceConfig.reputationDivisors.win:position<=3?race.prestige/raceConfig.reputationDivisors.podium:position<=10?race.prestige/raceConfig.reputationDivisors.top10:.04;
  const injury=rollInjury(player,race.date,{kind:'race',terrain:race.terrain,aggressive:strategy==='agressif'},random);
  const risk=injuryRisk(player,{kind:'race',terrain:race.terrain,aggressive:strategy==='agressif'});
  const dayEvent=playerScore.variance>2.5?'Une journée exceptionnelle vous a permis de dépasser les attentes.':playerScore.variance<-2.5?'Un jour sans vous a coûté plusieurs places.':'Votre performance correspond au niveau attendu aujourd’hui.';
  const events=[strategyEffect.summary,`Fatigue de course : +${fatigueCost}. Risque de blessure estimé : ${(risk*100).toFixed(1)} %.`,dayEvent];
  if(injury)events.push(`Blessure : ${injury.name} (${injury.daysRemaining} jours estimés).`);
  return {raceId:race.id,position,fieldSize,score:+playerScore.final.toFixed(1),gap:position===1?'—':`+ ${Math.max(4,Math.round((Math.max(...scores)-playerScore.final)*9))} s`,xpGained,reputationGained:+reputationGained.toFixed(2),moraleChange:moraleChange(position,fieldSize),strategy,fatigueCost,strategySummary:strategyEffect.summary,injury,events,breakdown:playerScore};
}
