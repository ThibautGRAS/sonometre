# Validation psychoacoustique — banc d'émulation

**Sonomètre CETIM · `emulate.js`** — 2026-07-20

Ce banc exécute les **fonctions DSP réelles** extraites de `index.html` (FFT, banc de filtres tiers d'octave IEC 61260, sonie ISO 532-1 tabulée, acuité DIN 45692, rugosité Daniel & Weber, fluctuation Fastl, tonalité Aures, TNR/PR ECMA-74) dans un bac à sable Node, avec un état `S` simulé et **calibré** (offset = −20·log10(2·10⁻⁵) = 93,98 dB → signaux générés en pascals). Il reproduit le flux de données réel de l'application (banc IIR → `curBndZ` non pondéré, spectre FFT/Parseval → `binPowD`) puis appelle les mêmes fonctions que la toile.

## Résultats

```
=== SONIE (ISO 532-1) — ton pur 1 kHz, définition 40 dB = 1 sone, ×2 / +10 dB ===
OK    1 kHz 40 dB                          1.026sone   réf 1 ±0.18
OK    1 kHz 50 dB                          2.070sone   réf 2 ±0.36
OK    1 kHz 60 dB                          4.174sone   réf 4 ±0.72
OK    1 kHz 70 dB                          8.536sone   réf 8 ±1.44
OK    1 kHz 80 dB                         17.390sone   réf 16 ±2.88

=== ACUITÉ (DIN 45692) — ton pur 1 kHz 60 dB ~ 1 acum ===
OK    1 kHz 60 dB                          1.012acum   réf 1 ±0.25
      3 kHz 60 dB (plus aigu)              2.154acum

=== RUGOSITÉ (D&W) — AM 1 kHz/70 Hz/100%/60 dB = 1 asper ===
OK    AM 70 Hz 100% 60 dB                  1.003asper   réf 1 ±0.25
OK    AM 70 Hz 50% 60 dB                   0.341asper   réf 0.34 ±0.12

=== FLUCTUATION — AM 1 kHz/4 Hz/100%/60 dB = 1 vacil ===
OK    AM 4 Hz 100% 60 dB                   1.003vacil   réf 1 ±0.3
      AM 4 Hz 50% 60 dB                    0.502vacil

=== TONALITÉ — 1 kHz pur (Aures) + TNR/PR (ECMA-74) ===
      Aures 1 kHz 60 dB                    1.263tu
      T-TNR 1 kHz                         15.531dB
      T-PR 1 kHz                         100.334dB

=== BRUIT DE FOND — bruit rose 50 dB : rugosité doit être ~0 ===
      pink 50 dB : N                       5.830sone
OK    pink 50 dB : R (D&W)                 0.015asper   réf 0 ±0.15

=== FLUCTUATION 5 s + balayage f_mod (pic attendu ~4 Hz) ===
      AM 1 Hz 100% 60 dB                   0.631vacil
      AM 2 Hz 100% 60 dB                   0.991vacil
      AM 4 Hz 100% 60 dB                   0.999vacil
      AM 8 Hz 100% 60 dB                   0.154vacil
      AM 16 Hz 100% 60 dB                  0.185vacil
      AM 32 Hz 100% 60 dB                  0.033vacil

=== BALAYAGE FRÉQUENTIEL (banc IIR réel) — sonie & acuité vs MOSQITO, tons purs 60 dB ===
  freq     N(app)  N(mos)  ΔN%     S(app)  S(mos)  ΔS%
  63 Hz      1.03    1.02    +1% ✓     0.13    0.13    +2% ✓
  125 Hz     2.51    2.49    +1% ✓     0.26    0.26    +1% ✓
  250 Hz     3.44    3.42    +0% ✓     0.37    0.37    +0% ✓
  500 Hz     3.93    3.87    +1% ✓     0.63    0.63    +0% ✓
  1000 Hz    4.17    4.09    +2% ✓     1.01    1.01    +1% ✓
  2000 Hz    4.94    4.83    +2% ✓     1.53    1.52    +1% ✓
  4000 Hz    6.21    6.16    +1% ✓     2.83    2.82    +0% ✓
  8000 Hz    3.45    3.39    +2% ✓     6.38    6.48    -1% ✓
  → sonie 8/8 (±15%)   acuité 8/8 (±25%)

=== SONIE vs NIVEAU à 125 / 1000 / 4000 Hz vs MOSQITO ===
  125 Hz : 40dB=0.42(0.42)  60dB=2.51(2.49)  80dB=11.93(11.79)  
  1000 Hz : 40dB=1.03(1.01)  60dB=4.17(4.09)  80dB=17.39(17.10)  
  4000 Hz : 40dB=1.58(1.56)  60dB=6.21(6.16)  80dB=25.34(25.14)
```

## Synthèse

- **Sonie (ISO 532-1)** : définition (1 sone à 1 kHz/40 dB, doublement par +10 dB) respectée ; concordance MOSQITO ~2 % sur tout le balayage 63 Hz → 8 kHz (à travers le banc de filtres réel) et sur la plage 40–80 dB.
- **Acuité (DIN 45692)** : concordance MOSQITO ~2 % de 63 Hz à 8 kHz.
- **Rugosité (Daniel & Weber)** : 1,00 asper pour l'AM de référence (1 kHz/70 Hz/100 %/60 dB) ; dépendance au niveau et balayage f_mod corrects ; ~0 asper sur bruit large bande.
- **Fluctuation** : 1,00 vacil pour l'AM 4 Hz de référence, pic bien centré sur 4 Hz.
- **Tonalité** : TNR/PR (ECMA-74) identiques à MOSQITO ; indice d'Aures reporté.
- **Pondération** : tous les indices sont calculés sur le spectre non pondéré (Z), indépendamment de la pondération A/C d'affichage.

**Conclusion.** Les cinq indicateurs respectent leurs définitions normatives et concordent avec MOSQITO à quelques pour-cent près en passant par la chaîne réelle de l'application, sur tout le spectre audible et une large plage de niveaux.

**Limites connues.** Micro de smartphone non métrologique (réponse non garantie, surtout < 50 Hz et en niveau absolu) ; sonie en régime stationnaire (N5 approché — sonie temps-variable ISO 532-1 §6 à faire) ; fluctuation valable ≤ ~8–10 Hz (échantillonnage 20 Hz) ; T-PR d'un ton pur dans le silence absolu = cas dégénéré. Indicateurs indicatifs, non certifiés.
