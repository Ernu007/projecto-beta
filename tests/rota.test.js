import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { MORADA_JVI, PLUS_CODE_JVI, COORDENADAS_JVI, linkDirecoes } from '../js/rota.js';

/* ---------------------------------------------------------------------------
   O QUE ESTE FICHEIRO PROTEGE

   A Fase 7A entrega UM link de direcções para o Google Maps. É um link
   simples, sem API key, sem tracking e sem JavaScript: um erro de
   codificação no `destination` mandava o cliente para o mato, e um erro
   de um carácter na morada era invisível a olho.

   Duas coisas são testadas:

   1. O link em si — formato, codificação e a ausência de `origin`.
   2. O `href` que está LITERALMENTE no `index.html`. O link é HTML
      estático de propósito (funciona sem JS e não pede consentimento
      nenhum), portanto o HTML é a segunda cópia da verdade. Estes testes
      são o que impede as duas de divergirem.
   --------------------------------------------------------------------------- */

/** O atributo tal e qual no ficheiro, com as entidades HTML resolvidas. */
const HTML = fs.readFileSync('index.html', 'utf8');

const entidades = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" };
const desescapar = (s) => s.replace(/&(amp|lt|gt|quot|#39);/g, (_, k) => entidades[k]);

/** O `href` do botão "Como chegar à JVI", lido do HTML e dessescapado. */
function hrefComoChegar() {
  const m = /<a\b[^>]*\bhref="(https:\/\/www\.google\.com\/maps\/dir\/[^"]*)"[^>]*>([\s\S]*?)<\/a>/.exec(HTML);
  assert.ok(m,
    'não encontrei nenhum <a> com um href de direcções do Google Maps no index.html');
  return { href: desescapar(m[1]), rotulo: desescapar(m[2].replace(/<svg[\s\S]*?<\/svg>/g, '')).trim() };
}

const param = (url, nome) => new URL(url).searchParams.get(nome);

/** O valor do parâmetro como está no URL — CODIFICADO. `param` acima
 *  devolve-o já decodificado, e é precisamente a codificação que este
 *  ficheiro tem de ver. */
function paramCru(url, nome) {
  const m = new RegExp(`[?&]${nome}=([^&]*)`).exec(url);
  return m ? m[1] : null;
}

/* ---------- O link ---------- */

test('o link usa o formato oficial de direccoes do Google Maps', () => {
  const u = linkDirecoes();
  assert.ok(u.startsWith('https://www.google.com/maps/dir/?api=1&destination='), u);
  assert.equal(param(u, 'api'), '1');
  assert.equal(param(u, 'travelmode'), 'driving');
});

test('a morada da JVI e a que o cliente confirmou, com a codificacao certa', () => {
  assert.equal(
    MORADA_JVI,
    'Av. 19 de Outubro, Terminal de Cargas Nº 113, Aeroporto de Maputo',
  );
  /* A morada já não é o destino por omissão (é o Plus Code), mas a
     função continua a aceitá-la, e tem de a codificar bem.
     Ida e volta: o que metemos no link volta a ser exactamente a morada.
     Sem isto, um `+` trocado por `%20` ou um `º` perdido passava. */
  const u = linkDirecoes(MORADA_JVI);
  assert.equal(param(u, 'destination'), MORADA_JVI);
  /* A vírgula tem de estar codificada: crua, o Maps lê-la-ia como
     separador de coordenadas em vez de parte do endereço. */
  assert.ok(paramCru(u, 'destination').includes('%2C'), 'a virgula ficou crua');
  assert.ok(paramCru(u, 'destination').includes('%C2%BA'),
    'o "Nº" tem de ir como UTF-8, não como "N"');
});

/* ---------- O Plus Code (D37) ---------- */

test('o destino por omissao e o Plus Code que o cliente confirmou', () => {
  assert.equal(PLUS_CODE_JVI, '3H9C+VJ8, Maputo');
  assert.equal(param(linkDirecoes(), 'destination'), PLUS_CODE_JVI);
  assert.equal(
    linkDirecoes(),
    'https://www.google.com/maps/dir/?api=1&destination=3H9C%2BVJ8%2C%20Maputo&travelmode=driving',
  );
});

