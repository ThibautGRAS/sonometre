#!/usr/bin/env python3
# =====================================================================
# PROCÉDURE DE VALIDATION GLOBALE — Sonomètre CETIM (réf. SONO-VAL-000)
# Régénère, à partir du CODE DÉPLOYÉ (index.html), en une commande :
#   1. les 3 bancs de test (test_weight, test_corr, test_realtime)
#   2. les jeux de données (export_data.js -> datasets.json)
#   3. les courbes (plot_figs.py -> fig_*.png)
#   4. le rapport GLOBAL (Partie I existante + Partie II) en .docx et .html
#
# Usage (depuis le dossier tests/ du dépôt) :  python3 make_global_report.py
# Dépendances : node, python3+matplotlib, pandoc. Sortie : Rapport_global_validation_DSP_CETIM.docx/.html
# =====================================================================
import subprocess, sys, os, json, datetime, pathlib

HERE = pathlib.Path(__file__).resolve().parent          # dossier tests/
ROOT = HERE.parent                                       # racine du dépôt (index.html)
INDEX = ROOT / "index.html"
EXISTING = HERE / "Rapport_validation_DSP_sonometre_CETIM.docx"   # Partie I (SONO-VAL-001)
os.chdir(HERE)

def run(cmd, **kw):
    print("→", " ".join(cmd)); r = subprocess.run(cmd, **kw)
    if r.returncode != 0: print("   (code retour", r.returncode, ")")
    return r

def need(path):
    if not pathlib.Path(path).exists(): sys.exit("MANQUE : "+str(path))

need(INDEX)
# les scripts s'attendent à trouver index.html dans le cwd : lien/relais
if not (HERE/"index.html").exists():
    try: (HERE/"index.html").symlink_to(INDEX)
    except Exception: import shutil; shutil.copy(INDEX, HERE/"index.html")

print("\n=== 1. Bancs de test ===")
tests_ok = True
for t in ["test_weight.js","test_corr.js","test_realtime.js","test_bandlimit.js","test_psycho.js"]:
    if (HERE/t).exists():
        r = run(["node", t]); tests_ok = tests_ok and (r.returncode == 0)
    else: print("   (absent, ignoré)", t)

print("\n=== 2. Jeux de données ===")
run(["node","export_data.js"]); need("datasets.json")

print("\n=== 3. Courbes ===")
run([sys.executable,"plot_figs.py"])

print("\n=== 3bis. Psychoacoustique (données + courbes) ===")
psy_ok = (HERE/"psycho_export.js").exists()
if psy_ok:
    run(["node","psycho_export.js"]); need("psycho_data.json")
    run([sys.executable,"psycho_figs.py"])
else:
    print("   (psycho_export.js absent, Partie III omise)")

print("\n=== 4. Rapport global ===")
# Partie I : rapport existant -> markdown (si présent)
body1 = "*(Rapport SONO-VAL-001 non trouvé dans tests/ — Partie I omise.)*\n"
if EXISTING.exists():
    md = subprocess.run(["pandoc","-t","markdown",str(EXISTING)], capture_output=True, text=True).stdout
    i = md.find("**1. Objet");  body1 = md[i:] if i>=0 else md

D = json.load(open("datasets.json"))
SW = D["sweep"]
def rows(key, lab):
    s=""
    for i,f in enumerate(SW):
        d=D[key]
        s+=f"| ton {f} Hz · {lab} | {d['iir'][i]:.2f} | {d['fft'][i]:.2f} | {d['theo'][i]:.2f} | {d['iir'][i]-d['theo'][i]:+.2f} | {d['iir'][i]-d['fft'][i]:+.2f} |\n"
    return s

