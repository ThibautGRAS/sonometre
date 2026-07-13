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
- **Persistance** : préférences dans `localStorage` sous `sono_prefs` ; langue sous `sono_lang` ; profils de calibration sous une clé dédiée.
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
- Traduction : ne jamais écraser le contenu d'une touche qui contient un SVG (icônes ▶ ■ ⏸) — garde `if(el.children.length)return`.

## 5. Fonctions principales

- **Écrans** : Spectre (tiers d'octave / octave / FFT bande fine), Spectrogramme (2D + vue 3D waterfall), Évolution temporelle, Valeurs (2 pages).
- **Indices** : LAeq, LCpeak, LAFmax/min, L10/L50/L90, LAE (SEL), Δ LF.
- **Émergence tonale** (ISO 1996-2) : toujours évaluée ; affichée dans le tableau de valeurs et au curseur FFT ; seuil réglable au menu expert ; bouton ÉMG = encadré orange de détection auto sur la bande fine.
- **VIB** — corrélation vibro-acoustique : coefficient de Pearson (0→1) entre l'enveloppe de chaque bande et le niveau accéléromètre (téléphone posé sur la structure). Corrèle les enveloppes (±250 ms de délai toléré), pas les formes d'onde ; une source constante n'est pas corrélable. Outil de tri « ce bruit vient-il de cette machine ? ». Adaptation « domaine enveloppe » de la méthode de cohérence (coherent output power, Bendat & Piersol).
- **Écoute filtrée (🔊)** : réinjection du micro vers la sortie à travers un passe-bande calé sur la bande de fréquence zoomée du spectrogramme, pente 24/48/96 dB/oct réglable. Écouteurs indispensables (larsen). Latence mesurée affichée.
- **Calibration** : offset au calibreur (94/114 dB) + correction fréquentielle par tiers d'octave face à un sonomètre étalon, enregistrable en profil.
- **Export** : CSV complet ou image PNG titrée, via la feuille de partage iOS.

## 6. Transport (boutons)

Convention **enregistreur** (comme le Dictaphone iOS) : bouton principal **rouge** avec point d'enregistrement ● au repos → carré ■ + halo pulsé en mesure. Pause dédiée ⏸ (ambre vif « enfoncé » quand active), ne se métamorphose jamais en triangle.

## 7. Points en attente / à faire

- **CRITIQUE** : révoquer le jeton GitHub (PAT) utilisé pour les déploiements — il a été exposé en clair. GitHub ▸ Settings ▸ Developer settings ▸ Personal access tokens.
- Passe 2 de traduction : toasts éphémères et étiquettes dessinées dans les graphes (encore en français).
- VIB : à valider sur cas réel (garder ou retirer selon l'usage terrain).
- Écoute filtrée : à tester sur un cas d'identification de raie réel.

---

## 8. Journal des versions

> Les versions antérieures à V27 sont documentées dans l'historique Git.

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
