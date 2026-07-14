# Sonomètre CETIM — Mémoire du projet

Application web mono-fichier (sonomètre + analyseur) pour iPhone, déployée sur GitHub Pages.
Ce document sert de mémoire technique : architecture, conventions, pièges connus et journal des versions.

- **Repo** : `ThibautGRAS/sonometre` (branche `main`)
- **URL live** : https://thibautgras.github.io/sonometre/
- **Auteur** : Thibaut Gras · CETIM · thibaut.gras@cetim.fr

---

## 1. Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | Application complète (HTML + CSS + JS en un seul fichier) |
| `sw.js` | Service worker (ouverture hors ligne, gestion du cache) |
| `manifest.webmanifest` | Manifeste PWA (installation écran d'accueil) |
| `icon-192.png`, `icon-512.png` | Icônes d'application |
| `README.md` | Présentation publique |
| `MEMOIRE.md` | Ce document |

## 2. Déploiement

Déploiement via l'API GitHub Contents (`api.github.com`), pas de build local (travail sur iPhone).
À **chaque** déploiement :
1. Ré-estamper le cache du service worker : `const CACHE = 'sono-<hash8>'` (hash du `index.html`).
2. Mettre à jour le numéro de version affiché sur le splash (`.splashver`) et l'entrée du journal ci-dessous.
3. Valider le JS avant envoi : extraire le plus gros bloc `<script>`, `node --check`, vérifier que chaque `$('id')` a un `id="..."` correspondant.
4. Recharger l'app sur l'appareil pour récupérer la nouvelle version.

## 3. Conventions

- **Charte CETIM** : marine `#001E50`, rouge `#EF3346`, police Arial Nova. Logo vectorisé (traçage de contours) inclus en SVG.
- **Thèmes** : Marine (défaut CSS), Acier, Clair labo, OLED noir (défaut applicatif), Game Boy DMG-01, Matrice. Tout suit le thème via variables CSS.
- **Persistance** : préférences dans `localStorage` (local à chaque appareil/navigateur, **jamais** sur Git) sous `sono_prefs` ; langue sous `sono_lang` ; profils de calibration sous une clé dédiée. Survit aux mises à jour, effacé si l'utilisateur vide les données du site.
- **Langues** : FR (source), EN, ES — bascule par drapeaux en tête de l'aide, dictionnaire `TR` + `translatePass()`.

## 4. Pièges techniques connus

- `CV.sgramCv` est un objet `{g,w,h,dpr}`, **pas** un canvas — dessiner en coordonnées logiques.
- `SG.cols` est un tampon **décalé** (le plus récent toujours à `Wp-1`), pas circulaire.
- Ligne 0 du tampon spectrogramme = fréquence **haute**.
- Le fichier contient **deux** blocs `<script>` ; le module i18n est injecté à la fin du plus gros.
- Échelle couleur du spectrogramme **partagée** entre vues 2D et 3D (`S.scale.sgram`).
- `autoRange()` : anti-scintillement (expansion immédiate, contraction temporisée 2 s).
- **Démarrage sans saut** (important, source de plusieurs bugs passés) :
  - thème appliqué par un mini-script inline **avant** le premier rendu (sinon flash marine→thème réel) ;
  - écran + clavier masqués (`body.booting`) puis révélés après le premier rendu complet ;
  - splash screen par-dessus, fondu après durée minimale ;
  - **pas** de `location.reload()` automatique sur `controllerchange` (il provoquait un double-chargement visible à chaque mise à jour).
- Service worker : `updateViaCache:'none'` à l'enregistrement + `fetch(req,{cache:'reload'})` pour le document → la version fraîche est servie sans dépendre du cache HTTP.
- Icônes flottantes des graphes (`.sg3dbtn`) : taille uniforme 46×26, estompage automatique après 3,5 s d'inactivité.
- Traduction : ne jamais écraser le contenu d'une touche qui contient un SVG (icônes ▶ ■ ⏸) — garde `if(el.children.length)return`. Valeurs composées traduites mot à mot (`Tstr`), pas par correspondance exacte. **Valeurs dynamiques** (touches `.kv`, valeurs `.mrow b`) : traduites via `trDyn()` qui traduit TOUJOURS depuis le français mémorisé (`dataset.fr`) avec garde `dataset.tr` (ne retraduit jamais un texte déjà traduit par nous). Sans ça, le remplacement mot-à-mot recompoundait (« Expert »→« Experto »→« Expertoo »… car « Expert » est un sous-mot de « Experto ») et la bascule ES→EN restait bloquée (on traduisait depuis l'espagnol au lieu du français).
- Spectrogramme 3D : réduire une tranche de fréquence par **max**, pas par moyenne (une raie fine serait diluée) ; lisser en **préservant les maxima locaux** (sinon le 1-2-1 rabaisse les raies). Les valeurs 3D doivent correspondre à la 2D.
- **Mouvement continu 3D (état actuel, V35.18→36)** : `drawSgram3D` n'échantillonne plus le tampon à âges fixes (ça faisait SAUTER les crêtes). Modèle **buffer de courbes-instantanés glissantes** dans `window.V3={frames,ema,acc,lastT,sig}` :
  - **EMA continue (V35.29)** : la colonne live est lissée à CHAQUE image (constante de temps ~55 ms, `a=1-exp(-dt/55)`) ; le **front** (dernier frame) est resynchronisé sur l'EMA chaque redraw (`frames[last].set(V.ema)`) → sa forme morphe en continu (fini le saut vertical du présent). Un instantané figé est poussé à `capInt=winSec*1000/(maxFrames-1)` (min 16 ms) ; `frames` plafonné à `maxFrames` (**96**, plus de mode Fluide/surface).
  - profondeur **continue** : `dzArr[k]=1-((len-1-k)+phase)/(maxFrames-1)`, `phase=acc/capInt` (0→1) ; front `dz≈1`.
  - `sig` = signature (mode, nF, fmin, fmax, maxFrames) → **reset des frames** si la vue change ; `resetSg3d()` vide `V3` sur clearAll/clearSgram/reset mesure (sinon on revoit l'ancienne trace).
  - **cache** : `key` (chaîne) contient `run/stop` et non `seq` → redraw **chaque frame en marche**, figé à l'arrêt.
  - **cadence ~60 FPS** (`SG._3dLast`, garde 10 ms) — le rendu est allégé (1 tracé dégradé par courbe, 1 point sur 2). **Anti-scintillement (V35.28)** : fondu du bord arrière (`edgeA` selon `dz`, la plus ancienne s'estompe au lieu de « poper »).
  - **Perf mesure longue (V35.30)** : pool de tampons persistant `SG._sc={pool,slice,norm,raw,dz}` réutilisé chaque frame → plus d'allocation dans la boucle chaude (fin des à-coups GC). `smoothProf(prof,out)` écrit dans un tampon fourni.
  - **3 niveaux de lissage (V35.30)** : `S.sg3dSmooth` 0-2 = Standard/Lisse/Très lisse (défaut Lisse) → `wirePass=smoothLvl` (passes 1-2-1 fil de fer, pics préservés).
  - **Axe temps (V35.31)** : plus de marqueur « ▲ présent » — un axe temps sur la profondeur (étiquettes `0 s`/`-winSec/2`/`-winSec`, titre « temps », `marginL=38`).
  - **Rotation** : azimut `S.sg3dRot` (`skewTot=plotW*(0.12+0.50*rot)`, symétrique), tangage `S.sg3dPitch` (`depth=plotH*(0.40+0.48*pitch)`, geste vertical `dy/220`).
- **Curseur FFT (V35.35-37)** : posé au tap ; **accroche un pic local** (fenêtre **±4 %** ou ≥3 bins, élargie en V35.37, + interp. parabolique) SEULEMENT si le tap est **au-dessus** de la courbe (`S.cursor.snap`, décidé via `tapDb > specCurveDb(f)+1`), sinon placement libre. **Déplaçable au glissé** (prise à 5 % de largeur, `mode='cursor'` dans `attachZoomPan`, conserve `snap`). **Double-tap dessus** = l'enlève. Zoom vertical dB **ancré sous les doigts** (`anchors.yc`) → plus de dérive.
- **Deux chemins de rendu (état actuel)** : le glissement continu ne s'applique qu'aux fenêtres **bornées 3/5/10 s** (`!isTout`, seules proposées en 3D). Le mode **« Tout »** (`isTout`, réservé à la **2D** depuis V35.27) garde l'**ancien rendu décimé** (`maxSlices=90`, tranches à âges fixes, `dzArr[j]=j/(nT-1)`, cache par `seq`). `smoothProf` est partagé. Le **mode surface a été entièrement retiré** (fil de fer uniquement).

## 5. Fonctions principales

- **Écrans** : Spectre (tiers d'octave / octave / FFT bande fine), Spectrogramme (2D + vue 3D waterfall), Évolution temporelle, Valeurs (2 pages).
- **Indices** : LAeq, LCpeak, LAFmax/min, L10/L50/L90, LAE (SEL), Δ LF.
- **Émergence tonale** (ISO 1996-2) : toujours évaluée ; affichée dans le tableau de valeurs et au curseur FFT ; seuil réglable au menu expert ; bouton ÉMG = encadré orange de détection auto sur la bande fine.
- **VIB** — corrélation vibro-acoustique : coefficient de Pearson (0→1) entre l'enveloppe de chaque bande et le niveau accéléromètre (téléphone posé sur la structure). Corrèle les enveloppes (±250 ms de délai toléré), pas les formes d'onde ; une source constante n'est pas corrélable. Outil de tri « ce bruit vient-il de cette machine ? ». Adaptation « domaine enveloppe » de la méthode de cohérence (coherent output power, Bendat & Piersol).
- **Écoute filtrée (🔊)** : réinjection du micro vers la sortie à travers un passe-bande calé sur la bande de fréquence zoomée du spectrogramme, pente 24/48/96 dB/oct réglable. Écouteurs indispensables (larsen). Latence mesurée affichée.
- **Calibration / réf. pleine échelle (0 dBFS)** : `S.offset` = niveau correspondant à 0 dBFS (≈120 dB ; **pas** une « correction d'amplitude », terme corrigé partout en V35.36). Réglage au calibreur (94/114 dB) + correction fréquentielle par tiers d'octave face à un sonomètre étalon, enregistrable en profil.
- **Export / Rapport** (menu EXPORT) : trois blocs. (1) **Infos du rapport** facultatives mémorisées (`localStorage` `rep_repSite/Oper/Ref/Note` + cases figures `rep_figSpec/Sgram/Hist`). (2) **Rapport (PDF)** : `generateReport()` ouvre un **onglet autonome** (`window.open`+`document.write(buildReportDoc)`, styles `REPORT_CSS`, impression auto au `load` → « Enregistrer en PDF » iOS ; repli partage `.html` si popup bloqué). Contenu : **logo CETIM** (`cetimLogoSVG`, reconstruit depuis le SVG du DOM), indices, conditions d'acquisition (dont **Réf. pleine échelle 0 dBFS** = `S.offset`), **figures cochées** rendues à la demande même hors écran (`figureDataURL` → `drawSpectrum`/`drawSgram`/`drawHistory` puis `toDataURL`), spectre 1/3 oct, commentaire, pied non-métrologique. (3) **CSV** complet et **PNG** titré (en-tête avec logo `LOGO_IMG_LIGHT` pré-rasterisé), via la feuille de partage iOS.

## 6. Transport (boutons)

Convention **enregistreur** (comme le Dictaphone iOS) : bouton principal **rouge** avec point d'enregistrement ● au repos → carré ■ + halo pulsé en mesure. Pause dédiée ⏸ (ambre vif « enfoncé » quand active), ne se métamorphose jamais en triangle.

## 7. Points en attente / à faire

- **CRITIQUE** : révoquer le jeton GitHub (PAT) utilisé pour les déploiements — il a été exposé en clair. GitHub ▸ Settings ▸ Developer settings ▸ Personal access tokens (révoquer + recréer un fine-grained limité au repo `sonometre`, permission Contents R/W).
- Rapport PDF : `window.open` peut être bloqué en mode « app écran d'accueil » (standalone) → repli sur partage `.html`. À valider si Thibaut installe l'app.
- Logo : logo d'en-tête ramené à 15 px (aligné sur le wordmark « Sonomètre ») en V35.37 ; restent le logo du rapport (32 px) et l'export PNG (18 px), à confirmer/affiner selon le rendu voulu.
- Passe 2 de traduction : toasts éphémères et étiquettes dessinées dans les graphes (encore en français) ; + aide EN/ES du bouton MOY (V35.41) à compléter.
- VIB : à valider sur cas réel (garder ou retirer selon l'usage terrain).
- Écoute filtrée : à tester sur un cas d'identification de raie réel.

---

## 8. Journal des versions

> Les versions antérieures à V27 sont documentées dans l'historique Git.

- **V35.41** : **spectre instantané ⇄ moyenné (Leq)**. Nouvel accumulateur d'énergie par bin FFT `S.binEnergy` (Float64, en miroir de `bandEnergy` pour les tiers d'octave) : `+= p·dt` quand `!idle`, remis à zéro dans `clearAll` et `beginRun`. Nouveau toggle écran **MOY** (`#avgBtn`, à côté de VIB/ÉMG, `right:112px`) piloté par `S.specAvg` (persisté) : bascule l'affichage du spectre entre instantané (lissage TEMPS Fast/Slow/V‑Slow) et **moyenné Leq sur la durée de mesure**, en tiers d'octave, octave ET bande fine. `drawSpectrum(avg)` : `useAvg = (avg===undefined?S.specAvg:avg) && eqT>0` → source `bandEnergy/eqT` ou `binEnergy/eqT`, peak-hold masqué, libellé « L<x>·Moy ». Le **rapport PDF** force toujours la figure moyennée (`figureDataURL('spec')`→`drawSpectrum(true)`) — **corrige le défaut** où le spectre exporté montrait l'instant final au lieu de la moyenne. Bouton grisé tant qu'aucune mesure (`eqT=0`). TEMPS et max/min/percentiles **inchangés** (pas d'ambiguïté). Aide EN/ES du bouton MOY à compléter.
- **V35.40** : **rapport — pagination + saisie**. (1) **Un graphe par page** : chaque figure sélectionnée est enveloppée dans `.rep-fig` avec `break-before:page` + `break-inside:avoid` (impression), titre en haut de page, image bornée `max-height:225mm object-fit:contain`. Page 1 = en-tête + indices + conditions ; figures ensuite chacune sur sa page ; la dernière partage sa page avec le tableau tiers d'octave + commentaire. Sur écran (pas d'impression) les figures s'enchaînent normalement. (2) **Popover export** : champ **Commentaire agrandi** (2→4 lignes, `min-height:76px`, `resize:vertical`) ; scroll **confiné** (`overscroll-behavior:contain`) ; **scroll-into-view au focus** des champs (`e.scrollIntoView({block:'center'})` après 300 ms) → le clavier iOS ne masque plus le champ en cours de saisie (surtout le commentaire).
- **V35.39** : **en-tête rapport responsive** (correctif largeur sur l'aperçu écran étroit). Le rapport est conçu A4 mais s'affiche à ~390 px sur iPhone → le logo (~190 px) écrasait titre et méta en cascade. `.rep-h` passe en `flex-wrap`, `.rep-htxt` en `flex:1 1 auto;min-width:0`, et une **media query `screen and (max-width:600px)`** (n'affecte PAS l'impression/A4) : logo 30→22 px, titres réduits, `.rep-htxt{flex-basis:0}` (logo+titre restent sur une ligne, le titre s'enroule), **bloc méta en pleine largeur sous le titre** (`order:3`, `flex-basis:100%`, aligné à gauche, lignes `label valeur` en flux `white-space:nowrap`). Le PDF final (media print) est inchangé.
- **V35.38** : **en-tête du rapport PDF refondu** (charte CETIM). Le CSS définissait `.rep-bar` (trait rouge) et `.rep-t1` (titre navy) **inutilisés** → header remis en cohérence avec l'app : logo CETIM navy · **séparateur rouge vertical** (`.rep-bar`, `align-self:stretch`) · **titre fort** navy capitales `.rep-t1` « Rapport de mesure acoustique » + sous-titre `.rep-t2` « Sonomètre CETIM · analyse de bruit ». Bloc **méta** à droite structuré en lignes `LABEL valeur` (Date/Réf/Site/Opérateur, `.rl` gris capitales, **même corps que la valeur** — 10 px), n'affiche que les champs remplis. Filet navy 2 px sous l'en-tête + **accent rouge** (`.rep-h::after`, 66 px à gauche). Logo rapport 32→30 px.
- **V35.37** : **logo d'en-tête** ramené de 18 à 15 px (`.logo`) → largeur ~114→95 px, aligné en hauteur sur le wordmark « Sonomètre » (le trait rouge séparateur ne paraît plus court). **Curseur FFT** : fenêtre d'accroche du pic au tap élargie de **±2 % → ±4 %** (plancher 2→3 bins) — le tap accroche un pic un peu plus loin autour du point touché ; curseur deux-doigts (max de toute la fenêtre zoomée) inchangé.
- **V35.36** : **curseur FFT** — (a) **double-tap sur le curseur** l'enlève (`opts.onCursorRemove`, détecté quand le second tap tombe sur le curseur ; double-tap ailleurs = reset vue comme avant) ; (b) **accroche conditionnelle** : le tap **au-dessus** de la courbe accroche le pic local (fenêtre ±2 % + interp. parabolique), le tap **sous/sur** la courbe = placement libre à la fréquence visée (`S.cursor.snap` décidé via `tapDb > specCurveDb(f)+1` ; `tapDb` calculé dans `touchend` par l'inverse de `y2` ; le glissé conserve le mode, `tapDb==null`). Libellé ⟂ seulement si accroché. **Logo** : en-tête rapport aligné (logo seul + sous-titre, sans doublon « SONOMÈTRE »), PNG logo 16→18 px. (1) **vrai logo CETIM** dans le rapport (en-tête, `cetimLogoSVG(fill)` reconstruit le SVG depuis le logo du DOM — chemins exacts, lettres `#001E50`, carré rouge) et dans l'export PNG (`LOGO_IMG_LIGHT` pré-rasterisé en `#EAF4FF`, `drawImage` avec repli texte). (2) **Libellé corrigé** : « correction d'amplitude » → **« Réf. pleine échelle (0 dBFS) »** dans le rapport, le menu expert (`mCalib`), le titre écran calibration et l'i18n (l'offset ~120 dB est le niveau à 0 dBFS, pas une correction). (3) **Zoom vertical du spectre** ancré **sous le milieu des doigts** (`anchors.yc` mémorisé au verrouillage db, dilatation autour de `anchorDb`) → fini la dérive haut/bas. (4) **Curseur spectre déplaçable au glissé** : `attachZoomPan` détecte la prise sur le curseur au `touchstart` (`opts.getCursorU`, seuil 5 % de largeur) → `mode='cursor'`, et le `touchmove` appelle `opts.onTap` en continu (comme le curseur d'évolution).
- **V35.34** : rapport multi-figures (cases Spectre/Spectrogramme/Évolution, rendu hors écran via `figureDataURL`).
- **V35.33** : **rapport PDF fiabilisé** — onglet autonome (`window.open`+`document.write(buildReportDoc)`), `REPORT_CSS`, impression auto au `load`, repli partage `.html` si popup bloqué. (Remplace l'ancienne impression `@media print` qui imprimait l'app.)
- **V35.32** : **refonte du menu Export → rapport pro**. Popover réorganisé en 3 blocs : (1) **Infos du rapport** facultatives et mémorisées en `localStorage` (`rep_repSite/Oper/Ref/Note`) ; (2) **Rapport complet (PDF)** ; (3) CSV/PNG conservés. Le rapport A4 contient : en-tête CETIM + date/réf/site/opérateur, tableau **indices** (LAeq/LCeq/LZeq, LAFmax/min, LCpeak, L10/50/90, LAE-SEL, ΔLF, durée), **conditions d'acquisition** (micro, Fe, FFT, fenêtre, overlap, source 1/3 oct, pondérations, correction d'amplitude `S.offset`, écran exporté), image du graphe courant, **spectre par tiers d'octave**, commentaire, pied **non-métrologique**. CSS `.ep-in`. Aide FR MAJ.
- **V35.31** : **3D — axe temps** : le marqueur « ▲ présent » est remplacé par un vrai **axe temps** sur la profondeur (étiquettes `0 s` au front / `-winSec/2` / `-winSec` au fond, guides + titre « temps » vertical à gauche ; `marginL` 14→38 pour loger les étiquettes). **Rotation élargie** : plus d'amplitude autour de l'axe des fréquences (`depth=plotH*(0.40+0.48*pitch)`, `ampH=…*(1-0.26*pitch)`, geste `dy/220`) et azimut plus symétrique (`skewTot=plotW*(0.12+0.50*rot)`). **Export** (`buildGraphCanvas`) : en-tête sans chevauchement — titre + sous-titre **empilés à gauche** (y 29 / 47), date **en haut à droite** (y 29), `top` 52→56 ; le sous-titre spectrogramme indique aussi la **durée de fenêtre** (ex. « · 5 s · 3D »).
- **V35.30** : **3 niveaux de lissage** seulement — `S.sg3dSmooth` 0-2 = **Standard / Lisse / Très lisse** (défaut **Lisse** = milieu ; `sg3dSmooth:1`). Niveau « Fluide » supprimé → `maxFrames=96` et `maxSlices=90` toujours ; `wirePass=smoothLvl` (0/1/2). Cycle `%3`, clamp `Math.min(2,…)`. **Bug relancement corrigé** : `resetSg3d()` (vide `window.V3.frames/ema/acc/lastT` + `SG._3dKey/_3dLast`) appelé dans `clearAll`, `clearSgram` et le reset de mesure — on ne revoit plus l'ancienne trace 3D. **Perf mesure longue** : pool de tampons persistant `SG._sc={pool,slice,norm,raw,dz}` → `smoothProf(prof,out)` écrit dans un tampon fourni, `liveEMA` réutilise `raw`, front resynchronisé par `.set()` (plus de `slice()` par image), `dzArr` réutilisé. Fin des ~20 000 `Float32Array/s` → plus d'à-coups GC après quelques minutes. `sg3dSmooth` persisté clampé (ancien 3→2).
- **V35.29** : **front live continu** — la courbe de front (présent) suit maintenant le signal à **chaque image** (EMA à constante de temps ~55 ms, resynchronisée sur le dernier frame chaque redraw) au lieu d'un instantané figé rafraîchi seulement à la cadence de capture. Fin du léger « saut de haut en bas » du front (surtout visible en HF/à droite). Push d'un instantané figé à `capInt` (l'ancien front est committé, un nouveau front live repart).
- **V35.28** : anti-scintillement du fil de fer 3D — cadence remontée à **~60 FPS** (le rendu par dégradé, 1 tracé/courbe, est désormais assez léger ; pas de glissement deux fois plus petits) et **fondu du bord arrière** (`edgeA` selon `dz`) : la courbe la plus ancienne s'estompe au lieu de disparaître d'un coup. Dégradé allégé (1 point sur 2).
- **V35.27** : le **spectrogramme 2D** retrouve l'option **« Tout »** (défaut 2D) ; le **3D** garde 3/5/10 s (défaut 5 s, jamais « Tout »). Fenêtres de temps **mémorisées par vue** (`S._tv2d`/`S._tv3d`) basculées au toggle 2D↔3D. `sgDefaultView()` (2D→Tout, 3D→5 s) utilisé par tous les resets. **Appui long ÉCHELLES** applique le défaut selon la vue, libellé passe bien à **« Auto »** (`fullT` du libellé : 5 s en 3D, Tout en 2D).
- **V35.24–26** : bouton LOG/LIN aligné puis élargi (hauteur 42 px = bouton OK, largeur 92 px) dans la ligne de saisie Hz.
- **V35.23** : toggle **LOG/LIN** déplacé dans la ligne de saisie Hz (ne mord plus le stepper max) ; **mode surface entièrement retiré du code** (fil de fer uniquement) — le niveau max de « Lissage / perf. 3D » devient **Très lisse** (Fluide/Standard/Lisse/Très lisse) ; **traduction corrigée à la racine** : `trDyn()` traduit toujours depuis le français mémorisé avec garde `dataset.tr` → fini le recompoundage « expertoooooo » et la bascule ES→EN fonctionne (plus de « Compartir/Réinit » figés).
- **V35.22** : toggle **LOG/LIN** (échelle fréquence) déplacé du menu expert vers le popover **ÉCHELLES** (section fréquence, présent pour spectre + spectrogramme) ; steppers dB resserrés (le « + » du max ne déborde plus) ; **mode surface retiré** du menu — il devient le **niveau maximal** d'une nouvelle option expert **« Lissage / perf. 3D »** (Fluide = moins de courbes pour smartphone à la peine → Standard → Lisse → Surface) ; `S.sg3dSmooth` (0–3) pilote maxFrames, passes de lissage fil de fer et bascule surface ; bouton Interpolation compact.
- **V35.21** : saisie **fréquence** (et temps) appliquée sur `change` en plus du bouton OK (le 1ᵉʳ appui OK ne faisait que fermer le clavier iOS → « ça ne fait rien ») ; **Pleine bande** = 20 Hz–20 kHz, détection d'état corrigée (comparait à Nyquist au lieu de `min(20000,nyq)`) et n'altère plus le temps ; couleurs du **fil de fer** lissées en **dégradé** le long de la courbe (fini les sauts de couleur marqués aux pics) et un seul `stroke` par courbe (plus léger).
- **V35.20** : options TEMPS spectrogramme = **3/5/10 s** (plus de « Tout » ; défaut **5 s** ; « Tout » conservé pour l'évolution) ; ÉCHELLES Auto met le temps à 5 s ; amplitude spectrogramme par défaut **fixe 0–90 dB** (preset 0–90 ajouté) ; **pause fige** le glissement 3D (capture/avance conditionnées à `!S.paused`) tout en laissant tourner/incliner ; **tangage** vertical (`S.sg3dPitch`, glisser bas = plongée) = rotation légère autour de l'axe des fréquences.
- **V35.19** : glissement continu réservé aux fenêtres bornées **3/5/10 s** ; en mode **Tout** retour à l'ancien rendu décimé léger (le glissement était saccadé/lourd sur tout le tampon). Helper `smoothProf` partagé.
- **V35.18** : fil de fer 3D à **glissement continu** — buffer de courbes-instantanés (`window.V3`) capturées à cadence régulière + EMA, profondeur continue interpolée par phase fractionnaire (fini le saut de tranche en tranche), redraw chaque frame en marche, plafond ~43 FPS. Look/masquage/couleurs inchangés.

- **V27–V33** : vue 3D waterfall (rotation, cache de rendu, modes fil de fer/surface, anti-scintillement), colorbar 3D unifiée avec la 2D, logo CETIM vectorisé, thèmes Game Boy et Matrice, modules VIB (corrélation vibro-acoustique) et écoute filtrée (🔊), traduction FR/EN/ES.
- **V33.1** : icônes ▶⏸ préservées lors de la traduction ; encadrés curseur/émergence sous les boutons ; traduction robuste (try/catch + re-passe).
- **V33.2–33.6** : estompage auto des icônes de graphes ; unités Hz/dB uniformisées et dessinées en dernier plan ; icônes du spectrogramme placées, dimensionnées et alignées horizontalement à gauche.
- **V33.7** : touche ANALYSE grisée hors de l'écran Spectre.
- **V34** : boutons transport style enregistreur ; correctif cache (`cache:'reload'`).
- **V34.1** : émergence toujours active (tableau + curseur), bouton ÉMG = encadré auto seulement.
- **V34.2** : bouton principal rouge (convention REC) ; service worker auto-actualisant.
- **V34.3** : icône statique du bouton START corrigée (triangle → point d'enregistrement).
- **V34.4** : thème appliqué avant le premier rendu (fin du flash) ; garde du reload SW.
- **V34.5** : suppression du grisage `mic-wait` au lancement.
- **V34.6** : masquage écran + clavier pendant le boot.
- **V34.7** : suppression du reload automatique du service worker (cause du saut de config à chaque mise à jour).
- **V35** : splash screen CETIM (logo, wordmark, barre de progression), fondu après durée minimale.
- **V35.1** : numéro de version affiché sur le splash, durée allongée à 1,4 s.
