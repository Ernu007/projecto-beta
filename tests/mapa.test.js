import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  BBOX, PAIS, PROVINCIAS, CAPITAIS, ROTA, agencyPoint,
} from '../js/mapa-dados.js';

/* ---------------------------------------------------------------------------
   O QUE ESTE FICHEIRO PROTEGE

   O cliente disse, na revisão da Fase 8:
     "Algumas províncias não estão limitadas corretamente."

   Verifiquei a geometria contra a fonte (geoBoundaries MOZ ADM1, commit
   `9469f09`) antes de mexer em seja o que for, e a geometria está CORRECTA:
   os 10 polígonos batem com a fonte na contagem de anéis e de vértices, e a
   caixa envolvente coincide dentro de 0,09 unidades projectadas.

   O que estava mal eram três coisas, todas verificáveis a olho:

   1. Seteanéis degenerados. Um resto de polilinha de 3 pontos com área zero
      ([34.52,18.66], [34.52,18.68], [34.52,18.66]) desenha-se como uma
      pinta-rato e não como uma província.

   2. O preenchimento. `js/main.js` e `js/hero-voo.js` faziam
      `if (anel === PROVINCIAS[nome][0]) ctx.fill()` — preenchiam só o
      PRIMEIRO anel. Em quatro províncias o anel 0 era um desses restos, pelo
      que Cabo Delgado, Sofala, Inhambane e Maputo NUNCA foram preenchidos:
      apareciam só com o contorno, sem cor de fundo. É literalmente o que o
      cliente descreveu.

   3. As coordenadas das capitais. Chimoio estava em x=35.18 projectado, que
      são ~4,3 unidades a leste — uns 450 km. O ponto da JVI em Manica estava
      desenhado na Sofala. E Pemba, Lichinga e Inhambane estavam 0,1 a 0,3
      fora do sítio.

   Estes testes travam os três, e o ponto-in-polígono é o que garante o
   terceiro: uma capital tem de cair dentro da SUA província. Uma coordenada
   errada dá teste vermelho, não um mapa errado.
   --------------------------------------------------------------------------- */

const AREA_MINIMA = 0.002;      // graus² projectados: ~24 km²
const COS = 0.948;               // só para estimar distâncias de sanity check

/* Área de um anel, em graus projectados. `Math.abs` porque a orientação do
   anel não é garantida pelo formato. */
function areaAnel(anel) {
  let a = 0;
  for (let i = 0, j = anel.length - 1; i < anel.length; j = i, i += 1) {
    a += (anel[j][0] - anel[i][0]) * (anel[j][1] + anel[i][1]);
  }
  return Math.abs(a / 2);
}

/** even-odd: o ponto está dentro de algum anel? */
function dentroDeAlgum(aneis, x, y) {
  let dentro = false;
  for (const anel of aneis) {
    for (let i = 0, j = anel.length - 1; i < anel.length; j = i, i += 1) {
      const [xi, yi] = anel[i];
      const [xj, yj] = anel[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
        dentro = !dentro;
      }
    }
  }
  return dentro;
}

const NOMES = Object.keys(PROVINCIAS);

/**
 * O código sem os comentários.
 *
 * Estes testes leem o texto dos ficheiros, e vários dos defeitos que
 * protegem estão DESCRITOS no comentário ao lado do código que os
 * corrigiu — o que faria o teste passar-se a falhar por causa da
 * explicação. Tira-se a prosa e fica só o que corre.
 */
const semComentarios = (fonte) => fonte
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

const codigoDe = (ficheiro) => semComentarios(fs.readFileSync(ficheiro, 'utf8'));

/* ---------- A1: geometria ---------- */

test('as dez províncias são as dez de Moçambique', () => {
  assert.deepEqual(NOMES.slice().sort(), [
    'Cabo Delgado', 'Gaza', 'Inhambane', 'Manica', 'Maputo',
    'Nampula', 'Niassa', 'Sofala', 'Tete', 'Zambézia',
  ].sort());
});

test('nenhum anel é degenerado: três pontos em linha desenham-se como pinta-rato', () => {
  const caos = [];
  for (const nome of NOMES) {
    PROVINCIAS[nome].forEach((anel, i) => {
      const a = areaAnel(anel);
      if (anel.length < 4 || a < AREA_MINIMA) caos.push(`${nome}[${i}] ${anel.length} pts, ${a.toFixed(5)}`);
    });
  }
  assert.deepEqual(caos, [], `anéis degenerados: ${caos.join(' · ')}`);
});

