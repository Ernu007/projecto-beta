import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

/* ---------------------------------------------------------------------------
   O QUE ESTE FICHEIRO PROTEGE

   Houve um bug que partiu o site inteiro: o ecrã de sucesso
   (`.envio-ok`) ficou IRMÃO de `#orcRaiz` em vez de descendente. O
   `js/main.js` fazia `raizOrc.querySelector('[data-ok]')`, recebeu
   `null`, e o `.addEventListener` seguinte lançou um TypeError no topo
   do módulo ES — o que aborta a avaliação e impede TODAS as linhas
   abaixo de correrem: o envio do orçamento, o mapa e a galeria.

   `tools/verificar-html.py` não apanhou isto: ele confirma que cada
   `data-attribute` existe no documento, não que esteja dentro do
   sítio certo. Este teste verifica o ÂMBITO.

   Implementado sem jsdom: um parser deimbricamento que reconstrói a
   árvore e diz, para cada atributo, quem é o pai. Suficiente para
   perguntas de "está dentro de X?" e sem dependências.
--------------------------------------------------------------------------- */

const HTML = fs.readFileSync('index.html', 'utf8');

/** Tags que não têm conteúdo próprio, logo não abrem âmbito. */
const VAZIAS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img',
  'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);

/** Tags que fecham-se sozinhas. */
const AUTO_FECHADAS = new Set(['li', 'p', 'option', 'td', 'th', 'tr', 'dt', 'dd']);

/**
 * Devolve um Map com `chave-do-elemento` -> caminho de ancestrais.
 * A chave imita o que o `index` do browser usaria.
 */
function arvore() {
  const ancestrais = new Map();
  const pilha = [];
  const vistos = new Set();

  const partes = HTML.split(/(<[^>]+>)/);
  for (const parte of partes) {
    if (!parte.startsWith('<')) continue;
    const tagM = /^<\/?\s*([a-zA-Z][a-zA-Z0-9-]*)/.exec(parte);
    if (!tagM) continue;
    const tag = tagM[1].toLowerCase();

    if (parte.startsWith('</')) {
      // fecha a última ocorrência aberta desta tag
      for (let i = pilha.length - 1; i >= 0; i -= 1) {
        if (pilha[i].tag === tag) { pilha.length = i; break; }
      }
      continue;
    }

    const selfClosing = parte.endsWith("/>") || VAZIAS.has(tag);
    const attrs = {};
    // Tem de apanhar TAMBEM os atributos sem valor (`data-ok hidden`),
    // senao os hooks booleanos desaparecem da arvore.
    for (const m of parte.matchAll(/([a-zA-Z-]+)(?:\s*=\s*"([^"]*)")?/g)) {
      if (!m[1] || m[1].startsWith("/")) continue;
      attrs[m[1].toLowerCase()] = m[2] ?? "";
    }

    if (attrs.id) {
      ancestrais.set(`#${attrs.id}`, pilha.map((p) => p.chave));
    }
    // Semântica de querySelector: para cada NOME de atributo, o que
    // importa é a PRIMEIRA ocorrência no documento. `data-ok` não tem
    // valor nenhum — a chave é o nome, não o valor.
    for (const k of Object.keys(attrs)) {
      if (!k.startsWith('data-')) continue;
      const chave = `[data-${k.slice(5)}]`;
      if (!vistos.has(chave)) {
        ancestrais.set(chave, pilha.map((p) => p.chave));
        vistos.add(chave);
      }
    }

    if (!selfClosing && !AUTO_FECHADAS.has(tag)) {
      const chave = attrs.id ? `#${attrs.id}` : tag;
      pilha.push({ tag, chave });
    }
  }
  return ancestrais;
}

const T = arvore();

/** O nó existe dentro do elemento com este id? */
function dentroDe(seletor, idRaiz) {
  const caminho = T.get(seletor);
  if (!caminho) return { existe: false, dentro: false, caminho };
  return {
    existe: true,
    dentro: caminho.includes(`#${idRaiz}`),
    caminho,
  };
}

test('a arvore do index.html foi bem construida', () => {
  assert.ok(T.size > 20, `a arvore ficou demasiado pequena (${T.size})`);
  assert.ok(T.has('#orcRaiz'), 'não encontrei #orcRaiz');
  assert.ok(T.has('#modal'), 'não encontrei #modal');
  assert.ok(T.has('#luz'), 'não encontrei #luz');
  assert.ok(T.has('#confirm'), 'não encontrei #confirm');
});

/* Este é o teste que teria apanhado o bug. */
test('o ecra de sucesso esta DENTRO de #orcRaiz', () => {
  const r = dentroDe('[data-ok]', 'orcRaiz');
  assert.ok(r.existe, 'data-ok não existe no documento');
  assert.ok(r.dentro,
    `data-ok está em ${r.caminho.join(' > ')} — é IRMÃO de #orcRaiz, ` +
    'e raizOrc.querySelector("[data-ok]") devolve null');
});

