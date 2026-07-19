const fs0=require("fs");
const src=fs0.readFileSync("index.html","utf8").match(/<script>([\s\S]*?)<\/script>/g).map(s=>s.replace(/<\/?script>/g,"")).sort((a,b)=>a.length-b.length).pop();
function grab(re){const m=src.match(re);if(!m)throw new Error("grab fail "+re);return m[0];}
let S={bands:null,curBnd:null,offset:40,fftN:16384,binHz:48000/16384,ctx:{sampleRate:48000}};
const code=
  grab(/const PSY_BARK_HI=[\s\S]*?const PSY_CN=[^;]*;/)
 +grab(/function psyBarkOf[\s\S]*?\n\}/)
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

// --- Rugosité ---
function amPCM(fc,fm,depth,fs,dur,dB){depth=depth==null?1:depth;const N=Math.round(dur*fs);const x=new Float64Array(N);const amp=Math.pow(10,((dB||60)-94)/20)*Math.SQRT2;for(let i=0;i<N;i++){const t=i/fs;x[i]=amp*(1+depth*Math.cos(2*Math.PI*fm*t))*Math.sin(2*Math.PI*fc*t);}return x;}
const rawR=psyRoughMB(amPCM(1000,70,1,48000,0.34,60),48000);
console.log("PSY_CAL_R  =",(1/rawR).toFixed(4),"  (rugosité: raw ref =",rawR.toFixed(4),")");

// --- Fluctuation via VRAIE sonie ---
function fluctReal(mf,depth,dB){ const dt=0.05,frames=100; const nhist=[];
  for(let f=0;f<frames;f++){const t=f*dt; const g=1+depth*Math.cos(2*Math.PI*mf*t);
    S.bands=NOMS; S.curBnd=new Array(NOMS.length).fill(0); S.curBnd[i1k]=g*g; S.offset=dB;
    const L=psyLoudness(); nhist.push(L?L.Nspec:new Float64Array(24)); }
  return psyFluctBW(nhist,dt);
}
const rawF=fluctReal(4,1,60);
console.log("PSY_CAL_F  =",(1/rawF).toFixed(4),"  (fluct: raw ref =",rawF.toFixed(4),")");
console.log("  verif profil (cal courant 2.30):",[1,4,8].map(mf=>"mf"+mf+":"+(2.30*fluctReal(mf,1,60)).toFixed(2)).join(" "),
            " depth50%@4:",(2.30*fluctReal(4,0.5,60)).toFixed(2)," niveau80:",(2.30*fluctReal(4,1,80)).toFixed(2));

// --- Tonalité ---
function specTone(fc,dB,nfft,fs,noiseDb){const n=nfft>>1,bp=new Float64Array(n),df=fs/nfft;const nf=Math.pow(10,(noiseDb-94)/10);for(let k=1;k<n;k++)bp[k]=nf*(0.5+0.3*Math.sin(k));const kc=Math.round(fc/df);bp[kc]+=Math.pow(10,(dB-94)/10);return{bp,df};}
let sp=specTone(1000,60,16384,48000,10);
console.log("Tonalité 1kHz (cal 1.98):",psyTonalAures(sp.bp,sp.df).toFixed(3));