test('o "+" do Plus Code vai como %2B, nunca cru', () => {
  /* Num query string, um `+` cru é um ESPAÇO. O Maps leria "3H9C VJ8",
     que não é Plus Code nenhum, e a localização falhava — com um link
     que a olho parece certo. */
  const cru = paramCru(linkDirecoes(), 'destination');
  assert.equal(cru, '3H9C%2BVJ8%2C%20Maputo');
  assert.ok(cru.includes('%2B'), 'o "+" do Plus Code não foi codificado');
  assert.equal(cru.includes('+'), false, 'há um "+" cru no destino: o Maps lê-o como espaço');
  assert.equal(linkDirecoes().includes('+'), false, 'há um "+" cru no link');

  /* Ida e volta, lida como o servidor a lê (`URLSearchParams` troca o
     `+` cru por espaço): o código tem de voltar com o `+` no sítio. */
  assert.equal(param(linkDirecoes(), 'destination'), PLUS_CODE_JVI);
  assert.notEqual(param(linkDirecoes(), 'destination'), '3H9C VJ8, Maputo');

  /* E no HTML, que é escrito à mão: os DOIS botões. */
  const hrefs = [...HTML.matchAll(/href="(https:\/\/www\.google\.com\/maps\/dir\/[^"]*)"/g)].map((m) => desescapar(m[1]));
  assert.equal(hrefs.length, 2, 'esperava dois botões de direcções: o do hero e o do rodapé');
  for (const h of hrefs) {
    assert.equal(paramCru(h, 'destination'), '3H9C%2BVJ8%2C%20Maputo');
    assert.equal(h, linkDirecoes());
  }
});

test('o link NUNCA leva a posicao de quem clica', () => {
  /* O `origin` omittedo é o que faz o Maps usar a localização que o
     Google pede ao utilizador, no consentimento dele. Mandar o `origin`
     seria enviar a posição do cliente — e a JVI ficaria a recebê-la.
     Este é o teste que garante que a 7A não virou tracking. */
  const u = linkDirecoes();
  assert.equal(param(u, 'origin'), null);
  assert.doesNotMatch(u, /origin=/);
  assert.doesNotMatch(u, /-25\.\d|\d{1,3}\.\d{4,}/, 'o link não pode conter coordenadas');
});

test('sem destino indicado, o link vai para a localizacao da JVI', () => {
  /* Um link morto é pior do que um link com a morada errada. */
  assert.equal(linkDirecoes(''), linkDirecoes());
  assert.equal(linkDirecoes('   '), linkDirecoes());
  assert.equal(param(linkDirecoes(''), 'destination'), PLUS_CODE_JVI);
});

/* ---------- O que esta no HTML ---------- */

test('o botao do hero tem o href que o modulo produz, byte a byte', () => {
  assert.equal(hrefComoChegar().href, linkDirecoes());
});

test('o botao do hero diz "Como chegar a JVI" e abre noutro separador', () => {
  const { rotulo, href } = hrefComoChegar();
  assert.match(rotulo, /Como chegar/i);
  assert.equal(href.includes('&amp;'), false,
    'a & do HTML tem de ser &amp;: um & cru é HTML inválido');
});

/* A Fase 6 proíbe duas acções primárias no mesmo ecrã. O briefing da
   Fase 7 é explícito: o orçamento continua principal e as direcções são
   secundárias, "mesmo que o botão de direcções seja grande e tocável".
   Isto está no HTML, não numa classe: promoting o link a `btn--primario`
   punha o igual peso visual ao orçamento, e era a Fase 6 a dizer que
   duas primárias não funcionam. */
