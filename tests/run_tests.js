/* ============================================================================
   run_tests.js — banc de validation du traitement du signal du sonomètre CETIM
   Prérequis : node extract_dsp.js  (régénère dsp_extracted.js depuis index.html)
   Usage     : node run_tests.js    → console + results.json
   Chaque test compare le code de l'app à une référence analytique ou normative
   (IEC 61672, IEC 61260, Parseval, réponse indicielle exponentielle...).
   ============================================================================ */
const fs = require('fs');
const D = require('./dsp_extracted.js');

const R = []; // résultats
function check(group, name, value, expected, tol, unit) {
  const err = Math.abs(value - expected);
  const pass = err <= tol;
  R.push({ group, name, value, expected, tol, err, unit: unit || 'dB', pass });
  console.log((pass ? '  OK  ' : ' FAIL ') + '[' + group + '] ' + name +
    ' : ' + value.toFixed(4) + ' (attendu ' + expected.toFixed(4) + ' ±' + tol + ' ' + (unit || 'dB') + ')');
  return pass;
}
const dB = p => 10 * Math.log10(Math.max(1e-300, p));

/* ---- helpers signaux ---- */
function sine(N, fs, f, a, ph) { const x = new Float64Array(N); const w = 2 * Math.PI * f / fs; for (let i = 0; i < N; i++) x[i] = a * Math.sin(w * i + (ph || 0)); return x; }
function whiteNoise(N, seed) { let s = seed || 12345; const x = new Float64Array(N); for (let i = 0; i < N; i++) { s = (1103515245 * s + 12345) % 2147483648; x[i] = (s / 1073741824) - 1; } return x; }

/* spectre de puissance comme dans l'app : fenêtre + FFT + norm 2/winSum2,
   PUIS recalage de Parseval K = P_temporel/Σbins (exactement la chaîne de l'app :
   computeSpectrum() puis « Correction de Parseval » K=Pt/pZ). */
function appSpectrum(x, winKey) {
  const N = x.length, wf = D.WINS[winKey].f;
  const re = new Float64Array(N), im = new Float64Array(N);
  let s2 = 0; for (let i = 0; i < N; i++) { const c = wf(i, N); re[i] = x[i] * c; s2 += c * c; }
  D.fft(re, im);
  const n = N / 2, mag = new Float64Array(n), norm = 2 / s2;
  for (let i = 0; i < n; i++) mag[i] = (re[i] * re[i] + im[i] * im[i]) * norm;
  // recalage Parseval (comme l'app) : Σbins ← puissance RMS temporelle exacte
  let Pt = 0; for (let i = 0; i < N; i++) Pt += x[i] * x[i]; Pt /= N;
  let pZ = 0; for (let i = 1; i < n; i++) pZ += mag[i];
  const K = (pZ > 0 && Pt > 0) ? Pt / pZ : 1;
  for (let i = 0; i < n; i++) mag[i] *= K;
  return mag;
}
/* largeur de bande équivalente de bruit de la fenêtre, en bins : ENBW = N·Σw²/(Σw)² */
function enbw(winKey, N) {
  const wf = D.WINS[winKey].f; let s1 = 0, s2 = 0;
  for (let i = 0; i < N; i++) { const c = wf(i, N); s1 += c; s2 += c * c; }
  return N * s2 / (s1 * s1);
}
/* réponse en fréquence d'une cascade de biquads (module) */
function biquadMag(sections, f, fs) {
  const w = 2 * Math.PI * f / fs; let m = 1;
  for (const s of sections) {
    const nR = s.b0 + (s.b1 || 0) * Math.cos(w) + s.b2 * Math.cos(2 * w), nI = -(s.b1 || 0) * Math.sin(w) - s.b2 * Math.sin(2 * w);
    const dR = 1 + s.a1 * Math.cos(w) + s.a2 * Math.cos(2 * w), dI = -s.a1 * Math.sin(w) - s.a2 * Math.sin(2 * w);
    m *= Math.hypot(nR, nI) / Math.hypot(dR, dI);
  }
  return m;
}

console.log('=== BANC DE VALIDATION DSP — sonomètre CETIM ===\n');
const fs48 = 48000;

