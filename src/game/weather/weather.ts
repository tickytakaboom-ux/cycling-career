import type { Race, Rider, WeatherConditions, WindDirection } from '../models';
import { clamp } from '../config';

const directions:WindDirection[]=['headwind','tailwind','crosswind'];
const hash=(value:string)=>[...value].reduce((sum,char)=>((sum*31+char.charCodeAt(0))>>>0),7);

export function generateWeather(race:Pick<Race,'id'|'terrain'>):WeatherConditions {
  const seed=hash(race.id);
  const temperature=6+(seed%23),windSpeed=5+((seed>>3)%31),windDirection=directions[(seed>>6)%3];
  const rainRoll=(seed>>8)%100,rain=rainRoll<48?'none':rainRoll<73?'light':rainRoll<92?'moderate':'heavy';
  return {temperature,windSpeed,windDirection,rain,humidity:45+((seed>>10)%51),cloudCover:20+((seed>>12)%81)};
}

export function weatherEffect(rider:Rider,race:Race) {
  const weather=race.weather??generateWeather(race),adaptation=(rider.stats.weather-50)/50;
  let raw=0;const reasons:string[]=[];
  if(weather.temperature<10){raw-=(10-weather.temperature)*.06;reasons.push('Le froid rend l’effort plus exigeant.')}else if(weather.temperature>25){raw-=(weather.temperature-25)*.07;reasons.push('La chaleur augmente la contrainte physique.')}else reasons.push('Température favorable.');
  if(weather.windSpeed>=15){const strength=(weather.windSpeed-10)/20;if(weather.windDirection==='headwind'){raw-=strength*(1.2-(rider.stats.endurance-50)/100);reasons.push('Vent de face : l’endurance est déterminante.')}if(weather.windDirection==='tailwind'){raw+=strength*.45;reasons.push('Vent arrière légèrement favorable.')}if(weather.windDirection==='crosswind'){raw-=strength*(1.1-((rider.stats.tactics+rider.stats.resistance)/2-50)/100);reasons.push('Vent latéral : tactique et résistance sollicitées.')}}
  const rainPenalty={none:0,light:.25,moderate:.65,heavy:1.1}[weather.rain];if(rainPenalty){raw-=rainPenalty;reasons.push(`Pluie ${weather.rain==='light'?'faible':weather.rain==='moderate'?'modérée':'forte'} : adhérence et placement plus difficiles.`)}
  const modifier=clamp(raw*(1-adaptation*.45),-3,2);
  return {modifier,conditions:weather,reasons};
}

export const windLabels:Record<WindDirection,string>={headwind:'de face',tailwind:'arrière',crosswind:'latéral'};
export const rainLabels={none:'aucune',light:'faible',moderate:'modérée',heavy:'forte'};
