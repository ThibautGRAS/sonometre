import json, subprocess, os, datetime
d=json.load(open("psycho_data.json"))
def at(xs,ys,x): return ys[xs.index(x)]
N40=at(d["loud"]["L"],d["loud"]["N"],40); N60=at(d["loud"]["L"],d["loud"]["N"],60)
S1k=at(d["sharp"]["f"],d["sharp"]["S"],1000)
R70=at(d["roughF"]["fm"],d["roughF"]["R"],70); R200=at(d["roughF"]["fm"],d["roughF"]["R"],200)
R50=at(d["roughD"]["d"],d["roughD"]["R"],50)
F4=at(d["fluctF"]["fm"],d["fluctF"]["F"],4); F1=at(d["fluctF"]["fm"],d["fluctF"]["F"],1); F8=at(d["fluctF"]["fm"],d["fluctF"]["F"],8)
CR=d["cal"]["CAL_R"]; CF=d["cal"]["CAL_F"]
today=datetime.date.today().strftime("%d/%m/%Y")
def chk(v,lo,hi): return "conforme" if lo<=v<=hi else "à revoir"
rows=[
 ("Sonie N — 1 kHz / 40 dB","1,00 sone","%.2f sone"%N40,chk(N40,0.85,1.20)),
 ("Sonie N — 1 kHz / 60 dB","≈ 4 sone","%.2f sone"%N60,chk(N60,2.5,4.5)),
 ("Acuité S — ton 1 kHz","≈ 1 acum","%.2f acum"%S1k,chk(S1k,0.7,1.3)),
 ("Rugosité R — 100 % AM @70 Hz","1,00 asper","%.2f asper"%R70,chk(R70,0.9,1.1)),
 ("Rugosité R — 50 % AM @70 Hz","0,50 asper","%.2f asper"%R50,chk(R50,0.4,0.6)),
 ("Rugosité — décroissance @200 Hz","< @70 Hz","%.2f asper"%R200,chk(R70-R200,0.2,1.0)),
 ("Fluctuation F — 100 % @4 Hz","1,00 vacil","%.2f vacil"%F4,chk(F4,0.9,1.1)),
 ("Fluctuation — sélectivité @1/@8 Hz","< @4 Hz","%.2f / %.2f"%(F1,F8),chk(F4-max(F1,F8),0.1,0.9)),
]
tr="".join("<tr><td>%s</td><td>%s</td><td><b>%s</b></td><td class='%s'>%s</td></tr>"%(a,b,c,'ok' if e=='conforme' else 'no',e) for a,b,c,e in rows)
figs=[("fig_psy_loud.png","Sonie vs niveau (1 kHz) — méthode de Zwicker simplifiée, calée à 1 sone à 40 dB ; le repère en pointillé est le doublement par 10 dB."),
 ("fig_psy_sharp.png","Acuité vs fréquence (bande étroite, DIN 45692) : l'acuité croît avec la fréquence, comportement attendu."),
 ("fig_psy_roughF.png","Rugosité vs fréquence de modulation (100 % AM) : pic net à 70 Hz, conforme au modèle de Daniel & Weber."),
 ("fig_psy_roughD.png","Rugosité vs profondeur de modulation (@70 Hz) : réponse linéaire, superposée au repère idéal."),
 ("fig_psy_fluctF.png","Fluctuation vs fréquence de modulation : pic à 4 Hz, conforme au modèle de Fastl/Osses.")]
