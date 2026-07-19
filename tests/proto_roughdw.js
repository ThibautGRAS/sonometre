const fs0=require("fs");
// ---- radix-2 fft (in-place) ----
function fftR(re,im,inv){const n=re.length;for(let i=1,j=0;i<n;i++){let b=n>>1;for(;j&b;b>>=1)j^=b;j^=b;if(i<j){[re[i],re[j]]=[re[j],re[i]];[im[i],im[j]]=[im[j],im[i]];}}
 for(let len=2;len<=n;len<<=1){const ang=(inv?2:-2)*Math.PI/len,wr=Math.cos(ang),wi=Math.sin(ang);for(let i=0;i<n;i+=len){let cr=1,ci=0;for(let k=0;k<len>>1;k++){const ur=re[i+k],ui=im[i+k],vr=re[i+k+(len>>1)]*cr-im[i+k+(len>>1)]*ci,vi=re[i+k+(len>>1)]*ci+im[i+k+(len>>1)]*cr;re[i+k]=ur+vr;im[i+k]=ui+vi;re[i+k+(len>>1)]=ur-vr;im[i+k+(len>>1)]=ui-vi;const ncr=cr*wr-ci*wi;ci=cr*wi+ci*wr;cr=ncr;}}}
 if(inv){for(let i=0;i<n;i++){re[i]/=n;im[i]/=n;}}}
// ---- Bluestein pour taille quelconque ----
function dft(re,im,inv){const n=re.length; if((n&(n-1))===0){fftR(re,im,inv);return;} let m=1;while(m<2*n-1)m<<=1;
 const ar=new Float64Array(m),ai=new Float64Array(m),br=new Float64Array(m),bi=new Float64Array(m);
 const s=inv?1:-1;
 const cr=new Float64Array(n),ci=new Float64Array(n);
 for(let k=0;k<n;k++){const ph=s*Math.PI*((k*k)%(2*n))/n;cr[k]=Math.cos(ph);ci[k]=Math.sin(ph);
  ar[k]=re[k]*cr[k]-im[k]*ci[k]; ai[k]=re[k]*ci[k]+im[k]*cr[k];}
 br[0]=cr[0];bi[0]=-ci[0];
 for(let k=1;k<n;k++){br[k]=br[m-k]=cr[k];bi[k]=bi[m-k]=-ci[k];}
 fftR(ar,ai,false);fftR(br,bi,false);
 for(let k=0;k<m;k++){const r=ar[k]*br[k]-ai[k]*bi[k],ii=ar[k]*bi[k]+ai[k]*br[k];ar[k]=r;ai[k]=ii;}
 fftR(ar,ai,true);
 for(let k=0;k<n;k++){const r=ar[k]*cr[k]-ai[k]*ci[k],ii=ar[k]*ci[k]+ai[k]*cr[k];re[k]=r;im[k]=ii;}
 if(inv){for(let k=0;k<n;k++){re[k]/=n;im[k]/=n;}}
}
// ---- interp lineaire ----
function interp(x,xp,yp){ if(x<=xp[0])return yp[0]; if(x>=xp[xp.length-1])return yp[yp.length-1];
 let i=1;while(xp[i]<x)i++; const t=(x-xp[i-1])/(xp[i]-xp[i-1]); return yp[i-1]+t*(yp[i]-yp[i-1]); }
