import numpy as np, json
from mosqito.sound_level_meter.comp_spectrum import comp_spectrum
from mosqito.sq_metrics import tnr_ecma_st, pr_ecma_st
fs=48000; d=1.0; t=np.arange(0,d,1/fs); P0=2e-5
def mk(sines, noise_dB=None):
    x=np.zeros_like(t)
    for f,dB in sines: x+=np.sqrt(2)*P0*10**(dB/20)*np.sin(2*np.pi*f*t)
    if noise_dB is not None:
        n=np.random.RandomState(1).randn(len(t)); n/=np.sqrt(np.mean(n**2)); x+=n*P0*10**(noise_dB/20)
    return x
cases={
 "1k60_noise30":mk([(1000,60)],30),
 "1k60_3k54_noise30":mk([(1000,60),(3000,54)],30),
 "200_60_noise20":mk([(200,60)],20),
 "noise_only":mk([],50),
}
out={}
for k,x in cases.items():
    spec_db,freq=comp_spectrum(x,fs,db=True)
    tt,tnr,prom,tf=tnr_ecma_st(x,fs,prominence=False)
    pt,pr,pprom,pf=pr_ecma_st(x,fs,prominence=False)
    out[k]={"spec_db":[float(v) for v in spec_db],"df":float(freq[1]-freq[0]),"f0":float(freq[0]),
      "tnr":{"t":float(np.atleast_1d(tt)[0]) if len(np.atleast_1d(tt)) else 0.0,
             "freqs":[float(v) for v in np.atleast_1d(tf)],"vals":[float(v) for v in np.atleast_1d(tnr)],"prom":[bool(v) for v in np.atleast_1d(prom)]},
      "pr":{"t":float(np.atleast_1d(pt)[0]) if len(np.atleast_1d(pt)) else 0.0,
             "freqs":[float(v) for v in np.atleast_1d(pf)],"vals":[float(v) for v in np.atleast_1d(pr)],"prom":[bool(v) for v in np.atleast_1d(pprom)]}}
    print(f"{k:20s} T-TNR={out[k]['tnr']['t']:.2f}  tones={[round(f) for f in out[k]['tnr']['freqs']]} tnr={[round(v,1) for v in out[k]['tnr']['vals']]}")
    print(f"{'':20s} T-PR ={out[k]['pr']['t']:.2f}  tones={[round(f) for f in out[k]['pr']['freqs']]} pr ={[round(v,1) for v in out[k]['pr']['vals']]}")
json.dump(out,open("tnr_ref.json","w"))
print("df=",out['1k60_noise30']['df'],"f0=",out['1k60_noise30']['f0'],"Nspec=",len(out['1k60_noise30']['spec_db']))
