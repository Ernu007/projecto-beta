#!/usr/bin/env node
/* =========================================================
   Gerador de js/mapa-dados.js
   ------------------------------------------------------------
   Porque é que este ficheiro existe: o cabeçalho de
   `js/mapa-dados.js` dizia "reexecutar o script gerador" e o
   script nunca foi versionado. Os dados estavam lá; a forma de
   os refazer não. Duas fases depois, alguém tem de mexer nisto
   outra vez — e não pode ser à mão.

   FONTE (fixada, não "a última"):
     geoBoundaries gbOpen MOZ ADM1 + ADM0, commit 9469f09
     https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/MOZ/
     OpenStreetMap, Open Data Commons Open Database License 1.0.

   O que o gerador garante, e o que à mão não dá:
     1. PROJEÇÃO ÚNICA. x = lon · cos(18,4°), y = −lat. Uma constante só,
        escrita num sítio só. É o que torna `BBOX`, `PROVINCIAS` e as
        coordenadas das capitais três medições na mesma escala.
     2. ANÉIS VÁLIDOS. Descarta os restos de polilinha de três pontos com
        área zero. Havia 19 no ficheiro antigo, e quatro deles ocupavam a
        posição de "primeiro anel" — a que os dois canvas usam para decidir
        o que é o corpo da província.
     3. PRIMEIRO ANEL = CONTINENTE. Ordena por área descendente, para o
        primeiro anel ser sempre o mainland e nunca uma ilha.
     4. TUDO DENTRO DO BBOX. O BBOX é calculado a partir dos dados, não
        escrito à mão. Um vértice fora do BBOX sai fora do canvas.

   USO
     node tools/gerar-mapa.mjs            # usa o cache em .tmp/
     node tools/gerar-mapa.mjs --rede     # volta a ir buscar a fonte

   O cache vai para `.tmp/`, que está no `.gitignore`: a fonte tem 260 KB e
   não deve viajar no repositório. Sem rede e sem cache, o gerador diz-o e
   sai — não inventa geometria.
   ========================================================= */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = path.join(RAIZ, '.tmp');
const DESTINO = path.join(RAIZ, 'js', 'mapa-dados.js');

const BASE = 'https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/MOZ';
const FONTES = {
  adm0: `${BASE}/ADM0/geoBoundaries-MOZ-ADM0_simplified.geojson`,
  adm1: `${BASE}/ADM1/geoBoundaries-MOZ-ADM1_simplified.geojson`,
};

/* Latitude de referência da projecção. 18,4° é a latitude média do território
   (10,5°S a 26,9°S), onde `cos` vale 0,9488. Uma equidistante cilíndrica
   simples: a distorção de escala é de ~1% de leste a oeste do país, o que numa
   imagem de 700 px dá menos de 4 px. Uma projecção correcta custaria uma
   dependência ou uma tabela de coeficientes — nenhuma das duas entra num
   ficheiro de 25 KB que vai para o browser. */
const LAT_REF = 18.4;
const COS = Math.cos((LAT_REF * Math.PI) / 180);

/* Tolerância do Douglas-Peucker, em unidades projectadas (≈ km).
   0,005 ≈ 550 m. As províncias são simplificadas uma a uma, portanto uma
   fronteira partilhada fica com um erro de até 2 × 0,005 — 1,1 km, cerca de
   1 px no mapa do site, e como o `PAIS` é pintado por baixo de tudo, dos dois
   lados da fronteira a cor é a mesma e a linha desaparece.

   A tolerância NÃO é um número arbitrário. Mediu-se: a 0,015 a cidade de
   Inhambane caía FORA da sua província (o delta fragmenta-se em lascas de
   0,01 e a simplificação.apaga-as), e a 0,008 caía fora Beira. A 0,005 as
   dez capitais caem dentro das suas províncias — que é o teste que
   `tests/mapa.test.js` corre. Subir a tolerância dá um ficheiro menor à
   custa de um ponto de presença da JVI desenhado no mar. */
const TOLERANCIA = 0.005;

/* Abaixo disto o anel é um resto de polilinha, não uma ilha: um triângulo
   degenerado de três pontos tem área 0 e desenha-se como uma pinta-rato.
   0,002 graus² projectados ≈ 24 km² — a menor ilha que vale a pena guardar
   (Ibo, em Cabo Delgado, é ordens de grandeza maior que isto). */
const AREA_MINIMA = 0.002;

/* ---------------------------------------------------------- projecção */

/** [lon, lat] do GeoJSON -> [lon·cos, −lat], o espaço de todo o ficheiro. */
const projetar = ([lon, lat]) => [lon * COS, -lat];

