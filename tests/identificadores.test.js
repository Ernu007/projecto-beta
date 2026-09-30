import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/* ---------------------------------------------------------------------------
   O QUE ESTE FICHEIRO PROTEGE

   Dois bugs, na mesma refactorizacao, que aoTogether mataram o site
   inteiro — e que os 94 testes existentes nao apanhavam.

   O `js/main.js` e' um modulo ES. Um modulo que lanca durante a
   avaliacao ABORTA: mais nada abaixo da linha da excepcao corre. E o
   que estava abaixo eram precisamente as tres coisas que o site
   promete fazer — o envio do orcamento, o mapa e a galeria.

     1. `raizOrc` era lido em dois sitios e nao estava DECLARADO. O
        `?.` que o codigo usa protege contra valor `null`, nao contra
        um binding inexistente: e' um ReferenceError, sempre. Bastava
        abrir a pagina.

     2. `planoEnvio` era chamado no `enviarPedido` e nao estava na lista
        de `import`. ReferenceError no clique em "Confirmar e enviar",
        DEPOIS de o resumo ja ter fechado — o pedido desaparecia sem
        mensagem nenhuma. Este e' o pior dos dois, porque nao se ve.

   Por que nenhum teste apanhou: nenhum teste carrega `js/main.js`. A
   suite divide-se em modulos puros (`precos`, `orcamento`, `rota`,
   `submit`) e em grep sobre o HTML e o CSS. O `envio-camada.test.js`
   importa `planoEnvio` de `orcamento.js` e passa — o que prova que a
   funcao esta correcta, nao que ela esta ligada ao sitio que a chama.

   Este ficheiro tapa o buraco por dois lados:

     A. Carrega o `main.js` com um DOM universal e falha se o modulo
        rebentar no topo. Apanha o bug 1, e qualquer regressao da
        mesma familia.

     B. Varre o ficheiro em busca de CHAMADAS a funcoes sem qualified
        cujo nome nao esta declarado nem importado. Apanha o bug 2, e
        o estado perigoso em que o 1 ja foi corrigido e o 2 nao — que
        e' quando o botao passa a funcionar e a perder o pedido em
        silencio.

   O teste B e' deliberadamente estreito. Uma resolucao de
   identificadores completa dava falsos positivos a cada linha (chaves
   de objecto, metodos de classe, desestruturacoes), e um teste que
   apita sem motivo treina quem o le a ignora-lo. So interessam as
   chamadas, que e' onde o ReferenceError morde.
   --------------------------------------------------------------------------- */

const DIR_JS = 'js';
const FICHEIROS = fs.readdirSync(DIR_JS).filter((f) => f.endsWith('.js'));

/* ------------------------------------------------------------------ */
/* A. O main.js tem de AVALIAR sem rebentar                            */
/* ------------------------------------------------------------------ */

/** Proxy que responde a tudo e devolve a si proprio. Não emula o
 *  browser — o objectivo é só chegar ao fim do topo do módulo. */
function nobo() {
  const fn = function () { return nobo(); };
  return new Proxy(fn, {
    get(t, k) {
      if (k === Symbol.toPrimitive || k === 'toString') return () => '[stub]';
      if (k === Symbol.iterator) return function* () {};
      /* Um thenable faz o `await import()` pendurar. */
      if (k === 'then') return undefined;
      if (k === 'length') return 0;
      if (k === 'dataset' || k === 'style' || k === 'classList') return nobo();
      if (k === 'hidden' || k === 'value' || k === 'checked') return false;
      if (typeof k !== 'string') return nobo();
      /* Qualquer metodo e' uma funcao. `querySelector*` devolvem o
         stub, cujo `length` e' 0 — logo nenhum `for (const x of lista)`
         corre, que e' o que se quer. */
      if (/^(get|set|add|remove|contains|focus|query|closest|scroll|dispatch|insert|replace|append|prepend|toggle|play|pause|observe|unobserve|open|close|log|warn|error|info|toFixed|toUpperCase|trim|slice|split|join|replace|match|test|pad|repeat|keys|entries|values|forEach|map|filter|find|reduce|some|every|includes|startsWith|endsWith|now|from|resolve|reject|all|assign|stringify|parse|random|floor|round|abs|min|max|ceil|sqrt|pow|getBoundingClientRect|scrollTo|scrollIntoView)/.test(k)) {
        return () => nobo();
      }
      return nobo();
    },
    set() { return true; },
    apply() { return nobo(); },
    construct() { return nobo(); },
    has() { return true; },
  });
}