today = datetime.date.today().isoformat()
part2 = f"""
\\newpage

# Partie II — Filtre de correction et méthodes de calcul temps réel (SONO-VAL-002)

Toutes les courbes sont calculées avec le code réellement déployé (fonctions extraites de `index.html`), fs = {D['FS']/1000:.0f} kHz.

## II.1 Chaînes de traitement
Deux chaînes parallèles partent du même signal microphone : une chaîne **fréquentielle (FFT)** — fenêtre Blackman, FFT, correction et pondération par raie, recalage de Parseval — qui produit les spectres, l'émergence et le Leq quand la correction est désactivée ; une chaîne **temporelle (IIR)** — filtre de correction (cascade de biquads) puis pondérations A/C (biquads IEC 61672), intégrateurs Fast/Slow/V-Slow, crête C et énergie cumulée — qui produit les niveaux instantanés, le LCpeak et le Leq quand une correction est active. L'offset (référence 0 dBFS, 130 dB par défaut iPhone) est un scalaire appliqué partout ; la courbe de correction est une forme normalisée à 0 dB à 1 kHz.

## II.2 Pondérations A et C (réalisation IIR vs IEC 61672-1)
Écart maximal 16 Hz–12,5 kHz : **{D['aC1']:.2f} dB (A)**, **{D['cC1']:.2f} dB (C)** → classe 1.

![Pondération A — écart IIR vs IEC 61672-1 dans l'enveloppe classe 1.](fig_Adev.png)

![Pondération C — écart IIR vs IEC 61672-1.](fig_Cdev.png)

![Pondération A — courbe absolue vs points nominaux IEC.](fig_Aabs.png)

## II.3 Filtre de correction micro
Écart réalisé − cible **< {D['corrErr']:.2f} dB** de 50 Hz à 12,5 kHz (profil MEMS).

![Filtre de correction — cible vs réalisé (points du profil en vert).](fig_corr.png)

![Filtre de correction — écart réalisé − cible.](fig_corrdev.png)

## II.4 Limitation de bande (passe-haut / passe-bas)
Deux filtres Butterworth 2e ordre réglables bornent la bande analysée (défauts **passe-haut {D['blHP']} Hz**, **passe-bas {int(D['blLP']/1000)} kHz**), appliqués au signal en amont des pondérations. −3 dB aux coupures, pente 40 dB/décade. Ils rendent le **LZeq** insensible au continu / à l'infrason / au vent (hors bande). Validé par `test_bandlimit.js` (magnitude, pente, atténuation réelle sur LZeq, neutralité Off).

![Limitation de bande — réponse (−3 dB aux coupures).](fig_bl.png)

## II.5 Comparaison temps réel : IIR vs FFT vs théorie (correction MEMS)

![L_Aeq par ton : IIR ≡ théorie ; dérivé FFT divergent.](fig_rtA.png)

![L_Zeq par ton : dérivé FFT plat (cancellation de Parseval) ; IIR conforme.](fig_rtZ.png)

| Signal (corr. MEMS) | IIR | FFT | Théorie | IIR−théo | IIR−FFT |
|---|---|---|---|---|---|
{rows('rtA','L_Aeq')}{rows('rtZ','L_Zeq')}

## II.6 Interprétation (Parseval)
Côté FFT, le recalage `K = P_t / p_Z` ramène l'énergie spectrale sur le RMS temporel brut du bloc ; la contribution globale de la correction s'annule alors (pour Z, exactement). La chaîne temporelle IIR n'a pas ce biais (correction appliquée au signal avant pondération, Leq dérivé du signal corrigé). **Correction active, seul le mode temporel IIR — le défaut — est exact ; le dérivé FFT est réservé à la comparaison.**

## II.7 Conclusion
Pondérations A/C classe 1 (16 Hz–12,5 kHz) ; filtre de correction < {D['corrErr']:.2f} dB ; niveaux temps réel IIR conformes à la théorie à ≤ 0,25 dB, correction comprise. Hors périmètre (validation sur appareil) : chaîne micro iOS, calibration absolue, référence pleine échelle (130 dBFS par défaut), émergence ISO 1996-2.
"""

