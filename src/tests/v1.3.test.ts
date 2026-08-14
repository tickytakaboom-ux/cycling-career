import { describe,expect,it } from 'vitest';
import { createRider } from '../data/riders';
import { generateWeather,weatherEffect } from '../game/weather/weather';
import { trainingPreview,restPreview } from '../game/progression/previews';
import { performance } from '../game/simulation/raceSimulation';
import { advanceToNextRace,createGame,nextDay,trainingBlockReason } from '../state/gameStore';
import type { Race,WeatherConditions } from '../game/models';

const rider=()=>createRider({firstName:'Julian',lastName:'Test',nationality:'France',height:178,weight:66,profile:'grimpeur'});
const conditions=(override:Partial<WeatherConditions>={}):WeatherConditions=>({temperature:17,windSpeed:8,windDirection:'tailwind',rain:'none',humidity:55,cloudCover:40,...override});
const race=(weather:WeatherConditions):Race=>({id:'test-race',name:'Course test',country:'France',date:'2027-02-08',terrain:'montagne',distance:160,elevation:3200,difficulty:65,prestige:50,maxAltitude:1800,weather});

describe('météo V1.3',()=>{
  it('génère une météo déterministe et complète',()=>{const a=generateWeather({id:'alpha',terrain:'montagne'}),b=generateWeather({id:'alpha',terrain:'montagne'});expect(a).toEqual(b);expect(a.temperature).toBeTypeOf('number');expect(a.windDirection).toBeDefined()});
  it('la météo normale a un impact faible',()=>expect(Math.abs(weatherEffect(rider(),race(conditions())).modifier)).toBeLessThan(1));
  it('la chaleur et le froid pénalisent la performance',()=>{expect(weatherEffect(rider(),race(conditions({temperature:34}))).modifier).toBeLessThan(0);expect(weatherEffect(rider(),race(conditions({temperature:2}))).modifier).toBeLessThan(0)});
  it('différencie vent de face, arrière et latéral',()=>{const head=weatherEffect(rider(),race(conditions({windSpeed:28,windDirection:'headwind'}))).modifier,tail=weatherEffect(rider(),race(conditions({windSpeed:28,windDirection:'tailwind'}))).modifier,cross=weatherEffect(rider(),race(conditions({windSpeed:28,windDirection:'crosswind'}))).modifier;expect(head).toBeLessThan(tail);expect(cross).toBeLessThan(tail)});
  it('la caractéristique météo réduit les conditions difficiles',()=>{const base=rider(),adapted={...base,stats:{...base.stats,weather:90}},poor={...base,stats:{...base.stats,weather:20}},hard=race(conditions({temperature:34,windSpeed:30,windDirection:'headwind',rain:'heavy'}));expect(weatherEffect(adapted,hard).modifier).toBeGreaterThan(weatherEffect(poor,hard).modifier)});
  it('l’impact météo reste borné et non excessif',()=>{const hard=race(conditions({temperature:40,windSpeed:50,windDirection:'headwind',rain:'heavy'})),effect=weatherEffect(rider(),hard).modifier;expect(effect).toBeGreaterThanOrEqual(-3);expect(effect).toBeLessThanOrEqual(2);const normalScore=performance(rider(),race(conditions()),'normal',()=>.25).final,hardScore=performance(rider(),hard,'normal',()=>.25).final;expect(normalScore-hardScore).toBeLessThanOrEqual(3)});
});

describe('informations et journée V1.3',()=>{
  it('une course contient toutes les informations de fiche',()=>{const game=createGame(rider()),item=game.calendar[0];expect(item.distance).toBeGreaterThan(0);expect(item.elevation).toBeGreaterThanOrEqual(0);expect(item.difficulty).toBeGreaterThan(0);expect(item.prestige).toBeGreaterThan(0);expect(item.maxAltitude).toBeDefined();expect(item.weather).toBeDefined()});
  it('calcule les conséquences estimées d’une séance',()=>{const game=createGame(rider()),preview=trainingPreview(game.rider,'montagne',game.team.trainingQuality/65);expect(preview.fatigueChange).toBe(14);expect(preview.formChange).toBeLessThan(0);expect(preview.gains.find(g=>g.stat==='mountain')?.gain).toBeGreaterThan(0);expect(preview.risk).toBeGreaterThan(0)});
  it('affiche une incompatibilité de blessure avant séance',()=>{const game=createGame(rider()),injured={...game,rider:{...game.rider,injury:{id:'x',name:'Lésion',severity:'serious' as const,startDate:game.currentDate,endDate:'2027-03-01',daysRemaining:20,trainingRestriction:'blocked' as const,performancePenalty:.16}}};expect(trainingBlockReason(injured,'montagne')).toContain('interdit')});
  it('prévoit et applique la récupération automatique',()=>{const game=createGame({...rider(),fatigue:60,form:55}),preview=restPreview(game.rider),rested=nextDay(game);expect(preview.fatigueAfter).toBeLessThan(preview.fatigueBefore);expect(rested.rider.fatigue).toBeCloseTo(preview.fatigueAfter)});
  it('une course bloque toujours l’avancement',()=>{const ready=advanceToNextRace(createGame(rider()));expect(ready.calendar[0].status).toBe('available');expect(nextDay(ready).currentDate).toBe(ready.currentDate)});
});
