// Banc de validation psychoacoustique (P3, modèles multi-bandes) — extrait fonctions/constantes du fichier
const fs0=require("fs");
const src=fs0.readFileSync("index.html","utf8").match(/<script>([\s\S]*?)<\/script>/g).map(s=>s.replace(/<\/?script>/g,"")).sort((a,b)=>a.length-b.length).pop();
function grab(re){const m=src.match(re);if(!m)throw new Error("grab fail "+re);return m[0];}
let S={bands:null,curBnd:null,offset:40,fftN:16384,binHz:48000/16384,ctx:{sampleRate:48000}};
const code=
  grab(/const ISO_F28=[\s\S]*?function isoCalcSlopes[\s\S]*?\n\}/)
 +grab(/let ISO_MAP=null;/)
 +grab(/function psyLoudness[\s\S]*?\n\}/)
 +grab(/function psySharpness[\s\S]*?\n\}/)
 +grab(/function fft\(re,im\)[\s\S]*?\n\}/)
 +grab(/const PSY_WR=[\s\S]*?const PSY_CAL_R=[^;]*, PSY_CAL_F=[^;]*, PSY_CAL_T=[^;]*;/)
 +grab(/function psyModBandP[\s\S]*?\n\}/)
 +grab(/let PSY_rRe[\s\S]*?function psyRoughMB[\s\S]*?\n\}/)
 +grab(/function psyFluctBW[\s\S]*?\n\}/)
 +grab(/const PSY_ZERO24[\s\S]*?function psyTonalAures[\s\S]*?\n\}/);
eval(code.replace(/\bconst /g,"var ").replace(/\blet /g,"var "));
const NOMS=[20,25,31.5,40,50,63,80,100,125,160,200,250,315,400,500,630,800,1000,1250,1600,2000,2500,3150,4000,5000,6300,8000,10000,12500,16000];
const i1k=NOMS.indexOf(1000);
let pass=0,fail=0;
function chk(name,val,lo,hi){const ok=val>=lo&&val<=hi;console.log((ok?"OK  ":"FAIL")+"  "+name+" = "+val.toFixed(3)+"  ["+lo+".."+hi+"]");ok?pass++:fail++;}

// 1) Sonie / Acuité
S.bands=NOMS; S.curBnd=new Array(NOMS.length).fill(0); S.curBnd[i1k]=1; S.offset=40;
const L40=psyLoudness(); chk("Sonie 1kHz/40dB (sone)",L40.N,0.85,1.05);
chk("Acuité 1kHz (acum)",psySharpness(L40.Nspec),0.7,1.2);
for(const a of [[50,1.6,2.0],[60,3.2,3.8],[70,6.3,7.6],[80,12.8,15.2]]){ S.offset=a[0]; chk("Sonie 1kHz/"+a[0]+"dB",psyLoudness().N,a[1],a[2]); }
S.offset=40;

// 2) Rugosité multi-bande
function amPCM(fc,fm,depth,dB){depth=depth==null?1:depth;const fs=48000,N=Math.round(0.34*fs),x=new Float64Array(N),amp=Math.pow(10,((dB||60)-94)/20)*Math.SQRT2;for(let i=0;i<N;i++){const t=i/fs;x[i]=amp*(1+depth*Math.cos(2*Math.PI*fm*t))*Math.sin(2*Math.PI*fc*t);}return x;}
const R=(fc,fm,d,dB)=>PSY_CAL_R*psyRoughMB(amPCM(fc,fm,d,dB),48000);
chk("Rugosité 100% AM@70Hz (asper)",R(1000,70,1,60),0.9,1.1);
chk("Rugosité 50% AM@70Hz (asper)",R(1000,70,0.5,60),0.35,0.65);
chk("Rugosité ton pur (~0)",R(1000,70,0,60),0,0.1);
chk("Rugosité AM@70 - AM@200",R(1000,70,1,60)-R(1000,200,1,60),0.3,1.0);
chk("Rugosité indep. niveau |80-60|",Math.abs(R(1000,70,1,80)-R(1000,70,1,60)),0,0.2);

// 3) Fluctuation band-wise (via VRAIE sonie spécifique)
function fluctReal(mf,depth,dB){const dt=0.05,frames=100,nhist=[];for(let f=0;f<frames;f++){const g=1+depth*Math.cos(2*Math.PI*mf*(f*dt));S.bands=NOMS;S.curBnd=new Array(NOMS.length).fill(0);S.curBnd[i1k]=g*g;S.offset=dB;const l=psyLoudness();nhist.push(l?l.Nspec:new Float64Array(24));}S.offset=40;return PSY_CAL_F*psyFluctBW(nhist,dt);}
chk("Fluctuation 100% mod@4Hz (vacil)",fluctReal(4,1,60),0.9,1.4);
chk("Fluctuation mod@4 - mod@1",fluctReal(4,1,60)-fluctReal(1,1,60),0.2,0.8);
chk("Fluctuation depth 50%",fluctReal(4,0.5,60),0.2,0.6);
chk("Fluctuation indep. niveau |80-60|",Math.abs(fluctReal(4,1,80)-fluctReal(4,1,60)),0,0.2);

// 4) Tonalité Aures
function specTone(fc,dB,noiseDb){const nfft=16384,fs=48000,n=nfft>>1,bp=new Float64Array(n),df=fs/nfft,nf=Math.pow(10,(noiseDb-94)/10);for(let k=1;k<n;k++)bp[k]=nf*(0.5+0.3*Math.sin(k*1.3));const kc=Math.round(fc/df);bp[kc]+=Math.pow(10,(dB-94)/10);return{bp,df};}
let sp=specTone(1000,60,10); chk("Tonalité ton pur 1kHz (t.u.)",psyTonalAures(sp.bp,sp.df),0.8,1.2);
let sp3=specTone(3000,60,10); const t3k=psyTonalAures(sp3.bp,sp3.df);
sp=specTone(1000,60,10); chk("Tonalité 1kHz > 3kHz",psyTonalAures(sp.bp,sp.df)-t3k,0.2,1.0);
{const nfft=16384,fs=48000,n=nfft>>1,bp=new Float64Array(n),nf=Math.pow(10,(40-94)/10);for(let k=1;k<n;k++)bp[k]=nf*(0.5+0.5*Math.abs(Math.sin(k*0.7)));chk("Tonalité bruit seul (~0)",psyTonalAures(bp,fs/nfft),0,0.15);}

console.log("\n"+pass+" OK / "+fail+" FAIL");
process.exit(fail?1:0);
