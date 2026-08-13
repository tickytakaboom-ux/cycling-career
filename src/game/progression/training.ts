import type { Race, RaceResult, Rider, TrainingType } from '../models';
import { clamp,trainingConfig } from '../config';

function progressionGain(rider:Rider,statValue:number) {
  const learning=.035+rider.hidden.learning/2100;
  const potentialRoom=clamp((rider.hidden.potential-statValue)/35,.25,1.15);
  const freshness=clamp(1-rider.fatigue/115,.2,1);
  const ageFactor=rider.age<=20?1:rider.age<=24?.9:rider.age<=29?.7:.45;
  return learning*potentialRoom*freshness*ageFactor;
}

export function applyTraining(rider:Rider,type:TrainingType):Rider {
  const config=trainingConfig[type];
  if(type==='recuperation') return {...rider,fatigue:clamp(rider.fatigue+config.fatigue,4,100),form:clamp(rider.form+config.form,45,88)};
  const stats={...rider.stats};
  config.stats.forEach(key=>stats[key]=clamp(stats[key]+progressionGain(rider,stats[key])));
  const fatiguePenalty=Math.max(0,rider.fatigue-45)*.035;
  return {...rider,stats,fatigue:clamp(rider.fatigue+config.fatigue,4,100),form:clamp(rider.form+config.form-fatiguePenalty,45,88)};
}

export function recoverDay(rider:Rider):Rider {
  const fatigueRecovery=2.5+rider.stats.recovery/35;
  const formChange=rider.form>76?-.65:rider.form<56?.2:-.15;
  return {...rider,fatigue:clamp(rider.fatigue-fatigueRecovery,4,100),form:clamp(rider.form+formChange,45,88)};
}

export function applyRaceProgression(rider:Rider,result:RaceResult,race:Race):Rider {
  const stats={...rider.stats};
  const key=(rider.profile==='sprinteur'?'sprint':rider.profile==='rouleur'?'timeTrial':rider.profile==='classiqueur'?'pavement':rider.profile==='puncheur'?'explosiveness':rider.profile==='etapes'?'endurance':'mountain') as keyof typeof stats;
  stats[key]=clamp(stats[key]+result.xpGained/450);
  return {...rider,stats,experience:rider.experience+result.xpGained,reputation:clamp(rider.reputation+result.reputationGained),fatigue:clamp(rider.fatigue+result.fatigueCost),form:clamp(rider.form-(race.difficulty/100)*2.5,45,88)};
}
