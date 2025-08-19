export function fmtHour(i:number){ return String(i).padStart(2,'0')+':00'; }
export function* eachDate(from:string, to:string) {
  const s = new Date(from+'T00:00:00'); const e = new Date(to+'T00:00:00');
  for(let d=new Date(s); d<=e; d.setDate(d.getDate()+1)) {
    yield d.toISOString().slice(0,10);
  }
}
