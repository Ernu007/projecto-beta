import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { MORADA_JVI, PASSOS_PERCURSO, NOTA_PERCURSO, linkDirecoes } from '../js/rota.js';

/* ---------------------------------------------------------------------------
   O PERCURSO COM SETAS (D36 em docs/decisoes.md)

   O cliente pediu: "quero que mostre ao cliente com setas de direcções
   para ficar mais fácil de compreender". O botão "Como chegar à JVI"
   continua a abrir o Google Maps; junto dele passa a haver, no próprio
   ecrã, os passos do percurso com setas.

   A regra que este ficheiro protege é a mesma da Fase 7: NÃO SE INVENTA
   ROTA. O projecto só tem confirmados três nomes — Aeroporto de Maputo,
   Av. 19 de Outubro e Terminal de Cargas Nº 113 —, não tem coordenadas e
   não sabe de onde o cliente parte. Portanto:

   - os únicos sítios nomeados são os da morada confirmada;
   - não há viragens (↱ ↰, "à esquerda", "à direita"): o lado depende de
     onde se vem, e ninguém o confirmou;
   - não há cruzamentos, rotundas nem saídas;
   - não há distâncias nem tempos.
   --------------------------------------------------------------------------- */

const HTML = fs.readFileSync('index.html', 'utf8');
const CSS = fs.readFileSync('css/styles.css', 'utf8');

const entidades = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" };
const texto = (s) => s.replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, ' ')
  .replace(/&(amp|lt|gt|quot|#39);/g, (_, k) => entidades[k]).replace(/\s+/g, ' ').trim();

/** Os blocos `.percurso` do HTML, pela ordem em que aparecem. */
const blocos = () => [...HTML.matchAll(/<div class="percurso">([\s\S]*?)<\/div>/g)].map((m) => m[1]);

/** Os passos de um bloco: a seta (ou `chegada`), a frase e o sítio a negrito. */
function passos(bloco) {
  return [...bloco.matchAll(/<li class="percurso__passo([^"]*)">([\s\S]*?)<\/li>/g)].map((m) => {
    const seta = /<span class="percurso__seta" aria-hidden="true">([^<]*)<\/span>/.exec(m[2])?.[1];
    return {
      seta: m[1].includes('percurso__passo--chegada') ? 'chegada' : seta,
      frase: texto(m[2].replace(/<span class="percurso__seta"[\s\S]*?<\/span>/, '')),
      local: texto(/<b>([\s\S]*?)<\/b>/.exec(m[2])?.[1] ?? ''),
    };
  });
}

/* ---------- Os dados ---------- */

test('o percurso so nomeia sitios que estao na morada confirmada', () => {
  assert.ok(PASSOS_PERCURSO.length >= 2, 'o percurso precisa de pelo menos dois passos');
  for (const p of PASSOS_PERCURSO) {
    assert.ok(MORADA_JVI.includes(p.local),
      `"${p.local}" não está na morada confirmada (${MORADA_JVI})`);
  }
  const locais = PASSOS_PERCURSO.map((p) => p.local);
  assert.ok(locais.includes('Av. 19 de Outubro'), 'falta a Av. 19 de Outubro');
  assert.ok(locais.includes('Terminal de Cargas Nº 113'), 'falta o Terminal de Cargas Nº 113');
});

test('o percurso acaba na JVI, e os passos anteriores levam seta', () => {
  const ultimo = PASSOS_PERCURSO.at(-1);
  assert.equal(ultimo.seta, 'chegada');
  assert.equal(ultimo.local, 'Terminal de Cargas Nº 113');
  for (const p of PASSOS_PERCURSO.slice(0, -1)) {
    assert.equal(p.seta, '↑', `o passo "${p.texto} ${p.local}" não tem a seta de seguir em frente`);
  }
});

test('o percurso nao inventa viragens, cruzamentos, saidas, distancias nem tempos', () => {
  const tudo = [...PASSOS_PERCURSO.map((p) => `${p.seta} ${p.texto} ${p.local}`), NOTA_PERCURSO].join(' | ');

  /* O lado de uma viragem depende de onde o cliente vem. */
  assert.doesNotMatch(tudo, /[↱↰↲↳⬅➡←→↖↗↘↙]/, 'há uma seta de viragem que ninguém confirmou');
  assert.doesNotMatch(tudo, /\b(esquerda|direita)\b/i, 'há um lado de viragem que ninguém confirmou');
  assert.doesNotMatch(tudo, /rotunda|cruzamento|sem[áa]foro|sa[íi]da|portagem|bombas?/i,
    'há um ponto de referência que não está confirmado no projecto');
  assert.doesNotMatch(tudo, /\d\s*(km|m|metros|min|minutos|h|horas)\b/i,
    'há uma distância ou um tempo, e o site não tem como os calcular');

  /* Os únicos números são os da morada: o 19 da avenida e o 113 do terminal. */
  const numeros = tudo.match(/\d+/g) ?? [];
  assert.deepEqual([...new Set(numeros)].sort(), ['113', '19']);
});

test('a nota diz que as viragens dependem de onde se parte e remete para o Maps', () => {
  assert.match(NOTA_PERCURSO, /Google Maps/);
  assert.match(NOTA_PERCURSO, /de onde (?:parte|vem|está)/i);
});

/* ---------- O que esta no ecra ---------- */

