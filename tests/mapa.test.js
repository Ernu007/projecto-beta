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

test('9.3: o hero não tem o cartão com a lista de nomes — o mapa já os escreve', () => {
  /* Fase 9 (9.3). O cliente: "renova esse card que vem escrito os nomes das
     províncias, não vejo a necessidade de ter! Pois as províncias já estão
     escritas no mapa!" Era a etiqueta `.hero__rota`, com as dez cidades da
     rota por extenso, e este teste obrigava-a a acompanhar a `ROTA`. A
     remoção é intencional: o teste passa a impedir que ela volte. */
  const html = fs.readFileSync('index.html', 'utf8');
  const hero = /<section class="hero" id="hero">([\s\S]*?)<\/section>/.exec(html)?.[1];
  assert.ok(hero, 'não encontrei o hero');
  assert.doesNotMatch(html, /heroRota|hero__rota/, 'o cartão da rota continua no HTML');
  const lista = ROTA.map((nome) => CAPITAIS[nome].nome).join(' → ');
  assert.ok(!hero.replace(/<!--[\s\S]*?-->/g, '').includes(' → '),
    `o hero continua a ter uma lista de nomes por extenso (era "${lista}")`);

  /* E quem escreve os nomes é o canvas: a província e a cidade de cada
     agência, em `js/hero-voo.js`. */
  const fonte = codigoDe('js/hero-voo.js');
  assert.match(fonte, /ctx\.fillText\(nome\.toUpperCase\(\)/, 'o mapa do hero deixou de escrever as províncias');
  assert.match(fonte, /ctx\.fillText\(a\.nome,/, 'o mapa do hero deixou de escrever as cidades');

  /* Sem cartão não sobra CSS dele, nem a reserva de espaço que ele pedia. */
  const css = fs.readFileSync('css/styles.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ');
  assert.doesNotMatch(css, /hero__rota|pulsaPonto/, 'ficou CSS do cartão removido');
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
  assert.match(fonte, /for \(const s of saltos\) desenharSeta\(s, estado\)/,
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
/* ---------- Fase 9 (9.2): o voo é de ida e volta, em loop infinito ---------- */

/* O cliente: "ao chegar a Cabo Delgado, ele contorna e volta fazendo o mesmo
   percurso, saindo de lá para Maputo, criando um loop infinito."

   Até aqui o voo fazia Maputo -> Pemba e TERMINAVA (`parar = true`). O que
   se fixa aqui é o estado do voo em função do tempo — `estadoVoo` é pura, e
   por isso testa-se sem canvas — e as duas coisas que um loop infinito
   estraga se forem esquecidas: o avião a voar de cauda na volta, e o canvas
   a pintar para sempre fora do ecrã (o desperdício que o commit 1088b90
   tirou do mapa de cobertura). */

const voo = await import('../js/hero-voo.js');
const TAU = Math.PI * 2;
/** Diferença entre dois ângulos, em [0, π]. */
const afastamento = (a, b) => {
  const d = (((a - b) % TAU) + TAU) % TAU;
  return Math.min(d, TAU - d);
};

test('9.2: a ida vai de Maputo a Cabo Delgado e a volta desfaz o mesmo percurso', () => {
  const { estadoVoo, DURACAO } = voo;
  assert.equal(typeof estadoVoo, 'function', 'o hero-voo.js não exporta estadoVoo');

  const partida = estadoVoo(0);
  assert.deepEqual([partida.perna, partida.sentido, partida.pos], [0, 1, 0]);

  const meiaIda = estadoVoo(DURACAO / 2);
  assert.equal(meiaIda.sentido, 1);
  assert.ok(Math.abs(meiaIda.pos - 0.5) < 1e-9);

  assert.ok(estadoVoo(DURACAO - 1).pos > 0.999, 'a ida não chega a Cabo Delgado');

  /* A volta: a mesma posição no percurso, percorrida ao contrário. */
  const meiaVolta = estadoVoo(DURACAO * 1.5);
  assert.deepEqual([meiaVolta.perna, meiaVolta.sentido], [1, -1]);
  assert.ok(Math.abs(meiaVolta.pos - 0.5) < 1e-9);
  for (const f of [0.1, 0.3, 0.7, 0.9]) {
    const ida = estadoVoo(DURACAO * f).pos;
    const volta = estadoVoo(DURACAO * (2 - f)).pos;
    assert.ok(Math.abs(ida - volta) < 1e-9,
      `a volta não passa pelo mesmo sítio da ida (${ida} vs ${volta})`);
  }
  assert.ok(estadoVoo(DURACAO * 2 - 1).pos < 0.001, 'a volta não chega a Maputo');
});

test('9.2: o voo não acaba — repete, e não dá saltos nas viragens', () => {
  const { estadoVoo, DURACAO } = voo;

  /* Depois da volta recomeça em Maputo, outra vez para norte. */
  const segunda = estadoVoo(DURACAO * 2);
  assert.deepEqual([segunda.perna, segunda.sentido, segunda.pos], [2, 1, 0]);

  /* Mil ciclos depois continua a ser um voo, e não um avião parado em Pemba. */
  const longe = estadoVoo(DURACAO * 2001.5);
  assert.equal(longe.sentido, -1);
  assert.ok(Math.abs(longe.pos - 0.5) < 1e-6);

  /* Nas duas pontas o avião não se teletransporta: o milissegundo antes e o
     milissegundo depois da viragem estão no mesmo sítio. */
  for (const k of [1, 2, 3, 4]) {
    const antes = estadoVoo(DURACAO * k - 1).pos;
    const depois = estadoVoo(DURACAO * k + 1).pos;
    assert.ok(Math.abs(antes - depois) < 0.001, `salto na viragem ${k}: ${antes} -> ${depois}`);
  }

  /* E em cada perna só anda num sentido. */
  let anterior = -1;
  for (let ms = 0; ms < DURACAO; ms += DURACAO / 200) {
    const { pos } = estadoVoo(ms);
    assert.ok(pos >= anterior, 'a ida recua');
    anterior = pos;
  }
  anterior = 2;
  for (let ms = DURACAO; ms < DURACAO * 2; ms += DURACAO / 200) {
    const { pos } = estadoVoo(ms);
    assert.ok(pos <= anterior, 'a volta avança para norte');
    anterior = pos;
  }
});

test('9.2: o avião vira-se na volta — não voa de cauda', () => {
  const { estadoVoo, rumoDoAviao, DURACAO, VIRAGEM } = voo;
  assert.equal(typeof rumoDoAviao, 'function', 'o hero-voo.js não exporta rumoDoAviao');
  assert.ok(VIRAGEM > 0 && VIRAGEM <= 0.15, `a viragem ocupa ${VIRAGEM} da perna`);

  /* `tangente` é a direcção do traçado no sentido Maputo -> Pemba. */
  for (const tangente of [-Math.PI / 2, -1.1, 0.4, 2.6]) {
    const ida = rumoDoAviao(tangente, estadoVoo(DURACAO * 0.5));
    assert.ok(afastamento(ida, tangente) < 1e-9, 'na ida o nariz não segue o traçado');

    const volta = rumoDoAviao(tangente, estadoVoo(DURACAO * 1.5));
    assert.ok(afastamento(volta, tangente + Math.PI) < 1e-9,
      `na volta o avião aponta para ${volta} e o percurso vai para ${tangente + Math.PI}: voa de cauda`);

    /* Na segunda ida volta a apontar para norte. */
    const outraIda = rumoDoAviao(tangente, estadoVoo(DURACAO * 2.5));
    assert.ok(afastamento(outraIda, tangente) < 1e-9, 'na segunda ida o avião ficou virado para sul');
  }
});

test('9.2: a viragem é uma rotação contínua, não um salto de 180 graus', () => {
  const { estadoVoo, rumoDoAviao, DURACAO, VIRAGEM } = voo;
  const tangente = -1.2;

  /* A primeira partida não tem viragem: o avião sai de Maputo já de nariz
     para norte. */
  assert.ok(afastamento(rumoDoAviao(tangente, estadoVoo(0)), tangente) < 1e-9);

  for (const perna of [1, 2, 3]) {
    const inicio = DURACAO * perna;
    const fimDaAnterior = rumoDoAviao(tangente, estadoVoo(inicio - 1));
    const comeco = rumoDoAviao(tangente, estadoVoo(inicio));
    assert.ok(afastamento(fimDaAnterior, comeco) < 0.01,
      `perna ${perna}: o avião roda ${afastamento(fimDaAnterior, comeco).toFixed(2)} rad de um frame para o outro`);

    /* A meio da viragem está de lado; no fim dela, já no rumo novo. */
    const meio = rumoDoAviao(tangente, estadoVoo(inicio + DURACAO * VIRAGEM * 0.5));
    assert.ok(Math.abs(afastamento(meio, comeco) - Math.PI / 2) < 0.2, 'a meio da viragem o avião não está de lado');
    const fim = rumoDoAviao(tangente, estadoVoo(inicio + DURACAO * VIRAGEM));
    assert.ok(afastamento(fim, comeco) > Math.PI - 1e-6, 'a viragem não completa os 180 graus');

    /* Passo a passo, sem saltos. */
    let antes = comeco;
    for (let k = 1; k <= 60; k += 1) {
      const agora = rumoDoAviao(tangente, estadoVoo(inicio + (DURACAO * VIRAGEM * k) / 60));
      assert.ok(afastamento(antes, agora) < 0.15, 'a rotação dá um salto');
      antes = agora;
    }
  }
});

test('9.2: o relógio do voo só anda com o hero à vista', () => {
  const { passoDoRelogio } = voo;
  assert.equal(typeof passoDoRelogio, 'function', 'o hero-voo.js não exporta passoDoRelogio');

  /* O primeiro frame depois de (re)entrar no ecrã não tem frame anterior. */
  assert.equal(passoDoRelogio(null, 5000), 0);
  /* Um frame normal conta o que passou. */
  assert.ok(Math.abs(passoDoRelogio(1000, 1016.7) - 16.7) < 1e-9);
  /* Um separador que esteve escondido um minuto não faz o avião saltar
     meio percurso: o passo é limitado. */
  assert.ok(passoDoRelogio(1000, 61000) <= 100);
  /* E o relógio nunca anda para trás. */
  assert.equal(passoDoRelogio(1000, 900), 0);
});

test('9.2: o loop infinito só pede frames enquanto o hero está no ecrã', () => {
  const fonte = codigoDe('js/hero-voo.js');
  const frame = /function frame\(agora\) \{([\s\S]*?)\n  \}/.exec(fonte)?.[1];
  assert.ok(frame, 'não encontrei a função frame');

  /* O voo deixou de ter fim… */
  assert.doesNotMatch(frame, /parar = true/, 'o voo continua a parar no fim da ida');
  assert.doesNotMatch(frame, /setTimeout/, 'o voo continua a ter um fim marcado');
  assert.match(frame, /estadoVoo\(decorrido\)/, 'o frame não usa o relógio do loop');

  /* …e por isso a única coisa que o pára é sair do ecrã. A guarda tem de
     vir ANTES de qualquer desenho e de qualquer novo pedido de frame. */
  const guarda = frame.indexOf('if (!visivel) return');
  assert.ok(guarda !== -1, 'o frame não pára quando o hero sai do ecrã');
  assert.ok(guarda < frame.indexOf('clearRect'), 'o frame desenha antes de saber se está à vista');
  assert.ok(guarda < frame.indexOf('requestAnimationFrame(frame)'));

  /* Um só pedido de frame por frame, e é o IntersectionObserver que
     arranca e pára o ciclo. */
  assert.equal(frame.split('requestAnimationFrame(frame)').length - 1, 1);
  assert.match(fonte, /new IntersectionObserver\(/);
  assert.match(fonte, /else if \(!dentro\) \{\s*visivel = false;/,
    'sair do ecrã não desliga o ciclo');

  /* O relógio é acumulado, não é `agora - inicio`: senão o tempo fora do
     ecrã contava, e o avião saltava para outro sítio ao voltar. */
  assert.match(frame, /decorrido \+= passoDoRelogio\(ultimo, agora\)/);
});

test('9.2: com prefers-reduced-motion não há voo nenhum', () => {
  const fonte = codigoDe('js/hero-voo.js');
  const arranque = fonte.slice(fonte.indexOf('if (reduzir) {', fonte.indexOf('montar();')));
  assert.ok(arranque.startsWith('if (reduzir) {'), 'não encontrei o ramo de movimento reduzido');
  const ramo = arranque.slice(0, arranque.indexOf('if (\'IntersectionObserver\' in window)'));
  assert.match(ramo, /return \(\) => \{\};/, 'o ramo de movimento reduzido não sai antes do ciclo');
  assert.doesNotMatch(ramo, /requestAnimationFrame\(frame\)/,
    'com movimento reduzido o loop arranca na mesma');
  assert.doesNotMatch(ramo, /desenharAviao/, 'com movimento reduzido não há avião a meio do percurso');
});

test('9.2: depois da primeira ida o fundo do mapa é pintado uma vez, não a cada frame', () => {
  /* O país e as dez províncias são ~1 100 `lineTo` e dezenas de `fill` e
     `stroke`. Num voo que acabava, pagava-se isso durante 11 s. Num loop
     infinito pagava-se para sempre — o mesmo desperdício do 1088b90. Assim
     que as províncias estão todas acesas o fundo já não muda: vai para uma
     camada e cada frame limita-se a copiá-la. */
  const fonte = codigoDe('js/hero-voo.js');
  const frame = /function frame\(agora\) \{([\s\S]*?)\n  \}/.exec(fonte)?.[1] ?? '';
  assert.match(fonte, /function camadaFundo\(\)/, 'não há camada para o fundo estático');
  assert.match(frame, /ctx\.drawImage\(camadaFundo\(\)/, 'o frame não usa a camada do fundo');
  /* A camada é deitada fora quando o canvas muda de tamanho. */
  const montar = /function montar\(\) \{([\s\S]*?)\n  \}/.exec(fonte)?.[1] ?? '';
  assert.match(montar, /fundo = null/, 'a camada do fundo sobrevive a um resize e fica desalinhada');
});

/* ---------- Fase 9 (9.2): o avião está mesmo NO mapa ---------- */

/* O cliente escreveu "faltou só o avião". Faltava mesmo: `construirRota`
   projectava as capitais para coordenadas de ecrã e passava-as a `saltoDe`,
   que as projectava OUTRA vez. O traçado, as setas e o avião eram desenhados
   a ~33 000 px da origem, fora de qualquer canvas — e nenhum teste o via,
   porque todos liam o texto do ficheiro e nenhum corria o desenho.

   Este corre. O canvas é um registo: guarda cada `translate` e cada
   `rotate`, que é como o avião e as setas se põem no sítio. */
function correrVoo({ largura = 1280, altura = 800, ate, passo = 100 }) {
  const quadros = [];
  let actual = null;
  const registo = () => new Proxy({}, {
    get(alvo, nome) {
      if (nome in alvo) return alvo[nome];
      if (nome === 'createLinearGradient' || nome === 'createRadialGradient') {
        return () => ({ addColorStop() {} });
      }
      if (nome === 'translate') return (x, y) => { actual?.translates.push([x, y]); };
      if (nome === 'rotate') return (a) => { actual?.rotates.push(a); };
      if (nome === 'arc') return (x, y) => { actual?.arcos.push([x, y]); };
      return () => {};
    },
    set(alvo, nome, valor) { alvo[nome] = valor; return true; },
  });
  const tela = () => ({ width: 0, height: 0, clientWidth: largura, clientHeight: altura, getContext: registo });

  let pedido = null;
  const antes = {
    window: globalThis.window, document: globalThis.document, raf: globalThis.requestAnimationFrame,
  };
  globalThis.window = {
    devicePixelRatio: 1,
    matchMedia: () => ({ matches: false }),
    addEventListener() {},
  };
  globalThis.document = { createElement: tela };
  globalThis.requestAnimationFrame = (f) => { pedido = f; };
  try {
    const progressos = [];
    voo.iniciarVoo(tela(), { aoProgredir: (v) => progressos.push(v) });
    for (let agora = 0; agora <= ate; agora += passo) {
      assert.ok(pedido, `o ciclo deixou de pedir frames aos ${agora} ms`);
      const f = pedido;
      pedido = null;
      actual = { ms: agora, translates: [], rotates: [], arcos: [] };
      f(agora);
      quadros.push(actual);
    }
    return { quadros, progressos, largura, altura };
  } finally {
    globalThis.window = antes.window;
    globalThis.document = antes.document;
    globalThis.requestAnimationFrame = antes.raf;
  }
}

/** O avião de um quadro: o penúltimo `translate` (o último é a sombra dele). */
const aviaoDe = (q) => {
  const [x, y] = q.translates[q.translates.length - 2];
  /* `desenharAviao` roda para o rumo e a sombra desfaz a rotação: o rumo
     é o penúltimo `rotate`. */
  return { x, y, rumo: q.rotates[q.rotates.length - 2] };
};

for (const [largura, altura] of [[1280, 800], [360, 740]]) {
  test(`9.2: a ${largura}px o avião, as setas e o traçado ficam dentro do canvas`, () => {
    const { quadros } = correrVoo({ largura, altura, ate: voo.DURACAO * 2.2 });
    for (const q of quadros.filter((x) => x.ms > 400)) {
      for (const [x, y] of q.translates.slice(0, -1)) {
        assert.ok(x >= 0 && x <= largura && y >= 0 && y <= altura,
          `aos ${q.ms} ms há um desenho em (${Math.round(x)}, ${Math.round(y)}), fora do canvas de ${largura}×${altura}`);
      }
    }
  });
}

test('9.2: o avião sobe o mapa na ida, desce na volta, e vira o nariz', () => {
  const D = voo.DURACAO;
  const { quadros, progressos } = correrVoo({ ate: D * 3.5 });
  const em = (ms) => aviaoDe(quadros.find((q) => q.ms >= ms));

  /* No canvas o norte é para cima: y menor. */
  assert.ok(em(D * 0.75).y < em(D * 0.25).y, 'na ida o avião não vai para norte');
  assert.ok(em(D * 1.75).y > em(D * 1.25).y, 'na volta o avião não vai para sul');
  assert.ok(em(D * 2.75).y < em(D * 2.25).y, 'o voo não repete: a segunda ida não sobe');

  /* No mesmo sítio do percurso, ida e volta têm rumos opostos. */
  const ida = em(D * 0.5);
  const volta = em(D * 1.5);
  assert.ok(Math.hypot(ida.x - volta.x, ida.y - volta.y) < 12, 'a volta não passa pelo percurso da ida');
  assert.ok(afastamento(volta.rumo, ida.rumo + Math.PI) < 0.1,
    `rumo na ida ${ida.rumo.toFixed(2)}, na volta ${volta.rumo.toFixed(2)}: o avião voa de cauda`);

  /* O avião parte de Maputo e chega a Pemba, e não a um sítio parecido. */
  const porCima = (ponto, q) => Math.min(...q.arcos.map(([x, y]) => Math.hypot(x - ponto.x, y - ponto.y)));
  assert.ok(porCima(em(D - 100), quadros[5]) < 3, 'o fim da ida não é em cima de uma agência');
  assert.ok(porCima(em(D * 2 - 100), quadros[5]) < 3, 'o fim da volta não é em cima de uma agência');

  /* E o título acende na primeira ida e não volta a apagar-se. */
  assert.ok(progressos[3] < 0.05);
  assert.equal(Math.min(...progressos.slice(Math.ceil(D / 100) + 1)), 1,
    'o título volta a apagar-se depois da primeira ida');
});

test('9.2: da primeira volta em diante cada frame pinta muito menos', () => {
  const D = voo.DURACAO;
  const { quadros } = correrVoo({ ate: D * 1.5 });
  const arcos = (ms) => quadros.find((q) => q.ms >= ms).arcos.length;
  /* Os `arc` das agências (dois por província) saem do frame: passam a vir
     na camada do fundo. */
  assert.ok(arcos(D * 1.4) <= arcos(D * 0.5) - 2 * ROTA.length,
    `na volta cada frame ainda desenha ${arcos(D * 1.4)} arcos (na ida ${arcos(D * 0.5)})`);
});

test('9.2: a seta de cada salto tem tamanho de seta, e não o da escala do mapa', () => {
  /* O raio era `4 + 2 * esc`, e `esc` são os píxeis por grau do mapa
     (~45 no computador): setas de 90 px, maiores do que uma província. Nunca
     se viu porque estavam fora do canvas, com o avião. */
  const fonte = codigoDe('js/hero-voo.js');
  const seta = /function desenharSeta\(s, estado\) \{([\s\S]*?)\n  \}/.exec(fonte)?.[1] ?? '';
  const m = /const r = w < 760 \? ([\d.]+) : ([\d.]+);/.exec(seta);
  assert.ok(m, 'o raio da seta voltou a depender de outra coisa que não a largura do ecrã');
  assert.ok(Number(m[1]) >= 3 && Number(m[1]) <= Number(m[2]) && Number(m[2]) <= 8,
    `raio da seta: ${m[1]} px no telemóvel, ${m[2]} px no computador`);
});
