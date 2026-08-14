import type { Race, RaceResult, Rider, TrainingType } from '../models';
import { clamp,fatigueConfig,formConfig,progressionConfig,recoveryConfig,trainingConfig } from '../config';

const tableFactor=(value:number,table:{max:number;value:number}[])=>table.find(item=>value<=item.max)?.value??1;

export function trainingAllowed(rider:Rider,type:TrainingType) {
  return type==='recuperation'||rider.fatigue+trainingConfig[type].fatigue<=fatigueConfig.trainingLimit;
}

export function progressionGain(rider:Rider,type:TrainingType,stat:keyof Rider['stats'],trainingQuality=1) {
  const potential=rider.hidden.potentials[stat];
  const remaining=Math.max(0,potential-rider.stats[stat]);
  const potentialFactor=Math.max(progressionConfig.minimumPotentialFactor,(remaining/Math.max(1,potential))**1.35);
  const ageFactor=tableFactor(rider.age,progressionConfig.ageFactors);
  const fatigueFactor=tableFactor(rider.fatigue,progressionConfig.fatigueFactors);
  const learning=.8+rider.hidden.learning/250;
  const experience=1+Math.min(progressionConfig.experienceFactorMax,rider.experience/15000);
  return progressionConfig.baseGain*potentialFactor*ageFactor*fatigueFactor*trainingQuality*trainingConfig[type].specialization*learning*experience;
}

export function applyTraining(rider:Rider,type:TrainingType,trainingQuality=1):Rider {
  if(type==='recuperation'||!trainingAllowed(rider,type))return rider;
  const config=trainingConfig[type],stats={...rider.stats};
  config.stats.forEach(stat=>stats[stat]=clamp(Math.min(rider.hidden.potentials[stat],stats[stat]+progressionGain(rider,type,stat,trainingQuality))));
  return {...rider,stats,fatigue:clamp(rider.fatigue+config.fatigue,fatigueConfig.minimum,fatigueConfig.maximum),form:clamp(rider.form+config.form,formConfig.minimum,formConfig.maximum)};
}

export function recoverDay(rider:Rider):Rider {
  const fatigueRatio=rider.fatigue/100;
  const recovery=Math.min(recoveryConfig.maximumDaily,recoveryConfig.base+fatigueRatio*recoveryConfig.highFatigueBonus+rider.stats.recovery/recoveryConfig.recoveryStatDivisor);
  const formGain=rider.form>=formConfig.highFormThreshold?-formConfig.highFormDecay:formConfig.restGain*(1-rider.form/formConfig.maximum);
  return {...rider,fatigue:clamp(rider.fatigue-recovery,fatigueConfig.minimum,fatigueConfig.maximum),form:clamp(rider.form+formGain,formConfig.minimum,formConfig.maximum)};
}

export function applyRaceProgression(rider:Rider,result:RaceResult,race:Race):Rider {
  const stats={...rider.stats};
  const key=(rider.profile==='sprinteur'?'sprint':rider.profile==='rouleur'?'timeTrial':rider.profile==='classiqueur'?'pavement':rider.profile==='puncheur'?'explosiveness':rider.profile==='etapes'?'endurance':'mountain') as keyof typeof stats;
  stats[key]=Math.min(rider.hidden.potentials[key],clamp(stats[key]+result.xpGained/650));
  return {...rider,stats,experience:rider.experience+result.xpGained,reputation:clamp(rider.reputation+result.reputationGained),fatigue:clamp(rider.fatigue+result.fatigueCost),form:clamp(rider.form-(race.difficulty/100)*formConfig.raceDifficultyLoss,formConfig.minimum,formConfig.maximum),injury:result.injury??rider.injury};
}
