export type RandomSource=()=>number;
export const gaussian=(random:RandomSource=Math.random)=>{const u=Math.max(random(),1e-9),v=Math.max(random(),1e-9);return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)};
