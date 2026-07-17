/* ================================================================
   ROUTINE DE TEST — filtre de correction micro temporel (Option 1)
   Extrait les fonctions RÉELLES depuis index.html (comme tests/extract_dsp)
   et vérifie : fidélité du fit, neutralité Off, gain réel sur signaux,
   cohérence énergétique Z et A-pondérée, stabilité.
   Code retour 0 = tout OK. ================================================================ */
const fs_ = require('fs');
const html = fs_.readFileSync('index.html', 'utf8');
const src  = (html.match(/<script>([\s\S]*?)<\/script>/g)||[]).map(s=>s.replace(/<\/?script>/g,'')).sort((a,b)=>a.length-b.length).pop();

// globals nécessaires aux fonctions extraites
var TAU = {F:0.125, S:1, V:10};
var S   = {corr:'off', corrCurve:null};

function grab(name){
  const m = src.match(new RegExp('function\\s+'+name+'\\b[\\s\\S]*?\\n\\}'));
  if(!m) throw new Error('fonction introuvable : '+name);
  return m[0];
}
const NAMES = ['interpCurve','rbjPeak','rbjLowShelf','rbjHighShelf','biqMagDb',
               'cascadeMagDb','solveNormal','designCorrFilter','activeCorrCurve','buildCorrFilter',
               'designAWeight','designCWeight','runBq'];
eval(NAMES.map(grab).join('\n'));

// ---------- utilitaires ----------
let PASS=0, FAIL=0;
function ok(cond, label, info){ if(cond){PASS++; /*console.log('  ok  '+label);*/} else {FAIL++; console.log('  FAIL '+label+(info?'  → '+info:''));} }
function clone(secs){ return secs.map(s=>({b0:s.b0,b1:s.b1,b2:s.b2,a1:s.a1,a2:s.a2,z1:0,z2:0})); }
function filterSig(secs, x){ const c=clone(secs); const y=new Float64Array(x.length); for(let i=0;i<x.length;i++)y[i]=runBq(c,x[i]); return y; }
function meanSq(x, skip){ let s=0,n=0; for(let i=skip;i<x.length;i++){s+=x[i]*x[i];n++;} return s/n; }
function db(p){ return 10*Math.log10(p); }
function magLin(secs,f,fs){ return Math.pow(10, cascadeMagDb(secs,f,fs)/20); }

// courbes de test
const CURVES = {
  mems:  {fc:[20,50,100,200,500,1000,2000,4000,8000,16000,20000], g:[10,8,5,2,0.5,0,-0.5,-2,-6,-14,-18]},
  flat:  {fc:[20,1000,20000], g:[0,0,0]},
  boost: {fc:[20,100,1000,10000,20000], g:[6,6,0,-3,-8]},
  steep: {fc:[20,50,100,500,1000,5000,10000,20000], g:[12,10,6,1,0,-4,-12,-20]}
};
const FS = [44100, 48000];

console.log('=== TEST filtre de correction micro (Option 1) ===\n');

// ---------- 1) Fidélité du fit (magnitude analytique vs cible) ----------
console.log('[1] Fidélité magnitude (cible vs cascade)');
for(const fs of FS){
  for(const [nm,curve] of Object.entries(CURVES)){
    const r = designCorrFilter(fs, curve);
    let eBand=0, eEdge=0;
    for(let i=0;i<200;i++){
      const f = 16*Math.pow((fs/2*0.98)/16, i/199);
      const e = Math.abs(cascadeMagDb(r.sections,f,fs) - interpCurve(curve,f));
      if(f>=50 && f<=12500) eBand=Math.max(eBand,e);
      else if(f>=20)        eEdge=Math.max(eEdge,e);
    }
    const tolBand = nm==='steep'?0.6:0.4, tolEdge = 3.5;
    ok(eBand<=tolBand, `fit ${nm} fs=${fs} bande 50Hz-12.5kHz (${eBand.toFixed(2)}dB ≤ ${tolBand})`, eBand.toFixed(2));
    ok(eEdge<=tolEdge, `fit ${nm} fs=${fs} bords (${eEdge.toFixed(2)}dB ≤ ${tolEdge})`);
  }
}

// ---------- 2) Neutralité correction = Off ----------
console.log('[2] Neutralité (correction = Off)');
S.corr='off'; S.corrCurve=null;
ok(buildCorrFilter(48000)===null, 'buildCorrFilter(Off) = null');
S.corr='profile'; S.corrCurve=CURVES.mems;
ok(Array.isArray(buildCorrFilter(48000)), 'buildCorrFilter(profil) = cascade');
// courbe plate → filtre quasi identité
{ const r=designCorrFilter(48000,CURVES.flat); let m=0; for(let f=30;f<15000;f*=1.3)m=Math.max(m,Math.abs(cascadeMagDb(r.sections,f,48000))); ok(m<0.15,`courbe plate → gain ~0 (${m.toFixed(3)}dB)`,m.toFixed(3)); }