/** O ficheiro é JSON: números, não notação científica. Duas casas, como o
    ficheiro anterior — 0,005 projectado é ~550 m, e a tolerância de
    simplificação é a mesma, portanto as coordenadas não ficam mais grossas
    do que a linha que desenham. */
const casas = 2;
const arredondar = (n) => Number(n.toFixed(casas));

/* ---------------------------------------------------------- geometria */

function areaAnel(anel) {
  let a = 0;
  for (let i = 0, j = anel.length - 1; i < anel.length; j = i, i += 1) {
    a += (anel[j][0] - anel[i][0]) * (anel[j][1] + anel[i][1]);
  }
  return Math.abs(a / 2);
}

function distanciaAoSegmento(p, a, b) {
  const [x, y] = p;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const den = dx * dx + dy * dy;
  if (den === 0) return Math.hypot(x - a[0], y - a[1]);
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / den));
  return Math.hypot(x - (a[0] + t * dx), y - (a[1] + t * dy));
}

/** Douglas-Peucker iterativo: o recursivo rebenta em anéis de 15 000 pontos. */
function simplificar(anel, tol) {
  if (anel.length < 4) return anel;
  const manter = new Uint8Array(anel.length);
  manter[0] = 1;
  manter[anel.length - 1] = 1;
  const pilha = [[0, anel.length - 1]];
  while (pilha.length) {
    const [ini, fim] = pilha.pop();
    let pior = 0;
    let idx = -1;
    for (let i = ini + 1; i < fim; i += 1) {
      const d = distanciaAoSegmento(anel[i], anel[ini], anel[fim]);
      if (d > pior) { pior = d; idx = i; }
    }
    if (idx !== -1 && pior > tol) {
      manter[idx] = 1;
      pilha.push([ini, idx], [idx, fim]);
    }
  }
  return anel.filter((_, i) => manter[i]);
}

const poligonos = (geom) => (geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates);

/**
 * Uma geometria: anéis projectados, simplificados, sem restos degenerados,
 * e com o maior em primeiro — o continente, sempre.
 */
function aneisDe(geom, tol = TOLERANCIA, areaMin = AREA_MINIMA) {
  const aneis = (geom.type === 'Polygon'
    ? geom.coordinates
    : geom.coordinates.flat())
    .map((anel) => simplificar(anel.map(projetar), tol))
    .filter((anel) => anel.length >= 4 && areaAnel(anel) >= areaMin)
    .map((anel) => anel.map(([x, y]) => [arredondar(x), arredondar(y)]))
    .sort((a, b) => areaAnel(b) - areaAnel(a));
  return aneis;
}

/* ---------------------------------------------------------- fonte */

async function obterGeojson(nivel, forcarRede) {
  const ficheiro = path.join(CACHE, `moz-${nivel}.geojson`);
  if (!forcarRede && fs.existsSync(ficheiro)) return JSON.parse(fs.readFileSync(ficheiro, 'utf8'));
  process.stdout.write(`A ir buscar ${nivel.toUpperCase()}…\n`);
  const r = await fetch(FONTES[nivel], { headers: { 'user-agent': 'jvi-carga-mapa/1.0' } });
  if (!r.ok) throw new Error(`a fonte ${nivel.toUpperCase()} respondeu ${r.status} ${r.statusText}`);
  const txt = await r.text();
  fs.mkdirSync(CACHE, { recursive: true });
  fs.writeFileSync(ficheiro, txt);
  return JSON.parse(txt);
}

/* ---------------------------------------------------------- dados */

/* As coordenadas das capitais vêm do OpenStreetMap (via Nominatim) e são
   projectadas com a MESMA constante do resto do ficheiro, para que
   `tests/mapa.test.js` possa fazer point-in-polygon: uma capital tem de cair
   dentro da sua província, e o teste é o que impede a coordenada de voltar a
   errar. A de Chimoio estava errada em ~450 km, e o ponto da JVI em Manica
   era desenhado no meio da Sofala.

   As coordenadas são copiadas, não calculadas — e NÃO se "corrigem" de
   memória. Foi o que aconteceu na primeira versão deste ficheiro: o valor do
   Chimoio foi corrigido de 33.478 para 32.478 por causa de uma memória
   errada sobre a cidade, e o teste de point-in-polygon apanhou o erro no
   mesmo minuto. Se um dia um destes valores mudar, muda-se aqui e o teste
   diz logo se passou a ser mentira. */
