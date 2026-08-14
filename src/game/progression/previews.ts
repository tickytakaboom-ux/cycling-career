import type { Rider, TrainingType } from '../models';
import { injuryRisk } from '../injuries/injurySystem';
import { applyTraining,progressionGain,recoverDay } from './training';
import { trainingConfig } from '../config';

export function trainingPreview(rider:Rider,type:TrainingType,trainingQuality=1) {
  const after=applyTraining(rider,type,trainingQuality);
  return {type,label:trainingConfig[type].label,fatigueChange:after.fatigue-rider.fatigue,formChange:after.form-rider.form,risk:injuryRisk(after,{kind:'training',type}),gains:trainingConfig[type].stats.map(stat=>({stat,gain:progressionGain(rider,type,stat,trainingQuality)}))};
}
export function restPreview(rider:Rider) {const after=recoverDay(rider);return {fatigueBefore:rider.fatigue,fatigueAfter:after.fatigue,formBefore:rider.form,formAfter:after.form,moraleBefore:rider.morale,moraleAfter:after.morale,injuryDaysBefore:rider.injury?.daysRemaining,injuryDaysAfter:rider.injury?Math.max(0,rider.injury.daysRemaining-1):undefined}}
