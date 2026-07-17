/* Test des pondérations A/C (biquads IIR) contre les valeurs nominales IEC 61672-1
   et les tolérances de classe 1 / classe 2. Extrait les fonctions RÉELLES de index.html. */
const fs_=require('fs');
const src=fs_.readFileSync('index.html','utf8').match(/<script>([\s\S]*?)<\/script>/g).map(s=>s.replace(/<\/?script>/g,'')).sort((a,b)=>a.length-b.length).pop();
function grab(n){const m=src.match(new RegExp('function\\s+'+n+'\\b[\\s\\S]*?\\n\\}'));if(!m)throw Error('introuvable '+n);return m[0];}
eval(['biqMagDb','cascadeMagDb','designAWeight','designCWeight'].map(grab).join('\n'));

// fréquences nominales et valeurs A / C IEC 61672-1 (dB)
const F  =[10,12.5,16,20,25,31.5,40,50,63,80,100,125,160,200,250,315,400,500,630,800,1000,1250,1600,2000,2500,3150,4000,5000,6300,8000,10000,12500,16000,20000];
const A  =[-70.4,-63.4,-56.7,-50.5,-44.7,-39.4,-34.6,-30.2,-26.2,-22.5,-19.1,-16.1,-13.4,-10.9,-8.6,-6.6,-4.8,-3.2,-1.9,-0.8,0.0,0.6,1.0,1.2,1.3,1.2,1.0,0.5,-0.1,-1.1,-2.5,-4.3,-6.6,-9.3];
const C  =[-14.3,-11.2,-8.5,-6.2,-4.4,-3.0,-2.0,-1.3,-0.8,-0.5,-0.3,-0.2,-0.1,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,-0.1,-0.2,-0.3,-0.5,-0.8,-1.3,-2.0,-3.0,-4.4,-6.2,-8.5,-11.2];
// tolérances IEC 61672-1 (classe 1 / classe 2), en dB (± ; symétrisé, valeurs typiques par fréquence)
const T1 =[3.5,3.0,2.5,2.5,2.0,2.0,1.5,1.5,1.5,1.5,1.4,1.4,1.4,1.4,1.4,1.4,1.4,1.4,1.4,1.4,1.1,1.4,1.6,1.6,1.6,1.6,1.6,2.1,2.1,2.1,2.6,3.0,3.5,4.0];
const T2 =[5.5,5.5,4.5,4.5,3.5,3.5,2.5,2.5,2.5,2.5,2.0,2.0,2.0,2.0,2.0,2.0,2.0,2.0,2.0,2.0,1.4,1.4,2.6,2.6,3.3,4.3,5.0,5.5,5.5,5.5,5.5,6.0,6.0,6.0];

for(const fs of [44100,48000]){
  const Aw=designAWeight(fs), Cw=designCWeight(fs);
  console.log(`\n=== fs=${fs} Hz ===`);
  console.log(' f(Hz)   A_iec  A_calc   ΔA   |  C_iec  C_calc   ΔC   | classe');
  let worstA=0,worstC=0, c1ok=true;
  for(let i=0;i<F.length;i++){
    const f=F[i];
    const ca=cascadeMagDb(Aw,f,fs), cc=cascadeMagDb(Cw,f,fs);
    const dA=ca-A[i], dC=cc-C[i];
    if(Math.abs(dA)>worstA)worstA=Math.abs(dA);
    if(Math.abs(dC)>worstC)worstC=Math.abs(dC);
    const worst=Math.max(Math.abs(dA),Math.abs(dC));
    const cls = worst<=T1[i]?'C1' : worst<=T2[i]?'C2' : 'HORS';
    if(worst>T1[i]) c1ok=false;
    console.log(`${String(f).padStart(6)}  ${A[i].toFixed(1).padStart(6)} ${ca.toFixed(2).padStart(7)} ${dA.toFixed(2).padStart(6)}  | ${C[i].toFixed(1).padStart(6)} ${cc.toFixed(2).padStart(7)} ${dC.toFixed(2).padStart(6)}  | ${cls}`);
  }
  console.log(`écart max sur toute la plage : ΔA=${worstA.toFixed(2)} dB  ΔC=${worstC.toFixed(2)} dB`);
  // conformité classe 1 dans la bande 16 Hz–12,5 kHz
  let c1=true,bA=0,bC=0; for(let i=0;i<F.length;i++){ if(F[i]<16||F[i]>12500)continue; const dA=Math.abs(cascadeMagDb(Aw,F[i],fs)-A[i]),dC=Math.abs(cascadeMagDb(Cw,F[i],fs)-C[i]); bA=Math.max(bA,dA); bC=Math.max(bC,dC); if(Math.max(dA,dC)>T1[i])c1=false; }
  console.log(`bande 16 Hz–12,5 kHz : ΔA max=${bA.toFixed(2)} dB  ΔC max=${bC.toFixed(2)} dB  → conformité classe 1 : ${c1?'OUI':'NON'}`);
}
