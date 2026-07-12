# Sonomètre CETIM

Sonomètre et analyseur acoustique fonctionnant entièrement dans le navigateur, optimisé pour iPhone (Safari) et utilisable hors ligne. Aucune installation, aucun serveur : toute l'analyse s'effectue localement sur l'appareil.

**Application en ligne : [thibautgras.github.io/sonometre](https://thibautgras.github.io/sonometre/)**

---

## Aperçu

L'application transforme le microphone d'un smartphone en sonomètre à affichage multiple : niveau instantané, spectre en bandes fines ou en tiers/octaves, spectrogramme temps-fréquence, évolution temporelle et tableau d'indices. Elle vise un usage d'ingénierie acoustique généraliste (relevés NVH, diagnostics de terrain, comparaisons avant/après traitement) tout en restant honnête sur ses limites métrologiques.

Le traitement du signal est intégralement écrit à la main en JavaScript : FFT sur fenêtre glissante, pondérations normalisées, banc de filtres, intégrations énergétiques. L'ensemble tient dans un unique fichier `index.html`.

## Fonctionnalités

### Mesure
- **Niveau sonore** pondéré A, C ou Z (linéaire), avec constantes de temps Fast, Slow et Very-Slow
- **LAeq / LCeq / LZeq** (niveaux équivalents intégrés en parallèle sur les trois pondérations)
- **LCpeak** : vraie crête pondérée C calculée dans le domaine temporel (filtre C IIR, non une approximation spectrale)
- **LAFmax / LAFmin**, peak-hold
- **Indices statistiques** L10 / L50 / L90 (percentiles du niveau)
- **LAE (SEL)** et **Δ LF** (LCeq − LAeq, indicateur de contenu basse fréquence)

### Analyse fréquentielle
- **Spectre FFT** en bandes fines (fenêtres Blackman, Hann, Hamming, Flat-top, rectangulaire), échelle log ou linéaire
- **Tiers d'octave et octaves** (fréquences normalisées ISO 266), par deux méthodes commutables :
  - *synthèse FFT* (somme d'énergie des bins) — rapide
  - *banc de filtres IEC 61260* (Butterworth d'ordre 6 par bande) — plus fidèle au gabarit normalisé
- **Interpolation parabolique de pic** pour une lecture fréquentielle fine
- **Spectrogramme** temps-fréquence avec échelle de couleur adaptative, interpolation, curseurs (viseur figé et suivi automatique du maximum)
- **Évolution temporelle** du niveau avec zoom et curseur

### Terrain
- **Déclenchement** : départ différé (5/10/30 s) et/ou seuil de niveau ; la mesure ne démarre qu'au franchissement
- **Calibration** : calage d'offset au calibreur acoustique (94 / 114 dB), courbe de correction fréquentielle par balayage tiers d'octave, profils enregistrables
- **Export** : menu de partage (feuille iOS) ou téléchargement, en CSV enrichi (métadonnées, tous les indices, spectre, historique) ou en image PNG titrée du graphe

### Confort
- **Hors ligne** : après un premier chargement en ligne, l'application s'ouvre sans réseau (service worker)
- **Installable** sur l'écran d'accueil comme une application (PWA)
- **Thèmes de façade** : Marine, Acier, Clair labo, OLED noir (charte CETIM conservée)
- Interface entièrement en français, pensée pour l'usage à une main sur iPhone

## Utilisation

1. Ouvrir [l'application](https://thibautgras.github.io/sonometre/) dans Safari (iPhone) ou Chrome (Android)
2. Autoriser l'accès au microphone au premier lancement
3. Appuyer sur **▶** pour démarrer une mesure

**Installer sur l'écran d'accueil (recommandé)** — iPhone : bouton Partager de Safari puis « Sur l'écran d'accueil ». Android : menu du navigateur puis « Ajouter à l'écran d'accueil ». L'application s'ouvre alors en plein écran et fonctionne hors ligne (après un premier chargement connecté).

**Gestes principaux**
- Touche **ÉCRAN** : appui court pour changer d'affichage, appui long pour le mode expert
- Touche **▶** : appui long pour le menu de déclenchement
- Sur les graphes : pincer pour zoomer, glisser pour déplacer, toucher pour poser un curseur

Une **page d'aide** complète est accessible depuis le menu expert de l'application.

## Précision et limites

L'exactitude d'un sonomètre logiciel dépend entièrement du microphone de l'appareil et de sa calibration. Les micros de smartphones sont conçus pour la voix, non pour la métrologie, et leur réponse varie d'un modèle à l'autre, d'une unité à l'autre, et selon la version du système.

- **Sans calibration**, l'application est fiable en **relatif** (comparaisons, spectres, évolutions), pas en niveau absolu.
- **Avec calibration** au calibreur acoustique, la justesse peut approcher celle d'un sonomètre de classe sur une plage donnée, mais l'application **ne constitue pas un instrument de mesure certifié** et ne peut pas revendiquer une conformité de classe 1 ou 2.
- La calibration est **propre à chaque appareil** et n'est pas transférable.

Ces réserves doivent accompagner tout usage en contexte de rapport ou de décision.

## Détails techniques

- **Architecture** : fichier HTML autonome (HTML + CSS + JavaScript), sans dépendance ni build. Fichiers annexes : `sw.js` (service worker), `manifest.webmanifest`, icônes.
- **Capture** : Web Audio API (`getUserMedia` + `AnalyserNode`), FFT radix-2 maison sur *ring buffer*, normalisation de Parseval par fenêtre.
- **Pondérations** : A / C / Z selon IEC 61672 (formules exactes appliquées bin par bin).
- **Tiers d'octave IEC** : passe-bande Butterworth d'ordre 6 par bande (prototype passe-bas → transformation passe-bas/passe-bande → bilinéaire avec pré-warping).
- **Déploiement** : GitHub Pages, mise à jour automatique du cache hors ligne à chaque version.

## Déploiement

Le dépôt est publié via **GitHub Pages** (branche `main`, racine). Toute modification de `index.html` poussée sur `main` est mise en ligne automatiquement. Le service worker est ré-estampillé à chaque version pour forcer la mise à jour du cache sur les appareils.

## Licence et marque

Le logo et le nom CETIM sont la propriété du CETIM. Ce projet est développé dans le cadre d'un usage interne d'ingénierie acoustique. Toute diffusion externe doit être validée par le service concerné.

---

*Développé pour le CETIM — Centre technique des industries mécaniques.*
