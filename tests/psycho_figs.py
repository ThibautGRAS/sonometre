import json, matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
NAVY="#001E50"; RED="#EF3346"; GREEN="#2FA05A"; GREY="#9AA7BD"
d=json.load(open("psycho_data.json"))
plt.rcParams.update({"font.size":10,"axes.edgecolor":"#33475b","axes.labelcolor":"#001E50","xtick.color":"#33475b","ytick.color":"#33475b","axes.titlecolor":NAVY})
def save(fig,name):
    fig.tight_layout(); fig.savefig(name,dpi=150,bbox_inches="tight"); plt.close(fig)

# 1 Sonie vs niveau
f=plt.figure(figsize=(5,3.1)); ax=f.add_subplot(111)
ax.plot(d["loud"]["L"],d["loud"]["N"],color=NAVY,lw=2,marker="o",ms=3,label="modèle (excitation + masquage)")
ax.plot(d["loud"]["L"],d["loud"]["ref2"],color=RED,lw=1.4,ls="--",label="repère 2^((L−40)/10)")
ax.axhline(1,color=GREY,lw=.8,ls=":"); ax.axvline(40,color=GREY,lw=.8,ls=":")
ax.set_xlabel("Niveau 1 kHz (dB SPL)"); ax.set_ylabel("Sonie N (sone)"); ax.set_title("Sonie vs niveau"); ax.legend(fontsize=8); ax.grid(alpha=.25)
save(f,"fig_psy_loud.png")

# 2 Acuité vs fréquence
f=plt.figure(figsize=(5,3.1)); ax=f.add_subplot(111)
ax.semilogx(d["sharp"]["f"],d["sharp"]["S"],color=NAVY,lw=2,marker="o",ms=3)
ax.set_xlabel("Fréquence bande étroite (Hz)"); ax.set_ylabel("Acuité S (acum)"); ax.set_title("Acuité vs fréquence (DIN 45692)"); ax.grid(alpha=.25,which="both")
save(f,"fig_psy_sharp.png")

# 3 Rugosité vs fréquence de modulation
f=plt.figure(figsize=(5,3.1)); ax=f.add_subplot(111)
ax.plot(d["roughF"]["fm"],d["roughF"]["R"],color=NAVY,lw=2)
ax.axvline(70,color=RED,lw=1.2,ls="--",label="pic 70 Hz (D&W)"); ax.axhline(1,color=GREY,lw=.8,ls=":")
ax.set_xlabel("Fréquence de modulation (Hz)"); ax.set_ylabel("Rugosité R (asper)"); ax.set_title("Rugosité vs f. de modulation (100 % AM)"); ax.legend(fontsize=8); ax.grid(alpha=.25)
save(f,"fig_psy_roughF.png")

# 4 Rugosité vs profondeur
f=plt.figure(figsize=(5,3.1)); ax=f.add_subplot(111)
ax.plot(d["roughD"]["d"],d["roughD"]["R"],color=NAVY,lw=2,marker="o",ms=3,label="modèle")
ax.plot(d["roughD"]["d"],d["roughD"]["ref"],color=RED,lw=1.2,ls="--",label="linéaire idéal")
ax.set_xlabel("Profondeur de modulation (%)"); ax.set_ylabel("Rugosité R (asper)"); ax.set_title("Rugosité vs profondeur (@70 Hz)"); ax.legend(fontsize=8); ax.grid(alpha=.25)
save(f,"fig_psy_roughD.png")

# 5 Fluctuation vs fréquence de modulation
f=plt.figure(figsize=(5,3.1)); ax=f.add_subplot(111)
ax.semilogx(d["fluctF"]["fm"],d["fluctF"]["F"],color=NAVY,lw=2,marker="o",ms=3)
ax.axvline(4,color=RED,lw=1.2,ls="--",label="pic 4 Hz (Fastl)"); ax.axhline(1,color=GREY,lw=.8,ls=":")
ax.set_xlabel("Fréquence de modulation (Hz)"); ax.set_ylabel("Fluctuation F (vacil)"); ax.set_title("Fluctuation vs f. de modulation"); ax.legend(fontsize=8); ax.grid(alpha=.25,which="both")
save(f,"fig_psy_fluctF.png")
print("figures OK")
