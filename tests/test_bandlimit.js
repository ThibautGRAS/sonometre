/* Test du filtre de limitation de bande (passe-haut / passe-bas). Fonctions réelles de index.html.
   Vérifie : magnitude −3 dB à fc, pente 2e ordre, atténuation réelle sur LZeq (chaîne temporelle),
   platitude en bande passante. Code retour 0 = OK. */
const fs_=require('fs');
const src=fs_.readFileSync('index.html','utf8').match(/<script>([\s\S]*?)<\/script>/g).map(s=>s.replace(/<\/?script>/g,'')).sort((a,b)=>a.length-b.length).pop();
function grab(n){const m=src.match(new RegExp('function\\s+'+n+'\\b[\\s\\S]*?\\n\\}'));if(!m)throw Error('introuvable '+n);return m[0];}
var TAU={F:0.125,S:1,V:10};
var S={corr:'off',corrCurve:null,device:'iphone',hpFc:0,lpFc:0};
var GENERIC={iphone:{fc:[20],g:[0]}};
eval(['interpCurve','activeCorrCurve','rbjPeak','rbjLowShelf','rbjHighShelf','rbjHP','rbjLP','biqMagDb','cascadeMagDb',
      'solveNormal','designCorrFilter','buildCorrFilter','buildBandLimit','designAWeight','designCWeight','runBq',
      'buildLvlDet','lvlDetRun'].map(grab).join('\n'));
const FS=48000;
let PASS=0,FAIL=0;
function ok(c,l,i){if(c)PASS++;else{FAIL++;console.log('  FAIL '+l+(i?' → '+i:''));}}
function tone(f,dur,a){const N=Math.round(FS*dur),x=new Float64Array(N);for(let i=0;i<N;i++)x[i]=a*Math.sin(2*Math.PI*f*i/FS);return x;}
function iirZ(sig){const d=buildLvlDet(FS),B=1024;for(let o=0;o<sig.length;o+=B)lvlDetRun(d,sig.subarray(o,Math.min(o+B,sig.length)),true);return 10*Math.log10(d.eqZ/d.eqN);}

console.log('=== TEST limitation de bande ===');
// 1) magnitude à fc = -3 dB (Butterworth 2e ordre)
for(const fc of [3,10,20]){const H=rbjHP(FS,fc,0.7071);ok(Math.abs(biqMagDb(H,fc,FS)-(-3.01))<0.25,`HP ${fc}Hz : -3 dB à fc`,biqMagDb(H,fc,FS).toFixed(2));}
for(const fc of [20000,22000]){const L=rbjLP(FS,fc,0.7071);ok(Math.abs(biqMagDb(L,fc,FS)-(-3.01))<0.35,`LP ${fc}Hz : -3 dB à fc`,biqMagDb(L,fc,FS).toFixed(2));}
// 2) pente 2e ordre : ~ -40 dB/décade (à 0,1·fc pour le HP)
{const H=rbjHP(FS,10,0.7071);const a=biqMagDb(H,1,FS);ok(a<-35&&a>-45,'HP pente 2e ordre (~-40 dB à 0,1·fc)',a.toFixed(1));}
// 3) platitude en bande passante (HP 10, LP 22k)
{const H=rbjHP(FS,10,0.7071),L=rbjLP(FS,22000,0.7071);let mx=0;for(let f=50;f<=10000;f*=1.5)mx=Math.max(mx,Math.abs(biqMagDb(H,f,FS)+biqMagDb(L,f,FS)));ok(mx<0.6,'bande passante 50 Hz–10 kHz quasi plate',mx.toFixed(2)+' dB');}
// 4) atténuation RÉELLE sur LZeq (chaîne temporelle) : ton à fc → -3 dB vs bande passante
S.hpFc=10;S.lpFc=22000;
{const zc=iirZ(tone(10,3,0.2)), zp=iirZ(tone(1000,3,0.2));ok(Math.abs((zc-zp)-(-3.01))<0.4,'LZeq ton @HP fc = -3 dB vs 1 kHz',(zc-zp).toFixed(2));}
// 5) infrason fortement atténué (2 Hz avec HP 10 Hz)
{const z2=iirZ(tone(2,3,0.2)), zp=iirZ(tone(1000,3,0.2));ok((z2-zp)<-25,'LZeq infrason 2 Hz fortement atténué',(z2-zp).toFixed(1)+' dB');}
// 6) Off = neutre (bande passante inchangée)
S.hpFc=0;S.lpFc=0;
{const z=iirZ(tone(1000,2,0.2));ok(Math.abs(z-10*Math.log10(0.02))<0.15,'Off : LZeq 1 kHz = niveau brut',z.toFixed(2));}
console.log(`=== RÉSULTAT : ${PASS} OK, ${FAIL} échec(s) ===`);
process.exit(FAIL?1:0);