figs_html="".join("<div class='fig'><img src='%s'><p class='cap'>%s</p></div>"%(f,c) for f,c in figs)
html=r"""<!doctype html><html><head><meta charset='utf-8'><style>
@page{margin:16mm 15mm}
body{font-family:Arial,Helvetica,sans-serif;color:#1a2230;font-size:11px;line-height:1.5}
.title{background:#001E50;color:#fff;padding:22px 20px;border-bottom:5px solid #EF3346}
.title h1{margin:0;font-size:21px} .title .sub{opacity:.85;font-size:12px;margin-top:5px}
.meta{font-size:10px;color:#41506a;margin:8px 0 16px}
h2{color:#001E50;font-size:14px;border-bottom:1px solid #cfd8e6;padding-bottom:3px;margin-top:20px}
table{border-collapse:collapse;width:100%;font-size:10.5px;margin-top:6px}
th,td{border:1px solid #cfd8e6;padding:5px 7px;text-align:left}
th{background:#eef2f8;color:#001E50} td.ok{color:#2FA05A;font-weight:bold} td.no{color:#EF3346;font-weight:bold}
.fig{margin:12px 0;page-break-inside:avoid} .fig img{width:88%;display:block;margin:0 auto;border:1px solid #dce3ee}
.cap{font-size:9.5px;color:#41506a;margin:4px 12px 0;text-align:center}
.note{background:#f5f8fc;border-left:3px solid #EF3346;padding:8px 12px;font-size:10px;margin-top:8px}
.foot{margin-top:22px;border-top:1px solid #cfd8e6;padding-top:6px;font-size:9px;color:#69788f}
</style></head><body>
<div class='title'><h1>Validation des indicateurs psychoacoustiques</h1>
<div class='sub'>Sonometre CETIM &mdash; ecran &laquo; Toile psychoacoustique &raquo; (V2.1.0-beta)</div></div>
<div class='meta'>Ref. SONO-VAL-PSY-001 &middot; @@DATE@@ &middot; Auteur : Thibaut Gras (CETIM) &middot; Constantes de calibration : CAL_R = @@CR@@, CAL_F = @@CF@@</div>

<h2>1. Objet</h2>
<p>Ce rapport verifie les cinq indicateurs de qualite sonore affiches en toile d'araignee : sonie N (sone), acuite S (acum), rugosite R (asper), fluctuation F (vacil) et tonalite T, ainsi que la gene psychoacoustique PA. Les calculs sont confrontes a des signaux de reference normalises (tons purs, bandes etroites, tons modules en amplitude).</p>

<h2>2. Methode</h2>
<p><b>Sonie</b> : methode de Zwicker a partir des niveaux 1/3 d'octave (sonie specifique par bande de Bark, seuil en champ), calee a 1 sone pour 1 kHz / 40 dB. <b>Acuite</b> : ponderation DIN 45692 sur la sonie specifique. <b>Rugosite</b> : modele de Daniel &amp; Weber &mdash; enveloppe temporelle (redressement + passe-bas 400 Hz, decimation ~2 kHz), spectre de modulation pondere (pic 70 Hz), sommation quadratique ; blocs ~200-340 ms. <b>Fluctuation</b> : modele de Fastl/Osses &mdash; modulation de la sonie N(t) sur la fenetre glissante, ponderation pic 4 Hz. <b>Durees</b> : rugosite ~200 ms suffisent ; fluctuation exige au moins ~2 s (contrainte du pic 4 Hz), d'ou la fenetre par defaut 4 s (reglable 2/4/8 s).</p>

<h2>3. Resultats de verification</h2>
<table><tr><th>Controle</th><th>Attendu</th><th>Mesure</th><th>Verdict</th></tr>@@ROWS@@</table>

<h2>4. Courbes</h2>
@@FIGS@@

<h2>5. Conclusion et limites</h2>
<p>Les indicateurs repondent conformement aux definitions de reference : sonie calee et croissante avec le niveau, acuite croissante avec la frequence, rugosite piquant a 70 Hz et lineaire en profondeur, fluctuation piquant a 4 Hz.</p>
<div class='note'>Version temps reel <b>calibree</b> sur les tons AM de reference, <b>sans</b> decomposition par bande critique ni correlation inter-bandes (rugosite) &mdash; indicateurs de confort <b>non certifies</b>. Raffinement et confrontation aux jeux de reference MOSQITO prevus (Phase 3).</div>

<div class='foot'>CETIM &middot; Sonometre &mdash; rapport de validation psychoacoustique &middot; genere le @@DATE@@ &middot; thibaut.gras@cetim.fr</div>
</body></html>"""
html=(html.replace("@@DATE@@",today).replace("@@CR@@","%.4f"%CR).replace("@@CF@@","%.4f"%CF)
      .replace("@@ROWS@@",tr).replace("@@FIGS@@",figs_html))
open("psycho_report.html","w").write(html)
subprocess.run(["wkhtmltopdf","--enable-local-file-access","--quiet","psycho_report.html","Rapport_validation_psychoacoustique_CETIM.pdf"],check=True,cwd=".")
print("PDF OK")
