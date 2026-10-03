import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { CAPITAIS, agencyPoint } from '../js/mapa-dados.js';

/* ---------------------------------------------------------------------------
   FASE 8C — correcções do áudio completo (BRIEFING-FASE8C-CORRECCOES.md).

   C1 (rota) e C2 (ordem das províncias) estão em tests/mapa.test.js e
   tests/formulario.test.js, ao lado dos testes que corrigem. Aqui fica o
   resto: a cobertura (C3, C4), os botões e a secção da empresa (C5, C6) e
   o SEO (C7).
   --------------------------------------------------------------------------- */

const HTML = fs.readFileSync('index.html', 'utf8');
const CSS = fs.readFileSync('css/styles.css', 'utf8');

/** O código sem os comentários — a prosa descreve os defeitos antigos. */
const semComentarios = (fonte) => fonte
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
const MAIN = semComentarios(fs.readFileSync('js/main.js', 'utf8'));

/** O HTML de uma <section id="…">, sem comentários. */
function seccao(id) {
  const m = new RegExp(`<section\\b[^>]*id="${id}"[^>]*>([\\s\\S]*?)</section>`).exec(HTML);
  assert.ok(m, `não há <section id="${id}">`);
  return m[1].replace(/<!--[\s\S]*?-->/g, '');
}

/** O corpo da primeira regra CSS cujo selector é exactamente `sel`. */
function regra(sel) {
  const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`(?:^|[}\\s])${esc}\\s*\\{([^}]*)\\}`, 'm').exec(CSS);
  assert.ok(m, `não há regra CSS para ${sel}`);
  return m[1];
}

/* ---------- C3: a Matola sai, Maputo é a sede ---------- */

test('C3: a cobertura não tem a Matola — faz parte de Maputo', () => {
  assert.doesNotMatch(seccao('cobertura'), /Matola/);
});

test('C3: o ponto da JVI em Maputo chama-se Maputo, não Matola', () => {
  assert.equal(CAPITAIS.Maputo.nome, 'Maputo');
  assert.equal(agencyPoint('Maputo').nome, 'Maputo');
});

test('C3: Maputo está marcada como sede, com um rótulo visível', () => {
  const cob = seccao('cobertura');
  assert.match(cob, /<span class="rota rota--hub">Maputo — Sede<\/span>/);
  assert.match(cob, /<p class="mapa-aviso"><b>Sede:<\/b>/);
  assert.match(MAIN, /'Maputo · Sede'/, 'o mapa de cobertura não escreve "Sede" junto de Maputo');
});

/* ---------- C4: os cartões e as setas ---------- */

test('C4: "Porquê a JVI." acaba em ponto final e é larga', () => {
  assert.match(seccao('diferenciais'), /<span class="etiqueta etiqueta--larga">Porquê a JVI\.<\/span>/);
});

test('C4: "Fluxo operacional" passa a "Fluxo de entrada." e é larga', () => {
  const fluxo = seccao('fluxo');
  assert.match(fluxo, /<span class="etiqueta etiqueta--larga">Fluxo de entrada\.<\/span>/);
  assert.doesNotMatch(HTML, /colégio/i);
});

test('C4: a etiqueta larga é de facto mais larga do que a normal', () => {
  const larga = regra('.etiqueta--larga');
  assert.match(larga, /padding\s*:/);
  assert.match(larga, /min-width\s*:/);
});

test('C4: o cartão "Outras províncias" é maior e está centrado', () => {
  assert.match(seccao('servicos'), /<article class="servico servico--destaque[^"]*">[\s\S]*?<h3>Outras províncias<\/h3>/);
  const d = regra('.servico--destaque');
  assert.match(d, /grid-column\s*:\s*1\s*\/\s*-1/, 'o cartão não ocupa as duas colunas');
  assert.match(d, /text-align\s*:\s*center/, 'o texto do cartão não está centrado');
});

test('C4: no mapa de cobertura as rotas SAEM da sede, com seta e nome do destino', () => {
  /* A curva começa no hub (Maputo) e acaba na capital. Antes era ao
     contrário: as linhas iam das províncias para Maputo. */
  assert.match(MAIN, /ctx\.moveTo\(hx, hy\);\s*ctx\.quadraticCurveTo\(ccx, ccy, x, y\)/,
    'a rota de cobertura não parte da sede');
  assert.match(MAIN, /function setaDestino\(/, 'não há seta no destino de cada rota');
  assert.match(MAIN, /setaDestino\([^)]*\)/);
  /* O rótulo de cada ponto é o nome da PROVÍNCIA de destino. */
  assert.match(MAIN, /function rotuloDe\(nome\)/);
  assert.match(MAIN, /etiqueta\([^;]*rotuloDe\(nome\)/);
});