// ---- tables Bark ----
const BF=[0,50,100,150,200,250,300,350,400,450,510,570,630,700,770,840,920,1000,1080,1170,1270,1370,1480,1600,1720,1850,2000,2150,2320,2500,2700,2900,3150,3400,3700,4000,4400,4800,5300,5800,6400,7000,7700,8500,9500,10500,12000,13500,15500,20000];
const BZ=[];for(let i=0;i<50;i++)BZ.push(i*0.5);
const freq2bark=f=>interp(f,BF,BZ), bark2freq=z=>interp(z,BZ,BF);
const db2amp=(d,r)=>Math.pow(10,0.05*d)*r, amp2db=(a,r)=>20*Math.log10((a===0?2e-12:a)/r);
// ear
const EX=[0,10,12,13,14,15,16,16.5,17,18,18.5,19,20,21,21.5,22,22.5,23,23.5,24,25,26],EY=[0,0,1.15,2.31,3.85,5.62,6.92,7.38,6.92,4.23,2.31,0,-1.43,-2.59,-3.57,-5.19,-7.41,-11.3,-20,-40,-130,-999];
const ear=z=>interp(z,EX,EY);
// gzi
const GX=[];for(let i=0;i<25;i++)GX.push(i);const GY=[0.15,0.26,0.38,0.47,0.54,0.65,0.76,0.83,0.90,0.98,0.98,0.90,0.80,0.70,0.62,0.54,0.49,0.43,0.39,0.35,0.30,0.30,0.30,0.30,0.30];
const gziW=z=>interp(z,GX,GY);
// LTQ roughness (depuis json)
const LTQR=JSON.parse(fs0.readFileSync("ltq_rough.json","utf8"));
const LTQrough=z=>interp(z,LTQR.bark,LTQR.lt);
// H weighting control points
const HC={ H2:[[0,17,23,25,32,37,48,67,90,114,171,206,247,294,358],[0,0.8,0.95,0.975,1,0.975,0.9,0.8,0.7,0.6,0.4,0.3,0.2,0.1,0]],
 H5:[[0,32,43,56,69,92,120,142,165,231,277,331,397,502],[0,0.8,0.95,1,0.975,0.9,0.8,0.7,0.6,0.4,0.3,0.2,0.1,0]],
 H16:[[0,23.5,34,47,56,63,79,100,115,135,159,172,194,215,244,290,348,415,500,645],[0,0.4,0.6,0.8,0.9,0.95,1,0.975,0.95,0.9,0.85,0.8,0.7,0.6,0.5,0.4,0.3,0.2,0.1,0]],
 H21:[[0,19,44,52.5,58,75,101.5,114.5,132.5,143.5,165.5,197.5,241,290,348,415,500,645],[0,0.4,0.8,0.9,0.95,1,0.95,0.9,0.85,0.8,0.7,0.6,0.5,0.4,0.3,0.2,0.1,0]],
 H42:[[0,15,41,49,53,64,71,88,94,106,115,137,180,238,290,348,415,500,645],[0,0.4,0.8,0.9,0.965,0.99,1,0.95,0.9,0.85,0.8,0.7,0.6,0.5,0.4,0.3,0.2,0.1,0]] };
function buildH(n,fs){const H=[];for(let i=0;i<47;i++)H.push(new Float64Array(n));
 const fill=(row,cx,cy)=>{const last=Math.floor(cx[cx.length-1]/fs*n);for(let j=2;j<last;j++){H[row][j]=interp(j*fs/n,cx,cy);}};
 fill(1,HC.H2[0],HC.H2[1]);fill(4,HC.H5[0],HC.H5[1]);fill(15,HC.H16[0],HC.H16[1]);fill(20,HC.H21[0],HC.H21[1]);fill(41,HC.H42[0],HC.H42[1]);
 H[0]=H[2]=H[3]=H[1];for(let i=5;i<15;i++)H[i]=H[4];for(let i=16;i<20;i++)H[i]=H[15];for(let i=21;i<41;i++)H[i]=H[20];for(let i=42;i<47;i++)H[i]=H[41];
 return H;}
