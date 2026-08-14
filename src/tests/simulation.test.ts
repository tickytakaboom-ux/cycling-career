import { describe,expect,it } from 'vitest';
import { createRider,opponents } from '../data/riders';
import { injuryRisk,rollInjury } from '../game/injuries/injurySystem';
import { applyTraining,recoverDay,trainingAllowed } from '../game/progression/training';
import { performance,riderBaseScore,simulateRace } from '../game/simulation/raceSimulation';
import { advanceToNextRace,createGame,migrateGame,nextDay,race as playRace,train } from '../state/gameStore';
import type { GameState,Race,RiderProfile } from '../game/models';

const makeRace=(terrain:Race['terrain'],prestige=50,date='2027-02-08'):Race=>({id:`${terrain}-${prestige}`,name:terrain,country:'Test',date,terrain,distance:180,elevation:terrain==='montagne'?3500:300,prestige,difficulty:60});
const make=(profile:RiderProfile='etapes')=>createRider({firstName:'Test',lastName:'Rider',nationality:'France',height:178,weight:65,profile});
const fixed=()=>.25;

describe('création, potentiels et entraînement',()=>{
  it('crée un coureur de 18 ans avec des potentiels individuels',()=>{const rider=make();expect(rider.age).toBe(18);for(const key of Object.keys(rider.stats) as (keyof typeof rider.stats)[])expect(rider.hidden.potentials[key]).toBeGreaterThan(rider.stats[key])});
  it('une séance augmente réellement la caractéristique ciblée',()=>{const rider=make('sprinteur'),trained=applyTraining(rider,'sprint');expect(trained.stats.sprint).toBeGreaterThan(rider.stats.sprint);expect(trained.stats.mountain).toBe(rider.stats.mountain)});
  it('ralentit fortement la progression près du potentiel',()=>{const rider=make('sprinteur'),farGain=applyTraining(rider,'sprint').stats.sprint-rider.stats.sprint,near={...rider,stats:{...rider.stats,sprint:rider.hidden.potentials.sprint-.2}},nearGain=applyTraining(near,'sprint').stats.sprint-near.stats.sprint;expect(farGain).toBeGreaterThan(nearGain*3)});
  it('refuse une séance dépassant le seuil de fatigue',()=>{const rider={...make(),fatigue:90};expect(trainingAllowed(rider,'chrono')).toBe(false);expect(applyTraining(rider,'chrono')).toEqual(rider)});
  it('n’autorise pas deux séances le même jour et la première passe à J+1',()=>{const game=createGame(make()),once=train(game,'endurance',()=>1),twice=train(once,'sprint',()=>1);expect(once.currentDate).toBe('2027-02-02');expect(twice.currentDate).toBe('2027-02-03');expect(twice.rider.stats.sprint).toBeGreaterThan(once.rider.stats.sprint)});
});

describe('repos, forme, fatigue et moral',()=>{
  it('le repos réduit automatiquement la fatigue sans restauration instantanée',()=>{const rider={...make(),fatigue:90,form:45},rested=recoverDay(rider);expect(rested.fatigue).toBeLessThan(90);expect(rested.fatigue).toBeGreaterThan(70);expect(rested.form).toBeGreaterThan(45);expect(rested.form).toBeLessThan(88)});
  it('la fatigue élevée réduit fortement la performance',()=>{const rider=make(),fresh={...rider,fatigue:5},tired={...rider,fatigue:90};expect(performance(fresh,makeRace('plaine'),'normal',fixed).final-performance(tired,makeRace('plaine'),'normal',fixed).final).toBeGreaterThan(6)});
  it('le moral influence légèrement la performance sans dominer le niveau',()=>{const rider=make(),low={...rider,morale:0},high={...rider,morale:100};const delta=performance(high,makeRace('plaine'),'normal',fixed).final-performance(low,makeRace('plaine'),'normal',fixed).final;expect(delta).toBeGreaterThan(3);expect(delta).toBeLessThan(10)});
});

describe('blessures',()=>{
  it('la fatigue élevée augmente le risque de blessure',()=>{const rider=make(),fresh={...rider,fatigue:10},tired={...rider,fatigue:92};expect(injuryRisk(tired,{kind:'training',type:'montagne'})).toBeGreaterThan(injuryRisk(fresh,{kind:'training',type:'montagne'}))});
  it('une blessure sérieuse bloque une activité',()=>{const rider={...make(),fatigue:95},values=[0,.9,.5],injury=rollInjury(rider,'2027-02-01',{kind:'training',type:'montagne'},()=>values.shift()??0);expect(injury).toBeDefined();const game={...createGame(rider),rider:{...rider,injury}};const result=train(game,'montagne',()=>1);expect(result.currentDate).toBe(game.currentDate);expect(result.notice).toContain('interdit')});
});

