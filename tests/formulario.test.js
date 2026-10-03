import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PROVINCIAS, PAGAMENTOS } from '../js/orcamento.js';
import { ROTA } from '../js/mapa-dados.js';
import { PAGAMENTOS as PAGAMENTOS_SERVIDOR, PROVINCIAS as PROVINCIAS_SERVIDOR } from '../functions/submit.js';

/* ---------------------------------------------------------------------------
   FASE 8 — o formulário (C1 a C6 do BRIEFING-FASE8-REVISAO.md).

   O formulário vive num <template>; estes testes lêem-no do index.html.
   --------------------------------------------------------------------------- */

const HTML = fs.readFileSync('index.html', 'utf8');
const TPL = /<template id="tplOrc">([\s\S]*?)<\/template>/.exec(HTML)?.[1] ?? '';
const CSS = fs.readFileSync('css/orcamento.css', 'utf8');
const JS = fs.readFileSync('js/orcamento.js', 'utf8');

/** O HTML de um passo do formulário (0, 1 ou 2). */
function seccao(n) {
  for (const m of TPL.matchAll(/<fieldset class="orc-seccao" data-seccao="(\d)"[^>]*>([\s\S]*?)<\/fieldset>/g)) {
    if (m[1] === String(n)) return m[2];
  }
  return assert.fail(`não encontrei o passo ${n + 1}`);
}

test('o template do formulário existe', () => {
  assert.ok(TPL.length > 0, 'não há <template id="tplOrc">');
});

/* ---------- C1 / C2: passo 1 ---------- */

test('C1: a ajuda do telefone fica só com a primeira frase', () => {
  const ajuda = /data-campo="telefone"[\s\S]*?<span class="campo__ajuda">([^<]*)<\/span>/.exec(TPL)?.[1];
  assert.equal(ajuda, 'É este número que recebe a confirmação.');
});

test('C2: o rótulo do telefone é só "Telefone" e o exemplo não é o número da JVI', () => {
  const rotulo = /<label for="orcTelefone">([\s\S]*?)<span/.exec(TPL)?.[1].trim();
  assert.equal(rotulo, 'Telefone');
  const ph = /id="orcTelefone"[^>]*placeholder="([^"]*)"/.exec(TPL)?.[1];
  assert.ok(ph, 'o telefone não tem exemplo');
  assert.ok(!ph.replace(/\D/g, '').includes('847935035'),
    `o exemplo do telefone é o número real da JVI: ${ph}`);
});

test('C2: os exemplos do nome, do apelido e da morada', () => {
  assert.match(TPL, /id="orcNome"[^>]*placeholder="Ex\.: João Pedro"/);
  assert.match(TPL, /id="orcApelido"[^>]*placeholder="Ex\.: [^"]+"/);
  /* Malhangalene: bairro do distrito municipal KaMpfumo, em Maputo. */
  assert.match(TPL, /id="orcMorada"[^>]*placeholder="Ex\.: Malhangalene, Maputo"/);
});

/* ---------- C3: passo 2 ---------- */

test('C3: o passo 2 chama-se "A sua carga"', () => {
  assert.match(seccao(1), /<h3 class="orc-seccao__t">A sua carga<\/h3>/);
  assert.doesNotMatch(TPL, /O que transportamos/);
});

test('C3: as dimensões são opcionais', () => {
  const dim = /<input id="orcDimensao"[^>]*>/.exec(TPL)?.[0];
  assert.ok(dim, 'o campo das dimensões desapareceu');
  assert.doesNotMatch(dim, /\brequired\b/, 'as dimensões voltaram a ser obrigatórias');
});

test('8C/C2: as províncias estão por ordem geográfica sul -> norte, e o servidor aceita as mesmas', () => {
  /* A Fase 8B dizia alfabética; o áudio completo diz "começando de Maputo
     (…) para Cabo Delgado". É a ordem da ROTA do avião. Palma, que é um
     distrito de Cabo Delgado e não uma província, fica a seguir a ela. */
  assert.deepEqual(PROVINCIAS, [
    'Maputo', 'Gaza', 'Inhambane', 'Sofala', 'Manica', 'Tete',
    'Zambézia', 'Niassa', 'Nampula', 'Cabo Delgado', 'Palma',
  ]);
  assert.deepEqual(PROVINCIAS.slice(0, ROTA.length), ROTA,
    'a ordem do formulário divergiu da ordem da rota');
  assert.deepEqual([...PROVINCIAS_SERVIDOR].sort(), [...PROVINCIAS].sort(),
    'o servidor e o formulário aceitam províncias diferentes');
});

