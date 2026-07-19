// ===== Banc d'émulation : fonctions RÉELLES de l'app sur signaux de référence =====
const fs0=require("fs");
const html=fs0.readFileSync("index.html","utf8");
const src=html.match(/<script>([\s\S]*?)<\/script>/g).map(s=>s.replace(/<\/?script>/g,"")).sort((a,b)=>a.length-b.length).pop();
function grab(re){const m=src.match(re);if(!m)throw new Error("grab "+re);return m[0];}
const lines=src.split("\n");
// bloc psycho contigu : de "const ISO_F28" à la fin de psyTnrPr
const iISO=src.indexOf("const ISO_F28"), iEnd=src.indexOf("function psyPctile");
let core=[grab(/function fft\(re,im\)[\s\S]*?\n\}/),
 grab(/const WINS=\{[\s\S]*?\n\};/),
 grab(/const NOMS=\[[\s\S]*?\];/),
 grab(/function aWeight\(f\)\{[\s\S]*?\n\}/),
 grab(/function cWeight\(f\)\{[\s\S]*?\n\}/),
 grab(/function designToctBand\([\s\S]*?\n\}/),
 grab(/function buildIirBank\([\s\S]*?\n\}/),
 grab(/function iirBankRun\([\s\S]*?\n\}/),
 src.slice(iISO,iEnd)].join("\n");
core=core.replace(/\bconst /g,"var ").replace(/\blet /g,"var ");
var S={}; eval(core);

const FS=48000, P0=2e-5, OFFSET=-20*Math.log10(P0); // 93.9794 -> SPL = 10log10(msPa)+offset

function paTone(fc,dB,N,fm,depth){ // signal en Pa (RMS = 2e-5*10^(dB/20))
  const x=new Float64Array(N), rms=P0*Math.pow(10,dB/20);
  for(let i=0;i<N;i++){ const t=i/FS; let s=Math.sin(2*Math.PI*fc*t);
    if(fm)s*=(1+depth*Math.sin(2*Math.PI*fm*t)); x[i]=s; }
  // normaliser au RMS voulu (√2 pour un sinus ; pour AM on normalise sur le RMS réel)
  let ms=0; for(let i=0;i<N;i++)ms+=x[i]*x[i]; ms=Math.sqrt(ms/N);
  const g=rms/ms; for(let i=0;i<N;i++)x[i]*=g; return x;
}
function pinkNoise(dB,N){ let x=new Float64Array(N),b0=0,b1=0,b2=0;
  for(let i=0;i<N;i++){const w=Math.random()*2-1;b0=0.99765*b0+w*0.099046;b1=0.963*b1+w*0.2965164;b2=0.57*b2+w*1.0526913;x[i]=b0+b1+b2+w*0.1848;}
  let ms=0;for(let i=0;i<N;i++)ms+=x[i]*x[i];ms=Math.sqrt(ms/N);const g=P0*Math.pow(10,dB/20)/ms;for(let i=0;i<N;i++)x[i]*=g;return x;}

function setup(fftN){
  S.ctx={sampleRate:FS}; S.fftN=fftN; S.binHz=FS/fftN; S.offset=OFFSET;
  S.weight='Z'; S.toctSrc='iir'; S.corr='off'; S.compGain=null;
  const n=fftN>>1; S.bands=[];
  for(const fc of NOMS){ if(fc*Math.pow(2,1/6)>FS/2)break; const lo=fc*Math.pow(2,-1/6),hi=fc*Math.pow(2,1/6);
    const i0=Math.max(1,Math.ceil(lo/S.binHz)),i1=Math.min(n-1,Math.floor(hi/S.binHz)); if(i1>=i0)S.bands.push(fc); }
  S.curBnd=new Float64Array(S.bands.length); S._isoMapN=-1; ISO_MAP=null;
}
function fineSpec(pcm,fftN){ const N=fftN,w=new Float64Array(N),wf=WINS['blackman'].f; let s2=0;
  for(let i=0;i<N;i++){w[i]=wf(i,N);s2+=w[i]*w[i];}
  const re=new Float64Array(N),im=new Float64Array(N); for(let i=0;i<N;i++)re[i]=(pcm[i]||0)*w[i];
  fft(re,im); const n=N>>1,norm=2/s2,out=new Float64Array(n); for(let i=0;i<n;i++)out[i]=(re[i]*re[i]+im[i]*im[i])*norm; return out; }
function bandPow(pcm){ const bank=buildIirBank(); iirBankRun(bank,pcm);
  for(let b=0;b<S.bands.length;b++)S.curBnd[b]=bank.acc[b]/bank.n; }

