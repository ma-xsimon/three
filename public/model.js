export const CHALLENGES = ['accuracy', 'updown', 'pressure'];
export const blankHole = () => ({ strokes: null, gir: null, close: null, updown: null, pressure: null });
export function newRound(course = '', mode = 4, omitted = 'pressure', policy = 'raw90') {
  return { id: crypto.randomUUID(), date: new Date().toISOString(), course, mode, omitted, policy, holes: Array.from({length:9}, blankHole), status:'draft', updatedAt:new Date().toISOString() };
}
export const active = (round, name) => round.mode === 4 || round.omitted !== name;
export function holePoints(round, hole) {
  const accuracy = active(round,'accuracy') ? (hole.gir === true ? 2 : 0) + (hole.close === true ? 1 : 0) : 0;
  const updown = active(round,'updown') ? hole.updown === 2 ? 2 : hole.updown === 3 ? 1 : 0 : 0;
  const pressure = active(round,'pressure') ? hole.pressure === 1 ? 5 : hole.pressure === 2 ? 3 : hole.pressure === 3 ? 2 : 0 : 0;
  const raw = accuracy + updown + pressure;
  return { accuracy, updown, pressure, raw, total: round.policy === 'hole8' ? Math.min(8,raw) : raw };
}
export function totals(round) {
  const raw = round.holes.reduce((sum,h)=>sum+holePoints(round,h).raw,0);
  const subtotal = round.holes.reduce((sum,h)=>sum+holePoints(round,h).total,0);
  const points = round.policy === 'round72' ? Math.min(72,subtotal) : subtotal;
  const strokes = round.holes.reduce((sum,h)=>sum+(h.strokes ?? 0),0);
  const played = round.holes.filter(h=>h.strokes !== null).length;
  const maximum = round.policy === 'raw90' ? (round.mode === 4 ? 90 : (round.omitted === 'pressure' ? 45 : round.omitted === 'accuracy' ? 63 : 72)) : round.policy === 'hole8' ? Math.min(72, round.mode === 4 ? 72 : round.omitted === 'pressure' ? 45 : round.omitted === 'accuracy' ? 63 : 72) : Math.min(72, round.mode === 4 ? 90 : round.omitted === 'pressure' ? 45 : round.omitted === 'accuracy' ? 63 : 72);
  return {raw,points,strokes,played,maximum};
}
export function holeComplete(r,h) {
  return h.strokes !== null && (!active(r,'accuracy') || (h.gir !== null && h.close !== null)) && (!active(r,'updown') || h.updown !== null) && (!active(r,'pressure') || h.pressure !== null);
}
export const roundComplete = r => r.holes.every(h=>holeComplete(r,h));
export function statistics(rounds) {
  let gir=0,girAttempts=0,up=0,upAttempts=0,strokes=0,holes=0,points=0;
  for(const r of rounds) {
    points+=totals(r).points;
    for(const h of r.holes) {
      if(h.strokes!==null){strokes+=h.strokes;holes++;}
      if(active(r,'accuracy')&&h.gir!==null){girAttempts++;if(h.gir)gir++;}
      if(active(r,'updown')&&h.updown!==null){upAttempts++;if(h.updown===2)up++;}
    }
  }
  return {gir:girAttempts?gir/girAttempts*100:null,up:upAttempts?up/upAttempts*100:null,average:holes?strokes/holes:null,points,rounds:rounds.length};
}
export function validateRound(r) {
  return !!r && typeof r.id==='string' && /^[a-zA-Z0-9-]{1,80}$/.test(r.id) && typeof r.course==='string' && r.course.length<=120 && typeof r.date==='string' && Number.isFinite(Date.parse(r.date)) && typeof r.updatedAt==='string' && Number.isFinite(Date.parse(r.updatedAt)) && [3,4].includes(r.mode) && CHALLENGES.includes(r.omitted) && ['round72','raw90','hole8'].includes(r.policy) && ['draft','completed'].includes(r.status) && Array.isArray(r.holes) && r.holes.length===9 && r.holes.every(h=> h && (h.strokes===null || Number.isInteger(h.strokes)&&h.strokes>=1&&h.strokes<=20) && [null,true,false].includes(h.gir) && [null,true,false].includes(h.close) && [null,2,3,4].includes(h.updown) && (h.pressure===null || Number.isInteger(h.pressure)&&h.pressure>=1&&h.pressure<=20)) && (r.status!=='completed'||roundComplete(r));
}
export function mergeRounds(local, remote) {
  const map=new Map();
  for(const r of [...local,...remote]) if(validateRound(r)&&r.status==='completed') {
    const old=map.get(r.id);if(!old||Date.parse(r.updatedAt)>Date.parse(old.updatedAt))map.set(r.id,r);
  }
  return [...map.values()].sort((a,b)=>Date.parse(b.date)-Date.parse(a.date)||Date.parse(b.updatedAt)-Date.parse(a.updatedAt));
}
