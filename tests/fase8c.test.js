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

/* ---------- C5: os botões de contacto com as cores do Google ---------- */

/** O valor de um token do :root. */
function token(nome) {
  const m = new RegExp(`${nome}\s*:\s*([^;]+);`).exec(CSS);
  assert.ok(m, `token ${nome} não existe`);
  return m[1].trim();
}
const hex = (h) => [0, 2, 4].map((i) => parseInt(h.slice(1 + i, 3 + i), 16));
const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const contraste = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

test('C5: as cores do Google estão no :root, uma por botão', () => {
  assert.equal(token('--google-vermelho').toUpperCase(), '#EA4335');
  assert.equal(token('--google-verde').toUpperCase(), '#34A853');
  assert.equal(token('--google-branco').toUpperCase(), '#FFFFFF');
});

test('C5: e-mail = vermelho, WhatsApp = verde, telefone = branco', () => {
  assert.match(regra('.fixo--mail .fixo__btn'), /background\s*:\s*var\(--google-vermelho\)/);
  assert.match(regra('.fixo--wa   .fixo__btn'), /background\s*:\s*var\(--google-verde\)/);
  assert.match(regra('.fixo--tel  .fixo__btn'), /background\s*:\s*var\(--google-branco\)/);
});

test('C5: o ícone de cada botão lê-se sobre a cor nova (3:1, gráfico)', () => {
  const pares = [
    ['.fixo--mail .fixo__btn', '--google-vermelho'],
    ['.fixo--wa   .fixo__btn', '--google-verde'],
    ['.fixo--tel  .fixo__btn', '--google-branco'],
  ];
  for (const [sel, fundo] of pares) {
    const cor = /(?:^|;)\s*color\s*:\s*var\((--[a-z-]+)\)/.exec(regra(sel))?.[1];
    assert.ok(cor, `${sel} não declara a cor do ícone com um token`);
    const r = contraste(hex(token(cor)), hex(token(fundo)));
    assert.ok(r >= 3, `${sel}: ícone ${cor} sobre ${fundo} dá ${r.toFixed(2)}:1`);
  }
});

test('C5: a legenda de cada botão lê-se sobre o fundo escuro (AA)', () => {
  for (const sel of ['.fixo--wa .fixo__txt', '.fixo--tel .fixo__txt', '.fixo--mail .fixo__txt']) {
    const cor = /color\s*:\s*var\((--[a-z-]+)\)/.exec(regra(sel))?.[1];
    assert.ok(cor, `${sel} não tem cor`);
    const r = contraste(hex(token(cor)), hex(token('--base')));
    assert.ok(r >= 4.5, `${sel}: ${cor} sobre --base dá ${r.toFixed(2)}:1`);
  }
});

test('C5: o botão do telefone não mudou — só a cor', () => {
  /* "O telefone está bom." O HTML é o mesmo, byte a byte, da Fase 8B. */
  assert.ok(HTML.includes(`<span class="fixo fixo--tel">
    <span class="fixo__txt">Ligar</span>
    <a class="fixo__btn" href="tel:+258847935035" aria-label="Ligar para +258 84 793 5035">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.79a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.29-1.29a2 2 0 0 1 2.11-.45c.89.34 1.83.57 2.79.7A2 2 0 0 1 22 16.92z"/></svg>
    </a>
  </span>`), 'o botão do telefone mudou além da cor');
});

test('C5: o botão de e-mail é um botão do Gmail', () => {
  const mail = /<span class="fixo fixo--mail">([\s\S]*?)<\/span>\s*<\/nav>/.exec(HTML)?.[1];
  assert.ok(mail, 'não encontrei o botão de e-mail');
  assert.match(mail, /<svg class="ico-gmail"/, 'o e-mail não tem o ícone do Gmail');
  assert.match(mail, /<span class="fixo__txt">Gmail<\/span>/);
});

/* ---------- C6: a secção "Nossa empresa" tem o panfleto ---------- */

test('C6: onde estava o camião ("Vamos conectar o seu negócio?") está o panfleto', () => {
  const cont = seccao('contactos');
  assert.doesNotMatch(cont, /camiao\.webp/, 'o camião continua nos contactos');
  assert.match(cont, /<a class="cont-figura__link" href="carta\/jvi-carta-apresentacao\.pdf"[^>]*>\s*<img src="assets\/img\/carta-capa\.webp"/,
    'o panfleto não está nos contactos, ou não abre a carta');
});

test('C6: a secção chama-se "Nossa empresa" e mostra o panfleto, larga', () => {
  const emp = seccao('empresa');
  assert.match(emp, /<h2 class="titulo-seccao">[^<]*<span class="verde">Nossa empresa<\/span>/);
  assert.match(emp, /<img src="assets\/img\/carta-capa\.webp"/);
  assert.doesNotMatch(emp, /camiao/);
  const larg = /max-width\s*:\s*(\d+)px/.exec(regra('.empresa__carta'))?.[1];
  assert.ok(Number(larg) >= 480, `o panfleto continua estreito (${larg}px)`);
});

/* ---------- C7: SEO, sem keyword stuffing e sem texto escondido ---------- */