/** Instala o DOM falso. Só Called uma vez, antes do import. */
function instalarDomStub() {
  globalThis.window = nobo();
  globalThis.document = nobo();
  /* `navigator` e' so de leitura no Node moderno. */
  Object.defineProperty(globalThis, 'navigator', {
    value: { userAgent: 'stub', language: 'pt-MZ' }, configurable: true,
  });
  globalThis.location = { href: 'https://exemplo/', search: '', hash: '' };
  globalThis.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, addListener() {} });
  globalThis.requestAnimationFrame = () => 0;
  globalThis.cancelAnimationFrame = () => {};
  globalThis.fetch = async () => ({ ok: true, json: async () => ({}) });
  /* O clone do <template> tem de se devolver a si proprio, senao o
     `cloneNode` do stub devolve um nobo() novo sem descendencia. */
  const criar = () => { const e = nobo(); e.cloneNode = () => e; return e; };
  for (const m of ['createElement', 'createElementNS', 'createTextNode', 'createDocumentFragment']) {
    globalThis.document[m] = criar;
  }
}

test('o main.js avalia inteiro sem rebentar no topo do modulo', async () => {
  instalarDomStub();
  const url = new URL(`file:///${path.resolve('js', 'main.js').replace(/\\/g, '/')}`).href;
  /* Um import dinâmico com query string para não ficar em cache entre
     execuções do runner. */
  await assert.doesNotReject(
    import(`${url}?t=${process.hrtime.bigint()}`),
    'o main.js lancou durante a avaliacao: tudo abaixo da linha morre '
    + '(envio do orcamento, mapa, galeria)',
  );
});

/* ------------------------------------------------------------------ */
/* B. Nenhuma chamada a uma funcao que nao esteja declarada            */
/* ------------------------------------------------------------------ */

/** Apaga comentarios, templates e strings: o que esta dentro deles
 *  nao e' codigo e nao pode contar como identificador. */