test('8C/C2: os DOIS selects (origem e destino) são enchidos pela mesma lista', () => {
  assert.match(TPL, /<select id="orcProvincia" name="provincia"/);
  assert.match(TPL, /<select id="orcProvinciaDestino" name="provinciaDestino"/);
  assert.match(JS, /select\[name="provincia"\], select\[name="provinciaDestino"\]'\)\s*\.forEach\(encherProvincias\)/);
  assert.doesNotMatch(JS, /PROVINCIAS = \[[^\]]*\]\.sort\(/,
    'a lista voltou a ser reordenada alfabeticamente');
});

test('C3: o peso mostra que aceita vírgula e a descrição tem o exemplo entre parênteses', () => {
  assert.match(TPL, /id="orcPeso"[^>]*placeholder="[^"]*15[^"]*11,7/);
  assert.match(TPL, /id="orcDescricao"[^>]*placeholder="\(ex\.: camisetas\)"/);
});

/* ---------- C4: a caixa verde ---------- */

test('C4: o passo 2 tem uma caixa de verificação obrigatória sobre o embarque', () => {
  const caixa = /<input[^>]*type="checkbox"[^>]*>/.exec(seccao(1))?.[0];
  assert.ok(caixa, 'não há caixa de verificação no passo 2');
  assert.match(caixa, /\brequired\b/, 'a caixa do passo 2 não é obrigatória');
  assert.match(seccao(1), /embarque/i);
});

test('C4: a caixa é verde', () => {
  assert.match(CSS, /\.verif input\s*\{[^}]*accent-color:\s*var\(--verde\)/);
});

test('C4: a validação do passo trata caixas e rádios, não só texto', () => {
  /* Uma checkbox tem sempre value="sim": validada como texto, a caixa
     obrigatória passava sem ser marcada. */
  assert.match(JS, /inp\.type === 'checkbox'\) return !inp\.checked/);
  assert.match(JS, /inp\.type === 'radio'/);
});

/* ---------- C5: pagamento ---------- */

test('C5: as formas de pagamento são e-Mola, M-Pesa e transferência bancária', () => {
  const esperado = ['e-Mola', 'M-Pesa', 'Transferência bancária'];
  assert.deepEqual(PAGAMENTOS, esperado);
  assert.deepEqual(PAGAMENTOS_SERVIDOR, esperado);
  const radios = [...seccao(2).matchAll(/name="pagamento" value="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(radios, esperado);
});

test('C5: nunca cartão de crédito nem numerário no formulário', () => {
  assert.doesNotMatch(TPL, /cart[ãa]o|Visa|MasterCard|Numerário/i);
});

test('C5: "quando paga" tem as duas opções, nenhuma imposta', () => {
  const bloco = /data-campo="pagarNoLevantamento"[\s\S]*?<span class="campo__erro">/.exec(seccao(2))?.[0];
  assert.ok(bloco, 'não há bloco "quando paga"');
  assert.match(bloco, /No acto de envio/);
  assert.match(bloco, /No acto de levantamento/);
  const radios = [...bloco.matchAll(/<input[^>]*name="pagarNoLevantamento"[^>]*>/g)].map((m) => m[0]);
  assert.equal(radios.length, 2);
  assert.ok(radios.every((r) => !/\bchecked\b/.test(r)), 'uma das opções vem marcada por omissão');
  assert.ok(radios.some((r) => /\brequired\b/.test(r)), 'escolher quando paga não é obrigatório');
});

/* ---------- C6: termos ---------- */

test('C6: aceitar os termos é obrigatório para enviar', () => {
  assert.match(seccao(2), /name="consentimento"/);
  assert.match(seccao(2), /termos/i);
  assert.match(JS, /if \(!consentCaixa\.checked\)/);
});

test('C6: os termos deixaram de ser um cartão, e o aviso legal fica no rodapé', () => {
  const regra = /\.consent\s*\{([^}]*)\}/.exec(CSS)?.[1] ?? '';
  assert.doesNotMatch(regra, /background/, 'o bloco dos termos voltou a ter fundo de cartão');
  const rodape = /<footer class="rodape">([\s\S]*?)<\/footer>/.exec(HTML)?.[1] ?? '';
  assert.match(rodape, /data-legal="privacidade"/, 'o aviso legal saiu do rodapé');
});
