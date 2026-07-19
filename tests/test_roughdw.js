const fs0=require("fs");
const src=fs0.readFileSync("index.html","utf8").match(/<script>([\s\S]*?)<\/script>/g).map(s=>s.replace(/<\/?script>/g,"")).sort((a,b)=>a.length-b.length).pop();
function grab(re){const m=src.match(re);if(!m)throw new Error("grab "+re);return m[0];}
eval((grab(/function fft\(re,im\)[\s\S]*?\n\}/)+grab(/\/\* ===== Rugosité Daniel & Weber COMPLÈTE[\s\S]*?function psyRoughDW[\s\S]*?\n\}/)).replace(/\bconst /g,"var ").replace(/\blet /g,"var "));
const fs=48000,P0=2e-5;
function am(fc,fm,d,dB,N){const x=new Float64Array(N);for(let i=0;i<N;i++){const t=i/fs;x[i]=(1+d*Math.sin(2*Math.PI*fm*t))*Math.sin(2*Math.PI*fc*t);}let ms=0;for(let i=0;i<N;i++)ms+=x[i]*x[i];ms=Math.sqrt(ms/N);const g=P0*Math.pow(10,dB/20)/ms;for(let i=0;i<N;i++)x[i]*=g;return x;}
const ref=JSON.parse(fs0.readFileSync("rough_ref.json","utf8"));
const cases={fm70_100_60:[1000,70,1,60],fm30_100_60:[1000,30,1,60],fm50_100_60:[1000,50,1,60],fm100_100_60:[1000,100,1,60],fm150_100_60:[1000,150,1,60],fm200_100_60:[1000,200,1,60],fm70_50_60:[1000,70,0.5,60],fm70_100_80:[1000,70,1,80],fm70_100_40:[1000,70,1,40],fc4000_fm70:[4000,70,1,60]};
let pass=0,fail=0;
for(const k in cases){const [fc,fm,d,dB]=cases[k];const R=psyRoughDW(am(fc,fm,d,dB,8192),fs);const ok=Math.abs(R-ref[k])<=0.12;console.log((ok?"OK  ":"FAIL")+"  "+k.padEnd(15)+" moi="+R.toFixed(3)+" mos="+ref[k].toFixed(3));ok?pass++:fail++;}
console.log("\n"+pass+" OK / "+fail+" FAIL");process.exit(fail?1:0);