// ---- comp_spectrum blackman, complexe one-sided ----
function compSpec(sig,fs){const N=sig.length;const w=new Float64Array(N);let sw=0;
 for(let i=0;i<N;i++){w[i]=0.42-0.5*Math.cos(2*Math.PI*i/(N-1))+0.08*Math.cos(4*Math.PI*i/(N-1));sw+=w[i];}
 const re=new Float64Array(N),im=new Float64Array(N);for(let i=0;i<N;i++)re[i]=sig[i]*w[i]/sw;
 dft(re,im,false);
 const L=N>>1,sr=new Float64Array(L),si=new Float64Array(L);for(let k=0;k<L;k++){sr[k]=re[k]*1.42;si[k]=im[k]*1.42;}
 return {sr,si,L};
}
// ---- coeur D&W ----
function roughDW(sig,fs,H,gzi){
 const sp=compSpec(sig,fs),L=sp.L,n=2*L;
 // 2-sided: [spec, reversed(spec)]
 const re=new Float64Array(n),im=new Float64Array(n);
 for(let k=0;k<L;k++){re[k]=sp.sr[k];im[k]=sp.si[k];}
 for(let k=0;k<L;k++){re[L+k]=sp.sr[L-1-k];im[L+k]=sp.si[L-1-k];}
 const freq=new Float64Array(L),bark=new Float64Array(L);for(let k=0;k<L;k++){freq[k]=(k+1)*fs/n;bark[k]=freq2bark(freq[k]);}
 // a0 ear sur premiere moitie
 for(let k=0;k<L;k++){const a=db2amp(ear(bark[k]),1);re[k]*=a;im[k]*=a;}
 for(let k=L;k<n;k++){re[k]=0;im[k]=0;}
 const module=new Float64Array(L),specDb=new Float64Array(L);for(let k=0;k<L;k++){module[k]=Math.hypot(re[k],im[k]);specDb[k]=amp2db(module[k],2e-5);}
 const thr=new Float64Array(L);for(let k=0;k<L;k++)thr[k]=LTQrough(bark[k]);
 const aud=[];for(let k=0;k<L;k++)if(specDb[k]>thr[k])aud.push(k);
 const na=aud.length; const NCH=47;
 const zi=[];for(let i=1;i<=NCH;i++)zi.push(i/2);
 const nZ=[];for(let i=1;i<=L;i++)nZ.push(i);
 const zb=zi.map(z=>bark2freq(z)*n/fs);
 const minExc=zb.map(v=>interp(v,nZ,thr));
 const s1=-27,s2=new Float64Array(na);
 for(let k=0;k<na;k++)s2[k]=Math.min(-24-230/freq[aud[k]]+0.2*specDb[aud[k]],0);
 const chLow=new Int32Array(na),chHigh=new Int32Array(na);
 for(let i=0;i<na;i++){chLow[i]=Math.floor(2*bark[aud[i]])-1;chHigh[i]=Math.ceil(2*bark[aud[i]])-1;}
 const slopes=Array.from({length:na},()=>new Float64Array(NCH));
 for(let k=0;k<na;k++){const lev=specDb[aud[k]],b=bark[aud[k]];
  for(let j=0;j<=chLow[k];j++){const sl=s1*(b-(j+1)*0.5)+lev;if(sl>minExc[j])slopes[k][j]=db2amp(sl,2e-5);}
  for(let j=chHigh[k];j<NCH;j++){const sl=s2[k]*((j+1)*0.5-b)+lev;if(sl>minExc[j])slopes[k][j]=db2amp(sl,2e-5);}}
 const hBP=Array.from({length:NCH},()=>new Float64Array(n));const md=new Float64Array(NCH);
 const er=new Float64Array(n),ei=new Float64Array(n);
 for(let i=0;i<NCH;i++){ er.fill(0);ei.fill(0);
  for(let j=0;j<na;j++){const ind=aud[j];let ampl;
   if(chLow[j]===i)ampl=1; else if(chHigh[j]===i)ampl=1; else if(chHigh[j]>i)ampl=slopes[j][i+1]/module[ind]; else ampl=slopes[j][i-1]/module[ind];
   er[ind]=ampl*re[ind]; ei[ind]=ampl*im[ind]; }
  const tr=er.slice(),ti=ei.slice(); dft(tr,ti,true); // ifft
  const te=new Float64Array(n);let h0=0;for(let k=0;k<n;k++){te[k]=Math.abs(n*tr[k]);h0+=te[k];}h0/=n;
  const fr2=new Float64Array(n),fi2=new Float64Array(n);for(let k=0;k<n;k++)fr2[k]=te[k]-h0;
  dft(fr2,fi2,false);
  for(let k=0;k<n;k++){fr2[k]*=H[i][k];fi2[k]*=H[i][k];}
  dft(fr2,fi2,true);
  let rms=0;for(let k=0;k<n;k++){hBP[i][k]=2*fr2[k];rms+=hBP[i][k]*hBP[i][k];}rms=Math.sqrt(rms/n);
  md[i]=h0>0?Math.min(1,rms/h0):0;
 }
 // cross-corr i,i+2
 const ki=new Float64Array(47);
 const cc=(a,b)=>{let ma=0,mb=0;for(let k=0;k<n;k++){ma+=a[k];mb+=b[k];}ma/=n;mb/=n;let sa=0,sb=0,sab=0;for(let k=0;k<n;k++){const da=a[k]-ma,db=b[k]-mb;sa+=da*da;sb+=db*db;sab+=da*db;}return(sa>0&&sb>0)?sab/Math.sqrt(sa*sb):0;};
 for(let i=0;i<45;i++)ki[i]=cc(hBP[i],hBP[i+2]);
 const Rs=new Float64Array(47);
 Rs[0]=gzi[0]*Math.pow(md[0]*ki[0],2);Rs[1]=gzi[1]*Math.pow(md[1]*ki[1],2);
 for(let i=2;i<45;i++)Rs[i]=gzi[i]*Math.pow(md[i]*ki[i]*ki[i-2],2);
 Rs[45]=gzi[45]*Math.pow(md[45]*ki[43],2);Rs[46]=gzi[46]*Math.pow(md[46]*ki[44],2);
 let R=0;for(let i=0;i<47;i++)R+=Rs[i];return 0.25*R;
}
// ---- validation ----
const fs=48000;const nper=Math.round(0.2*fs),n=2*(nper>>1);
const H=buildH(n,fs);const gzi=[];for(let i=1;i<48;i++)gzi.push(gziW(i/2));
const P0=2e-5;
function am(fc,fm,d,dB,dur=0.4){const N=Math.round(dur*fs),x=new Float64Array(N);for(let i=0;i<N;i++){const t=i/fs;x[i]=(1+d*Math.sin(2*Math.PI*fm*t))*Math.sin(2*Math.PI*fc*t);}
 let ms=0;for(let i=0;i<N;i++)ms+=x[i]*x[i];ms=Math.sqrt(ms/N);const g=P0*Math.pow(10,dB/20)/ms;for(let i=0;i<N;i++)x[i]*=g;return x;}
function Rof(fc,fm,d,dB){ // 1 trame de 200ms au centre
 const x=am(fc,fm,d,dB,0.4);const seg=x.slice(0,nper);return roughDW(seg,fs,H,gzi);}
const ref=JSON.parse(fs0.readFileSync("rough_ref.json","utf8"));
const cases={fm70_100_60:[1000,70,1,60],fm30_100_60:[1000,30,1,60],fm50_100_60:[1000,50,1,60],fm100_100_60:[1000,100,1,60],fm150_100_60:[1000,150,1,60],fm200_100_60:[1000,200,1,60],fm70_50_60:[1000,70,0.5,60],fm70_100_80:[1000,70,1,80],fm70_100_40:[1000,70,1,40],fc250_fm70:[250,70,1,60],fc4000_fm70:[4000,70,1,60]};
console.log("cas              R moi    R mos    ecart");
for(const k in cases){const [fc,fm,d,dB]=cases[k];const R=Rof(fc,fm,d,dB);console.log(k.padEnd(15),R.toFixed(3).padStart(8),ref[k].toFixed(3).padStart(8),((R-ref[k])>=0?"+":"")+(R-ref[k]).toFixed(3));}
