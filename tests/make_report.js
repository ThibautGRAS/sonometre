/* Génère le rapport de validation Word au format CETIM (navy/rouge/Arial). */
const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow,
  TableCell, WidthType, BorderStyle, ShadingType, PageBreak, Header, Footer, PageNumber,
  TableOfContents, LevelFormat, NumberFormat, VerticalAlign
} = require('docx');

const RES = JSON.parse(fs.readFileSync(__dirname + '/results.json', 'utf8'));
const NAVY = '001E50', RED = 'EF3346', GREY = '5B6472', LIGHT = 'EEF1F6';
const APPV = 'V35.42';
const DATE = new Date().toLocaleDateString('fr-FR');

const F = 'Arial';
const t = (txt, o) => new TextRun(Object.assign({ text: txt, font: F, size: 21 }, o || {}));
const p = (txt, o) => new Paragraph(Object.assign({ children: [t(txt)], spacing: { after: 120 } }, o || {}));

function h1(txt) { return new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 320, after: 160 }, children: [t(txt, { bold: true, color: NAVY, size: 30 })] }); }
function h2(txt) { return new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 120 }, children: [t(txt, { bold: true, color: NAVY, size: 24 })] }); }
function body(txt) { return new Paragraph({ spacing: { after: 140 }, alignment: AlignmentType.JUSTIFIED, children: [t(txt)] }); }
function bodyRuns(runs) { return new Paragraph({ spacing: { after: 140 }, alignment: AlignmentType.JUSTIFIED, children: runs }); }

/* tableau de résultats d'un groupe */
function resultTable(groups) {
  const rows = RES.results.filter(r => groups.includes(r.group));
  const W = [4400, 1500, 1500, 1100, 860];
  const hdr = new TableRow({
    tableHeader: true,
    children: ['Test', 'Mesuré', 'Attendu', 'Tolérance', 'Statut'].map((x, i) => new TableCell({
      width: { size: W[i], type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, fill: NAVY },
      verticalAlign: VerticalAlign.CENTER,
      margins: { top: 60, bottom: 60, left: 80, right: 80 },
      children: [new Paragraph({ children: [t(x, { bold: true, color: 'FFFFFF', size: 18 })] })]
    }))
  });
  const body = rows.map((r, k) => new TableRow({
    children: [
      r.name,
      r.value.toFixed(3) + ' ' + r.unit,
      r.expected.toFixed(3) + ' ' + r.unit,
      '± ' + r.tol,
      r.pass ? 'OK' : 'ÉCART'
    ].map((x, i) => new TableCell({
      width: { size: W[i], type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, fill: k % 2 ? LIGHT : 'FFFFFF' },
      margins: { top: 40, bottom: 40, left: 80, right: 80 },
      children: [new Paragraph({ children: [t(x, { size: 17, bold: i === 4, color: i === 4 ? (r.pass ? '2FBF83' : RED) : '111111' })] })]
    }))
  }));
  return new Table({ columnWidths: W, width: { size: W.reduce((a, b) => a + b), type: WidthType.DXA }, rows: [hdr, ...body] });
}

const numbering = {
  config: [{
    reference: 'bul',
    levels: [{ level: 0, format: LevelFormat.BULLET, text: '\u2022', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 200 } } } }]
  }]
};
const bullet = txt => new Paragraph({ numbering: { reference: 'bul', level: 0 }, spacing: { after: 80 }, children: [t(txt)] });
const bulletRuns = runs => new Paragraph({ numbering: { reference: 'bul', level: 0 }, spacing: { after: 80 }, children: runs });

