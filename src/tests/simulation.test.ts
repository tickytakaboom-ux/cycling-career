import { describe,expect,it } from 'vitest';
import { createRider,opponents } from '../data/riders';
import { applyTraining,recoverDay } from '../game/progression/training';
import { performance,riderBaseScore,simulateRace } from '../game/simulation/raceSimulation';
import { advanceToNextRace,createGame,nextDay,race as playRace,train } from '../state/gameStore';
import type { Race, RiderProfile } from '../game/models';

const makeRace=(terrain:Race['terrain'],prestige=50,date='2027-02-08'):Race=>({id:`${terrain}-${prestige}`,name:terrain,country:'Test',date,terrain,distance:180,elevation:terrain==='montagne'?3500:300,prestige,difficulty:60});
const make=(profile:RiderProfile='etapes')=>createRider({firstName:'Test',lastName:'Rider',nationality:'France',height:178,weight:65,profile});
const fixed=()=>.25;

describe('création et développement',()=>{
  it('crée toujours un coureur de 18 ans au niveau espoir',()=>{const rider=make();expect(rider.age).toBe(18);expect(Math.max(...Object.values(rider.stats))).toBeLessThanOrEqual(62);expect(rider.reputation).toBe(2)});
  it('favorise le spécialiste adapté au terrain',()=>{expect(riderBaseScore(make('sprinteur'),makeRace('sprint'))).toBeGreaterThan(riderBaseScore(make('grimpeur'),makeRace('sprint')));expect(riderBaseScore(make('grimpeur'),makeRace('montagne'))).toBeGreaterThan(riderBaseScore(make('sprinteur'),makeRace('montagne')))});
  it('fait progresser lentement les statistiques ciblées',()=>{const rider=make('sprinteur'),trained=applyTraining(rider,'sprint');expect(trained.stats.sprint).toBeGreaterThan(rider.stats.sprint);expect(trained.stats.mountain).toBe(rider.stats.mountain);expect(trained.stats.sprint-rider.stats.sprint).toBeLessThan(.15);expect(trained.fatigue).toBeGreaterThan(rider.fatigue)});
  it('empêche le cycle récupération de produire forme 100 et fatigue 0',()=>{let rider=make();for(let i=0;i<100;i++){rider=applyTraining(rider,'endurance');rider=applyTraining(rider,'recuperation');rider=recoverDay(rider)}expect(rider.form).toBeLessThanOrEqual(88);expect(rider.fatigue).toBeGreaterThanOrEqual(4)});
});

describe('simulation et stratégies',()=>{
  it('la fatigue réduit et la forme améliore la performance',()=>{const rider=make(),tired={...rider,fatigue:90},low={...rider,form:45},high={...rider,form:88};expect(performance(rider,makeRace('plaine'),'normal',fixed).final).toBeGreaterThan(performance(tired,makeRace('plaine'),'normal',fixed).final);expect(performance(high,makeRace('plaine'),'normal',fixed).final).toBeGreaterThan(performance(low,makeRace('plaine'),'normal',fixed).final)});
  it('pénalise davantage un jeune sur une course prestigieuse',()=>{const young=make(),adult={...young,age:26,experience:1400};expect(performance(adult,makeRace('paves',70),'normal',fixed).final).toBeGreaterThan(performance(young,makeRace('paves',70),'normal',fixed).final)});
  it('rend les stratégies mesurables avec avantages et coûts',()=>{const rider=make(),race=makeRace('vallons');const safe=simulateRace(rider,opponents,race,'economiser',fixed),normal=simulateRace(rider,opponents,race,'normal',fixed),attack=simulateRace(rider,opponents,race,'agressif',fixed);expect(attack.score).toBeGreaterThan(normal.score);expect(normal.score).toBeGreaterThan(safe.score);expect(attack.fatigueCost).toBeGreaterThan(normal.fatigueCost);expect(normal.fatigueCost).toBeGreaterThan(safe.fatigueCost);expect(attack.strategySummary).toContain('fatigue')});
});

describe('calendrier de carrière',()=>{
  it('bloque à la date de la prochaine course',()=>{const game=createGame(make()),advanced=advanceToNextRace(game);expect(advanced.currentDate).toBe('2027-02-08');expect(advanced.calendar[0].status).toBe('available');expect(nextDay(advanced)).toEqual(advanced)});
  it('n’autorise qu’une séance par jour',()=>{const game=createGame(make()),once=train(game,'endurance'),twice=train(once,'sprint');expect(twice.rider).toEqual(once.rider)});
  it('reprend le lendemain après une course et refuse une course passée',()=>{const ready=advanceToNextRace(createGame(make()));const completed=playRace(ready,ready.calendar[0].id,'normal');expect(completed.currentDate).toBe('2027-02-09');expect(completed.calendar[0].status).toBe('completed');const replay=playRace(completed,completed.calendar[0].id,'normal');expect(replay).toEqual(completed)});
});