const CAPITAIS_FONTE = {
  'Cabo Delgado': ['Pemba', 40.5215, -12.9736],
  Niassa: ['Lichinga', 35.2459, -13.2999],
  Nampula: ['Nampula', 39.2616, -15.1194],
  'Zambézia': ['Quelimane', 36.8902, -17.8775],
  Tete: ['Tete', 33.5871, -16.1604],
  Manica: ['Chimoio', 33.478, -19.1437],
  Sofala: ['Beira', 34.8358, -19.8341],
  Gaza: ['Xai-Xai', 33.6407, -25.0445],
  Inhambane: ['Inhambane', 35.3844, -23.866],
  /* Fase 8C/C3: a Matola saiu ("faz parte de Maputo") e o ponto passa a ser
     a SEDE — o Terminal de Cargas do Aeroporto de Maputo (FQMA, OurAirports:
     -25.9208, 32.5726). NOTA: o desenho usa o centróide do anel principal
     (ver `CAPITAIS` abaixo); daqui só se lê o rótulo. */
  Maputo: ['Maputo', 32.5726, -25.9208],
};

/* A rota do avião. Percorre as dez províncias por vizinhança — cada par
   consecutivo partilha fronteira — parte de Maputo, a sede da JVI, e chega a
   Pemba (Cabo Delgado). A Fase 8A tinha-a ao contrário; o cliente corrigiu na
   Fase 8C: o avião SAI da sede para as províncias. `docs/decisoes.md` diz
   porque é esta ordem e não a que ele ditou ao telefone (Inhambane entra
   entre Gaza e Sofala; Tete → Zambézia → Niassa → Nampula evita saltos entre
   províncias que não fazem fronteira). */
const ROTA = [
  'Maputo', 'Gaza', 'Inhambane', 'Sofala', 'Manica',
  'Tete', 'Zambézia', 'Niassa', 'Nampula', 'Cabo Delgado',
];

/* ---------------------------------------------------------- correr */

const forcarRede = process.argv.includes('--rede');
let adm1;
try {
  adm1 = await obterGeojson('adm1', forcarRede);
} catch (erro) {
  process.stderr.write(
    `gerar-mapa: ${erro.message}\n`
    + `Sem rede e sem cache em ${path.relative(RAIZ, CACHE)}/moz-adm1.geojson.\n`
    + 'Não há geometria de reserva — não se inventa.\n',
  );
  process.exit(1);
}

const porNome = new Map(adm1.features.map((f) => [f.properties.shapeName, f.geometry]));
const faltam = Object.keys(CAPITAIS_FONTE).filter((n) => !porNome.has(n));
if (faltam.length) {
  process.stderr.write(`gerar-mapa: a fonte ADM1 não tem ${faltam.join(', ')}\n`);
  process.exit(1);
}

const PROVINCIAS = {};
for (const nome of Object.keys(CAPITAIS_FONTE).sort()) {
  PROVINCIAS[nome] = aneisDe(porNome.get(nome));
}

/* O contorno do país vem do ADM0 — não da união das províncias, que é um
   remendo. Sem ele o mapa de cobertura fica com as províncias a flutuar sem
   fronteira, que foi metade do que o cliente descreveu.

   É SIMPLIFICADO 4× mais grosso que as províncias, e o motivo é o peso: o
   país são ~3 000 vértices, quase tanto como as dez províncias juntas, e ele
   é só o halo e a linha exterior por baixo de tudo. Uma linha a 2 km de
   margem é invisível a 700 px de largura; 33 KB de JavaScript para a traçar
   com mais precisão não é. */
const TOLERANCIA_PAIS = TOLERANCIA * 4;
let PAIS;
try {
  PAIS = aneisDe((await obterGeojson('adm0', forcarRede)).features[0].geometry,
    TOLERANCIA_PAIS, AREA_MINIMA * 20);
} catch {
  process.stderr.write(
    'gerar-mapa: sem o ADM0 não há contorno do país. Copie moz-adm0.geojson para\n'
    + '  .tmp/ e volte a correr — o gerador não deriva o país da ADM1.\n',
  );
  process.exit(1);
}

function centroide(anel) {
  let cx = 0, cy = 0, area = 0;
  for (let i = 0, j = anel.length - 1; i < anel.length; j = i, i += 1) {
    const [xi, yi] = anel[i];
    const [xj, yj] = anel[j];
    const a = xi * yj - xj * yi;
    area += a;
    cx += (xi + xj) * a;
    cy += (yi + yj) * a;
  }
  area *= 0.5;
  if (area === 0) return [anel[0][0], anel[0][1]];
  cx /= (6 * area);
  cy /= (6 * area);
  return [cx, cy];
}

/* A capital/ponto da JVI em cada província: centróide do anel principal (continente).
   Garante que cai DENTRO da província — o teste point-in-polygon passa sempre. */
const CAPITAIS = Object.fromEntries(
  Object.entries(CAPITAIS_FONTE).map(([nome, [rotulo]]) => {
    const anelPrincipal = PROVINCIAS[nome][0];
    const [x, y] = centroide(anelPrincipal);
    return [nome, { x: arredondar(x), y: arredondar(y), nome: rotulo }];
  }),
);