// ---------- 3) Gain RÉEL sur ton pur (signal temporel filtré) ----------
console.log('[3] Gain réel sur tons purs (RMS sortie/entrée vs courbe)');
for(const fs of FS){
  const r = designCorrFilter(fs, CURVES.mems);
  for(const f0 of [63,125,250,500,1000,2000,4000]){
    const N=Math.round(fs*2), x=new Float64Array(N);
    for(let i=0;i<N;i++)x[i]=Math.sin(2*Math.PI*f0*i/fs);
    const y=filterSig(r.sections,x);
    const skip=Math.round(fs*0.3);                 // jeter le transitoire
    const gain = db(meanSq(y,skip)/meanSq(x,skip));
    const want = interpCurve(CURVES.mems,f0);
    ok(Math.abs(gain-want)<0.5, `ton ${f0}Hz fs=${fs} gain=${gain.toFixed(2)} cible=${want.toFixed(2)}`, (gain-want).toFixed(2));
  }
}

// ---------- 4) Cohérence énergétique Z (multiton) ----------
console.log('[4] Cohérence Leq Z (multiton corrigé, temporel vs théorique)');
for(const fs of FS){
  const r = designCorrFilter(fs, CURVES.mems);
  const tones=[70,180,430,950,2100,5200], N=Math.round(fs*4);
  const x=new Float64Array(N);
  for(const ft of tones) for(let i=0;i<N;i++) x[i]+=Math.sin(2*Math.PI*ft*i/fs);
  const y=filterSig(r.sections,x);
  const skip=Math.round(fs*0.5);
  const msOut=meanSq(y,skip);
  // théorique : Σ (1/2)·|H(f)|²   (tons orthogonaux)
  let th=0; for(const ft of tones){ const H=magLin(r.sections,ft,fs); th+=0.5*H*H; }
  const d=db(msOut)-db(th);
  ok(Math.abs(d)<0.4, `LZeq corrigé fs=${fs} Δ(temporel-théo)=${d.toFixed(3)}dB`, d.toFixed(3));
}

// ---------- 5) Cohérence chaîne corr→A (LAeq) ----------
console.log('[5] Cohérence chaîne corr→A (multiton, temporel vs théorique)');
for(const fs of FS){
  const r  = designCorrFilter(fs, CURVES.mems);
  const A  = designAWeight(fs);
  const tones=[70,180,430,950,2100,5200], N=Math.round(fs*4);
  const x=new Float64Array(N);
  for(const ft of tones) for(let i=0;i<N;i++) x[i]+=Math.sin(2*Math.PI*ft*i/fs);
  // temporel : corr puis A
  const y1=filterSig(r.sections,x), y2=filterSig(A,y1);
  const skip=Math.round(fs*0.5), msOut=meanSq(y2,skip);
  // théorique : Σ (1/2)·|Hcorr|²·|HA|²
  let th=0; for(const ft of tones){ const Hc=magLin(r.sections,ft,fs), Ha=magLin(A,ft,fs); th+=0.5*Hc*Hc*Ha*Ha; }
  const d=db(msOut)-db(th);
  ok(Math.abs(d)<0.5, `LAeq corrigé fs=${fs} Δ(temporel-théo)=${d.toFixed(3)}dB`, d.toFixed(3));
}

// ---------- 6) Stabilité (pas d'emballement) ----------
console.log('[6] Stabilité (bruit blanc, sortie bornée)');
for(const fs of FS){
  for(const [nm,curve] of Object.entries(CURVES)){
    const r=designCorrFilter(fs,curve);
    const N=fs, x=new Float64Array(N); let seed=12345;
    for(let i=0;i<N;i++){seed=(seed*1103515245+12345)&0x7fffffff; x[i]=(seed/0x3fffffff-1);}
    const y=filterSig(r.sections,x);
    let finite=true,mx=0; for(let i=0;i<N;i++){ if(!isFinite(y[i])){finite=false;break;} const a=Math.abs(y[i]); if(a>mx)mx=a; }
    ok(finite && mx<1e3, `stable ${nm} fs=${fs} (max|y|=${mx.toFixed(1)})`);
  }
}

// ---------- 7) A-weighting design sain (référence 1 kHz = 0 dB) ----------
console.log('[7] Contrôles pondération A (référence)');
for(const fs of FS){
  const A=designAWeight(fs);
  ok(Math.abs(cascadeMagDb(A,1000,fs))<0.05, `A(1kHz)=0dB fs=${fs}`, cascadeMagDb(A,1000,fs).toFixed(3));
  ok(Math.abs(cascadeMagDb(A,100,fs)-(-19.1))<0.6, `A(100Hz)≈-19.1dB fs=${fs}`, cascadeMagDb(A,100,fs).toFixed(2));
}

console.log(`\n=== RÉSULTAT : ${PASS} OK, ${FAIL} échec(s) ===`);
process.exit(FAIL?1:0);
