function modBandP(sig,fs,fLo,fHi,wfun){   // sommation quadratique
  const n=sig.length; if(n<8)return 0;
  let m0=0; for(let i=0;i<n;i++)m0+=sig[i]; m0/=n; if(m0<=1e-9)return 0;
  const df=fs/n, kLo=Math.max(1,Math.ceil(fLo/df)), kHi=Math.min(Math.floor(n/2),Math.floor(fHi/df));
  let acc=0;
  for(let k=kLo;k<=kHi;k++){ const f=k*df, w=2*Math.PI*k/n; let re=0,im=0;
    for(let i=0;i<n;i++){ re+=sig[i]*Math.cos(w*i); im-=sig[i]*Math.sin(w*i); }
    const a=2*Math.sqrt(re*re+im*im)/n*wfun(f); acc+=a*a; }
  return Math.sqrt(acc)/m0;
}
const wR=f=>(f/70)*Math.exp(1-f/70), wF=f=>2/((f/4)+(4/f));
const fs=48000, T=Math.round(0.34*fs), D=Math.round(fs/2000), M=Math.floor(T/D), fsE=fs/D;
const aLP=1-Math.exp(-2*Math.PI*400/fs);
function envAM(fm,depth){ depth=depth==null?1:depth; const x=new Float32Array(T);
  for(let i=0;i<T;i++){const t=i/fs;x[i]=(1+depth*Math.cos(2*Math.PI*fm*t))*Math.sin(2*Math.PI*1000*t);}
  let y=0; const e=new Float64Array(M); for(let i=0,k=0;i<T;i++){ y+=aLP*(Math.abs(x[i])-y); if(i%D===0&&k<M)e[k++]=y; } return e; }
const CAL_R=1/modBandP(envAM(70),fsE,20,300,wR);
console.log("CAL_R =",CAL_R.toFixed(4));
console.log("rugosité (asper):"); for(const m of [20,30,50,70,100,150,200,300]) console.log("  @"+m+"Hz",(CAL_R*modBandP(envAM(m),fsE,20,300,wR)).toFixed(3));
console.log("profondeur @70Hz: 100%",(CAL_R*modBandP(envAM(70,1),fsE,20,300,wR)).toFixed(3),"| 50%",(CAL_R*modBandP(envAM(70,0.5),fsE,20,300,wR)).toFixed(3),"| 25%",(CAL_R*modBandP(envAM(70,0.25),fsE,20,300,wR)).toFixed(3));
const fsN=20,n=fsN*4,Nt=new Float64Array(n); for(let i=0;i<n;i++)Nt[i]=1+Math.cos(2*Math.PI*4*(i/fsN));
console.log("CAL_F =",(1/modBandP(Nt,fsN,0.2,8,wF)).toFixed(4));