describe('courses, profils et stratégies',()=>{
  it('favorise les grimpeurs en montagne et les sprinteurs sur le plat',()=>{expect(riderBaseScore(make('grimpeur'),makeRace('montagne'))).toBeGreaterThan(riderBaseScore(make('sprinteur'),makeRace('montagne')));expect(riderBaseScore(make('sprinteur'),makeRace('sprint'))).toBeGreaterThan(riderBaseScore(make('grimpeur'),makeRace('sprint')))});
  it('les stratégies ont des performances, variances et coûts différents',()=>{const race=makeRace('vallons'),safe=simulateRace(make(),opponents,race,'economiser',fixed),normal=simulateRace(make(),opponents,race,'normal',fixed),attack=simulateRace(make(),opponents,race,'agressif',fixed);expect(attack.score).toBeGreaterThan(normal.score);expect(normal.score).toBeGreaterThan(safe.score);expect(attack.fatigueCost).toBeGreaterThan(normal.fatigueCost);expect(normal.fatigueCost).toBeGreaterThan(safe.fatigueCost)});
  it('prend réellement les adversaires en compte',()=>{const player=make(),race=makeRace('vallons'),setStats=(r:typeof player,value:number)=>Object.fromEntries(Object.keys(r.stats).map(k=>[k,value])) as unknown as typeof r.stats,weak=opponents.map(r=>({...r,stats:setStats(r,20)})),strong=opponents.map(r=>({...r,stats:setStats(r,90)}));expect(simulateRace(player,weak,race,'normal',fixed).position).toBeLessThan(simulateRace(player,strong,race,'normal',fixed).position)});
  it('fait évoluer expérience, réputation et moral après course',()=>{const ready=advanceToNextRace(createGame(make())),completed=playRace(ready,ready.calendar[0].id,'normal',()=>.9);expect(completed.rider.experience).toBeGreaterThan(0);expect(completed.rider.reputation).toBeGreaterThan(2);expect(completed.rider.morale).not.toBe(68);expect(completed.currentDate).toBe('2027-02-09')});
});

describe('calendrier et sauvegardes',()=>{
  it('bloque exactement à la prochaine course',()=>{const advanced=advanceToNextRace(createGame(make()));expect(advanced.currentDate).toBe('2027-02-08');expect(advanced.calendar[0].status).toBe('available');expect(nextDay(advanced).currentDate).toBe('2027-02-08')});
  it('migre une sauvegarde V1.1 sans potentiels ni blessure',()=>{const current=createGame(make()),legacy={...current,gameVersion:2,rider:{...current.rider,profile:'etapes',hidden:{consistency:68,injuryResistance:72,learning:76,mental:70}}} as unknown as GameState;const migrated=migrateGame(legacy);expect(migrated.gameVersion).toBe(3);expect(migrated.rider.hidden.potentials.sprint).toBeGreaterThan(migrated.rider.stats.sprint);expect(migrated.currentDate).toBe(current.currentDate)});
});

describe('calibration validée',()=>{
  it('rend la progression visible après plusieurs bonnes séances',()=>{let rider=make('grimpeur');const initial=rider.stats.mountain;for(let i=0;i<8;i++)rider=applyTraining({...rider,fatigue:25},'montagne');expect(rider.stats.mountain-initial).toBeGreaterThanOrEqual(.5);expect(Math.round(rider.stats.mountain)).toBeGreaterThan(Math.round(initial))});
  it('conserve un fort ralentissement près du potentiel après recalibration',()=>{const rider=make('grimpeur'),far=applyTraining(rider,'montagne').stats.mountain-rider.stats.mountain,near={...rider,stats:{...rider.stats,mountain:rider.hidden.potentials.mountain-.2}},slow=applyTraining(near,'montagne').stats.mountain-near.stats.mountain;expect(far).toBeGreaterThan(slow*3)});
  it('récupère plus rapidement la forme au repos et ralentit près du plafond',()=>{const rider=make(),mid=recoverDay({...rider,form:60}),near=recoverDay({...rider,form:77});expect(mid.form-60).toBeGreaterThan(.6);expect(near.form-77).toBeLessThan(mid.form-60)});
  it('rend le risque perceptible à fatigue extrême et en intensif',()=>{const rider=make(),fresh=injuryRisk({...rider,fatigue:20},{kind:'training',type:'explosivite'}),exhausted=injuryRisk({...rider,fatigue:95},{kind:'training',type:'explosivite'});expect(fresh).toBeLessThan(.005);expect(exhausted).toBeGreaterThan(.04);expect(exhausted).toBeGreaterThan(fresh*10)});
  it('applique les multiplicateurs de stratégie au risque de course',()=>{const rider={...make(),fatigue:50},context={kind:'race' as const,terrain:'montagne' as const},safe=injuryRisk(rider,{...context,strategy:'economiser'}),normal=injuryRisk(rider,{...context,strategy:'normal'}),attack=injuryRisk(rider,{...context,strategy:'agressif'});expect(safe/normal).toBeCloseTo(.75);expect(attack/normal).toBeCloseTo(1.25)});
  it('distribue les adversaires entre accessibles, moyens et favoris',()=>{const levels=opponents.map(rider=>riderBaseScore(rider,makeRace('montagne'))),average=levels.reduce((sum,value)=>sum+value,0)/levels.length;expect(Math.min(...levels)).toBeGreaterThanOrEqual(43);expect(Math.min(...levels)).toBeLessThanOrEqual(49);expect(average).toBeGreaterThanOrEqual(51);expect(average).toBeLessThanOrEqual(56);expect(Math.max(...levels)).toBeGreaterThanOrEqual(62);expect(Math.max(...levels)).toBeLessThanOrEqual(70);expect(levels.filter(value=>value<=51).length).toBeGreaterThanOrEqual(5)});
});
