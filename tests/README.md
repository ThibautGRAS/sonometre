# Banc de validation du traitement du signal — sonomètre CETIM

Processus **reproductible** de validation des algorithmes de traitement du signal
de l'application (`index.html`). À rejouer après toute évolution du code DSP.

## Principe

1. `extract_dsp.js` **extrait les fonctions directement depuis `index.html`**
   (FFT, fenêtres, pondérations A/C, filtre C temporel, banc IEC 61260,
   interpolation de pic, constantes de temps). On teste donc **le code déployé**,
   jamais une copie qui pourrait diverger.
2. `run_tests.js` génère des **signaux synthétiques de référence** (sinus calibrés,
   bruit blanc) et compare chaque sortie à sa valeur **analytique ou normative**
   (IEC 61672-1, IEC 61260-1, théorème de Parseval, réponse indicielle
   exponentielle…) avec une tolérance explicite.

## Exécution

```bash
cd tests
node extract_dsp.js      # régénère dsp_extracted.js depuis ../index.html
node run_tests.js        # exécute les 61 tests → console + results.json
```

Code retour 0 = tous les tests dans les tolérances. `results.json` contient chaque
test (valeur, attendu, tolérance, écart) pour archivage / rapport.

## Familles de tests

| # | Famille | Référence |
|---|---------|-----------|
| 1 | FFT (raie, Parseval, fuite) | analytique |
| 2 | Fenêtres (Hann, Blackman, Flat-top) | Parseval / ENBW |
| 3 | Pondérations A et C | table IEC 61672-1 |
| 4 | Filtre C temporel (LCpeak) | IEC 61672-1 + crête sinus |
| 5 | Banc tiers d'octave IIR | IEC 61260-1 (fc, bornes −3 dB, réjection) |
| 6 | Synthèse tiers depuis FFT (+ raie noyée dans du bruit) | analytique |
| 7 | Leq / LAE (SEL) / agrégation octave | définitions énergétiques |
| 8 | Pondérations temporelles Fast/Slow/V-Slow | réponse indicielle (63,2 % à τ) |
| 9 | Interpolation parabolique de pic | fréquence vraie + ENBW |
| 10 | Émergence tonale (arithmétique de base) | raie−bruit |

## Écarts connus et documentés

- **Pondération C à 8 kHz** : +0,65 dB vs valeur nominale (distorsion de la
  transformation bilinéaire à fs = 48 kHz, malgré le pré-warping du pôle HF).
  Toléré à ±1 dB. Sans effet notable sur LCpeak (dominé par les basses fréquences).
- **Sommet d'une raie fine** : lit `niveau vrai − 10·log10(ENBW_fenêtre)`
  (≈ −2,37 dB en Blackman). Conséquence du choix de normalisation en puissance
  totale (Parseval, recalage K) : les niveaux **par bande** et **globaux** sont
  exacts, le sommet ponctuel d'une raie est étalé sur l'ENBW. L'interpolation
  parabolique corrige le scalloping (position inter-bin), pas l'ENBW.

## Hors périmètre du banc (validation sur appareil)

Chaîne micro iOS (réponse du capteur, gain automatique), calibration absolue
(offset 0 dBFS), émergence tonale complète ISO 1996-2 (dépend de l'état applicatif),
corrélation vibro-acoustique (module retiré de l'UI en V35.42).