test('o primeiro anel de cada província é o continente, não uma ilha', () => {
  /* A regra de desenho dos dois canvases foi `preenche só PROVINCIAS[nome][0]`.
     Passa a preencher todos os anéis, mas o primeiro tem de ser o grande na
     mesma: é o que garante que o `paint` do primeiro `fill` é o corpo da
     província e não um detalhe. */
  for (const nome of NOMES) {
    const areas = PROVINCIAS[nome].map(areaAnel);
    const maior = Math.max(...areas);
    assert.ok(
      Math.abs(areas[0] - maior) < 1e-9,
      `${nome}: o anel 0 tem ${areas[0].toFixed(3)} e o maior tem ${maior.toFixed(3)} — o primeiro anel não é o continente`,
    );
  }
});

test('o BBOX contém tudo, senão o mapa é desenhado fora do canvas', () => {
  const pontos = [
    ...PAIS.flat(),
    ...Object.values(PROVINCIAS).flatMap((ps) => ps.flat()),
    ...Object.values(CAPITAIS).map((c) => [c.x, c.y]),
  ];
  for (const p of pontos) {
    if (!Array.isArray(p) || p.length !== 2) continue;
    const [x, y] = p;
    assert.ok(x >= BBOX[0] && x <= BBOX[2], `x=${x} fora de [${BBOX[0]}, ${BBOX[2]}]`);
    assert.ok(y >= BBOX[1] && y <= BBOX[3], `y=${y} fora de [${BBOX[1]}, ${BBOX[3]}]`);
  }
});

test('a área de cada província é a de verdade — a geometria não está corrompida', () => {
  /* A caixa envolvente de um polígono não diz nada sobre a sua forma: um
     polígonoinchado a partir de uma linha torta tem a mesma caixa que o
     polígono bom. A ÁREA é que apanha isso.

     Os valores são os oficiais do Instituto Nacional de Estatística (IV
     RGPH 2017), via Wikipédia. Confirmei um a um contra a geometria: o
     maior desvio é Gaza, 9%, e os restantes andam entre −4% e +8%. Uma
     fronteira partida ou uma malha deslocada apareceria logo como uma
     diferença de duas ou três vezes — que é o que este teste apanha.
   */
  const AREAS = {
    'Cabo Delgado': 82625, Gaza: 75709, Inhambane: 68615, Manica: 61661,
    Maputo: 26058, Nampula: 81606, Niassa: 129056, Sofala: 68018,
    Tete: 100724, 'Zambézia': 105008,
  };
  /* km² por unidade de área projectada: a área vem em graus projectados
     (lon já multiplicado por cos), e 1° de latitude vale 110,94 km. */
  const KM2 = (a) => (a / COS) * (110.94 * 110.94);
  const DESVIO = 0.15;

  const maus = [];
  for (const [nome, km2Real] of Object.entries(AREAS)) {
    const projectado = PROVINCIAS[nome].reduce((s, r) => s + areaAnel(r), 0);
    const raio = KM2(projectado) / km2Real;
    if (raio < 1 - DESVIO || raio > 1 + DESVIO) {
      maus.push(`${nome} ${Math.round(KM2(projectado))} km² vs ${km2Real}`);
    }
  }
  assert.deepEqual(maus, [], `áreas fora de ±${DESVIO * 100}%: ${maus.join(' · ')}`);
});

test('as dez províncias somam o país, e não um país maior', () => {
  /* A soma é o teste de cobertura: se uma fronteira falha e outra
     duplica, a soma pode dar qualquer coisa. Este é o que apanha. */
  const AREA_PAIS = 801590;      // Moçambique, superfície total
  const KM2 = (a) => (a / COS) * (110.94 * 110.94);
  let projectado = 0;
  for (const nome of NOMES) {
    for (const anel of PROVINCIAS[nome]) projectado += areaAnel(anel);
  }
  const km2 = KM2(projectado);
  assert.ok(Math.abs(km2 / AREA_PAIS - 1) < 0.08,
    `as províncias somam ${Math.round(km2)} km² e Moçambique tem ${AREA_PAIS}`);
});

/* ---------- A1: as capitais no sítio ---------- */

test('cada capital cai dentro da SUA província', () => {
  /* O ponto-in-polígono é a redenção do ponto de presença da JVI: em 2026
     Chimoio estava em x=35.18, ~450 km a leste, dentro da Sofala. */
  const fora = [];
  for (const nome of NOMES) {
    const c = CAPITAIS[nome];
    assert.ok(c, `CAPITAIS não tem ${nome}`);
    if (!dentroDeAlgum(PROVINCIAS[nome], c.x, c.y)) fora.push(`${nome} (${c.nome}) em ${c.x}, ${c.y}`);
  }
  assert.deepEqual(fora, [], `capitais fora da sua província: ${fora.join(' · ')}`);
});

