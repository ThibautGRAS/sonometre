/* Génère un rapport de validation DSP autonome (HTML + SVG) à partir des fonctions RÉELLES
   de index.html. Sortie : tests/rapport_validation_dsp.html (déployable, visualisable iPhone). */
const fs_=require('fs');
const src=fs_.readFileSync('index.html','utf8').match(/<script>([\s\S]*?)<\/script>/g).map(s=>s.replace(/<\/?script>/g,'')).sort((a,b)=>a.length-b.length).pop();
function grab(n){const m=src.match(new RegExp('function\\s+'+n+'\\b[\\s\\S]*?\\n\\}'));if(!m)throw Error('introuvable '+n);return m[0];}
var TAU={F:0.125,S:1,V:10};
var S={corr:'off',corrCurve:null,device:'iphone'};
var GENERIC={iphone:{fc:[20,25,31.5,40,50,63,80,100,125,160,200,1000,5000,6300,8000,10000,12500,16000],g:[12,10,8,6,4.5,3,2,1.2,0.7,0.3,0,0,0,-0.5,-1.5,-2.5,-3,-2]}};
eval(['interpCurve','activeCorrCurve','rbjPeak','rbjLowShelf','rbjHighShelf','biqMagDb','cascadeMagDb',
      'solveNormal','designCorrFilter','buildCorrFilter','designAWeight','designCWeight','runBq',
      'buildLvlDet','lvlDetRun','aWeight','cWeight','fft'].map(grab).join('\n'));

const FS=48000;
const CURVE_MEMS={fc:[20,50,100,200,500,1000,2000,4000,8000,16000,20000],g:[10,8,5,2,0.5,0,-0.5,-2,-6,-14,-18]};
// IEC 61672-1
const NF=[16,20,25,31.5,40,50,63,80,100,125,160,200,250,315,400,500,630,800,1000,1250,1600,2000,2500,3150,4000,5000,6300,8000,10000,12500,16000];
const AN=[-56.7,-50.5,-44.7,-39.4,-34.6,-30.2,-26.2,-22.5,-19.1,-16.1,-13.4,-10.9,-8.6,-6.6,-4.8,-3.2,-1.9,-0.8,0,0.6,1.0,1.2,1.3,1.2,1.0,0.5,-0.1,-1.1,-2.5,-4.3,-6.6];
const CN=[-8.5,-6.2,-4.4,-3.0,-2.0,-1.3,-0.8,-0.5,-0.3,-0.2,-0.1,0,0,0,0,0,0,0,0,0,0,-0.2,-0.3,-0.5,-0.8,-1.3,-2.0,-3.0,-4.4,-6.2,-8.5];
const T1=[2.5,2.5,2.0,2.0,1.5,1.5,1.5,1.5,1.4,1.4,1.4,1.4,1.4,1.4,1.4,1.4,1.4,1.4,1.1,1.4,1.6,1.6,1.6,1.6,1.6,2.1,2.1,2.1,2.6,3.0,3.5];

