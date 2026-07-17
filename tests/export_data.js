const fs_=require('fs');
const src=fs_.readFileSync('index.html','utf8').match(/<script>([\s\S]*?)<\/script>/g).map(s=>s.replace(/<\/?script>/g,'')).sort((a,b)=>a.length-b.length).pop();
function grab(n){const m=src.match(new RegExp('function\\s+'+n+'\\b[\\s\\S]*?\\n\\}'));if(!m)throw Error('introuvable '+n);return m[0];}
var TAU={F:0.125,S:1,V:10};
var S={corr:'off',corrCurve:null,device:'iphone'};
var GENERIC={iphone:{fc:[20],g:[0]}};
eval(['interpCurve','activeCorrCurve','rbjPeak','rbjLowShelf','rbjHighShelf','biqMagDb','cascadeMagDb',
      'solveNormal','designCorrFilter','buildCorrFilter','designAWeight','designCWeight','runBq',
      'buildLvlDet','lvlDetRun','aWeight','cWeight','fft'].map(grab).join('\n'));
const FS=48000;
const CURVE_MEMS={fc:[20,50,100,200,500,1000,2000,4000,8000,16000,20000],g:[10,8,5,2,0.5,0,-0.5,-2,-6,-14,-18]};
const NF=[16,20,25,31.5,40,50,63,80,100,125,160,200,250,315,400,500,630,800,1000,1250,1600,2000,2500,3150,4000,5000,6300,8000,10000,12500,16000];
const AN=[-56.7,-50.5,-44.7,-39.4,-34.6,-30.2,-26.2,-22.5,-19.1,-16.1,-13.4,-10.9,-8.6,-6.6,-4.8,-3.2,-1.9,-0.8,0,0.6,1.0,1.2,1.3,1.2,1.0,0.5,-0.1,-1.1,-2.5,-4.3,-6.6];
const CN=[-8.5,-6.2,-4.4,-3.0,-2.0,-1.3,-0.8,-0.5,-0.3,-0.2,-0.1,0,0,0,0,0,0,0,0,0,0,-0.2,-0.3,-0.5,-0.8,-1.3,-2.0,-3.0,-4.4,-6.2,-8.5];
const T1=[2.5,2.5,2.0,2.0,1.5,1.5,1.5,1.5,1.4,1.4,1.4,1.4,1.4,1.4,1.4,1.4,1.4,1.4,1.1,1.4,1.6,1.6,1.6,1.6,1.6,2.1,2.1,2.1,2.6,3.0,3.5];
function bm(N){const w=new Float64Array(N);for(let i=0;i<N;i++)w[i]=0.42-0.5*Math.cos(2*Math.PI*i/(N-1))+0.08*Math.cos(4*Math.PI*i/(N-1));return w;}
function corrDbAt(f){const c=activeCorrCurve();return c?interpCurve(c,f):0;}
function mkTone(f,fs,dur,a){const N=Math.round(fs*dur),x=new Float64Array(N);for(let i=0;i<N;i++)x[i]=a*Math.sin(2*Math.PI*f*i/fs);return x;}
function iirLevels(sig,fs){const d=buildLvlDet(fs),B=1024;for(let o=0;o<sig.length;o+=B)lvlDetRun(d,sig.subarray(o,Math.min(o+B,sig.length)),true);return{A:d.eqA/d.eqN,C:d.eqC/d.eqN,Z:d.eqZ/d.eqN};}
function fftLevels(sig,fs,N){const w=bm(N),n=N/2,wA=new Float64Array(n),wC=new Float64Array(n),cg=new Float64Array(n);
  for(let i=0;i<n;i++){const f=i*fs/N;wA[i]=Math.pow(10,aWeight(f)/10);wC[i]=Math.pow(10,cWeight(f)/10);cg[i]=(S.corr!=='off')?Math.pow(10,corrDbAt(f)/10):1;}
  const hop=N/2;let fr=0,sA=0,sC=0,sZ=0;for(let o=0;o+N<=sig.length;o+=hop){const re=new Float64Array(N),im=new Float64Array(N);let Pt=0;for(let i=0;i<N;i++){re[i]=sig[o+i]*w[i];Pt+=sig[o+i]*sig[o+i];}Pt/=N;fft(re,im);let pA=0,pC=0,pZ=0;for(let i=1;i<n;i++){let p=re[i]*re[i]+im[i]*im[i];if(S.corr!=='off')p*=cg[i];pZ+=p;pA+=p*wA[i];pC+=p*wC[i];}if(pZ<=0)continue;const K=Pt/pZ;sA+=pA*K;sC+=pC*K;sZ+=pZ*K;fr++;}
  return{A:sA/fr,C:sC/fr,Z:sZ/fr};}