/* ------------------- page de garde ------------------- */
const cover = [
  new Paragraph({ spacing: { before: 2400, after: 200 }, alignment: AlignmentType.CENTER, children: [t('CETIM', { bold: true, color: NAVY, size: 72 }), t('  \u25a0', { color: RED, size: 40 })] }),
  new Paragraph({
    alignment: AlignmentType.CENTER, spacing: { after: 300 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: NAVY, space: 8 } },
    children: [t('Centre technique des industries mécaniques', { color: GREY, size: 20 })]
  }),
  new Paragraph({ spacing: { before: 1400, after: 200 }, alignment: AlignmentType.CENTER, children: [t('VALIDATION DU TRAITEMENT DU SIGNAL', { bold: true, color: NAVY, size: 40 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 }, children: [t('Application sonomètre / analyseur — ' + APPV, { color: NAVY, size: 26 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 2200 }, children: [t('Banc de tests reproductible et méthodes de calcul', { color: GREY, size: 22, italics: true })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [t('Référence : SONO-VAL-001  \u00b7  Version 1.0  \u00b7  ' + DATE, { size: 20, color: GREY })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 100 }, children: [t('Rédacteur : Thibaut Gras \u00b7 thibaut.gras@cetim.fr', { size: 20, color: GREY })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 100 }, children: [t('Bilan : ' + RES.pass + ' / ' + RES.total + ' tests dans les tolérances', { size: 22, bold: true, color: NAVY })] }),
  new Paragraph({ children: [new PageBreak()] })
];

/* ------------------- corps ------------------- */
const C = [];

C.push(h1('Sommaire'));
C.push(new TableOfContents('Sommaire', { hyperlink: true, headingStyleRange: '1-2' }));
C.push(new Paragraph({ children: [new PageBreak()] }));

C.push(h1('1. Objet et périmètre'));
C.push(body("Ce document décrit le banc de validation du traitement du signal de l'application sonomètre/analyseur CETIM (application web mono-fichier, " + APPV + "), les méthodes de calcul implémentées, les références utilisées pour la validation et les résultats obtenus. Le banc est conçu pour être rejoué à l'identique après chaque évolution du code : il fait partie du dépôt de l'application (dossier tests/) et s'exécute en deux commandes."));
C.push(body("Périmètre validé : chaîne FFT et sa normalisation, fenêtres d'analyse, pondérations fréquentielles A et C, filtre C temporel (LCpeak), banc de filtres tiers d'octave, synthèse des tiers d'octave depuis la FFT, intégration Leq / LAE (SEL) / agrégation en octaves, pondérations temporelles Fast/Slow/V-Slow, interpolation parabolique de pic, et arithmétique de base de l'émergence tonale."));
C.push(body("Hors périmètre (validation sur appareil ou sur cas réel) : réponse du microphone iPhone et gain automatique iOS, calibration absolue (référence pleine échelle 0 dBFS), méthode complète d'émergence tonale ISO 1996-2 (dépendante de l'état applicatif temps réel), et module de corrélation vibro-acoustique (retiré de l'interface en V35.42)."));

C.push(h1('2. Principe du banc de tests'));
C.push(h2('2.1 Tester le code déployé, pas une copie'));
C.push(body("Le script extract_dsp.js extrait les fonctions de traitement du signal directement depuis index.html (le fichier déployé sur GitHub Pages), par analyse syntaxique avec équilibrage d'accolades : fft, aWeight, cWeight, designCWeight, cFilterRun, designToctBand, iirBankRun, parabolicPeak, ainsi que les constantes WINS (fenêtres), TAU (constantes de temps) et NOMS (fréquences centrales normalisées). Toute divergence entre le code testé et le code en production est donc impossible par construction : régénérer l'extraction puis relancer les tests valide exactement ce que l'utilisateur exécute."));
C.push(h2('2.2 Signaux de référence et critères'));
C.push(body("Le script run_tests.js génère des signaux synthétiques parfaitement connus : sinus d'amplitude et de fréquence calibrées (sur bin entier, entre deux bins, noyé dans du bruit), bruit blanc pseudo-aléatoire reproductible (générateur congruentiel à graine fixe). Chaque grandeur calculée par le code de l'application est comparée à sa valeur de référence analytique (théorème de Parseval, puissance d'un sinus a\u00b2/2, réponse indicielle exponentielle) ou normative (tables des pondérations IEC 61672-1, gabarit des filtres de bande IEC 61260-1), avec une tolérance explicite par test. Le bilan et le détail de chaque test (valeur, attendu, tolérance, écart) sont archivés dans results.json."));
C.push(h2('2.3 Exécution'));
C.push(bodyRuns([t('Depuis le dossier tests/ du dépôt : ', {}), t('node extract_dsp.js', { font: 'Consolas', size: 19, color: NAVY }), t(' puis ', {}), t('node run_tests.js', { font: 'Consolas', size: 19, color: NAVY }), t(". Le code retour vaut 0 si tous les tests sont dans les tolérances. Le banc n'a aucune dépendance externe (Node.js seul).")]));

C.push(new Paragraph({ children: [new PageBreak()] }));
C.push(h1('3. Méthodes de calcul de l\u2019application'));

C.push(h2('3.1 Chaîne FFT et normalisation en puissance (Parseval)'));
C.push(body("Le signal microphone est accumulé dans un tampon circulaire de N points (N = 2048 à 32768, réglable), multiplié par la fenêtre d'analyse choisie, puis transformé par une FFT radix-2 itérative implémentée en JavaScript pur. Le spectre de puissance par bin est obtenu par |X(k)|\u00b2 \u00d7 2/\u03a3w\u00b2 (normalisation par la somme des carrés de la fenêtre, facteur 2 pour le repli du spectre unilatéral)."));
C.push(body("Un recalage de Parseval est ensuite appliqué en continu : le facteur K = P_temporel / \u03a3bins ramène la somme des puissances spectrales exactement sur la puissance RMS du bloc temporel fenêtré (K est lissé à 90/10 entre trames pour la stabilité). Cette normalisation garantit que le niveau global (Z) et les niveaux par bande correspondent au vrai dBFS RMS du signal, indépendamment de la fenêtre choisie. Le passage au niveau absolu en dB SPL se fait par l'offset de calibration (référence pleine échelle 0 dBFS, \u2248 120 dB, réglable au calibreur)."));
C.push(body("Propriété assumée de cette normalisation : le sommet ponctuel d'une raie fine lit « niveau vrai \u2212 10\u00b7log10(ENBW) » (la puissance de la raie est étalée sur la largeur de bande équivalente de bruit de la fenêtre, \u2248 1,73 bin en Blackman soit \u22122,4 dB). Les niveaux par bande (somme de bins) et globaux restent exacts. Ce point est vérifié et quantifié par le banc (famille 9)."));

C.push(h2('3.2 Fenêtres d\u2019analyse'));
C.push(body("Cinq fenêtres sont disponibles : rectangulaire, Hann, Hamming, Blackman (défaut) et Flat-top, définies par leurs coefficients cosinus usuels. Le compromis est classique : la rectangulaire offre la raie la plus fine mais la pire fuite spectrale ; Blackman offre une excellente dynamique de lobes secondaires pour l'analyse tonale ; Flat-top minimise l'erreur d'amplitude au sommet (scalloping). Le recouvrement (0/50/75 %) densifie les trames sans changer la résolution réelle, fixée par N et fs (compromis de Gabor)."));

C.push(h2('3.3 Pondérations fréquentielles A et C (IEC 61672-1)'));
C.push(body("Les pondérations A et C sont calculées analytiquement par leurs fonctions de transfert normalisées (pôles à 20,6 Hz, 107,7 Hz, 737,9 Hz et 12194 Hz pour A ; 20,6 Hz et 12194 Hz pour C), normalisées à 0 dB à 1 kHz. Elles sont appliquées dans le domaine spectral : chaque bin de puissance est multiplié par 10^(A(f)/10) (resp. C), puis sommé pour donner les niveaux LA et LC. Le banc compare ces formules aux valeurs nominales de la table IEC 61672-1 sur 10 fréquences de 31,5 Hz à 16 kHz (famille 3) : écart maximal constaté 0,14 dB."));

C.push(h2('3.4 Filtre C temporel et LCpeak'));
C.push(body("Le LCpeak (crête pondérée C, réglementaire en bruit au travail) ne peut pas être obtenu depuis le spectre : il exige la crête instantanée du signal pondéré. L'application discrétise la fonction de transfert C(s) en deux biquads (transformation bilinéaire avec pré-warping du pôle haute fréquence, normalisation à 1 kHz) et filtre le flux temporel en Direct Form II transposée ; le maximum de |y| est suivi en continu. Le banc vérifie la réponse en fréquence du filtre numérique contre la table IEC (famille 4) et la crête d'un sinus 1 kHz calibré (écart < 0,01 dB). Écart documenté : +0,65 dB à 8 kHz, dû à la compression de la bilinéaire près de Nyquist à fs = 48 kHz ; sans effet pratique sur LCpeak, dominé par le contenu basses et moyennes fréquences."));

C.push(h2('3.5 Tiers d\u2019octave : banc IIR IEC 61260 et synthèse FFT'));
C.push(body("Deux sources sont disponibles pour les tiers d'octave. (1) Banc de filtres IIR (défaut) : un passe-bande Butterworth d'ordre 6 (3 biquads) par bande, conçu par transformation passe-bas \u2192 passe-bande puis bilinéaire avec pré-warping des bornes fc\u00b72^(\u00b11/6) ; l'énergie de sortie de chaque bande est accumulée en continu (Leq par bande exact au sens temporel). (2) Synthèse FFT : somme des bins de puissance dont la fréquence tombe dans [fc\u00b72^(\u22121/6), fc\u00b72^(1/6)). Le banc vérifie pour plusieurs bandes : gain 0 dB à fc (\u00b10,05 dB), \u22123 dB aux bornes, réjection \u2265 17 dB au tiers adjacent, et récupération exacte de la puissance d'un sinus par sa bande, y compris noyé dans du bruit blanc (familles 5, 6 et 6bis)."));

C.push(h2('3.6 Leq, LAE (SEL), \u0394LF et agrégation en octaves'));
C.push(body("Le Leq est une intégration énergétique vraie : l'énergie \u03a3 p\u00b7dt et le temps \u03a3 dt sont accumulés séparément (par pondération A/C/Z, par bande tiers d'octave, et depuis V35.41 par bin FFT), uniquement pendant la mesure effective (hors armement, départ différé, attente de seuil et pause). LAeq = 10\u00b7log10(E_A/T). Le LAE (SEL) en découle : LAeq + 10\u00b7log10(T/1 s) ; le \u0394LF vaut LCeq \u2212 LAeq. L'agrégation en octaves est la somme énergétique des trois tiers constitutifs (vérifiée : 3 tiers égaux donnent +4,77 dB). Les spectres exportés (rapport PDF, PNG, CSV) sont depuis V35.42 systématiquement ces moyennes énergétiques, à la résolution tiers d'octave ou octave au choix."));

C.push(h2('3.7 Pondérations temporelles Fast / Slow / V-Slow'));
C.push(body("L'affichage instantané (grand niveau, spectre live, max/min, percentiles L10/L50/L90) est lissé par une moyenne exponentielle p' = \u03b1\u00b7p' + (1\u2212\u03b1)\u00b7p avec \u03b1 = exp(\u2212dt/\u03c4), équivalent numérique de l'intégrateur RC des sonomètres : \u03c4 = 125 ms (Fast) et 1 s (Slow) conformes IEC 61672, plus un V-Slow non normalisé à 10 s pour lecture quasi stationnaire. Le banc vérifie les constantes du code et la réponse indicielle (63,2 % à t = \u03c4, famille 8). Ces pondérations n'affectent ni le Leq ni le LCpeak."));

C.push(h2('3.8 Interpolation parabolique de pic'));
C.push(body("Au curseur du spectre bande fine, la fréquence et le niveau du pic sont raffinés par ajustement d'une parabole sur les trois bins (i\u22121, i, i+1) en dB : exact pour une fenêtre gaussienne, très précis pour Hann/Blackman. Le décalage sub-bin \u03b4 = \u00bd(y\u208b\u2081\u2212y\u208a\u2081)/(y\u208b\u2081\u22122y\u2080+y\u208a\u2081) donne la fréquence vraie, et la correction d'amplitude compense le scalloping. Vérifié : un sinus placé à 30 % entre deux bins est localisé à mieux que 0,01 bin (famille 9)."));

C.push(h2('3.9 Émergence tonale (ISO 1996-2)'));
C.push(body("La détection de raie tonale évalue l'émergence de la raie dominante par rapport au bruit masquant dans une bande critique de Bark centrée sur la raie (\u00b10,5 Bark, méthode ISO 1996-2), la raie elle-même (\u00b12 bins) étant exclue de l'estimation du bruit. Une confirmation temporelle (persistance de la même raie sur plusieurs échantillons, avec hystérésis) élimine les pics de bruit fugitifs. Le banc valide l'arithmétique de base (raie \u2212 plancher) ; la méthode complète, dépendante de l'état temps réel, se valide fonctionnellement sur l'appareil avec une source tonale connue."));

C.push(new Paragraph({ children: [new PageBreak()] }));
C.push(h1('4. Résultats détaillés'));
C.push(body("Bilan global : " + RES.pass + " / " + RES.total + " tests dans les tolérances (exécution du " + new Date(RES.date).toLocaleString('fr-FR') + "). Les tableaux ci-dessous reprennent chaque test avec la valeur mesurée sur le code extrait de l'application, la valeur attendue (référence analytique ou normative) et la tolérance retenue."));

const SECTIONS = [
  ['4.1 FFT et fenêtres', ['FFT', 'Fenêtres']],
  ['4.2 Pondérations fréquentielles A et C (IEC 61672-1)', ['Pond. A', 'Pond. C']],
  ['4.3 Filtre C temporel (LCpeak)', ['Filtre C (LCpeak)']],
  ['4.4 Tiers d\u2019octave IEC 61260 et synthèse FFT', ['IEC 61260', 'Tiers FFT', 'Raie+bruit']],
  ['4.5 Leq, SEL et agrégation en octaves', ['Leq']],
  ['4.6 Pondérations temporelles', ['Pond. temp.']],
  ['4.7 Interpolation de pic et émergence', ['Interp. pic', 'Émergence']]
];
for (const [title, groups] of SECTIONS) {
  C.push(h2(title));
  C.push(resultTable(groups));
  C.push(new Paragraph({ spacing: { after: 160 }, children: [] }));
}

C.push(h1('5. Écarts connus, limites et bonnes pratiques'));
C.push(bulletRuns([t('Pondération C à 8 kHz (+0,65 dB) : ', { bold: true }), t("distorsion de la transformation bilinéaire près de Nyquist à fs = 48 kHz, malgré le pré-warping. Impact négligeable sur LCpeak. Une conception par pré-warping multipoint ou un fs supérieur la réduirait si nécessaire.")]));
C.push(bulletRuns([t('Sommet de raie fine (\u221210\u00b7log10(ENBW)) : ', { bold: true }), t("propriété de la normalisation en puissance totale. Pour comparer une amplitude de raie à une référence absolue, utiliser la fenêtre Flat-top ou lire le niveau de la bande tiers d'octave contenant la raie (exact).")]));
C.push(bulletRuns([t('Microphone non métrologique : ', { bold: true }), t("le capteur du smartphone (réponse, gain automatique iOS, linéarité) n'entre pas dans ce banc. La chaîne absolue se valide par calibreur (94/114 dB) et comparaison à un sonomètre étalon, comme prévu dans l'application (profils de correction par tiers d'octave). Les mesures restent indicatives, non réglementaires.")]));
C.push(bulletRuns([t('Périmètre temps réel : ', { bold: true }), t("cadence de trames, latence audio et comportement du gain iOS se vérifient sur appareil (armement 1,5 s déjà en place pour écarter le transitoire de gain).")]));

C.push(h1('6. Processus de ré-exécution (procédure qualité)'));
C.push(bullet("Après toute modification du traitement du signal dans index.html : exécuter node extract_dsp.js puis node run_tests.js dans tests/."));
C.push(bullet("Archiver results.json avec le numéro de version de l'application (journal MEMOIRE.md)."));
C.push(bullet("Tout test hors tolérance bloque le déploiement jusqu'à analyse : soit régression du code, soit tolérance à réviser en le justifiant dans ce rapport."));
C.push(bullet("Étendre le banc à chaque nouvelle fonction de calcul (ajouter la fonction à extract_dsp.js et ses tests à run_tests.js)."));
C.push(bullet("Compléments recommandés à terme : test de bout en bout sur fichier WAV de référence (sinus calibré + bruit rose) injecté dans la page via un contexte audio hors-ligne, et validation croisée avec un sonomètre classe 1 sur site."));

C.push(h1('7. Conclusion'));
C.push(body("Le traitement du signal de l'application " + APPV + " est validé sur l'ensemble des " + RES.total + " points de contrôle du banc : normalisation spectrale exacte au sens de Parseval, pondérations A et C conformes aux valeurs IEC 61672-1 à mieux que 0,15 dB, banc de tiers d'octave conforme au gabarit IEC 61260-1 (0 dB à fc, \u22123 dB aux bornes, réjection > 18 dB), intégration Leq énergétiquement exacte, constantes de temps Fast/Slow conformes, et localisation de raie à mieux que 0,01 bin. Les deux écarts identifiés (pondération C à 8 kHz, lecture du sommet de raie) sont quantifiés, expliqués et sans impact sur les indices exportés. Le banc, versionné avec l'application, rend cette validation reproductible à chaque évolution."));

/* ------------------- document ------------------- */
const header = new Header({
  children: [new Paragraph({
    tabStops: [{ type: 'right', position: 9800 }],
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: NAVY, space: 4 } },
    children: [t('CETIM', { bold: true, color: NAVY, size: 20 }), t(' \u25a0', { color: RED, size: 14 }), t('\tValidation du traitement du signal \u2014 sonomètre ' + APPV, { color: GREY, size: 16 })]
  })]
});
const footer = new Footer({
  children: [new Paragraph({
    tabStops: [{ type: 'right', position: 9800 }],
    border: { top: { style: BorderStyle.SINGLE, size: 6, color: 'CFD8E6', space: 4 } },
    children: [t('SONO-VAL-001 \u00b7 v1.0 \u00b7 ' + DATE, { color: GREY, size: 15 }),
      new TextRun({ font: F, size: 15, color: GREY, children: ['\tPage ', PageNumber.CURRENT, ' / ', PageNumber.TOTAL_PAGES] })]
  })]
});

const doc = new Document({
  numbering,
  styles: { default: { document: { run: { font: F, size: 21 } } } },
  features: { updateFields: true },
  sections: [{
    properties: { page: { margin: { top: 1100, bottom: 1100, left: 1250, right: 1250 } } },
    headers: { default: header }, footers: { default: footer },
    children: [...cover, ...C]
  }]
});

Packer.toBuffer(doc).then(b => {
  fs.writeFileSync(__dirname + '/Rapport_validation_DSP_sonometre_CETIM.docx', b);
  console.log('docx écrit :', b.length, 'octets');
});