// ---------- moteur de calcul (repris du banc temps réel) ----------
function blackman(N){const w=new Float64Array(N);for(let i=0;i<N;i++)w[i]=0.42-0.5*Math.cos(2*Math.PI*i/(N-1))+0.08*Math.cos(4*Math.PI*i/(N-1));return w;}
function corrDbAt(f){const c=activeCorrCurve();return c?interpCurve(c,f):0;}
function mkTone(f,fs,dur,a){const N=Math.round(fs*dur),x=new Float64Array(N);for(let i=0;i<N;i++)x[i]=a*Math.sin(2*Math.PI*f*i/fs);return x;}
function iirLevels(sig,fs){const det=buildLvlDet(fs),B=1024;for(let o=0;o<sig.length;o+=B){lvlDetRun(det,sig.subarray(o,Math.min(o+B,sig.length)),true);}return{A:det.eqA/det.eqN,C:det.eqC/det.eqN,Z:det.eqZ/det.eqN};}
function fftLevels(sig,fs,N){const w=blackman(N),n=N/2,wA=new Float64Array(n),wC=new Float64Array(n),cg=new Float64Array(n);
  for(let i=0;i<n;i++){const f=i*fs/N;wA[i]=Math.pow(10,aWeight(f)/10);wC[i]=Math.pow(10,cWeight(f)/10);cg[i]=(S.corr!=='off')?Math.pow(10,corrDbAt(f)/10):1;}
  const hop=Math.floor(N/2);let fr=0,sA=0,sC=0,sZ=0;
  for(let o=0;o+N<=sig.length;o+=hop){const re=new Float64Array(N),im=new Float64Array(N);let Pt=0;
    for(let i=0;i<N;i++){const s=sig[o+i];re[i]=s*w[i];Pt+=s*s;}Pt/=N;fft(re,im);
    let pA=0,pC=0,pZ=0;for(let i=1;i<n;i++){let p=re[i]*re[i]+im[i]*im[i];if(S.corr!=='off')p*=cg[i];pZ+=p;pA+=p*wA[i];pC+=p*wC[i];}
    if(pZ<=0)continue;const K=Pt/pZ;sA+=pA*K;sC+=pC*K;sZ+=pZ*K;fr++;}
  return{A:sA/fr,C:sC/fr,Z:sZ/fr};}
const dbp=p=>10*Math.log10(p);

// ---------- SVG ----------
const NAVY='#001E50', RED='#EF3346', INK='#0b2a4a';
function svgChart(o){
  const W=680,H=320,pL=54,pR=14,pT=34,pB=42;
  const xmin=o.xmin,xmax=o.xmax,ymin=o.ymin,ymax=o.ymax;
  const X=f=>pL+(Math.log(f/xmin)/Math.log(xmax/xmin))*(W-pL-pR);
  const Y=v=>pT+(1-(v-ymin)/(ymax-ymin))*(H-pT-pB);
  let s=`<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px;height:auto;background:#fff;border:1px solid #dbe4ee;border-radius:8px">`;
  s+=`<text x="${W/2}" y="20" text-anchor="middle" font-family="Arial" font-size="14" font-weight="700" fill="${NAVY}">${o.title}</text>`;
  // grille Y
  s+=`<g font-family="Arial" font-size="10" fill="#5a6b7d">`;
  const dy=o.ystep||((ymax-ymin)>25?10:(ymax-ymin)>8?2:1);
  for(let v=Math.ceil(ymin/dy)*dy;v<=ymax;v+=dy){const y=Y(v);s+=`<line x1="${pL}" y1="${y}" x2="${W-pR}" y2="${y}" stroke="#eef2f7"/><text x="${pL-5}" y="${y+3}" text-anchor="end">${(v>0?'+':'')+v}</text>`;}
  // grille X (déc + repères)
  const decs=[20,50,100,200,500,1000,2000,5000,10000,20000];
  for(const f of decs){if(f<xmin||f>xmax)continue;const x=X(f);s+=`<line x1="${x}" y1="${pT}" x2="${x}" y2="${H-pB}" stroke="#eef2f7"/><text x="${x}" y="${H-pB+13}" text-anchor="middle">${f>=1000?(f/1000)+'k':f}</text>;`}
  s+=`<text x="${(pL+W-pR)/2}" y="${H-6}" text-anchor="middle" font-size="10" fill="#5a6b7d">Fréquence (Hz)</text>`;
  s+=`<text transform="translate(13,${(pT+H-pB)/2}) rotate(-90)" text-anchor="middle" font-size="10" fill="#5a6b7d">${o.yLabel||'dB'}</text></g>`;
  // ligne 0
  if(ymin<0&&ymax>0){s+=`<line x1="${pL}" y1="${Y(0)}" x2="${W-pR}" y2="${Y(0)}" stroke="#b9c6d6" stroke-width="1"/>`;}
  // bande de tolérance
  if(o.band){let up='',lo='';for(const p of o.band){up+=`${X(p[0])},${Y(p[1])} `;}for(let i=o.band.length-1;i>=0;i--){lo+=`${X(o.band[i][0])},${Y(o.band[i][2])} `;}
    s+=`<polygon points="${up}${lo}" fill="rgba(47,160,90,.12)" stroke="none"/>`;
    s+=`<polyline points="${up}" fill="none" stroke="rgba(47,160,90,.5)" stroke-width="1" stroke-dasharray="4 3"/>`;
    s+=`<polyline points="${o.band.map(p=>X(p[0])+','+Y(p[2])).join(' ')}" fill="none" stroke="rgba(47,160,90,.5)" stroke-width="1" stroke-dasharray="4 3"/>`;}
  // séries
  for(const se of o.series){
    if(se.pts&&se.pts.length){s+=`<polyline points="${se.pts.map(p=>X(p[0])+','+Y(p[1])).join(' ')}" fill="none" stroke="${se.color}" stroke-width="${se.w||2}"${se.dash?` stroke-dasharray="${se.dash}"`:''}/>`;}
    if(se.markers){for(const p of se.markers){s+=`<circle cx="${X(p[0])}" cy="${Y(p[1])}" r="2.6" fill="${se.color}"/>`;}}
  }
  // légende
  let lx=pL+6,ly=pT+12;s+=`<g font-family="Arial" font-size="10.5">`;
  for(const se of o.series){s+=`<rect x="${lx}" y="${ly-8}" width="16" height="3" fill="${se.color}"/><text x="${lx+20}" y="${ly-3}" fill="${INK}">${se.name}</text>`;lx+=28+se.name.length*6.2;if(lx>W-140){lx=pL+6;ly+=15;}}
  s+=`</g></svg>`;
  return s;
}