function runApp(pcm, fftN){
  setup(fftN);
  bandPow(pcm);                              // -> S.curBnd (banc IIR, comme l'app)
  S.binPowD=fineSpec(pcm,fftN);              // -> spectre fin Parseval
  const L=psyLoudness();
  const Sh=psySharpness(L.Nspec);
  const T=psyTonalAures(S.binPowD,S.binHz);
  const nb=S.binPowD.length,specDb=new Float64Array(nb),frq=new Float64Array(nb);
  for(let k=0;k<nb;k++){const p=S.binPowD[k];specDb[k]=p>0?10*Math.log10(p)+S.offset:-180;frq[k]=k*S.binHz;}
  const tp=psyTnrPr(specDb,frq);
  const kPa=2e-5*Math.pow(10,S.offset/20); const seg=new Float64Array(8192); for(let i=0;i<8192;i++)seg[i]=(pcm[i]||0)*kPa;
  const R=psyRoughDW(seg,FS);
  return {N:L.N,S:Sh,R,T,tnrT:tp.tnrT,prT:tp.prT};
}
// Fluctuation : série temporelle de sonie spécifique par blocs de 50 ms
function runFluct(pcm,fftN){
  setup(fftN); const bank=buildIirBank(); const hop=Math.round(FS*0.05);
  PSY.buf=[]; let t=0;
  for(let off=0; off+hop<=pcm.length; off+=hop){
    iirBankRun(bank, pcm.subarray(off,off+hop));
    for(let b=0;b<S.bands.length;b++)S.curBnd[b]=bank.acc[b]/bank.n;
    const L=psyLoudness(); PSY.buf.push({t:t, N:L.N, Ns:L.Nspec}); t+=hop/FS;
    bank.acc.fill(0); bank.n=0;
  }
  return psyFluct(PSY.buf);
}

// ---------- Validation ----------
function line(name,val,ref,tol,unit){ const ok=(ref==null)||Math.abs(val-ref)<=tol;
  console.log((ref==null?"    ":ok?"OK  ":"FAIL")+"  "+name.padEnd(34)+val.toFixed(3).padStart(8)+(unit||"")+(ref!=null?("   réf "+ref+" ±"+tol):"")); return ok; }

console.log("=== SONIE (ISO 532-1) — ton pur 1 kHz, définition 40 dB = 1 sone, ×2 / +10 dB ===");
for(const [dB,ref] of [[40,1.0],[50,2.0],[60,4.0],[70,8.0],[80,16.0]]){
  const r=runApp(paTone(1000,dB,48000),16384); line("1 kHz "+dB+" dB",r.N,ref,ref*0.18,"sone");
}
console.log("\n=== ACUITÉ (DIN 45692) — ton pur 1 kHz 60 dB ~ 1 acum ===");
{ const r=runApp(paTone(1000,60,48000),16384); line("1 kHz 60 dB",r.S,1.0,0.25,"acum");
  const r2=runApp(paTone(3000,60,48000),16384); line("3 kHz 60 dB (plus aigu)",r2.S,null,0,"acum"); }
console.log("\n=== RUGOSITÉ (D&W) — AM 1 kHz/70 Hz/100%/60 dB = 1 asper ===");
{ const r=runApp(paTone(1000,60,48000,70,1),16384); line("AM 70 Hz 100% 60 dB",r.R,1.0,0.25,"asper");
  const r2=runApp(paTone(1000,60,48000,70,0.5),16384); line("AM 70 Hz 50% 60 dB",r2.R,0.34,0.12,"asper"); }
console.log("\n=== FLUCTUATION — AM 1 kHz/4 Hz/100%/60 dB = 1 vacil ===");
{ const F=runFluct(paTone(1000,60,FS*3,4,1),16384); line("AM 4 Hz 100% 60 dB",F,1.0,0.3,"vacil");
  const F2=runFluct(paTone(1000,60,FS*3,4,0.5),16384); line("AM 4 Hz 50% 60 dB",F2,null,0,"vacil"); }
console.log("\n=== TONALITÉ — 1 kHz pur (Aures) + TNR/PR (ECMA-74) ===");
{ const r=runApp(paTone(1000,60,48000),16384); line("Aures 1 kHz 60 dB",r.T,null,0,"tu");
  line("T-TNR 1 kHz",r.tnrT,null,0,"dB"); line("T-PR 1 kHz",r.prT,null,0,"dB"); }
console.log("\n=== BRUIT DE FOND — bruit rose 50 dB : rugosité doit être ~0 ===");
{ const r=runApp(pinkNoise(50,48000),16384); line("pink 50 dB : N",r.N,null,0,"sone"); line("pink 50 dB : R (D&W)",r.R,0,0.15,"asper"); }

console.log("\n=== FLUCTUATION 5 s + balayage f_mod (pic attendu ~4 Hz) ===");
for(const fm of [1,2,4,8,16,32]){ const F=runFluct(paTone(1000,60,FS*5,fm,1),16384); line("AM "+fm+" Hz 100% 60 dB",F,null,0,"vacil"); }