function soCodigo(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
    .replace(/`(?:\\.|[^`\\])*`/g, '""')
    .replace(/'(?:\\.|[^'\\\n])*'/g, "''")
    .replace(/"(?:\\.|[^"\\\n])*"/g, '""');
}

/** Tudo o que este ficheiro DECLARA: locals, funções, classes, parâmetros,
 *  desestruturações e o que entra por `import`. */
function nomesDeclarados(s) {
  const d = new Set();
  const add = (n) => { if (n && /^[A-Za-z_$][\w$]*$/.test(n)) d.add(n); };
  const cabeca = (t) => t.split('=')[0].split(':').pop().trim();

  for (const m of s.matchAll(/\bfunction\s*\*?\s*([A-Za-z_$][\w$]*)/g)) add(m[1]);
  for (const m of s.matchAll(/\bclass\s+([A-Za-z_$][\w$]*)/g)) add(m[1]);
  for (const m of s.matchAll(/\bcatch\s*\(\s*([A-Za-z_$][\w$]*)/g)) add(m[1]);
  /* `nome(a, b) {` — método de objecto literal ou de classe. */
  for (const m of s.matchAll(/(?:^|[{,\n])\s*(?:static\s+|async\s+|get\s+|set\s+)*([A-Za-z_$][\w$]*)\s*\([^()]*\)\s*\{/g)) add(m[1]);
  for (const m of s.matchAll(/([A-Za-z_$][\w$]*)\s*=>/g)) add(m[1]);
  /* `import { a, b as c } from '…'` e `import x from '…'`. */
  for (const m of s.matchAll(/\bimport\s*(?:\{([^}]*)\}|([A-Za-z_$][\w$]*))\s*(?:as\s+([A-Za-z_$][\w$]*))?\s*from/g)) {
    if (m[1]) {
      for (const p of m[1].split(',')) {
        const t = p.trim(); if (!t) continue;
        const as = t.split(/\s+as\s+/);
        add((as[1] ?? as[0]).trim());
      }
    } else add(m[3] ?? m[2]);
  }
  /* `const a = 1, b = 2;` e `const { a, b } = x;` e `const f = (a) => …`. */
  for (const m of s.matchAll(/\b(?:const|let|var)\s+([^;]+);/g)) {
    const lista = m[1];
    if (/=>|\{|\[/.test(lista)) {
      add(cabeca(lista.split('=')[0]));
      for (const c of lista.split('=')[0].matchAll(/\{([^{}]*)\}/g)) {
        for (const p of c[1].split(',')) add(cabeca(p));
      }
      continue;
    }
    for (const p of lista.split(',')) add(cabeca(p));
  }
  /* Parâmetros de qualquer `(…)=>` ou `(…) {`. */
  for (const m of s.matchAll(/\(([^()]*)\)\s*(?:=>|\{)/g)) {
    for (const p of m[1].split(',')) add(cabeca(p.trim().replace(/^\.\.\./, '')));
  }
  return d;
}

/** O que o browser dá a qualquer script, mais as palavras reservadas.
 *  Só entra aqui o que é global: o resto tem de estar declarado. */
const AMBIENTE = new Set(`window document navigator location console globalThis self
fetch setTimeout clearTimeout setInterval clearInterval requestAnimationFrame
cancelAnimationFrame AbortController IntersectionObserver ResizeObserver
MutationObserver matchMedia Intl Date Math JSON Object Array String Number
Boolean Promise Map Set WeakMap Symbol Error RegExp Infinity NaN undefined null
true false parseInt parseFloat isNaN isFinite encodeURIComponent
decodeURIComponent CustomEvent Event HTMLElement Node Element SVGElement Image
URL URLSearchParams Blob performance structuredClone queueMicrotask
getComputedStyle alert confirm prompt this arguments if else for while do
switch case default break continue try catch finally throw function class
const let var async await yield import export from as static get set of in
instanceof new typeof void delete return Option`.split(/\s+/));

test('nenhum ficheiro em js/ chama uma funcao que nao declarou', () => {
  const problemas = [];
  for (const ficheiro of FICHEIROS) {
    const s = soCodigo(fs.readFileSync(path.join(DIR_JS, ficheiro), 'utf8'));
    const declarados = nomesDeclarados(s);
    for (const m of s.matchAll(/(^|[^\w$.])([A-Za-z_$][\w$]*)\s*\(/g)) {
      const nome = m[2];
      if (declarados.has(nome) || AMBIENTE.has(nome)) continue;
      problemas.push(`${ficheiro}: ${nome}() é chamada mas não está `
        + 'declarada nem importada — ReferenceError quando o caminho for percorrido');
    }
  }
  assert.deepEqual(problemas, [], `\n${problemas.join('\n')}`);
});

test('o main.js usa do orcamento.js tudo o que chama', () => {
  /* Segunda visto do bug 2: o que entra por import tem de ser usado, e
     o que se chama de lá tem de ter entrado. A segunda metade e' a que
     apanhou o `planoEnvio`. */
  const s = soCodigo(fs.readFileSync(path.join(DIR_JS, 'main.js'), 'utf8'));
  const declarados = nomesDeclarados(s);
  const chamadas = new Set();
  for (const m of s.matchAll(/(^|[^\w$.])([A-Za-z_$][\w$]*)\s*\(/g)) {
    if (!declarados.has(m[2]) && !AMBIENTE.has(m[2])) chamadas.add(m[2]);
  }
  assert.deepEqual([...chamadas], [],
    'main.js chama um nome que não declarou nem importou');
});
