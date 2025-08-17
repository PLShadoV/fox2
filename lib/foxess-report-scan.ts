import crypto from "crypto";

const FOX_DOMAIN = "https://www.foxesscloud.com";

type SepKind = "literal" | "crlf" | "lf";
export type VariantHit = {
  ok: boolean;
  errno?: number;
  msg?: string;
  variant: {
    key: "dimension" | "type";
    value: string;
    variables: string[];
  };
  count?: number;
  sample?: any;
};

function buildSignature(path: string, token: string, timestamp: number, kind: SepKind) {
  const SEPS: Record<SepKind, string> = { literal: "\\r\\n", crlf: "\r\n", lf: "\n" };
  const sep = SEPS[kind];
  const plaintext = path + sep + token + sep + String(timestamp);
  return crypto.createHash("md5").update(plaintext).digest("hex");
}

async function callFox(path: string, headers: Record<string,string>, bodyObj: any) {
  const url = FOX_DOMAIN + path;
  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(bodyObj), cache: "no-store" });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch {}
  return { res, text, json };
}

function normalize(values:any, unit?:string){
  const arr = Array.isArray(values) ? values.map((x:any)=> Number(x)||0) : [];
  const maxv = arr.length ? Math.max(...arr) : 0;
  let out = arr.slice();
  let u = String(unit||"kWh");
  if (u.toLowerCase() === "kwh" && maxv > 20000) { out = out.map((v:number)=> v/1000); u = "kWh"; }
  const fit24 = new Array(24).fill(0);
  for (let i=0;i<Math.min(24,out.length);i++) fit24[i] = +Number(out[i]).toFixed(3);
  return { unit: u, values: fit24 };
}

export async function foxReportQueryFlexible({ sn, year, month, day }: { sn:string; year:number; month:number; day:number }){
  const token = process.env.FOXESS_API_KEY || "";
  if (!token) throw new Error("Brak FOXESS_API_KEY");
  const path = "/op/v0/device/report/query";
  const ts = Date.now();

  const varGroups: string[][] = [
    // Energia dzienna (panele) — różne aliasy
    ["generation","eDay","dayEnergy","yield","production","pvGeneration","gen"],
    // Energia oddana do sieci
    ["feedin","gridExportEnergy","export","gridOutEnergy","sell","toGrid","eOut"]
  ];
  const dimKeys: Array<"dimension"|"type"> = ["dimension","type"];
  const dimVals = ["day","DAY","Day","daily","DAILY"];
  const kinds: SepKind[] = ["literal","crlf","lf"];

  const hits: VariantHit[] = [];

  for (const key of dimKeys){
    for (const value of dimVals){
      for (const variables of varGroups){
        for (const kind of kinds){
          const sign = buildSignature(path, token, ts, kind);
          const headers: Record<string,string> = {
            "Content-Type": "application/json",
            "lang": process.env.FOXESS_API_LANG || "pl",
            "timestamp": String(ts),
            "token": token,
            "sign": sign,
            "signature": sign
          };
          const body: any = { sn, year, month, day, variables };
          (body as any)[key] = value;
          const { json, text, res } = await callFox(path, headers, body);
          if (!json || typeof json.errno !== "number"){
            hits.push({ ok:false, msg:`HTTP ${res?.status}`, variant:{ key, value, variables } });
            continue;
          }
          if (json.errno !== 0){
            hits.push({ ok:false, errno: json.errno, msg: json.msg, variant:{ key, value, variables } });
            continue;
          }
          // Parse wyników
          const raw = json.result;
          let count = 0;
          let sample: any = null;
          if (Array.isArray(raw)){
            if (raw.length && (Array.isArray(raw[0]?.values) || raw[0]?.values == null)){
              const r0 = raw[0];
              const norm = normalize(r0?.values, r0?.unit);
              count = norm.values.reduce((a:number,b:number)=>a+b,0) > 0 ? norm.values.length : (r0?.values?.length || 0);
              sample = r0;
            } else if (raw.length && Array.isArray((raw[0] as any)?.datas)){
              const ds = (raw[0] as any).datas[0];
              const vals = ds?.values ?? ds?.data ?? ds?.points;
              const norm = normalize(vals, ds?.unit);
              count = norm.values.reduce((a:number,b:number)=>a+b,0) > 0 ? norm.values.length : (Array.isArray(vals)?vals.length:0);
              sample = ds;
            } else {
              // mapy
              const k = Object.keys(raw[0]||{}).find(x=> Array.isArray((raw[0] as any)[x]));
              const vals = k ? (raw[0] as any)[k] : [];
              const norm = normalize(vals, (raw[0] as any)?.unit);
              count = norm.values.reduce((a:number,b:number)=>a+b,0) > 0 ? norm.values.length : (Array.isArray(vals)?vals.length:0);
              sample = raw[0];
            }
          } else if (raw && typeof raw === "object") {
            const k = Object.keys(raw).find(x=> Array.isArray((raw as any)[x]));
            const vals = k ? (raw as any)[k] : [];
            const norm = normalize(vals, (raw as any)?.unit);
            count = norm.values.reduce((a:number,b:number)=>a+b,0) > 0 ? norm.values.length : (Array.isArray(vals)?vals.length:0);
            sample = { [k||"unknown"]: vals, unit: (raw as any)?.unit };
          }
          hits.push({ ok:true, variant:{ key, value, variables }, count, sample });
        }
      }
    }
  }

  // wybieramy najlepsze trafienie: preferuj takie z count>=24 oraz sumą > 0
  const score = (h:VariantHit) => {
    if (!h.ok) return -1;
    const s = (()=>{
      const v = (h.sample?.values || h.sample?.data || h.sample?.points);
      if (Array.isArray(v)) return v.reduce((a:number,b:number)=>a+(+b||0),0);
      // map case
      const key = h.sample && Object.keys(h.sample).find((k:string)=> Array.isArray(h.sample[k]));
      const arr = key ? h.sample[key] : [];
      return Array.isArray(arr) ? arr.reduce((a:number,b:number)=>a+(+b||0),0) : 0;
    })();
    return (h.count||0) + (s>0 ? 1000 : 0);
  };
  hits.sort((a,b)=> score(b)-score(a));
  return hits;
}