test('todos os nos que o main.js procura dentro de #orcRaiz estao la dentro', () => {
  const dentroDeOrcRaiz = ['[data-ok]', '[data-ok-nota]',
    '[data-ok-cliente]', '[data-ok-fechar]'];
  for (const sel of dentroDeOrcRaiz) {
    const r = dentroDe(sel, 'orcRaiz');
    assert.ok(r.existe, `${sel} não existe no documento`);
    assert.ok(r.dentro, `${sel} está em ${r.caminho.join(' > ')}, fora de #orcRaiz`);
  }
});

test('o no da confirmacao e hijo directo de #confirm', () => {
  const r = dentroDe('[data-resumo-confirm]', 'confirm');
  assert.ok(r.dentro,
    `data-resumo-confirm está em ${r.caminho.join(' > ')}, fora de #confirm`);
});

test('os botoes da luzbox estao dentro de #luz', () => {
  for (const sel of ['[data-luz-img]', '[data-luz-legenda]',
    '[data-luz-fechar]', '[data-luz-ant]',
    '[data-luz-prox]', '[data-luz-fundo]']) {
    const r = dentroDe(sel, 'luz');
    assert.ok(r.dentro, `${sel} está em ${r.caminho.join(' > ')}, fora de #luz`);
  }
});

test('a raiz da galeria esta dentro de <main>', () => {
  const r = dentroDe('[data-gal]', 'topo');
  assert.ok(r.existe && r.dentro, 'data-gal nao esta onde o main.js a procura');
});

/* Fase 9 (9.5). O carrossel cresceu, e o que não pode partir-se com isso é
   a luzbox: cada cartão continua a ser o `<button>` que a abre, com o
   `data-gal-src` da fotografia grande. `iniciarGaleria` procura
   `[data-gal-src]` dentro de `[data-gal]`, e `iniciarCarrossel` procura os
   cartões dentro de `[data-gal-pista]`: têm de ser os mesmos. */
test('9.5: cada cartao do carrossel continua a abrir a sua fotografia na luzbox', () => {
  const pista = /<div class="gal__grelha" data-gal-pista[^>]*>([\s\S]*?)<\/div>\s*<div class="gal__controlos">/.exec(HTML)?.[1];
  assert.ok(pista, 'não encontrei a pista do carrossel');

  const cartoes = [...pista.matchAll(/<button class="gal__item" type="button"([^>]*)>([\s\S]*?)<\/button>/g)];
  assert.ok(cartoes.length >= 2, `o carrossel só tem ${cartoes.length} cartões`);

  for (const [, atributos, dentro] of cartoes) {
    const grande = /data-gal-src="([^"]+)"/.exec(atributos)?.[1];
    assert.ok(grande, `um cartão do carrossel perdeu o data-gal-src: ${atributos.trim().slice(0, 60)}`);
    assert.ok(fs.existsSync(grande), `${grande} não existe`);
    assert.match(atributos, /data-gal-alt="[^"]+"/, `${grande}: a luzbox fica sem texto alternativo`);
    /* A fotografia do cartão é a que a luzbox amplia, e leva as dimensões
       reais — é o que impede o cartão de saltar enquanto carrega, agora
       que é maior. */
    const img = /<img src="([^"]+)" width="(\d+)" height="(\d+)"/.exec(dentro);
    assert.ok(img, `${grande}: a fotografia do cartão não tem src, width e height`);
    assert.equal(img[1], grande);
    assert.match(dentro, /<span class="gal__legenda">[^<]+<\/span>/, `${grande}: sem legenda`);
  }

  /* Nenhum `[data-gal-src]` fora da pista: a luzbox e o carrossel contam
     os mesmos itens, senão "3 de 11" numa não é a terceira do outro. */
  assert.equal((HTML.match(/data-gal-src=/g) ?? []).length, cartoes.length);
  assert.match(HTML, new RegExp(`data-gal-contador[^>]*>1 / ${cartoes.length}<`),
    'o contador do carrossel não bate com o número de fotografias');

  /* E a pista está dentro de `[data-gal]`, que é onde as duas funções a
     procuram. */
  const r = dentroDe('[data-gal-pista]', 'topo');
  assert.ok(r.existe && r.dentro);
  assert.ok(T.get('[data-gal-pista]').length > T.get('[data-gal]').length,
    'a pista do carrossel saiu de dentro de [data-gal]');
});

test('o template do formulario esta no topo do documento, nao dentro do modal', () => {
  const caminho = T.get('#tplOrc');
  assert.ok(caminho, 'não encontrei #tplOrc');
  assert.ok(!caminho.includes('#modal'),
    '#tplOrc dentro do modal faria o template nunca ser clonado');
});
