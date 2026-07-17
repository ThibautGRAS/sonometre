/* ================================================================
   VALIDATION TEMPS RÉEL — comparaison des méthodes de niveau
   Rejoue la boucle bloc par bloc avec les fonctions RÉELLES de index.html :
   - chaîne TEMPORELLE IIR (lvlDet : correction biquad + A/C + intégrateurs + Leq)
   - chaîne FFT (fenêtre Blackman + fft + pondération par raie wA/wC + Parseval K)
   - THÉORIE analytique (pour tons/multitons : Σ a²/2 · pondérations)
   Signaux : tons purs, multiton, bruit rose. Correction Off ET profil MEMS.
   Compare LAeq/LCeq/LZeq entre IIR, FFT, théorie. Code retour 0 = OK.
   ================================================================ */
const fs_=require('fs');
const src=fs_.readFileSync('index.html','utf8').match(/<script>([\s\S]*?)<\/script>/g).map(s=>s.replace(/<\/?script>/g,'')).sort((a,b)=>a.length-b.length).pop();
function grab(n){const m=src.match(new RegExp('function\\s+'+n+'\\b[\\s\\S]*?\\n\\}'));if(!m)throw Error('introuvable '+n);return m[0];}

var TAU={F:0.125,S:1,V:10};
var S={corr:'off', corrCurve:null, device:'iphone'};
var GENERIC={iphone:{fc:[20,25,31.5,40,50,63,80,100,125,160,200,1000,5000,6300,8000,10000,12500,16000],
                     g:[12,10,8,6,4.5,3,2,1.2,0.7,0.3,0,0,0,-0.5,-1.5,-2.5,-3,-2]}};

eval(['interpCurve','activeCorrCurve','rbjPeak','rbjLowShelf','rbjHighShelf','biqMagDb','cascadeMagDb',
      'solveNormal','designCorrFilter','buildCorrFilter','designAWeight','designCWeight','runBq',
      'buildLvlDet','lvlDetRun','aWeight','cWeight','fft'].map(grab).join('\n'));

// ---------- utilitaires ----------
const CURVE_MEMS={fc:[20,50,100,200,500,1000,2000,4000,8000,16000,20000],g:[10,8,5,2,0.5,0,-0.5,-2,-6,-14,-18]};
function blackman(N){const w=new Float64Array(N);for(let i=0;i<N;i++)w[i]=0.42-0.5*Math.cos(2*Math.PI*i/(N-1))+0.08*Math.cos(4*Math.PI*i/(N-1));return w;}
function corrDbAt(f){const c=activeCorrCurve();return c?interpCurve(c,f):0;}

// chaîne FFT : renvoie la puissance moyenne pondérée (post-Parseval) sur tout le signal
function fftLevels(sig, fs, N){
  const w=blackman(N); let ws2=0; for(let i=0;i<N;i++)ws2+=w[i]*w[i];
  const n=N/2, freqs=new Float64Array(n), wA=new Float64Array(n), wC=new Float64Array(n), cg=new Float64Array(n);
  for(let i=0;i<n;i++){const f=i*fs/N;freqs[i]=f;wA[i]=Math.pow(10,aWeight(f)/10);wC[i]=Math.pow(10,cWeight(f)/10);
    cg[i]=(S.corr!=='off')?Math.pow(10,corrDbAt(f)/10):1;}
  const hop=Math.floor(N/2); let frames=0, sA=0,sC=0,sZ=0;
  for(let off=0; off+N<=sig.length; off+=hop){
    const re=new Float64Array(N), im=new Float64Array(N); let Pt=0;
    for(let i=0;i<N;i++){const s=sig[off+i];re[i]=s*w[i];Pt+=s*s;}
    Pt/=N;
    fft(re,im);
    let pA=0,pC=0,pZ=0;
    for(let i=1;i<n;i++){let p=(re[i]*re[i]+im[i]*im[i]);if(S.corr!=='off')p*=cg[i];pZ+=p;pA+=p*wA[i];pC+=p*wC[i];}
    if(pZ<=0)continue;
    const K=Pt/pZ;                    // Parseval : recale sur le RMS brut du bloc
    sA+=pA*K; sC+=pC*K; sZ+=pZ*K; frames++;
  }
  return {A:sA/frames, C:sC/frames, Z:sZ/frames};   // puissances moyennes pondérées
}

// chaîne TEMPORELLE IIR : rejoue lvlDetRun bloc par bloc, renvoie le Leq (énergies)
function iirLevels(sig, fs){
  const det=buildLvlDet(fs); const B=1024;
  for(let off=0; off<sig.length; off+=B){
    const blk=sig.subarray(off, Math.min(off+B, sig.length));
    lvlDetRun(det, blk, true);
  }
  return {A:det.eqA/det.eqN, C:det.eqC/det.eqN, Z:det.eqZ/det.eqN};
}

// théorie (somme de sinusoïdes) : puissances pondérées exactes
function theoryLevels(tones){   // tones: [{f,a}]
  let A=0,C=0,Z=0;
  for(const t of tones){const ms=t.a*t.a/2, cd=(S.corr!=='off')?corrDbAt(t.f):0;
    Z+=ms*Math.pow(10,cd/10); A+=ms*Math.pow(10,(aWeight(t.f)+cd)/10); C+=ms*Math.pow(10,(cWeight(t.f)+cd)/10);}
  return {A,C,Z};
}