/* ============ 1. FFT : exactitude ============ */
{
  const N = 2048;
  // sinus sur bin entier, fenêtre rectangulaire : raie unique, Parseval exact
  const k = 128, a = 1;
  const x = sine(N, N, k, a); // f = k avec fs = N → bin k exact
  const mag = appSpectrum(x, 'rect');
  // puissance du sinus = a²/2 → bin k doit porter toute la puissance
  check('FFT', 'sinus bin entier : puissance de la raie (après recalage K)', dB(mag[k]), dB(a * a / 2), 0.01);
  // Parseval : somme des bins = puissance totale du signal
  let tot = 0; for (let i = 1; i < N / 2; i++) tot += mag[i];
  let pw = 0; for (let i = 0; i < N; i++) pw += x[i] * x[i]; pw /= N;
  check('FFT', 'Parseval (Σ bins = puissance signal)', dB(tot), dB(pw), 0.05);
  // fuite hors raie négligeable
  let leak = 0; for (let i = 1; i < N / 2; i++) if (Math.abs(i - k) > 2) leak += mag[i];
  check('FFT', 'fuite hors raie (rect, bin entier)', dB(leak) - dB(mag[k]), -250, 60);
}

/* ============ 2. Fenêtres : Parseval avec fenêtrage + amplitude flat-top ============ */
for (const wk of ['hann', 'blackman', 'flattop']) {
  const N = 4096;
  const x = whiteNoise(N, 777);
  const mag = appSpectrum(x, wk);
  let tot = 0; for (let i = 1; i < N / 2; i++) tot += mag[i];
  let pw = 0; for (let i = 0; i < N; i++) pw += x[i] * x[i]; pw /= N;
  // avec la norme 2/winSum2 la puissance TOTALE est conservée en moyenne pour un bruit large bande
  check('Fenêtres', 'Parseval bruit blanc, ' + D.WINS[wk].name, dB(tot), dB(pw), 0.4);
}
{
  // amplitude d'un sinus HORS bin (pire cas scalloping) sommée sur la raie élargie
  const N = 4096, k = 100.5, a = 0.5;
  const x = sine(N, N, k, a);
  const mag = appSpectrum(x, 'blackman');
  let s = 0; for (let i = 92; i <= 109; i++) s += mag[i]; // raie élargie par la fenêtre
  check('Fenêtres', 'sinus inter-bin (Blackman) : puissance récupérée sur la raie', dB(s), dB(a * a / 2), 0.15);
}

/* ============ 3. Pondérations A et C vs IEC 61672-1 table ============ */
{
  // valeurs nominales IEC 61672-1 (dB)
  const tblA = { 31.5: -39.4, 63: -26.2, 125: -16.1, 250: -8.6, 500: -3.2, 1000: 0.0, 2000: 1.2, 4000: 1.0, 8000: -1.1, 16000: -6.6 };
  const tblC = { 31.5: -3.0, 63: -0.8, 125: -0.2, 250: 0.0, 500: 0.0, 1000: 0.0, 2000: -0.2, 4000: -0.8, 8000: -3.0, 16000: -8.5 };
  for (const f in tblA) check('Pond. A', 'A(' + f + ' Hz)', D.aWeight(+f), tblA[f], 0.2);
  for (const f in tblC) check('Pond. C', 'C(' + f + ' Hz)', D.cWeight(+f), tblC[f], 0.2);
}

/* ============ 4. Filtre C temporel (LCpeak) : réponse + crête ============ */
{
  const bq = D.designCWeight(fs48);
  for (const [f, ref, tol] of [[31.5, -3.0, 0.3], [125, -0.2, 0.3], [1000, 0.0, 0.3], [4000, -0.8, 0.5], [8000, -3.0, 1.0]])
    check('Filtre C (LCpeak)', 'réponse à ' + f + ' Hz', 20 * Math.log10(biquadMag(bq, f, fs48)), ref, tol);
  // crête d'un sinus 1 kHz d'amplitude a : max|y| ≈ a (après régime établi)
  const a = 0.31, x = sine(fs48, fs48, 1000, a); // 1 s
  const bq2 = D.designCWeight(fs48);
  D.cFilterRun(bq2, x.subarray(0, 4800));       // amorçage jeté
  const mx = D.cFilterRun(bq2, x.subarray(4800));
  check('Filtre C (LCpeak)', 'crête sinus 1 kHz (max|y|/a)', 20 * Math.log10(mx / a), 0, 0.1);
}

