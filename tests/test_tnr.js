// Banc TNR/PR : psyTnrPr extrait du fichier vs références MOSQITO (tnr_ref.json)
const fs0=require("fs");
const src=fs0.readFileSync("index.html","utf8").match(/<script>([\s\S]*?)<\/script>/g).map(s=>s.replace(/<\/?script>/g,"")).sort((a,b)=>a.length-b.length).pop();
function grab(re){const m=src.match(re);if(!m)throw new Error("grab "+re);return m[0];}
eval((grab(/const tnrLOG=Math\.log10;[\s\S]*?function psyTnrPr[\s\S]*?\n\}/)).replace(/\bconst /g,"var ").replace(/\blet /g,"var "));
const ref=JSON.parse(fs0.readFileSync("tnr_ref.json","utf8"));
let pass=0,fail=0;
function chk(n,a,b,tol){const ok=Math.abs(a-b)<=tol;console.log((ok?"OK  ":"FAIL")+"  "+n+" moi="+a.toFixed(2)+" mos="+b.toFixed(2)+" (±"+tol+")");ok?pass++:fail++;}
for(const k in ref){ const c=ref[k]; const spec=c.spec_db, freq=spec.map((_,i)=>c.f0+i*c.df);
  const r=psyTnrPr(spec,freq);
  chk(k+" T-TNR",r.tnrT,c.tnr.t,0.1);
  chk(k+" T-PR ",r.prT,c.pr.t,0.1);
}
console.log("\n"+pass+" OK / "+fail+" FAIL"); process.exit(fail?1:0);