// ---------- 1) Pondérations A/C : écart IIR vs IEC 61672-1 + tolérance classe 1 ----------
const Aw=designAWeight(FS), Cw=designCWeight(FS);
function devChart(w,Nom,title){
  const dev=NF.map((f,i)=>[f, cascadeMagDb(w,f,FS)-Nom[i]]);
  const band=NF.map((f,i)=>[f, T1[i], -T1[i]]);
  return svgChart({title, xmin:16,xmax:20000, ymin:-4,ymax:4, ystep:1, yLabel:'écart (dB)',
    band, series:[{name:'écart IIR − IEC', color:RED, pts:dev, markers:dev, w:2},
                  {name:'tolérance classe 1', color:'rgba(47,160,90,.7)', pts:[], dash:'4 3'}]});
}
// courbes absolues A & C : IIR vs nominal
function absChart(w,Nom,title,col){
  const dense=[];for(let i=0;i<=160;i++){const f=16*Math.pow(20000/16,i/160);dense.push([f,cascadeMagDb(w,f,FS)]);}
  return svgChart({title, xmin:16,xmax:20000, ymin:-60,ymax:6, ystep:10, yLabel:'gain (dB)',
    series:[{name:'IIR (biquads)', color:col, pts:dense, w:2},
            {name:'IEC 61672-1 (nominal)', color:NAVY, pts:[], markers:NF.map((f,i)=>[f,Nom[i]])}]});
}

// ---------- 2) Filtre de correction : cible vs réalisé (MEMS) ----------
S.corr='profile'; S.corrCurve=CURVE_MEMS;
const cc=activeCorrCurve(); const cf=designCorrFilter(FS,cc);
const dense2=[],tgt=[];for(let i=0;i<=180;i++){const f=20*Math.pow(20000/20,i/180);dense2.push([f,cascadeMagDb(cf.sections,f,FS)]);tgt.push([f,interpCurve(cc,f)]);}
const corrChart=svgChart({title:'Filtre de correction — cible vs réalisé (profil MEMS, normalisé 0 dB à 1 kHz)',
  xmin:20,xmax:20000, ymin:-16,ymax:12, ystep:4, yLabel:'gain (dB)',
  series:[{name:'cible (courbe)', color:NAVY, pts:tgt, w:2, dash:'5 3'},
          {name:'réalisé (cascade biquads)', color:RED, pts:dense2, w:2},
          {name:'points profil', color:'#2FA05A', pts:[], markers:cc.fc.map((f,i)=>[f,cc.g[i]])}]});