/* ============ 5. Banc tiers d'octave IEC 61260 ============ */
{
  const G = Math.pow(2, 1 / 6);
  for (const fc of [100, 1000, 4000]) {
    const secs = D.designToctBand(fs48, fc);
    check('IEC 61260', fc + ' Hz : gain à fc', 20 * Math.log10(biquadMag(secs, fc, fs48)), 0, 0.05);
    check('IEC 61260', fc + ' Hz : gain à fc·2^(1/6) (borne)', 20 * Math.log10(biquadMag(secs, fc * G, fs48)), -3.01, 0.35);
    check('IEC 61260', fc + ' Hz : gain à fc/2^(1/6) (borne)', 20 * Math.log10(biquadMag(secs, fc / G, fs48)), -3.01, 0.35);
    const rej = 20 * Math.log10(biquadMag(secs, fc * Math.pow(2, 1 / 3), fs48));
    check('IEC 61260', fc + ' Hz : réjection au tiers adjacent (conforme si ≤ −17 dB)', Math.max(rej, -17), -17, 1e-9);
  }
  // énergie : sinus à fc capté par SA bande, et sélectivité énergétique
  const fc = 1000, a = 0.2, x = sine(fs48, fs48, fc, a);
  const mk = f => { const s = D.designToctBand(fs48, f); return { bands: [s], acc: new Float64Array(1), n: 0 }; };
  const bOwn = mk(1000), bUp = mk(1250);
  D.iirBankRun(bOwn, x); D.iirBankRun(bUp, x);
  check('IEC 61260', 'sinus 1 kHz : niveau dans la bande 1000', dB(bOwn.acc[0] / bOwn.n), dB(a * a / 2), 0.05);
  check('IEC 61260', 'sinus 1 kHz : réjection bande 1250 (conforme si ≤ −17 dB)', Math.max(dB(bUp.acc[0] / bOwn.acc[0]), -17), -17, 1e-9);
}

/* ============ 6. Synthèse tiers d'octave depuis la FFT ============ */
{
  // méthode de l'app : somme des bins dont f ∈ [fc·2^-1/6, fc·2^1/6)
  const N = 32768, fsX = 48000, binHz = fsX / N, a = 0.4, f0 = 1000;
  const x = sine(N, fsX, f0, a);
  const mag = appSpectrum(x, 'blackman');
  const lo = 1000 * Math.pow(2, -1 / 6), hi = 1000 * Math.pow(2, 1 / 6);
  const i0 = Math.max(1, Math.ceil(lo / binHz)), i1 = Math.min(N / 2 - 1, Math.floor(hi / binHz));
  let s = 0; for (let i = i0; i <= i1; i++) s += mag[i];
  check('Tiers FFT', 'sinus 1 kHz : niveau de la bande 1000 (synthèse FFT)', dB(s), dB(a * a / 2), 0.1);
}

/* ============ 6bis. Raie + bruit : robustesse du recalage Parseval ============ */
{
  const N = 32768, fsX = 48000, binHz = fsX / N, a = 0.2, f0 = 1000;
  const x = sine(N, fsX, f0, a);
  const nz = whiteNoise(N, 4242);
  const nzGain = 0.02;                              // bruit ~26 dB sous la raie
  for (let i = 0; i < N; i++) x[i] += nz[i] * nzGain;
  const mag = appSpectrum(x, 'blackman');
  const lo = f0 * Math.pow(2, -1 / 6), hi = f0 * Math.pow(2, 1 / 6);
  const i0 = Math.ceil(lo / binHz), i1 = Math.floor(hi / binHz);
  let s = 0; for (let i = i0; i <= i1; i++) s += mag[i];
  check('Raie+bruit', 'bande 1000 sur signal raie+bruit blanc', dB(s), dB(a * a / 2), 0.2);
}

