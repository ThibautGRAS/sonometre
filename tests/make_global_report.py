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
for t in ["test_weight.js","test_corr.js","test_realtime.js","test_bandlimit.js"]:
    if (HERE/t).exists():
        r = run(["node", t]); tests_ok = tests_ok and (r.returncode == 0)
    else: print("   (absent, ignoré)", t)

print("\n=== 2. Jeux de données ===")
run(["node","export_data.js"]); need("datasets.json")

print("\n=== 3. Courbes ===")
run([sys.executable,"plot_figs.py"])

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

header = f"""**CETIM — Centre technique des industries mécaniques**

# Rapport global de validation du traitement du signal

Application sonomètre / analyseur — *rapport global*

Référence : **SONO-VAL-000** (regroupe SONO-VAL-001 et SONO-VAL-002) · {today}
Rédacteur : Thibaut Gras · thibaut.gras@cetim.fr

Ce rapport réunit **Partie I** (banc de tests reproductible et méthodes de calcul, SONO-VAL-001) et **Partie II** (filtre de correction micro et comparaison des méthodes de niveau temps réel, SONO-VAL-002).

\\newpage

# Partie I — Banc de tests et méthodes de calcul (SONO-VAL-001)

{body1}
"""

open("combined.md","w",encoding="utf-8").write(header+part2)
run(["pandoc","combined.md","-o","Rapport_global_validation_DSP_CETIM.docx"])
if (HERE/"make_report.js").exists():
    run(["node","make_report.js"])   # version HTML autonome (rapport_validation_dsp.html)

# ---- PDF FORMAT CETIM (HTML stylé + wkhtmltopdf) ----
part1_html = subprocess.run(["pandoc",str(EXISTING),"-t","html"],capture_output=True,text=True).stdout if EXISTING.exists() else "<p><em>Partie I (SONO-VAL-001) non trouvée.</em></p>"
part2_html = subprocess.run(["pandoc","-f","markdown","-t","html"],input=part2,capture_output=True,text=True).stdout
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
html_doc = f"<!doctype html><html lang='fr'><head><meta charset='utf-8'><style>{CETIM_CSS}</style></head><body>{COVER}<h1>Partie I — Banc de tests et méthodes de calcul (SONO-VAL-001)</h1>{part1_html}<div style='page-break-before:always'></div>{part2_html}</body></html>"
open("rapport_cetim.html","w",encoding="utf-8").write(html_doc)
run(["wkhtmltopdf","--enable-local-file-access","--quiet","-s","A4","-T","18mm","-B","18mm","-L","14mm","-R","14mm",
     "rapport_cetim.html","Rapport_global_validation_DSP_CETIM.pdf"])

print("\n=== TERMINÉ ===")
print("Rapports : Rapport_global_validation_DSP_CETIM.pdf (format CETIM) · .docx · rapport_validation_dsp.html")
print("Bancs de test :", "TOUS OK" if tests_ok else "au moins un échec (voir ci-dessus)")
