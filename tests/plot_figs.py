import json, matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.ticker import FuncFormatter

D=json.load(open('datasets.json'))
NAVY='#001E50'; RED='#EF3346'; GREEN='#2FA05A'
plt.rcParams.update({'font.size':9,'font.family':'DejaVu Sans','axes.edgecolor':'#8aa0b8','axes.linewidth':0.8})

def logx(ax):
    ax.set_xscale('log')
    ax.xaxis.set_major_formatter(FuncFormatter(lambda x,_: f'{int(x/1000)}k' if x>=1000 else f'{x:g}'))
    ax.set_xticks([16,31.5,63,125,250,500,1000,2000,4000,8000,16000])
    ax.grid(True,which='major',color='#e6ecf3',lw=0.7)
    ax.set_xlabel('Fréquence (Hz)')

def save(fig,name):
    fig.tight_layout(); fig.savefig(name,dpi=130,bbox_inches='tight'); plt.close(fig)
    print('écrit',name)

# 1) écart pondération A vs tolérance classe 1
def dev_chart(dev,name,title):
    f=D['wf']; tol=D['tol']
    fig,ax=plt.subplots(figsize=(6.6,2.9))
    ax.fill_between(f,[-t for t in tol],tol,color=GREEN,alpha=0.12,label='tolérance classe 1')
    ax.plot(f,tol,color=GREEN,lw=1,ls='--',alpha=0.6); ax.plot(f,[-t for t in tol],color=GREEN,lw=1,ls='--',alpha=0.6)
    ax.axhline(0,color='#9db2c8',lw=0.8)
    ax.plot(f,dev,color=RED,lw=1.8,marker='o',ms=3,label='écart IIR − IEC')
    ax.set_ylim(-4,4); ax.set_ylabel('écart (dB)'); ax.set_title(title,color=NAVY,fontweight='bold',fontsize=10)
    logx(ax); ax.legend(loc='lower left',fontsize=8,framealpha=0.9)
    save(fig,name)
dev_chart(D['Adev'],'fig_Adev.png','Pondération A — écart IIR vs IEC 61672-1')
dev_chart(D['Cdev'],'fig_Cdev.png','Pondération C — écart IIR vs IEC 61672-1')

# 2) pondération A absolue
fig,ax=plt.subplots(figsize=(6.6,2.9))
xs=[p[0] for p in D['Aabs']]; ys=[p[1] for p in D['Aabs']]
ax.plot(xs,ys,color=RED,lw=1.8,label='IIR (biquads)')
ax.plot(D['wf'],D['An'],color=NAVY,ls='none',marker='s',ms=3.5,label='IEC 61672-1 (nominal)')
ax.set_ylim(-60,6); ax.set_ylabel('gain (dB)'); ax.set_title('Pondération A — courbe absolue',color=NAVY,fontweight='bold',fontsize=10)
logx(ax); ax.legend(loc='lower center',fontsize=8)
save(fig,'fig_Aabs.png')

# 3) correction : cible vs réalisé
fig,ax=plt.subplots(figsize=(6.6,2.9))
tf=[p[0] for p in D['corrTgt']]; tg=[p[1] for p in D['corrTgt']]; rf=[p[0] for p in D['corrReal']]; rg=[p[1] for p in D['corrReal']]
ax.axhline(0,color='#9db2c8',lw=0.8)
ax.plot(tf,tg,color=NAVY,lw=1.8,ls='--',label='cible (courbe)')
ax.plot(rf,rg,color=RED,lw=1.8,label='réalisé (cascade biquads)')
ax.plot([p[0] for p in D['corrPts']],[p[1] for p in D['corrPts']],ls='none',marker='o',ms=4,color=GREEN,label='points profil')
ax.set_ylabel('gain (dB)'); ax.set_title('Filtre de correction — cible vs réalisé (MEMS, 0 dB à 1 kHz)',color=NAVY,fontweight='bold',fontsize=10)
logx(ax); ax.legend(loc='upper right',fontsize=8)
save(fig,'fig_corr.png')

# 4) correction : écart
fig,ax=plt.subplots(figsize=(6.6,2.5))
ef=[p[0] for p in D['corrReal'] if p[0]<=12500]; eg=[D['corrReal'][i][1]-D['corrTgt'][i][1] for i in range(len(D['corrReal'])) if D['corrReal'][i][0]<=12500]
ax.axhline(0,color='#9db2c8',lw=0.8); ax.plot(ef,eg,color=RED,lw=1.6)
ax.set_ylim(-1,1); ax.set_ylabel('écart (dB)'); ax.set_title('Filtre de correction — écart réalisé − cible',color=NAVY,fontweight='bold',fontsize=10)
logx(ax)
save(fig,'fig_corrdev.png')

# 5) temps réel LAeq et LZeq
def rt_chart(d,name,title,yl):
    sw=D['sweep']
    fig,ax=plt.subplots(figsize=(6.6,3.0))
    ax.plot(sw,d['theo'],color=GREEN,lw=3,label='théorie',alpha=0.85)
    ax.plot(sw,d['iir'],color=RED,lw=1.8,marker='o',ms=4,label='IIR temporel')
    ax.plot(sw,d['fft'],color=NAVY,lw=1.8,ls='--',marker='^',ms=4,label='dérivé FFT')
    ax.set_ylabel(yl); ax.set_title(title,color=NAVY,fontweight='bold',fontsize=10)
    logx(ax); ax.set_xticks([31.5,63,125,250,500,1000,2000,4000,8000]); ax.legend(loc='best',fontsize=8)
    save(fig,name)
rt_chart(D['rtA'],'fig_rtA.png','Temps réel LAeq par ton — correction MEMS','L_Aeq (dB re 0 dBFS)')
rt_chart(D['rtZ'],'fig_rtZ.png','Temps réel LZeq par ton — cancellation de Parseval (FFT)','L_Zeq (dB re 0 dBFS)')
# 6) limitation de bande
fig,ax=plt.subplots(figsize=(6.6,2.7))
bf=[p[0] for p in D['blResp']]; bg=[p[1] for p in D['blResp']]
ax.axhline(0,color='#9db2c8',lw=0.8)
ax.axhline(-3.01,color='#9db2c8',lw=0.8,ls=':')
ax.plot(bf,bg,color=RED,lw=2,label=f"HP {D['blHP']} Hz + LP {int(D['blLP']/1000)} kHz")
ax.axvline(D['blHP'],color=GREEN,lw=1,ls='--'); ax.axvline(D['blLP'],color=GREEN,lw=1,ls='--')
ax.set_ylim(-40,3); ax.set_ylabel('gain (dB)'); ax.set_title('Limitation de bande — réponse (Butterworth 2e ordre, −3 dB aux coupures)',color=NAVY,fontweight='bold',fontsize=10)
logx(ax); ax.set_xlim(2,24000); ax.legend(loc='lower center',fontsize=8)
save(fig,'fig_bl.png')
print('OK')