function mkTones(tones, fs, dur){const N=Math.round(fs*dur),x=new Float64Array(N);
  for(const t of tones)for(let i=0;i<N;i++)x[i]+=t.a*Math.sin(2*Math.PI*t.f*i/fs);return x;}
function pink(fs,dur){const N=Math.round(fs*dur),x=new Float64Array(N);let b0=0,b1=0,b2=0,seed=98765;
  for(let i=0;i<N;i++){seed=(seed*1103515245+12345)&0x7fffffff;const wht=seed/0x3fffffff-1;
    b0=0.99765*b0+wht*0.0990460;b1=0.96300*b1+wht*0.2965164;b2=0.57000*b2+wht*1.0526913;
    x[i]=(b0+b1+b2+wht*0.1848)*0.05;}return x;}
const dbp=p=>10*Math.log10(p);

// ---------- exécution ----------
let PASS=0,FAIL=0;
function chk(cond,label,info){if(cond)PASS++;else{FAIL++;console.log('   FAIL '+label+(info?' → '+info:''));}}

for(const corr of ['off','mems']){
  S.corr = corr==='off'?'off':'profile';
  S.corrCurve = corr==='off'?null:CURVE_MEMS;
  console.log(`\n================ Correction : ${corr==='off'?'OFF':'profil MEMS'} ================`);
  for(const fs of [48000]){
    const N = 16384;
    console.log(`fs=${fs}, FFT N=${N}`);
    console.log(' signal                LAeq: IIR / FFT / théo    ΔIIR-FFT  ΔIIR-théo');

    // 1) tons purs
    for(const f of [125,500,1000,2000,4000]){
      const tones=[{f,a:0.2}];
      const sig=mkTones(tones,fs,3);
      const iir=iirLevels(sig,fs), fw=fftLevels(sig,fs,N), th=theoryLevels(tones);
      const li=dbp(iir.A), lf=dbp(fw.A), lt=dbp(th.A);
      const dIF=li-lf, dIT=li-lt;
      console.log(`  ton ${String(f).padStart(4)} Hz          ${li.toFixed(2).padStart(7)} /${lf.toFixed(2).padStart(7)} /${lt.toFixed(2).padStart(7)}   ${dIF.toFixed(2).padStart(6)}   ${dIT.toFixed(2).padStart(6)}`);
      chk(Math.abs(dIT)<0.7, `ton ${f}Hz IIR vs théo`, dIT.toFixed(2));         // référence : le temporel doit coller à la théorie
      if(corr==='off') chk(Math.abs(dIF)<0.6, `ton ${f}Hz IIR vs FFT (Off)`, dIF.toFixed(2));
    }

    // 2) multiton (A, C, Z)
    {
      const tones=[{f:80,a:0.15},{f:250,a:0.15},{f:800,a:0.15},{f:2500,a:0.15},{f:6300,a:0.15}];
      const sig=mkTones(tones,fs,4);
      const iir=iirLevels(sig,fs), fw=fftLevels(sig,fs,N), th=theoryLevels(tones);
      for(const W of ['A','C','Z']){
        const li=dbp(iir[W]), lf=dbp(fw[W]), lt=dbp(th[W]), dIF=li-lf, dIT=li-lt;
        console.log(`  multiton L${W}eq        ${li.toFixed(2).padStart(7)} /${lf.toFixed(2).padStart(7)} /${lt.toFixed(2).padStart(7)}   ${dIF.toFixed(2).padStart(6)}   ${dIT.toFixed(2).padStart(6)}`);
        chk(Math.abs(dIT)<0.7, `multiton L${W} IIR vs théo`, dIT.toFixed(2));
        if(corr==='off') chk(Math.abs(dIF)<0.6, `multiton L${W} IIR vs FFT (Off)`, dIF.toFixed(2));
      }
      if(corr!=='off') console.log(`   NB : sous correction, FFT s'écarte de la théorie (cancellation de Parseval) — attendu, d'où l'Option 1 (Leq temporel).`);
    }

    // 3) bruit rose (pas de théorie simple → IIR vs FFT quand Off)
    {
      const sig=pink(fs,5);
      const iir=iirLevels(sig,fs), fw=fftLevels(sig,fs,N);
      for(const W of ['A','C','Z']){
        const li=dbp(iir[W]), lf=dbp(fw[W]), dIF=li-lf;
        console.log(`  bruit rose L${W}eq      ${li.toFixed(2).padStart(7)} /${lf.toFixed(2).padStart(7)} /   —       ${dIF.toFixed(2).padStart(6)}`);
        if(corr==='off') chk(Math.abs(dIF)<0.7, `bruit rose L${W} IIR vs FFT (Off)`, dIF.toFixed(2));
      }
    }
  }
}
console.log(`\n=== RÉSULTAT : ${PASS} OK, ${FAIL} échec(s) ===`);
process.exit(FAIL?1:0);
