// Banc de validation psychoacoustique (P2) — extrait les fonctions/constantes du fichier
const fs=require("fs");
const src=fs.readFileSync("index.html","utf8").match(/<script>([\s\S]*?)<\/script>/g).map(s=>s.replace(/<\/?script>/g,"")).sort((a,b)=>a.length-b.length).pop();
function grab(re){const m=src.match(re);return m?m[0]:"";}
const consts = src.match(/const PSY_BARK_HI=[\s\S]*?const PSY_CN=[^;]*;/)[0]
  + src.match(/const PSY_WR=[\s\S]*?const PSY_CAL_R=[^;]*;/)[0];
let S={bands:[1000],curBnd:[1],offset:40};
eval(consts.replace(/\bconst /g,"var ")
  + grab(/function psyBarkOf[\s\S]*?\n\}/)
  + grab(/function psyLoudness[\s\S]*?\n\}/)
  + grab(/function psySharpness[\s\S]*?\n\}/)
  + grab(/function psyModBandP[\s\S]*?\n\}/));
let pass=0,fail=0;
function chk(name,val,lo,hi){ const ok=val>=lo&&val<=hi; console.log((ok?"OK  ":"FAIL")+"  "+name+" = "+val.toFixed(3)+"  ["+lo+".."+hi+"]"); ok?pass++:fail++; }

// 1) Sonie : 1 kHz @40 dB -> ~1 sone
const L=psyLoudness(); chk("Sonie 1kHz/40dB (sone)",L.N,0.85,1.20);
// 2) Acuité : ton 1 kHz -> ~1 acum
chk("Acuité 1kHz (acum)",psySharpness(L.Nspec),0.7,1.2);
// 3) Sonie croît avec le niveau
S.offset=60; chk("Sonie 1kHz/60dB (sone)",psyLoudness().N,3.4,5.0);
S.offset=50; chk("Sonie 1kHz/50dB (sone)",psyLoudness().N,1.7,2.6);
S.offset=70; chk("Sonie 1kHz/70dB (sone)",psyLoudness().N,7.0,10.0);
S.offset=80; chk("Sonie 1kHz/80dB (sone)",psyLoudness().N,13.5,19.0);
S.offset=40;

// 4) Rugosité : reproduit le pipeline enveloppe + modBandP avec les constantes du fichier
function roughAM(fm,depth){ depth=depth==null?1:depth;
  const sr=48000,T=Math.round(0.34*sr),D=Math.round(sr/2000),M=Math.floor(T/D);
  const aLP=1-Math.exp(-2*Math.PI*400/sr); let y=0,k=0; const e=new Float64Array(M);
  for(let i=0;i<T;i++){const t=i/sr; const x=(1+depth*Math.cos(2*Math.PI*fm*t))*Math.sin(2*Math.PI*1000*t); y+=aLP*(Math.abs(x)-y); if(i%D===0&&k<M)e[k++]=y;}
  return PSY_CAL_R*psyModBandP(e,sr/D,20,300,PSY_WR);
}
chk("Rugosité 100% AM@70Hz (asper)",roughAM(70),0.9,1.1);
chk("Rugosité 50% AM@70Hz (asper)",roughAM(70,0.5),0.4,0.6);
chk("Rugosité AM@200Hz < AM@70Hz",roughAM(70)-roughAM(200),0.3,1.0);
// 5) Fluctuation : N(t)=1+cos(2π·4·t) -> ~1 vacil
function fluctMod(mf){ const fsN=20,n=fsN*4,y=new Float64Array(n); for(let i=0;i<n;i++)y[i]=1+Math.cos(2*Math.PI*mf*(i/fsN)); return PSY_CAL_F*psyModBandP(y,fsN,0.2,8,PSY_WF); }
chk("Fluctuation 100% mod@4Hz (vacil)",fluctMod(4),0.9,1.1);
chk("Fluctuation mod@1Hz < mod@4Hz",fluctMod(4)-fluctMod(1),0.3,0.8);

console.log("\n"+pass+" OK / "+fail+" FAIL");
process.exit(fail?1:0);