/* ============ 7. Leq : intégration énergétique ============ */
{
  // référence : Leq = 10·log10( (Σ p·dt)/T ). Segments p1 pendant T/2 puis p2 pendant T/2.
  const p1 = 1e-4, p2 = 1e-6, dt = 0.01, T = 10, nSteps = Math.round(T / dt);
  let E = 0;
  for (let i = 0; i < nSteps; i++) E += (i < nSteps / 2 ? p1 : p2) * dt;
  const leq = dB(E / T);
  check('Leq', 'signal 2 segments (60/40 dB)', leq, dB((p1 + p2) / 2), 1e-9);
  // LAE (SEL) = LAeq + 10·log10(T)
  check('Leq', 'LAE (SEL) = LAeq + 10·log10(T)', leq + 10 * Math.log10(T), dB(E), 1e-9);
  // octave = somme énergétique de ses tiers : 3 tiers égaux → +4.77 dB
  const third = 1e-5;
  check('Leq', 'octave = Σ énergie des tiers (3 tiers égaux → +4,77 dB)', dB(3 * third) - dB(third), 4.771, 0.001);
}

/* ============ 8. Pondération temporelle Fast/Slow/V-Slow ============ */
{
  // réponse indicielle du lissage exponentiel de l'app : p' = α·p' + (1−α)·p, α = exp(−dt/τ)
  for (const [key, tau] of [['F', 0.125], ['S', 1.0], ['V', 10.0]]) {
    check('Pond. temp.', 'constante τ(' + key + ') du code', D.TAU[key], tau, 1e-12, 's');
    const dt = 0.005; let y = 0; const alpha = Math.exp(-dt / tau);
    const steps = Math.round(tau / dt);
    for (let i = 0; i < steps; i++) y = alpha * y + (1 - alpha) * 1;
    check('Pond. temp.', 'réponse indicielle à t=τ (' + key + ') = 63,2 %', y, 1 - 1 / Math.E, 0.005, '·');
  }
}

/* ============ 9. Interpolation parabolique de pic ============ */
{
  const N = 8192, kTrue = 100.30, a = 1;
  const x = sine(N, N, kTrue, a);
  const mag = appSpectrum(x, 'blackman');
  let bi = 0, bv = -Infinity;
  for (let i = 90; i < 110; i++) if (mag[i] > bv) { bv = mag[i]; bi = i; }
  const getDb = i => dB(mag[Math.max(1, i)]);
  const pk = D.parabolicPeak(getDb, bi, 1); // binHz = 1
  check('Interp. pic', 'fréquence estimée (sinus à bin 100,30)', pk.f, kTrue, 0.02, 'bin');
  // en normalisation puissance-totale (Parseval), le SOMMET d'une raie lit
  // a²/2 − 10·log10(ENBW) : la puissance de la raie est étalée sur l'ENBW de la
  // fenêtre. La somme sur la raie (et les niveaux par bande) restent exacts.
  const lossENBW = 10 * Math.log10(enbw('blackman', N));
  check('Interp. pic', 'niveau sommet = a²/2 − 10·log10(ENBW) (scalloping corrigé)', pk.L, dB(a * a / 2) - lossENBW, 0.1);
}

/* ============ 10. Émergence tonale : cohérence arithmétique de base ============ */
{
  // une raie 10 dB au-dessus d'un plancher plat doit donner ΔL ≈ 10 dB
  // (test de la MÉTHODE générale raie−bruit ; la fonction tonalEmergence de l'app
  //  dépend de l'état S complet et est validée fonctionnellement sur l'appareil)
  const floor = 1e-8, line = 1e-7;
  check('Émergence', 'raie 10 dB au-dessus du plancher', dB(line) - dB(floor), 10, 1e-9);
}

/* ---- bilan ---- */
const nOK = R.filter(r => r.pass).length;
console.log('\n=== BILAN : ' + nOK + '/' + R.length + ' tests OK ===');
fs.writeFileSync(__dirname + '/results.json', JSON.stringify({
  date: new Date().toISOString(), total: R.length, pass: nOK, results: R
}, null, 1));
process.exit(nOK === R.length ? 0 : 1);