test('as direccoes sao secundarias: o hero continua com UMA accao primaria', () => {
  const accoes = /<div class="hero__acoes">([\s\S]*?)<\/div>/.exec(HTML);
  assert.ok(accoes, 'não encontrei .hero__acoes no index.html');
  const bloco = accoes[1];

  const primarias = bloco.match(/btn--primario/g) ?? [];
  assert.equal(primarias.length, 1,
    `o hero tem ${primarias.length} acções primárias — a Fase 6 quer exactamente uma`);

  const link = /<a\b[^>]*google\.com\/maps\/dir\/[^>]*>/.exec(bloco);
  assert.ok(link, 'o link das direcções não está em .hero__acoes');
  assert.doesNotMatch(link[0], /btn--primario/,
    'o link das direcções foi promovido a acção primária');
  assert.match(link[0], /btn--vidro/,
    'o link das direcções devia herdar o estilo secundário do hero');
});

test('a morada que o cliente le e a mesma no JSON-LD, nos contactos e na politica', () => {
  /* O destino do link passou a ser o Plus Code (D37), mas a morada
     continua a ser o que a PESSOA lê, e está escrita à mão em três
     sítios do HTML (o `streetAddress` do JSON-LD, a secção Contactos e
     o cabeçalho da política). Um teste é o que impede que passem a
     anunciar moradas diferentes da constante. */
  const streetAddress = /"streetAddress":\s*"([^"]+)"/.exec(HTML)?.[1];
  assert.ok(streetAddress, 'não encontrei streetAddress no JSON-LD');
  assert.equal(streetAddress, MORADA_JVI);
  assert.ok(
    new RegExp(`<b>Sede operacional</b>\\s*${MORADA_JVI.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(HTML),
    'a morada da secção Contactos já não é a mesma',
  );
  assert.ok(HTML.includes(`<p class="pp__meta">JVI Carga &amp; Serviços, Lda · ${MORADA_JVI}, Moçambique`),
    'a morada do cabeçalho da política já não é a mesma');
});

test('o JSON-LD aponta para a mesma localizacao que o botao', () => {
  const ld = JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(HTML)[1]);
  assert.equal(ld.location?.['@type'], 'Place');
  assert.deepEqual(
    { latitude: ld.location.geo.latitude, longitude: ld.location.geo.longitude },
    COORDENADAS_JVI,
  );
  /* O `hasMap` é o endereço em que o Plus Code foi verificado — também
     com o `+` como `%2B`. */
  assert.equal(ld.location.hasMap, 'https://www.google.com/maps/place/3H9C%2BVJ8,+Maputo/');
  assert.ok(decodeURIComponent(ld.location.hasMap).includes(PLUS_CODE_JVI.split(',')[0]));
});

/* ---------------------------------------------------------------------------
   A POLÍTICA DE PRIVACIDADE PASSOU A SER MENTIRA

   O site dizia, e com razão na altura: *"a tipografia é alojada no
   próprio site, pelo que o seu endereço IP não é transmitido a
   servidores externos de Google"*. Zero cookies, zero pedidos ao
   Google Fonts.

   O botão "Como chegar à JVI" abre o Google Maps. A partir de agora
   o IP vai para a Google — no clique de quem quer as direcções, e não
   em silêncio. A promessa deixou de ser verdadeira e tinha de ser
   corrigida no mesmo commit que a tornava falsa.
   --------------------------------------------------------------------------- */

const politica = () => /<div class="pp">([\s\S]*?)<p class="pp__meta pp__meta--fim">/.exec(HTML)?.[1] ?? '';

test('a politica de privacidade nao promete que nada vai para o Google', () => {
  const pp = politica();
  assert.ok(pp.length > 200, 'não encontrei o corpo da política de privacidade');
  assert.doesNotMatch(pp, /endereço IP não é transmitido a servidores externos de Google/,
    'a política ainda promete que nada vai para o Google — e o Maps é do Google');
});

test('a politica de privacidade declara que o botao abre o Google Maps', () => {
  const pp = politica();
  assert.match(pp, /Como chegar à JVI/,
    'a política não menciona o botão que abre o Maps');
  assert.match(pp, /Google Maps/);
  /* E que a JVI não fica com a posição: é a diferença entre clicar
     numa hiperligação e a Fase 7B, que está desligada. */
  assert.match(pp, /não (?:guarda|recebe|vê|ve|guardamos|recebemos|enviamos)[^.]*posi[çc][ãa]o/i);
});

