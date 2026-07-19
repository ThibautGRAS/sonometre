// Export des balayages de validation psychoacoustique -> tests/psycho_data.json
const fs=require("fs");
const src=fs.readFileSync(fs.existsSync("index.html")?"index.html":"../index.html","utf8").match(/<script>([\s\S]*?)<\/script>/g).map(s=>s.replace(/<\/?script>/g,"")).sort((a,b)=>a.length-b.length).pop();
function grab(re){const m=src.match(re);return m?m[0]:"";}
const consts=(src.match(/const PSY_BARK_HI=[\s\S]*?const PSY_CN=[^;]*;/)[0]
  + src.match(/const PSY_WR=[\s\S]*?const PSY_CAL_R=[^;]*;/)[0]).replace(/\bconst /g,"var ");
var S={bands:[1000],curBnd:[1],offset:40};
eval(consts+grab(/function psyBarkOf[\s\S]*?\n\}/)+grab(/function psyLoudness[\s\S]*?\n\}/)+grab(/function psySharpness[\s\S]*?\n\}/)+grab(/function psyModBandP[\s\S]*?\n\}/));

// enveloppe AM -> rugosité (réplique psyRoughness)
function roughAM(fm,depth){ depth=depth==null?1:depth;
  const sr=48000,T=Math.round(0.34*sr),D=Math.round(sr/2000),M=Math.floor(T/D);
  const aLP=1-Math.exp(-2*Math.PI*400/sr); let y=0,k=0; const e=new Float64Array(M);
  for(let i=0;i<T;i++){const t=i/sr;const x=(1+depth*Math.cos(2*Math.PI*fm*t))*Math.sin(2*Math.PI*1000*t);y+=aLP*(Math.abs(x)-y);if(i%D===0&&k<M)e[k++]=y;}
  return PSY_CAL_R*psyModBandP(e,sr/D,20,300,PSY_WR); }
function fluctMod(mf){ const fsN=20,n=fsN*4,y=new Float64Array(n); for(let i=0;i<n;i++)y[i]=1+Math.cos(2*Math.PI*mf*(i/fsN)); return PSY_CAL_F*psyModBandP(y,fsN,0.2,8,PSY_WF); }

const out={};
// 1) Sonie vs niveau (1 kHz)
out.loud={L:[],N:[],ref2:[]};
for(let L=20;L<=100;L+=5){ S.bands=[1000];S.curBnd=[1];S.offset=L; out.loud.L.push(L); out.loud.N.push(psyLoudness().N); out.loud.ref2.push(Math.pow(2,(L-40)/10)); }
// 2) Acuité vs fréquence (bande étroite 60 dB)
out.sharp={f:[],S:[]};
for(const f of [250,500,800,1000,1600,2500,4000,6300,10000]){ S.bands=[f];S.curBnd=[1];S.offset=60; const L=psyLoudness(); out.sharp.f.push(f); out.sharp.S.push(psySharpness(L.Nspec)); }
// 3) Rugosité vs fréquence de modulation (100% AM)
out.roughF={fm:[],R:[]};
for(let fm=10;fm<=300;fm+=10){ out.roughF.fm.push(fm); out.roughF.R.push(roughAM(fm)); }
// 4) Rugosité vs profondeur (@70 Hz)
out.roughD={d:[],R:[],ref:[]};
for(let d=0;d<=100;d+=10){ out.roughD.d.push(d); out.roughD.R.push(roughAM(70,d/100)); out.roughD.ref.push(d/100); }
// 5) Fluctuation vs fréquence de modulation
out.fluctF={fm:[],F:[]};
for(const mf of [0.5,1,1.5,2,3,4,6,8,10,12,16]){ out.fluctF.fm.push(mf); out.fluctF.F.push(fluctMod(mf)); }
out.cal={CAL_R:PSY_CAL_R,CAL_F:PSY_CAL_F,CN:PSY_CN};
fs.writeFileSync("psycho_data.json",JSON.stringify(out));
console.log("export OK — sonie@40dB=",psyLoudness().N.toFixed(3)," R@70=",roughAM(70).toFixed(3)," F@4=",fluctMod(4).toFixed(3));