test('ha um percurso junto a cada botao "Como chegar a JVI"', () => {
  const botoes = HTML.match(/<a\b[^>]*google\.com\/maps\/dir\/[^>]*>/g) ?? [];
  assert.equal(botoes.length, 2, 'esperava dois botões de direcções: o do hero e o do rodapé');
  assert.equal(blocos().length, botoes.length, 'cada botão de direcções tem de ter o percurso ao lado');

  /* "Junto": entre o fim do botão e o percurso só pode haver o fecho do
     contentor das acções — nada de outro conteúdo pelo meio. */
  for (const m of HTML.matchAll(/google\.com\/maps\/dir\/[\s\S]*?Como chegar à JVI\s*<\/a>([\s\S]*?)<div class="percurso">/g)) {
    assert.match(m[1], /^\s*(?:<\/div>)?\s*$/, `há conteúdo entre o botão e o percurso: ${m[1].trim().slice(0, 80)}`);
  }
  assert.equal([...HTML.matchAll(/Como chegar à JVI\s*<\/a>\s*(?:<\/div>)?\s*<div class="percurso">/g)].length, 2);
});

test('os passos do ecra sao os de js/rota.js, pela mesma ordem', () => {
  const esperado = PASSOS_PERCURSO.map((p) => ({
    seta: p.seta, frase: `${p.texto} ${p.local}`, local: p.local,
  }));
  for (const [i, bloco] of blocos().entries()) {
    assert.deepEqual(passos(bloco), esperado, `o percurso n.º ${i + 1} do HTML divergiu de PASSOS_PERCURSO`);
    assert.equal(texto(/<p class="percurso__nota">([\s\S]*?)<\/p>/.exec(bloco)?.[1] ?? ''), NOTA_PERCURSO);
  }
});

test('as setas estao visiveis no ecra e nao sao lidas duas vezes', () => {
  for (const bloco of blocos()) {
    const setas = [...bloco.matchAll(/<span class="percurso__seta" aria-hidden="true">([^<]*)<\/span>/g)].map((m) => m[1]);
    assert.deepEqual(setas, PASSOS_PERCURSO.filter((p) => p.seta !== 'chegada').map((p) => p.seta));
    /* É uma lista ORDENADA com nome: quem usa leitor de ecrã ouve
       "1 de 3, siga para…" em vez do nome do carácter da seta. */
    assert.match(bloco, /<ol class="percurso__passos" aria-label="Percurso até à JVI">/);
    /* A chegada leva o pin, o mesmo desenho do botão. */
    assert.match(bloco, /percurso__passo--chegada">\s*<svg[^>]*aria-hidden="true"/);
  }
  const regra = /\.percurso__seta\s*\{([^}]*)\}/.exec(CSS)?.[1];
  assert.ok(regra, 'não há regra CSS para .percurso__seta');
  assert.doesNotMatch(regra, /display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0\b/);
  assert.match(regra, /color\s*:\s*var\(--verde\)/, 'a seta devia destacar-se na cor da marca');
});

test('o percurso nao tira nada ao botao: o link do Maps continua igual', () => {
  const links = [...HTML.matchAll(/<a\b[^>]*href="(https:\/\/www\.google\.com\/maps\/dir\/[^"]*)"[^>]*>/g)];
  for (const m of links) {
    assert.equal(m[1].replace(/&amp;/g, '&'), linkDirecoes());
    assert.match(m[0], /target="_blank"/);
    assert.match(m[0], /rel="noopener"/);
  }
  /* E o percurso é texto: não é link, não tem JavaScript, não pede posição. */
  for (const bloco of blocos()) {
    assert.doesNotMatch(bloco, /<a\b|<button\b|onclick|geolocation/i);
  }
});

test('o percurso do hero fica fora de .hero__acoes: as accoes continuam a ser tres', () => {
  const accoes = /<div class="hero__acoes">([\s\S]*?)<\/div>/.exec(HTML)?.[1] ?? '';
  assert.doesNotMatch(accoes, /percurso/);
  assert.match(HTML, /<div class="hero__acoes">[\s\S]*?<\/div>\s*<div class="percurso">/);
});

/* Com o percurso o conteúdo do hero cresceu. A etiqueta da rota
   (`.hero__rota`) está presa a 96px do fundo do hero e as provas acabam
   onde começa o `padding-bottom`: com os 80px de base, a última linha das
   provas ficava por baixo da etiqueta. Onde a etiqueta existe (acima de
   760px), o hero tem de lhe guardar o espaço. */
test('o hero guarda espaco para a etiqueta da rota, que o percurso empurrava', () => {
  const rota = /\.hero__rota\s*\{([^}]*)\}/.exec(CSS)?.[1] ?? '';
  const bottom = Number(/bottom:\s*(\d+)px/.exec(rota)?.[1]);
  const padV = Number(/padding:\s*(\d+)px/.exec(rota)?.[1]);
  const letra = Number(/font-size:\s*([\d.]+)px/.exec(rota)?.[1]);
  assert.ok(bottom > 0 && padV > 0 && letra > 0, 'não consegui ler a geometria de .hero__rota');
  /* Topo da etiqueta, medido do fundo do hero: 2 de borda, o padding
     vertical e uma linha de texto (line-height ~1.6). */
  const topo = bottom + 2 + 2 * padV + Math.ceil(letra * 1.6);

  const media = /@media \(min-width: 761px\)\s*\{\s*\.hero\s*\{\s*padding-bottom:\s*(\d+)px;\s*\}\s*\}/.exec(CSS);
  assert.ok(media, 'falta a regra que dá espaço à etiqueta da rota acima de 760px');
  assert.ok(Number(media[1]) >= topo,
    `o hero guarda ${media[1]}px e a etiqueta da rota chega aos ${topo}px`);
  /* E é mesmo a 760px que a etiqueta desaparece. */
  assert.match(CSS, /@media \(max-width: 760px\)\s*\{\s*\.hero__rota\s*\{\s*display:\s*none;/);
});