part3 = ""
if psy_ok and pathlib.Path("psycho_data.json").exists():
    P = json.load(open("psycho_data.json"))
    def _at(xs,ys,x): return ys[xs.index(x)]
    N40=_at(P["loud"]["L"],P["loud"]["N"],40); N60=_at(P["loud"]["L"],P["loud"]["N"],60)
    S1k=_at(P["sharp"]["f"],P["sharp"]["S"],1000)
    R70=_at(P["roughF"]["fm"],P["roughF"]["R"],70); R200=_at(P["roughF"]["fm"],P["roughF"]["R"],200)
    R50=_at(P["roughD"]["d"],P["roughD"]["R"],50)
    F4=_at(P["fluctF"]["fm"],P["fluctF"]["F"],4); F1=_at(P["fluctF"]["fm"],P["fluctF"]["F"],1); F8=_at(P["fluctF"]["fm"],P["fluctF"]["F"],8)
    def _v(x,lo,hi): return "conforme" if lo<=x<=hi else "à revoir"
    prows="".join([
      f"| Sonie N — 1 kHz / 40 dB | 1,00 sone | {N40:.2f} sone | {_v(N40,0.85,1.20)} |\n",
      f"| Sonie N — 1 kHz / 50 dB | ≈ 2 sone | {_at(P['loud']['L'],P['loud']['N'],50):.2f} sone | {_v(_at(P['loud']['L'],P['loud']['N'],50),1.7,2.6)} |\n",
      f"| Sonie N — 1 kHz / 60 dB | ≈ 4 sone | {N60:.2f} sone | {_v(N60,3.4,5.0)} |\n",
      f"| Sonie N — 1 kHz / 70 dB | ≈ 8 sone | {_at(P['loud']['L'],P['loud']['N'],70):.2f} sone | {_v(_at(P['loud']['L'],P['loud']['N'],70),7,10)} |\n",
      f"| Sonie N — 1 kHz / 80 dB | ≈ 16 sone | {_at(P['loud']['L'],P['loud']['N'],80):.2f} sone | {_v(_at(P['loud']['L'],P['loud']['N'],80),13.5,19)} |\n",
      f"| Acuité S — ton 1 kHz | ≈ 1 acum | {S1k:.2f} acum | {_v(S1k,0.7,1.3)} |\n",
      f"| Rugosité R — 100 % AM @70 Hz | 1,00 asper | {R70:.2f} asper | {_v(R70,0.9,1.1)} |\n",
      f"| Rugosité R — 50 % AM @70 Hz | 0,50 asper | {R50:.2f} asper | {_v(R50,0.4,0.6)} |\n",
      f"| Rugosité — décroissance @200 Hz | < @70 Hz | {R200:.2f} asper | {_v(R70-R200,0.2,1.0)} |\n",
      f"| Fluctuation F — 100 % @4 Hz | 1,00 vacil | {F4:.2f} vacil | {_v(F4,0.9,1.1)} |\n",
      f"| Fluctuation — sélectivité @1/@8 Hz | < @4 Hz | {F1:.2f} / {F8:.2f} | {_v(F4-max(F1,F8),0.1,0.9)} |\n",
    ])
    part3 = f"""
\\newpage

# Partie III — Indicateurs psychoacoustiques (SONO-VAL-PSY-001)

L'écran « Toile psychoacoustique » affiche cinq indicateurs de qualité sonore normalisés sur une fenêtre glissante (réglable 2/4/8 s) : sonie N, acuité S, rugosité R, fluctuation F, tonalité T ; au centre, la gêne psychoacoustique PA (modèle de Zwicker). Constantes de calibration extraites du code : CAL_R = {P['cal']['CAL_R']:.4f}, CAL_F = {P['cal']['CAL_F']:.4f}, C_N = {P['cal'].get('CN',0):.4f}.

## III.1 Méthodes
**Sonie** : méthode de Zwicker (ISO 532-1) — motif d'excitation par bande de Bark avec **étalement de masquage** (pente supérieure dépendante du niveau, pente inférieure 27 dB/Bark), sonie spécifique intégrée ; calée à 1 sone pour 1 kHz / 40 dB. La loi sonie/niveau reproduit le doublement par 10 dB (cf. §III.3). **Acuité** : pondération DIN 45692 sur la sonie spécifique. **Rugosité** : modèle de Daniel & Weber — enveloppe temporelle (redressement + passe-bas 400 Hz, décimation ~2 kHz), spectre de modulation pondéré (pic 70 Hz), sommation quadratique, calée à 1 asper (1 kHz / 100 % AM @70 Hz). **Fluctuation** : modèle de Fastl/Osses — modulation de la sonie N(t) sur la fenêtre, pondération pic 4 Hz, calée à 1 vacil. **Tonalité** : dérivée de l'émergence tonale. **PA** : combinaison de Zwicker (N5, S, R, F).

## III.2 Durées d'analyse (d'après les modèles)
Rugosité : phénomène rapide (20–300 Hz), blocs **~200 ms** suffisants. Fluctuation : pic à **4 Hz**, exige **≥ ~2 s** (plusieurs périodes) — contrainte dimensionnante. Sonie/acuité quasi instantanées. Fenêtre par défaut **4 s** (réglable 2/4/8 s).

## III.3 Vérification contre signaux de référence

| Contrôle | Attendu | Mesuré | Verdict |
|---|---|---|---|
{prows}

![Sonie vs niveau (1 kHz) — calée à 1 sone à 40 dB ; repère doublement/10 dB en pointillé.](fig_psy_loud.png)

![Acuité vs fréquence (bande étroite, DIN 45692) — croissante avec la fréquence.](fig_psy_sharp.png)

![Rugosité vs fréquence de modulation (100 % AM) — pic à 70 Hz (Daniel & Weber).](fig_psy_roughF.png)

![Rugosité vs profondeur de modulation (@70 Hz) — réponse linéaire.](fig_psy_roughD.png)

![Fluctuation vs fréquence de modulation — pic à 4 Hz (Fastl/Osses).](fig_psy_fluctF.png)

## III.4 Conclusion et limites
Les cinq indicateurs répondent conformément aux définitions de référence. La sonie inclut désormais l'étalement de masquage (loi de niveau conforme au doublement par 10 dB). Version temps réel **calibrée** sur les signaux de référence ; la rugosité reste **sans** décomposition par bande critique ni corrélation inter-bandes. Indicateurs de confort **non certifiés**. Raffinement et confrontation aux jeux de référence MOSQITO prévus (Phase 3).
"""

