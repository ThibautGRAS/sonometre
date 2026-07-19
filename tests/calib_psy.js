// Recalage des constantes psycho via le VRAI pipeline (extrait du fichier)
const fs0=require("fs");
const src=fs0.readFileSync("index.html","utf8").match(/<script>([\s\S]*?)<\/script>/g).map(s=>s.replace(/<\/?script>/g,"")).sort((a,b)=>a.length-b.length).pop();
function grab(re){const m=src.match(re);if(!m)throw new Error("grab "+re);return m[0];}
let S={bands:null,curBnd:null,offset:40,fftN:16384,binHz:48000/16384,ctx:{sampleRate:48000}};
eval((grab(/const ISO_F28=[\s\S]*?function isoCalcSlopes[\s\S]*?\n\}/)
 +grab(/let ISO_MAP=null;/)+grab(/function psyLoudness[\s\S]*?\n\}/)+grab(/function psySharpness[\s\S]*?\n\}/)
 +grab(/function fft\(re,im\)[\s\S]*?\n\}/)+grab(/const PSY_WR=[\s\S]*?const PSY_CAL_R=[^;]*, PSY_CAL_F=[^;]*, PSY_CAL_T=[^;]*;/)
 +grab(/function psyModBandP[\s\S]*?\n\}/)+grab(/let PSY_rRe[\s\S]*?function psyRoughMB[\s\S]*?\n\}/)
 +grab(/function psyFluctBW[\s\S]*?\n\}/)+grab(/const PSY_ZERO24[\s\S]*?function psyTonalAures[\s\S]*?\n\}/)
 ).replace(/\bconst /g,"var ").replace(/\blet /g,"var "));
const NOMS=[20,25,31.5,40,50,63,80,100,125,160,200,250,315,400,500,630,800,1000,1250,1600,2000,2500,3150,4000,5000,6300,8000,10000,12500,16000];
const i1k=NOMS.indexOf(1000);
function amPCM(fc,fm,d,dB){const fs=48000,N=Math.round(0.34*fs),x=new Float64Array(N),amp=Math.pow(10,((dB||60)-94)/20)*Math.SQRT2;for(let i=0;i<N;i++){const t=i/fs;x[i]=amp*(1+d*Math.cos(2*Math.PI*fm*t))*Math.sin(2*Math.PI*fc*t);}return x;}
console.log("PSY_CAL_R =",(1/psyRoughMB(amPCM(1000,70,1,60),48000)).toFixed(4));
function fluctReal(mf,d,dB){const dt=0.05,fr=100,nh=[];for(let f=0;f<fr;f++){const g=1+d*Math.cos(2*Math.PI*mf*(f*dt));S.bands=NOMS;S.curBnd=new Array(NOMS.length).fill(0);S.curBnd[i1k]=g*g;S.offset=dB;const l=psyLoudness();nh.push(l?l.Nspec:new Float64Array(24));}return psyFluctBW(nh,dt);}
const rawF=fluctReal(4,1,60);
console.log("PSY_CAL_F =",(1/rawF).toFixed(4),"  (raw",rawF.toFixed(4)+")");
console.log("  profil (cal courant):",[1,4,8].map(mf=>"mf"+mf+":"+(1.384*fluctReal(mf,1,60)/rawF*rawF).toFixed(2)).join(" "));
function specTone(fc,dB,noiseDb){const nfft=16384,fs=48000,n=nfft>>1,bp=new Float64Array(n),df=fs/nfft,nf=Math.pow(10,(noiseDb-94)/10);for(let k=1;k<n;k++)bp[k]=nf*(0.5+0.3*Math.sin(k));const kc=Math.round(fc/df);bp[kc]+=Math.pow(10,(dB-94)/10);return{bp,df};}
let sp=specTone(1000,60,10); console.log("PSY_CAL_T check (1kHz):",psyTonalAures(sp.bp,sp.df).toFixed(3));