/* Os termos vêm da lógica do negócio e do vocabulário dos concorrentes
   moçambicanos (ver docs/decisoes.md): não há dados de volume de pesquisa
   verificáveis, e o briefing proíbe inventá-los. */
/* Só as expressões de serviço: "Maputo" aparece onze vezes porque é a
   morada e o nome de uma província, e isso não é stuffing. */
const TERMOS = ['envio de encomendas', 'transporte de carga', 'carga aérea', 'agência de carga'];

const titulo = /<title>([^<]*)<\/title>/.exec(HTML)?.[1] ?? '';
const descricao = /<meta name="description" content="([^"]*)"/.exec(HTML)?.[1] ?? '';
const LD = JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(HTML)?.[1] ?? '{}');
const minus = (s) => s.toLowerCase();

test('C7: o <title> tem o serviço e o sítio, e cabe no resultado do Google', () => {
  assert.match(minus(titulo), /envio de encomendas/);
  assert.match(minus(titulo), /maputo/);
  assert.match(titulo, /JVI/);
  assert.ok(titulo.replace(/&amp;/g, '&').length <= 65, `o título tem ${titulo.length} caracteres`);
});

test('C7: a meta description tem os termos e o tamanho de um snippet', () => {
  const d = minus(descricao);
  for (const t of ['envio de encomendas', 'carga', 'maputo', 'províncias']) assert.ok(d.includes(t), `falta "${t}"`);
  assert.ok(descricao.length >= 120 && descricao.length <= 160, `a descrição tem ${descricao.length} caracteres`);
});

test('C7: og e twitter dizem o mesmo que o <title> e a description', () => {
  assert.ok(HTML.includes(`<meta property="og:title" content="${titulo}">`));
  assert.ok(HTML.includes(`<meta name="twitter:title" content="${titulo}">`));
  assert.ok(HTML.includes(`<meta property="og:description" content="${descricao}">`));
  assert.ok(HTML.includes(`<meta name="twitter:description" content="${descricao}">`));
});

test('C7: o JSON-LD diz que serviços são e que províncias serve', () => {
  const areas = (LD.areaServed ?? []).map((a) => a.name);
  for (const p of ['Maputo', 'Gaza', 'Inhambane', 'Sofala', 'Manica', 'Tete', 'Zambézia', 'Niassa', 'Nampula', 'Cabo Delgado']) {
    assert.ok(areas.includes(p), `o JSON-LD não serve ${p}`);
  }
  const servicos = (LD.hasOfferCatalog?.itemListElement ?? []).map((o) => minus(o.itemOffered?.name ?? ''));
  for (const t of ['envio de encomendas', 'carga aérea', 'transporte rodoviário']) {
    assert.ok(servicos.some((s) => s.includes(t)), `o catálogo do JSON-LD não tem "${t}"`);
  }
  assert.match(minus(LD.description), /envio de encomendas/);
});

test('C7: os h2 de serviços e cobertura falam como quem pesquisa', () => {
  const h2 = (id) => /<h2[^>]*>([\s\S]*?)<\/h2>/.exec(seccao(id))[1].replace(/<[^>]+>/g, '');
  assert.match(minus(h2('servicos')), /carga aérea e rodoviária/);
  assert.match(minus(h2('cobertura')), /envio de encomendas/);
});

test('C7: sem keyword stuffing — nenhum termo repetido à exaustão', () => {
  /* Conta no texto visível (sem scripts, estilos, comentários e atributos).
     Um limite generoso, mas que apanha um bloco de palavras-chave colado. */
  const visivel = minus(HTML
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' '));
  for (const t of TERMOS) {
    const n = visivel.split(t).length - 1;
    assert.ok(n <= 8, `"${t}" aparece ${n} vezes no texto visível`);
  }
  assert.ok(minus(titulo).split('encomendas').length - 1 <= 1, 'o título repete "encomendas"');
});

test('C7: o bloco SEO do rodapé é texto real, com links internos, e não está escondido', () => {
  const rodape = /<footer class="rodape">([\s\S]*?)<\/footer>/.exec(HTML)[1];
  const bloco = /<nav class="rodape__seo"[^>]*>([\s\S]*?)<\/nav>/.exec(rodape)?.[0];
  assert.ok(bloco, 'não há bloco de serviços/províncias no rodapé');
  assert.doesNotMatch(bloco, /hidden|aria-hidden|sr-only|display:\s*none/);
  const links = [...bloco.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(links.length >= 3, 'o bloco tem poucos links');
  for (const l of links) {
    assert.ok(l.startsWith('#'), `${l} não é um link interno`);
    assert.match(HTML, new RegExp(`id="${l.slice(1)}"`), `${l} não tem destino`);
  }
  for (const c of ['Xai-Xai', 'Beira', 'Nampula', 'Pemba']) assert.match(bloco, new RegExp(c));
  const css = regra('.rodape__seo');
  assert.doesNotMatch(css, /display\s*:\s*none|visibility\s*:\s*hidden|font-size\s*:\s*0|opacity\s*:\s*0\b|text-indent\s*:\s*-/,
    'o bloco SEO está escondido — o Google penaliza');
});