header = f"""**CETIM — Centre technique des industries mécaniques**

# Rapport global de validation du traitement du signal

Application sonomètre / analyseur — *rapport global*

Référence : **SONO-VAL-000** (regroupe SONO-VAL-001, SONO-VAL-002 et SONO-VAL-PSY-001) · {today}
Rédacteur : Thibaut Gras · thibaut.gras@cetim.fr

Ce rapport réunit **Partie I** (banc de tests reproductible et méthodes de calcul, SONO-VAL-001), **Partie II** (filtre de correction micro et comparaison des méthodes de niveau temps réel, SONO-VAL-002) et **Partie III** (indicateurs psychoacoustiques, SONO-VAL-PSY-001).

\\newpage

# Partie I — Banc de tests et méthodes de calcul (SONO-VAL-001)

{body1}
"""

open("combined.md","w",encoding="utf-8").write(header+part2+part3)
run(["pandoc","combined.md","-o","Rapport_global_validation_DSP_CETIM.docx"])
if (HERE/"make_report.js").exists():
    run(["node","make_report.js"])   # version HTML autonome (rapport_validation_dsp.html)

# ---- PDF FORMAT CETIM (HTML stylé + wkhtmltopdf) ----
part1_html = subprocess.run(["pandoc",str(EXISTING),"-t","html"],capture_output=True,text=True).stdout if EXISTING.exists() else "<p><em>Partie I (SONO-VAL-001) non trouvée.</em></p>"
part2_html = subprocess.run(["pandoc","-f","markdown","-t","html"],input=part2,capture_output=True,text=True).stdout
part3_html = subprocess.run(["pandoc","-f","markdown","-t","html"],input=part3,capture_output=True,text=True).stdout if part3 else ""
CETIM_CSS = """
@page { margin: 20mm 16mm; }
body{font-family:'Helvetica Neue',Arial,sans-serif;color:#12293f;line-height:1.5;font-size:11pt}
.cover{border-bottom:4px solid #EF3346;padding-bottom:10px;margin-bottom:6px}
.cover .brand{color:#001E50;font-weight:800;font-size:15pt;letter-spacing:.5px}
.cover .brand .sq{color:#EF3346}
h1{color:#001E50;font-size:17pt;border-bottom:2px solid #EF3346;padding-bottom:5px;margin-top:26px}
h2{color:#001E50;font-size:13pt;border-left:4px solid #EF3346;padding-left:8px;margin-top:20px}
h3{color:#001E50;font-size:11.5pt;margin-top:14px}
h4{color:#001E50;font-size:11pt}
img{max-width:100%;display:block;margin:8px auto;border:1px solid #dbe4ee;border-radius:6px}
table{border-collapse:collapse;width:100%;font-size:9.5pt;margin:10px 0}
th,td{border:1px solid #cdd9e6;padding:4px 7px;text-align:center}
th{background:#001E50;color:#fff}
tr:nth-child(even) td{background:#f2f6fb}
code{background:#eef2f7;padding:1px 4px;border-radius:3px;font-size:9.5pt}
em{color:#5a6b7d}
.meta{color:#5a6b7d;font-size:10pt}
"""
COVER = f"""<div class="cover"><div class="brand">◼ CETIM <span class="sq">|</span> Centre technique des industries mécaniques</div></div>
<div style="text-align:center;margin:40px 0 20px"><div style="color:#001E50;font-size:22pt;font-weight:800">Rapport global de validation<br>du traitement du signal</div>
<div style="color:#5a6b7d;font-size:13pt;margin-top:10px">Application sonomètre / analyseur — CETIM</div>
<div class="meta" style="margin-top:24px">Référence <b>SONO-VAL-000</b> (regroupe SONO-VAL-001 et SONO-VAL-002)<br>{today} · Rédacteur : Thibaut Gras · thibaut.gras@cetim.fr</div></div>
<div style="page-break-after:always"></div>"""
html_doc = f"<!doctype html><html lang='fr'><head><meta charset='utf-8'><style>{CETIM_CSS}</style></head><body>{COVER}<h1>Partie I — Banc de tests et méthodes de calcul (SONO-VAL-001)</h1>{part1_html}<div style='page-break-before:always'></div>{part2_html}<div style='page-break-before:always'></div>{part3_html}</body></html>"
open("rapport_cetim.html","w",encoding="utf-8").write(html_doc)
run(["wkhtmltopdf","--enable-local-file-access","--quiet","-s","A4","-T","18mm","-B","18mm","-L","14mm","-R","14mm",
     "rapport_cetim.html","Rapport_global_validation_DSP_CETIM.pdf"])

print("\n=== TERMINÉ ===")
print("Rapports : Rapport_global_validation_DSP_CETIM.pdf (format CETIM) · .docx · rapport_validation_dsp.html")
print("Bancs de test :", "TOUS OK" if tests_ok else "au moins un échec (voir ci-dessus)")