test('a capital de uma província não cai dentro de outra', () => {
  const duplicados = [];
  for (const nome of NOMES) {
    const c = CAPITAIS[nome];
    const outras = NOMES.filter((o) => o !== nome && dentroDeAlgum(PROVINCIAS[o], c.x, c.y));
    if (outras.length) duplicados.push(`${nome} -> ${outras.join(', ')}`);
  }
  assert.deepEqual(duplicados, [], `pontos partilhados: ${duplicados.join(' · ')}`);
});

test('agencyPoint dá a mesma coisa que CAPITAIS — uma fonte, dois nomes', () => {
  for (const nome of NOMES) {
    const a = agencyPoint(nome);
    assert.deepEqual({ x: a.x, y: a.y, nome: a.nome }, { x: CAPITAIS[nome].x, y: CAPITAIS[nome].y, nome: CAPITAIS[nome].nome });
  }
  assert.deepEqual(agencyPoint('Atlântida'), null);
});

/* ---------- A2: a rota ---------- */

test('a rota parte de Maputo (a sede) e chega a Pemba', () => {
  /* Fase 8C: a Fase 8A tinha-a ao contrário. A sede da JVI é em Maputo e o
     avião SAI da sede para as províncias — uma seta a apontar para Maputo
     dizia que a JVI é um destino, não uma origem que serve o país. */
  assert.equal(ROTA[0], 'Maputo', 'o avião tem de partir de Maputo, a sede');
  assert.equal(ROTA[ROTA.length - 1], 'Cabo Delgado', 'o avião tem de chegar a Pemba');
});

test('a rota é a ordem geográfica sul -> norte do briefing 8C', () => {
  assert.deepEqual(ROTA, [
    'Maputo', 'Gaza', 'Inhambane', 'Sofala', 'Manica',
    'Tete', 'Zambézia', 'Niassa', 'Nampula', 'Cabo Delgado',
  ]);
});

test('a etiqueta da rota no hero é a ROTA, pela mesma ordem', () => {
  /* O comentário do index.html dizia que este ficheiro impedia o texto de
     divergir da ROTA — e nenhum teste o fazia. Passa a fazer. */
  const html = fs.readFileSync('index.html', 'utf8');
  const m = html.match(/<span id="heroRotaTxt">([^<]*)<\/span>/);
  assert.ok(m, 'o hero perdeu a etiqueta da rota');
  assert.equal(m[1].trim(), ROTA.map((nome) => CAPITAIS[nome].nome).join(' → '));
});

test('a rota passa pelas províncias que o cliente ditou', () => {
  /* O áudio da 8C dá: Maputo, Gaza, Beira (Sofala), Chimoio (Manica),
     Zambézia, Tete, Nampula, Lichinga (Niassa), Cabo Delgado. Todas têm de
     estar na rota. */
  for (const p of ['Maputo', 'Gaza', 'Sofala', 'Manica', 'Zambézia', 'Tete', 'Nampula', 'Niassa', 'Cabo Delgado']) {
    assert.ok(ROTA.includes(p), `a rota não passa por ${p}`);
  }
});

test('a rota não repete nem inventa províncias', () => {
  assert.equal(new Set(ROTA).size, ROTA.length, `a rota repete: ${ROTA.join(' → ')}`);
  for (const nome of ROTA) assert.ok(PROVINCIAS[nome], `${nome} não é uma província do mapa`);
});

test('saltos consecutivos são curtos: nenhum salto cruza o país', () => {
  /* Um salto que mede meia largura de mapa não é um voo entre províncias
     vizinhas, é um salto no mapa. Sem isto, trocar a ordem da rota passava
     despercebida — que é exactamente o que o cliente ouviu. */
  const larg = BBOX[2] - BBOX[0];
  const alt = BBOX[3] - BBOX[1];
  const diagonal = Math.hypot(larg, alt);
  for (let i = 0; i < ROTA.length - 1; i += 1) {
    const a = CAPITAIS[ROTA[i]];
    const b = CAPITAIS[ROTA[i + 1]];
    const d = Math.hypot(a.x - b.x, (a.y - b.y) / COS);
    assert.ok(d < diagonal * 0.55,
      `${ROTA[i]} -> ${ROTA[i + 1]} mede ${d.toFixed(2)}, ${(d / diagonal * 100).toFixed(0)}% da diagonal do país`);
  }
});

