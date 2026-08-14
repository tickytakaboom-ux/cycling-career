import {describe,expect,it} from 'vitest';
import {careerTeams} from '../data/careerTeams';
import {createRider,generateOpponents} from '../data/riders';
import {careerLevel,seasonSummary,updateObjectives} from '../game/career/careerProgression';
import {generateOffers} from '../game/career/contracts';
import {fieldRange,generateTeamCalendar} from '../game/career/teams';
import type {GameState,RaceResult,RiderProfile} from '../game/models';
import {createCareer,migrateGame,nextDay,signContract} from '../state/gameStore';

const rider=(profile:RiderProfile='grimpeur')=>createRider({firstName:'Julian',lastName:'Stehlin',nationality:'France',height:178,weight:66,profile});
const result=(position=12):RaceResult=>({raceId:'x',position,fieldSize:31,score:50,gap:'+ 10 s',xpGained:20,reputationGained:.1,moraleChange:0,strategy:'normal',fatigueCost:15,strategySummary:'Normal',events:[],breakdown:{base:50,form:0,fatigue:0,morale:0,age:0,experience:0,prestige:0,injury:0,weather:0,strategy:0,variance:0,final:50}});

describe('création V1.4',()=>{
 it('fixe automatiquement l’âge à 18 ans',()=>expect(rider().age).toBe(18));
 it.each(['grimpeur','sprinteur','puncheur','rouleur','baroudeur'] as RiderProfile[])('génère le profil %s',profile=>expect(rider(profile).profile).toBe(profile));
 it('donne au grimpeur des potentiels cohérents et cachés',()=>{const value=rider('grimpeur');expect(value.hidden.potentials.mountain).toBeGreaterThan(value.stats.mountain);expect(value.hidden.potentials.mountain).toBeGreaterThan(value.hidden.potentials.sprint)});
});
describe('équipes et calendriers',()=>{
 it('propose plusieurs niveaux et spécialités',()=>{expect(new Set(careerTeams.map(t=>t.level)).size).toBeGreaterThan(2);expect(careerTeams.every(t=>t.specialties.length>0)).toBe(true)});
 it('génère un calendrier propre à la structure',()=>{const small=generateTeamCalendar(careerTeams[0]),large=generateTeamCalendar(careerTeams[4]);expect(small).toHaveLength(careerTeams[0].calendarSize);expect(large.length).toBeGreaterThan(small.length);expect(small.every(r=>r.competitionLevel!<=2)).toBe(true)});
});
describe('contrats',()=>{
 it('génère trois offres réellement différentes',()=>{const offers=generateOffers(rider());expect(offers).toHaveLength(3);expect(new Set(offers.map(o=>o.contract.monthlySalary)).size).toBe(3)});
 it('enregistre la signature et construit la saison',()=>{const game=createCareer(rider()),signed=signContract(game,game.career.offers[0].id);expect(signed.career.contract?.teamId).toBe(signed.team.id);expect(signed.calendar.length).toBe(signed.team.calendarSize)});
 it('la réputation améliore la qualité des offres',()=>{const low=generateOffers(rider()),high=generateOffers({...rider(),reputation:20});expect(Math.max(...high.map(o=>careerTeams.find(t=>t.id===o.teamId)!.level))).toBeGreaterThan(Math.max(...low.map(o=>careerTeams.find(t=>t.id===o.teamId)!.level)))});
});
describe('pelotons et carrière',()=>{
 it('rend les petites courses accessibles et les grandes plus fortes',()=>{const low=fieldRange(1),high=fieldRange(3),lowField=generateOpponents((low.average[0]+low.average[1])/2),highField=generateOpponents((high.average[0]+high.average[1])/2),mean=(field:typeof lowField)=>field.reduce((sum,r)=>sum+Object.values(r.stats).reduce((a,b)=>a+b,0)/12,0)/field.length;expect(mean(lowField)).toBeLessThan(53);expect(mean(highField)).toBeGreaterThan(mean(lowField)+8)});
 it('fait progresser et clôt les objectifs',()=>{const goals=generateOffers(rider())[0].contract.objectives,updated=updateObjectives(goals,result(10),5);expect(updated.find(g=>g.type==='top20')?.progress).toBe(1);expect(updated.find(g=>g.type==='reputation')?.status).toBe('completed')});
 it('calcule le niveau de carrière sans remplacer les caractéristiques',()=>{expect(careerLevel(2,0)).toBe(1);expect(careerLevel(15,600)).toBe(3)});
 it('verse et enregistre le salaire mensuel',()=>{const game=createCareer(rider()),signed=signContract(game,game.career.offers[0].id),paid=nextDay(signed);expect(paid.career.balance).toBe(signed.career.contract!.monthlySalary);expect(paid.career.totalEarnings).toBe(paid.career.balance)});
 it('produit un bilan de fin de saison',()=>{const game=createCareer(rider()),signed=signContract(game,game.career.offers[0].id),done={...signed,season:{...signed.season,status:'completed' as const},calendar:signed.calendar.slice(0,1).map(r=>({...r,status:'completed' as const,result:result(18)}))};expect(seasonSummary(done).top20).toBe(1)});
 it('migre une sauvegarde V1.3 sans détruire calendrier et coureur',()=>{const legacy=createCareer(rider()),signed=signContract(legacy,legacy.career.offers[0].id),old={...signed,career:undefined} as unknown as GameState,migrated=migrateGame(old);expect(migrated.rider.firstName).toBe('Julian');expect(migrated.calendar).toHaveLength(signed.calendar.length);expect(migrated.career.contract).toBeDefined()});
});