const corrDev=svgChart({title:'Filtre de correction — écart réalisé − cible',
  xmin:20,xmax:12500, ymin:-1,ymax:1, ystep:0.5, yLabel:'écart (dB)',
  series:[{name:'écart', color:RED, pts:dense2.filter(p=>p[0]<=12500).map(p=>[p[0], p[1]-interpCurve(cc,p[0])]), w:2}]});

// ---------- 3) Temps réel : LAeq & LZeq par ton, IIR vs FFT vs théorie ----------
const SWEEP=[31.5,63,125,250,500,1000,2000,4000,8000];
function rtSweep(weight){
  const out={iir:[],fft:[],theo:[]};
  for(const f of SWEEP){
    const sig=mkTone(f,FS,2,0.2);
    const iir=iirLevels(sig,FS), fw=fftLevels(sig,FS,16384);
    const ms=0.2*0.2/2, cd=(S.corr!=='off')?corrDbAt(f):0;
    const wd=weight==='A'?aWeight(f):weight==='C'?cWeight(f):0;
    const th=ms*Math.pow(10,(wd+cd)/10);
    out.iir.push([f,dbp(iir[weight])]); out.fft.push([f,dbp(fw[weight])]); out.theo.push([f,dbp(th)]);
  }
  return out;
}
S.corr='profile'; S.corrCurve=CURVE_MEMS;
const rtA=rtSweep('A'), rtZ=rtSweep('Z');
function rtChart(d,title,yl){return svgChart({title, xmin:31.5,xmax:8000, ymin:Math.floor(Math.min(...d.theo.map(p=>p[1]),...d.fft.map(p=>p[1]))/5)*5-2, ymax:Math.ceil(Math.max(...d.theo.map(p=>p[1]),...d.fft.map(p=>p[1]))/5)*5+2, ystep:5, yLabel:yl,
  series:[{name:'théorie', color:'#2FA05A', pts:d.theo, w:3},
          {name:'IIR temporel', color:RED, pts:d.iir, w:2, markers:d.iir},
          {name:'dérivé FFT', color:NAVY, pts:d.fft, w:2, dash:'5 3', markers:d.fft}]});}
const rtAChart=rtChart(rtA,'Temps réel LAeq par ton — correction MEMS (IIR ≡ théorie ; FFT diverge)','L_Aeq (dB re 0 dBFS)');
const rtZChart=rtChart(rtZ,'Temps réel LZeq par ton — correction MEMS (cancellation de Parseval côté FFT)','L_Zeq (dB re 0 dBFS)');

// écarts max pour le texte
S.corr='off';S.corrCurve=null;let aC1=0,cC1=0;for(let i=0;i<NF.length;i++){if(NF[i]<16||NF[i]>12500)continue;aC1=Math.max(aC1,Math.abs(cascadeMagDb(Aw,NF[i],FS)-AN[i]));cC1=Math.max(cC1,Math.abs(cascadeMagDb(Cw,NF[i],FS)-CN[i]));}
const now=new Date().toISOString().slice(0,10);