const dbp=p=>10*Math.log10(p);
const Aw=designAWeight(FS),Cw=designCWeight(FS);
const D={FS};
// pondérations : écart + tolérance, et courbe absolue
D.wf=NF; D.Adev=NF.map((f,i)=>+(cascadeMagDb(Aw,f,FS)-AN[i]).toFixed(3)); D.Cdev=NF.map((f,i)=>+(cascadeMagDb(Cw,f,FS)-CN[i]).toFixed(3)); D.tol=T1;
D.An=AN; D.Cn=CN;
D.Aabs=[];for(let i=0;i<=140;i++){const f=16*Math.pow(20000/16,i/140);D.Aabs.push([+f.toFixed(2),+cascadeMagDb(Aw,f,FS).toFixed(3)]);}
let aC1=0,cC1=0;for(let i=0;i<NF.length;i++){if(NF[i]<16||NF[i]>12500)continue;aC1=Math.max(aC1,Math.abs(D.Adev[i]));cC1=Math.max(cC1,Math.abs(D.Cdev[i]));}
D.aC1=+aC1.toFixed(2);D.cC1=+cC1.toFixed(2);
// correction MEMS
S.corr='profile';S.corrCurve=CURVE_MEMS;const cc=activeCorrCurve(),cf=designCorrFilter(FS,cc);
D.corrPts=cc.fc.map((f,i)=>[f,cc.g[i]]);
D.corrTgt=[];D.corrReal=[];for(let i=0;i<=160;i++){const f=20*Math.pow(20000/20,i/160);D.corrTgt.push([+f.toFixed(2),+interpCurve(cc,f).toFixed(3)]);D.corrReal.push([+f.toFixed(2),+cascadeMagDb(cf.sections,f,FS).toFixed(3)]);}
let cErr=0;for(const p of D.corrReal){if(p[0]<50||p[0]>12500)continue;cErr=Math.max(cErr,Math.abs(p[1]-interpCurve(cc,p[0])));}D.corrErr=+cErr.toFixed(2);
// temps réel (correction MEMS)
const SW=[31.5,63,125,250,500,1000,2000,4000,8000];D.sweep=SW;
D.rtA={iir:[],fft:[],theo:[]};D.rtZ={iir:[],fft:[],theo:[]};
for(const f of SW){const sig=mkTone(f,FS,2,0.2);const iir=iirLevels(sig,FS),fw=fftLevels(sig,FS,16384);
  const ms=0.02,cd=corrDbAt(f);
  D.rtA.iir.push(+dbp(iir.A).toFixed(2));D.rtA.fft.push(+dbp(fw.A).toFixed(2));D.rtA.theo.push(+dbp(ms*Math.pow(10,(aWeight(f)+cd)/10)).toFixed(2));
  D.rtZ.iir.push(+dbp(iir.Z).toFixed(2));D.rtZ.fft.push(+dbp(fw.Z).toFixed(2));D.rtZ.theo.push(+dbp(ms*Math.pow(10,cd/10)).toFixed(2));}
fs_.writeFileSync('datasets.json',JSON.stringify(D));
console.log('datasets.json écrit — aC1='+D.aC1+' cC1='+D.cC1+' corrErr='+D.corrErr);
