/* ============================================================================
   extract_dsp.js — extrait les fonctions de traitement du signal de index.html
   vers dsp_extracted.js, pour les tester hors navigateur (Node).
   Principe : on teste LE CODE DÉPLOYÉ, pas une copie — toute divergence entre
   l'app et le banc de test est donc impossible par construction.
   Usage : node extract_dsp.js [chemin/vers/index.html]
   ============================================================================ */
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(process.argv[2] || path.join(__dirname, '..', 'index.html'), 'utf8');

/* extrait un bloc `function name(...){...}` par équilibrage d'accolades */
function extractFunction(name) {
  const m = src.indexOf('function ' + name + '(');
  if (m < 0) throw new Error('fonction introuvable : ' + name);
  let i = src.indexOf('{', m), depth = 0;
  for (let j = i; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}') { depth--; if (depth === 0) return src.slice(m, j + 1); }
  }
  throw new Error('accolades non équilibrées : ' + name);
}
/* extrait `const name = {...};` ou `const name=[...];` par équilibrage */
function extractConst(name) {
  const re = new RegExp('const ' + name + '\\s*=');
  const m = src.search(re);
  if (m < 0) throw new Error('constante introuvable : ' + name);
  const start = src.indexOf('=', m) + 1;
  let i = start; while (/\s/.test(src[i])) i++;
  const open = src[i], close = open === '{' ? '}' : ']';
  if (open !== '{' && open !== '[') throw new Error('constante non structurée : ' + name);
  let depth = 0;
  for (let j = i; j < src.length; j++) {
    if (src[j] === open) depth++;
    else if (src[j] === close) { depth--; if (depth === 0) return 'const ' + name + ' = ' + src.slice(i, j + 1) + ';'; }
  }
  throw new Error('délimiteurs non équilibrés : ' + name);
}

const FUNCS = ['fft', 'aWeight', 'cWeight', 'designCWeight', 'cFilterRun',
               'designToctBand', 'iirBankRun', 'parabolicPeak'];
const CONSTS = ['WINS', 'TAU', 'NOMS'];

let out = '/* GÉNÉRÉ PAR extract_dsp.js — NE PAS ÉDITER (extrait de index.html) */\n';
out += '/* stub minimal de l\'état applicatif pour les fonctions qui y font référence */\n';
out += 'const S = { peakInterp: true, offset: 0 };\n';
out += 'const lvl = p => p > 0 ? 10 * Math.log10(p) + S.offset : -99;\n\n';
for (const c of CONSTS) out += extractConst(c) + '\n\n';
for (const f of FUNCS) out += extractFunction(f) + '\n\n';
out += 'module.exports = { S, lvl, WINS, TAU, NOMS, ' + FUNCS.join(', ') + ' };\n';

fs.writeFileSync(path.join(__dirname, 'dsp_extracted.js'), out);
console.log('dsp_extracted.js écrit (' + FUNCS.length + ' fonctions, ' + CONSTS.length + ' constantes)');