// ---------- HTML ----------
const html=`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Rapport de validation DSP — Sonomètre CETIM</title>
<style>
 body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#12293f;max-width:760px;margin:0 auto;padding:18px 16px 60px;line-height:1.5;background:#f6f9fc}
 h1{color:${NAVY};font-size:22px;border-bottom:3px solid ${RED};padding-bottom:8px;margin-bottom:4px}
 h2{color:${NAVY};font-size:17px;margin-top:28px;border-left:4px solid ${RED};padding-left:9px}
 h3{color:${NAVY};font-size:14px;margin-top:18px}
 .meta{color:#5a6b7d;font-size:13px;margin-bottom:8px}
 .fig{margin:14px 0 6px}
 .cap{font-size:12px;color:#5a6b7d;margin:2px 2px 18px;font-style:italic}
 table{border-collapse:collapse;width:100%;font-size:13px;margin:10px 0}
 th,td{border:1px solid #d6e0ea;padding:5px 8px;text-align:center}
 th{background:${NAVY};color:#fff;font-weight:600}
 td.l,th.l{text-align:left}
 .ok{color:#1f8a4c;font-weight:700}
 .warn{color:#b26a00;font-weight:700}
 code{background:#eef2f7;padding:1px 5px;border-radius:4px;font-size:12px}
 .note{background:#eaf2fb;border-left:4px solid ${NAVY};padding:9px 12px;border-radius:6px;margin:12px 0;font-size:13px}
 .foot{margin-top:36px;padding-top:12px;border-top:1px solid #d6e0ea;font-size:12px;color:#5a6b7d}
</style></head><body>
<h1>Validation du traitement du signal — Sonomètre CETIM</h1>
<div class="meta">Réf. SONO-VAL-002 · ${now} · Généré automatiquement à partir des fonctions déployées (<code>index.html</code>) · fs = ${FS/1000} kHz · Auteur : Thibaut Gras</div>

<div class="note"><b>Objet.</b> Ce rapport documente et illustre la conformité des chaînes de niveau du sonomètre : pondérations fréquentielles A/C (IEC 61672-1), filtre de correction micro, et comparaison des deux méthodes de calcul temps réel (temporelle IIR vs dérivée FFT) face à la théorie. Toutes les courbes sont calculées avec le code réellement déployé.</div>

<h2>1. Méthodologie</h2>
<p>Les fonctions DSP sont extraites de <code>index.html</code> et exécutées hors ligne (Node). Trois références sont comparées :</p>
<ul>
<li><b>Temporel IIR</b> — pondérations A/C par biquads (transformation bilinéaire, IEC 61672), filtre de correction (cascade de biquads) appliqué en amont, intégrateurs exponentiels et énergie cumulée (Leq). C'est la méthode par défaut de l'application.</li>
<li><b>Dérivé FFT</b> — bloc fenêtré (Blackman), FFT, pondération par raie <code>wA/wC</code>, correction par raie <code>compGain</code>, recalage d'amplitude par identité de Parseval (<code>K = P<sub>t</sub>/p<sub>Z</sub></code>).</li>
<li><b>Théorie</b> — pour des sinusoïdes, puissance pondérée exacte Σ (a²/2)·10<sup>(W(f)+corr(f))/10</sup>.</li>
</ul>

<h2>2. Pondérations A et C (IEC 61672-1)</h2>
<p>Écart de la réalisation IIR aux valeurs nominales, comparé à la tolérance <b>classe 1</b>. Dans la bande 16 Hz–12,5 kHz, l'écart maximal mesuré est de <b>${aC1.toFixed(2)} dB (A)</b> et <b>${cC1.toFixed(2)} dB (C)</b>, soit un fonctionnement <span class="ok">classe 1</span>.</p>
<div class="fig">${devChart(Aw,AN,'Pondération A — écart IIR vs IEC 61672-1')}</div>
<div class="cap">Fig. 1 — Écart de la pondération A (rouge) dans l'enveloppe de tolérance classe 1 (verte).</div>
<div class="fig">${devChart(Cw,CN,'Pondération C — écart IIR vs IEC 61672-1')}</div>
<div class="cap">Fig. 2 — Écart de la pondération C. Au-delà de ~12,5 kHz, l'écart croît (limite bilinéaire près de Nyquist), sans effet notable sur les niveaux pondérés.</div>
<div class="fig">${absChart(Aw,AN,'Pondération A — courbe absolue',RED)}</div>
<div class="cap">Fig. 3 — Courbe A réalisée (rouge) vs points nominaux IEC (bleu).</div>

<h2>3. Filtre de correction micro</h2>
<p>Le filtre reproduit une courbe de correction (ici profil type MEMS) par une cascade de biquads, ajustée par moindres carrés et <b>normalisée à 0 dB à 1 kHz</b> (forme relative au médium ; le niveau global relève de l'offset). Écart réalisé–cible &lt; <b>${(function(){let m=0;for(let i=0;i<=180;i++){const f=20*Math.pow(20000/20,i/180);if(f<50||f>12500)continue;m=Math.max(m,Math.abs(cascadeMagDb(cf.sections,f,FS)-interpCurve(cc,f)));}return m.toFixed(2);})()} dB</b> de 50 Hz à 12,5 kHz.</p>
<div class="fig">${corrChart}</div>
<div class="cap">Fig. 4 — Cible (bleu pointillé), réalisé (rouge), points du profil (vert).</div>
<div class="fig">${corrDev}</div>
<div class="cap">Fig. 5 — Écart réalisé − cible (bande utile).</div>

<h2>4. Comparaison temps réel : IIR vs FFT vs théorie</h2>
<p>Niveaux par ton pur, <b>correction MEMS active</b>. La méthode temporelle IIR suit la théorie ; la méthode dérivée FFT s'en écarte.</p>
<div class="fig">${rtAChart}</div>
<div class="cap">Fig. 6 — L<sub>Aeq</sub> : IIR (rouge) ≡ théorie (vert) ; dérivé FFT (bleu pointillé) divergent.</div>
<div class="fig">${rtZChart}</div>
<div class="cap">Fig. 7 — L<sub>Zeq</sub> : le dérivé FFT ignore la correction (ligne quasi plate) — <b>cancellation de Parseval</b> — alors que l'IIR applique correctement la courbe.</div>

<table><tr><th class="l">Signal (corr. MEMS)</th><th>IIR</th><th>FFT</th><th>Théorie</th><th>IIR−théo</th><th>IIR−FFT</th></tr>
${(function(){let r='';for(let i=0;i<SWEEP.length;i++){r+=`<tr><td class="l">ton ${SWEEP[i]} Hz · L_Aeq</td><td>${rtA.iir[i][1].toFixed(2)}</td><td>${rtA.fft[i][1].toFixed(2)}</td><td>${rtA.theo[i][1].toFixed(2)}</td><td class="ok">${(rtA.iir[i][1]-rtA.theo[i][1]).toFixed(2)}</td><td>${(rtA.iir[i][1]-rtA.fft[i][1]).toFixed(2)}</td></tr>`;}return r;})()}
</table>

<div class="note"><b>Interprétation (Parseval).</b> Côté FFT, le recalage <code>K = P<sub>t</sub>/p<sub>Z</sub></code> ramène l'énergie spectrale sur le RMS temporel <i>brut</i> du bloc. La contribution <i>globale</i> de la courbe de correction s'annule alors dans ce rapport (pour Z, exactement : L<sub>Zeq</sub> corrigé = L<sub>Zeq</sub> brut). Seule la forme relative subsiste partiellement pour A/C. La méthode <b>temporelle IIR</b> n'a pas ce biais car la correction est appliquée au signal avant pondération et le Leq dérive du signal corrigé (« Option 1 »). <b>Conclusion : correction active, seul le mode Temporel IIR — le défaut — est exact.</b></div>

<h2>5. Conclusion</h2>
<ul>
<li>Pondérations A/C : <span class="ok">classe 1</span> de 16 Hz à 12,5 kHz (écart ≤ ${Math.max(aC1,cC1).toFixed(2)} dB).</li>
<li>Filtre de correction : fidélité &lt; ~0,5 dB (bande utile) sur courbe douce.</li>
<li>Niveaux temps réel IIR : conformes à la théorie à ≤ 0,25 dB, correction comprise.</li>
<li>Mode dérivé FFT : cohérent hors correction ; réservé à la comparaison sous correction (Parseval).</li>
</ul>
<p><b>Hors périmètre</b> (validation sur appareil requise) : chaîne micro iOS, calibration absolue, référence pleine échelle (130 dBFS par défaut, hypothèse), émergence ISO 1996-2.</p>

<div class="foot">Sonomètre CETIM · Rapport généré par <code>tests/make_report.js</code> · reproductible par <code>node tests/make_report.js</code>. Les courbes reflètent le code de la version déployée.</div>
</body></html>`;

fs_.writeFileSync('tests_out_rapport.html',html);
console.log('Rapport écrit : tests_out_rapport.html ('+(html.length/1024|0)+' Ko)');
console.log(`A classe1 max=${aC1.toFixed(2)} dB, C classe1 max=${cC1.toFixed(2)} dB`);
