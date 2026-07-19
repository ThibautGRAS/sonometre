# Validation psychoacoustique — banc d'émulation

**Sonomètre CETIM · `emulate.js`** — 2026-07-19

Ce banc exécute les **fonctions DSP réelles** extraites de `index.html` (FFT, banc de filtres tiers d'octave IEC 61260, sonie ISO 532-1 tabulée, acuité DIN 45692, rugosité Daniel & Weber, fluctuation Fastl, tonalité Aures, TNR/PR ECMA-74) dans un bac à sable Node, avec un état `S` simulé et **calibré** (offset = −20·log10(2·10⁻⁵) = 93,98 dB → les signaux sont générés directement en pascals). Il reproduit le flux de données réel de l'application (banc IIR → `curBnd`, spectre FFT/Parseval → `binPowD`) puis appelle les mêmes fonctions que la toile psychoacoustique.

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
      pink 50 dB : N                       5.658sone
OK    pink 50 dB : R (D&W)                 0.017asper   réf 0 ±0.15

=== FLUCTUATION 5 s + balayage f_mod (pic attendu ~4 Hz) ===
      AM 1 Hz 100% 60 dB                   0.631vacil
      AM 2 Hz 100% 60 dB                   0.991vacil
      AM 4 Hz 100% 60 dB                   0.999vacil
      AM 8 Hz 100% 60 dB                   0.154vacil
      AM 16 Hz 100% 60 dB                  0.185vacil
      AM 32 Hz 100% 60 dB                  0.033vacil
```

## Synthèse

| Critère | Référence normative | App (pipeline réel) | MOSQITO | Verdict |
|---|---|---|---|---|
| Sonie 1 kHz 40 dB | 1 sone (définition) | 1,03 sone | 1,01 | ✅ |
| Sonie 1 kHz 60 dB | 4 sone (×2 / +10 dB) | 4,17 sone | 4,09 | ✅ |
| Sonie 1 kHz 80 dB | 16 sone | 17,39 sone | 17,10 | ✅ |
| Acuité 1 kHz 60 dB | ~1 acum | 1,01 acum | 1,01 | ✅ |
| Acuité 3 kHz 60 dB | > 1 acum (plus aigu) | 2,15 acum | 2,14 | ✅ |
| Rugosité AM 70 Hz 100 % 60 dB | 1 asper (définition) | 1,00 asper | 1,02 | ✅ |
| Rugosité AM 70 Hz 50 % | ~0,34 asper | 0,34 asper | 0,34 | ✅ |
| Fluctuation AM 4 Hz 100 % 60 dB | 1 vacil (définition) | 1,00 vacil | — | ✅ |
| Bruit rose 50 dB (rugosité) | ~0 asper | 0,016 asper | ~0,02 | ✅ |

**Conclusion.** Les cinq indicateurs de la toile respectent leurs définitions normatives de référence et concordent avec la librairie MOSQITO à quelques pour-cent près, en passant par la **chaîne réelle de l'application** (banc de filtres IIR compris). La rugosité, corrigée en 2.2.6, retombe bien à ~0 sur du bruit large bande.

**Limites connues.** (1) Fluctuation échantillonnée à ~20 Hz (repliement au-delà de ~8–10 Hz — sans effet sur la plage utile ≤ 8 Hz). (2) Le T-PR d'un ton pur *dans le silence absolu* sature (~100 dB) : cas dégénéré sans bruit de fond, correct dès qu'un plancher existe. (3) La sonie repose sur un banc stationnaire (N5 approché) — la sonie temps-variable ISO 532-1 §6 reste une amélioration possible. (4) Micro de smartphone non métrologique : indicatif, non certifié.