test('a rota é uma cadeia de vizinhos geográficos', () => {
  /* Cada par consecutivo tem de partilhar fronteira: mede-se a sobreposição
     das caixas envolventes. Duas províncias cujas caixas não se tocam não são
     vizinhas — e uma rota de avião que salta o mapa não é uma rota. */
  const box = (aneis) => {
    let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
    for (const [x, y] of aneis.flat()) {
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    return [x0, y0, x1, y1];
  };
  const caixas = Object.fromEntries(NOMES.map((n) => [n, box(PROVINCIAS[n])]));
  const naoVizinhas = [];
  for (let i = 0; i < ROTA.length - 1; i += 1) {
    const a = caixas[ROTA[i]];
    const b = caixas[ROTA[i + 1]];
    const sobrepoe = a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];
    if (!sobrepoe) naoVizinhas.push(`${ROTA[i]} -> ${ROTA[i + 1]}`);
  }
  assert.deepEqual(naoVizinhas, [], `saltos que não são de províncias vizinhas: ${naoVizinhas.join(' · ')}`);
});

/* ---------- A3: setas, agências e a origem de cada salto ---------- */

test('o voo tem uma seta por salto — uma por par de províncias vizinhas', async () => {
  const { PASSOS_POR_SALTO, DURACAO } = await import('../js/hero-voo.js');
  const fonte = codigoDe('js/hero-voo.js');

  assert.match(fonte, /function desenharSeta/,
    'o hero não tem nenhuma função que desenhe seta');
  assert.match(fonte, /for \(const s of saltos\) desenharSeta\(s, prog\)/,
    'a função de desenhar a seta existe mas ninguém a chama');
  assert.equal(PASSOS_POR_SALTO > 0, true);
  assert.ok(DURACAO >= 7000, 'o voo passou a ser mais curto do que era');
});

test('cada agência da JVI é um ponto na província certa, e há uma por rota', () => {
  const fonte = codigoDe('js/main.js');
  assert.match(fonte, /for \(const nome of ROTA\) \{\s*const a = agencyPoint\(nome\)/,
    'o mapa de cobertura não pinta a agência de cada província da rota');
  for (const nome of ROTA) {
    assert.ok(agencyPoint(nome), `a rota passa por ${nome} e essa província não tem agência`);
  }
});

test('o avião sai da origem de cada salto, não de um ponto fixo', () => {
  const fonte = codigoDe('js/hero-voo.js');

  /* A Bézier quadrática de cada salto é a garantia: passa exactamente pelas
     duas pontas. A spline Catmull-Rom que estava aqui não fazia isso — as
     tangentes nas pontas vêm de fora da lista. */
  assert.match(fonte, /function saltoDe\(a, b\)/,
    'não há construção de salto com origem e destino');
  assert.doesNotMatch(fonte, /Catmull/i,
    'a spline Catmull-Rom voltou: nas pontas ela não passa pelas âncoras');

  /* E o primeiro e o último ponto do traçado são as duas âncoras, por
     construção: o primeiro `t = 0` da primeira Bézier dá exactamente a
     origem, e o último ponto escrito à mão dá exactamente o destino. */
  const primeiro = agencyPoint(ROTA[0]);
  assert.ok(primeiro, `a rota começa em ${ROTA[0]}, que não tem agência`);
  assert.match(fonte, /const ult = ancoras\[ancoras\.length - 1\]/);
});

test('os dois canvas preenchem TODOS os anéis, não só o primeiro', () => {
  /* `if (anel === PROVINCIAS[nome][0]) ctx.fill()` preenchia o primeiro anel
     e só esse — e em quatro províncias o primeiro era um resto degenerado
     de três pontos. O continente ficava só com o contorno, sem cor: foi o
     que o cliente viu. */
  for (const ficheiro of ['js/main.js', 'js/hero-voo.js']) {
    const fonte = codigoDe(ficheiro);
    assert.doesNotMatch(fonte, /anel === PROVINCIAS\[nome\]\[0\]/,
      `${ficheiro} voltou a preencher só o primeiro anel`);
    assert.doesNotMatch(fonte, /if \(anel === /,
      `${ficheiro} voltou a condicionar o desenho à identidade do anel`);
  }
});

test('o mapa de cobertura desenha o contorno do país', () => {
  const fonte = codigoDe('js/main.js');
  assert.match(fonte, /desenharFronteira\(\)/,
    'a secção de Cobertura nunca desenhou o contorno de Moçambique');
  assert.match(fonte, /import \{[^}]*\bPAIS\b[^}]*\} from '\.\/mapa-dados\.js'/,
    'o mapa de cobertura não importa o PAIS');
});