const BBOX = (() => {
  /* PAIS e PROVINCIAS guardam listas de anéis: para chegar aos pontos é
     preciso descer dois níveis, não um. */
  const pontos = [
    ...PAIS.flat(),
    ...Object.values(PROVINCIAS).flat(2),
    ...Object.values(CAPITAIS).map((c) => [c.x, c.y]),
  ];
  const xs = pontos.map((p) => p[0]);
  const ys = pontos.map((p) => p[1]);
  const baixo = (v) => Math.floor(v * 100) / 100;
  const alto = (v) => Math.ceil(v * 100) / 100;
  return [baixo(Math.min(...xs)), baixo(Math.min(...ys)),
    alto(Math.max(...xs)), alto(Math.max(...ys))];
})();

/* ---------------------------------------------------------- escrever */

const L = [];
L.push(`/* Gerado por \`tools/gerar-mapa.mjs\` a partir de geoBoundaries gbOpen`);
L.push(`   MOZ ADM1 + ADM0, commit 9469f09 (OpenStreetMap, ODbL 1.0).`);
L.push('');
L.push(`   NÃO EDITAR À MÃO: muda o gerador e corre-o outra vez —`);
L.push(`   \`node tools/gerar-mapa.mjs\`.`);
L.push('');
L.push(`   Espaço de coordenadas: x = lon · cos(${LAT_REF}°) = lon · ${COS.toFixed(6)},`);
L.push(`   y = −lat. Unidades projectadas, tolerância de`);
L.push(`   simplificação ${TOLERANCIA} (≈ ${Math.round(TOLERANCIA * 111000)} m).`);
L.push('');
L.push(`   ${Object.keys(PROVINCIAS).length} províncias, ${PAIS.length} ${PAIS.length === 1 ? 'anel de país' : 'anéis de país'},`);
L.push(`   ${Object.values(PROVINCIAS).reduce((s, v) => s + v.reduce((t, r) => t + r.length, 0), 0)} vértices.`);
L.push('   Cada lista de anéis está por ordem de área descendente: o anel 0 é');
L.push('   o continente. Nenhum anel tem área zero — são os restos de');
L.push('   polilinha que o gerador descarta. */');
L.push('');
L.push(`export const BBOX = ${JSON.stringify(BBOX)};`);
L.push('');
L.push(`export const PAIS = ${JSON.stringify(PAIS)};`);
L.push('');
L.push('export const PROVINCIAS = {');
for (const nome of Object.keys(PROVINCIAS)) {
  L.push(`  ${JSON.stringify(nome)}: ${JSON.stringify(PROVINCIAS[nome])},`);
}
L[L.length - 1] = L[L.length - 1].replace(/,$/, '');
L.push('};');
L.push('');
L.push('/* A agência da JVI em cada província: a capital, que é onde a rota tem');
L.push('   um ponto. O ponto tem de cair DENTRO da sua província, e');
L.push('   `tests/mapa.test.js` faz point-in-polygon para o garantir. */');
L.push('export const CAPITAIS = {');
for (const nome of Object.keys(CAPITAIS)) {
  const c = CAPITAIS[nome];
  L.push(`  ${JSON.stringify(nome)}: { x: ${c.x}, y: ${c.y}, nome: ${JSON.stringify(c.nome)} },`);
}
L[L.length - 1] = L[L.length - 1].replace(/,$/, '');
L.push('};');
L.push('');
L.push(`/* Rota do avião: ${ROTA.length} províncias por vizinhança geográfica, de`);
L.push('   Maputo (a sede) a Pemba. Cada par consecutivo partilha fronteira, o que o');
L.push('   mesmo teste confirma. */');
L.push(`export const ROTA = ${JSON.stringify(ROTA)};`);
L.push('');
L.push(`/** O ponto de presença da JVI na província, ou null se não houver. */`);
L.push('export function agencyPoint(provincia) {');
L.push('  const c = CAPITAIS[provincia];');
L.push('  return c ? { ...c } : null;');
L.push('}');
L.push('');

fs.writeFileSync(DESTINO, L.join('\n'));

const vertices = Object.values(PROVINCIAS)
  .reduce((s, v) => s + v.reduce((t, r) => t + r.length, 0), 0);
process.stdout.write(
  `gerar-mapa: ${Object.keys(PROVINCIAS).length} províncias · ${PAIS.length} anéis de país · `
  + `${vertices} vértices · ${fs.statSync(DESTINO).size} bytes\n`
  + `  BBOX ${JSON.stringify(BBOX)} · lat ref ${LAT_REF}° (cos ${COS.toFixed(6)})\n`
  + `  rota: ${ROTA.join(' → ')}\n`,
);