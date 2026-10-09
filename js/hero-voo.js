/* =========================================================
   Voo da carga — cena do hero
   ------------------------------------------------------------
   Um avião de carga parte de Maputo, a sede da JVI, e percorre as dez
   províncias por vizinhança geográfica até Pemba (Cabo Delgado): a JVI
   é uma origem que serve o país, não um destino. Fase 8C — até aí o voo
   fazia o caminho inverso.

   Desenhado em canvas 2D com sombreamento 3D, sem bibliotecas
   externas e sem pedidos de rede — para carregar depressa em
   ligações lentas, que é o caso comum em Moçambique.

   A cena notifica o progresso (0..1) para o texto do hero se
   revelar palavra a palavra à medida que o avião avança.

   Fase 9 (9.2). O voo deixou de acabar em Pemba: chega, contorna, e
   volta a Maputo pelo mesmo percurso — e repete, sem fim. Três coisas
   que um loop infinito obriga a escrever, e que estão mais abaixo:
   o avião RODA na viragem (`rumoDoAviao`), o relógio só anda com o hero
   à vista (`passoDoRelogio`), e o fundo do mapa deixa de ser repintado
   a cada frame assim que pára de mudar (`camadaFundo`).

   Fase 8 (A2, A3). Antes disto a rota tinha seis províncias e o
   desenho tinha três falhas que o cliente viu e descreveu:

     - NÃO HAVIA SETAS. Sabia-se que o avião ia de Pemba a Maputo,
       mas não se via para que lado ia em cada salto.
     - NÃO HAVIA AGÊNCIA NENHUMA no hero. A cobertura estava só na
       secção de baixo, e o voo era uma linha sem interrupção.
     - O AVIÃO NÃO SAI DA ORIGEM de cada salto. A spline Catmull-Rom
       é interpoladora, mas as tangentes em cada nó vêm dos dois
       vizinhos — e nas pontas, de fora da lista. O primeiro e o
       último salto saíam de um sítio que não era Pemba nem Maputo.

   A rota passou a ser uma lista de SALTOS, cada um com origem,
   destino e a seta que aponta de uma para o outro. O traçado é uma
   Bézier quadrática por salto: a curva passa exactamente pelas duas
   pontas, que é a única forma de garantir que o avião levanta da
   origem de cada salto.
   ========================================================= */

import {
  BBOX, PAIS, PROVINCIAS, CAPITAIS, ROTA, agencyPoint,
} from './mapa-dados.js';

const VERDE = [169, 207, 68];
const BRANCO = [244, 244, 245];
const CLARO = [232, 237, 245];

/* A rota vem de `mapa-dados.js` (que a gera `tools/gerar-mapa.mjs`): as dez
   províncias por vizinhança geográfica, de Maputo (a sede) a Pemba. A ordem
   veio da revisão do cliente na Fase 8C; `docs/decisoes.md` diz porque é esta
   e não a que ele ditou ao telefone. */
const DURACAO = 11000;         // ms de cada perna — dez províncias a uma velocidade de leitura
const CURVA = 0.16;            // quanto cada salto se afasta da linha recta
const PASSOS_POR_SALTO = 26;   // amostras por salto — desenham a curva, não a reta
const VIRAGEM = 0.08;          // fracção da perna que o avião gasta a dar a volta
const PASSO_MAX = 100;         // ms — o máximo que um só frame faz andar o relógio

function ease(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/* ------------------------------------------------------------
   Fase 9 (9.2) — o estado do voo, em função do tempo de voo.

   O voo é uma sequência de PERNAS de `DURACAO` cada: as pares são a ida
   (Maputo -> Cabo Delgado), as ímpares a volta. `pos` é a posição no
   traçado, 0 em Maputo e 1 em Pemba, nos dois sentidos — a volta é o
   mesmo percurso lido ao contrário, e não um segundo traçado.

   O `ease` é por perna: o avião abranda ao chegar a cada ponta e arranca
   devagar, que é o que deixa a viragem ler-se como uma manobra e não como
   um ricochete.

   Pura de propósito: `tests/mapa.test.js` corre-a sem canvas.
   ------------------------------------------------------------ */
export function estadoVoo(decorrido) {
  const ms = Math.max(0, decorrido);
  const perna = Math.floor(ms / DURACAO);
  const t = (ms - perna * DURACAO) / DURACAO;
  const sentido = perna % 2 === 0 ? 1 : -1;
  const avanco = ease(t);
  return { perna, sentido, t, avanco, pos: sentido === 1 ? avanco : 1 - avanco };
}

/* O rumo do avião. `tangente` é a direcção do traçado no sentido da ida.

   Na volta o nariz aponta para o lado contrário: sem os π, o avião
   percorria o caminho de regresso de cauda, que é o tipo de erro que se
   vê logo. E a viragem é uma rotação: nos primeiros `VIRAGEM` de cada
   perna o avião roda meia volta a partir do rumo com que chegou, em vez
   de aparecer virado de um frame para o outro. Nessa altura quase não se
   desloca (o `ease` arranca do zero), por isso roda sobre a ponta do
   percurso. A primeira partida não tem viragem: sai de Maputo já de nariz
   para norte. */
export function rumoDoAviao(tangente, estado) {
  const rumo = estado.sentido === 1 ? tangente : tangente + Math.PI;
  if (estado.perna === 0 || estado.t >= VIRAGEM) return rumo;
  const u = estado.t / VIRAGEM;
  const suave = u * u * (3 - 2 * u);
  return rumo - Math.PI * (1 - suave);
}

/* Quanto anda o relógio do voo neste frame. O tempo é ACUMULADO frame a
   frame, e não `agora - inicio`: fora do ecrã não há frames, logo o
   relógio pára, e ao voltar o avião está onde ficou. O tecto serve o
   separador que esteve escondido — o primeiro frame depois de um minuto
   não pode fazer o avião saltar meio país. */
export function passoDoRelogio(ultimo, agora) {
  if (ultimo === null) return 0;
  return Math.max(0, Math.min(PASSO_MAX, agora - ultimo));
}

/* ------------------------------------------------------------
   Fase 10 (10.7) — geometria do mapa e etiquetas sem sobreposição.

   A 360 px o país mede ~320 px e Manica/Sofala (Chimoio/Beira) ficam a
   1,2 unidades uma da outra: "MANICA" caía em cima de "SOFALA" e "Chimoio"
   em cima de "Beira". `geometriaDoMapa` é a conta de `resize` tirada para
   fora, e `etiquetasDoMapa` decide ONDE vai cada nome. Ambas puras: o
   desenho lê delas e `tests/etiquetas.test.js` corre-as sem canvas.

   Regras: (1) o nome da província não se escreve quando a cidade tem o
   mesmo nome (Nampula, Tete, Inhambane, Maputo) — a cidade já o diz;
   (2) cada etiqueta tenta posições por ordem (em baixo, em cima, à
   esquerda, à direita, e os cantos) e fica na primeira que não toca em
   nenhuma já colocada nem em nenhum ponto de agência; (3) abaixo de
   `ECRA_PEQUENO` os tamanhos descem um ponto. A largura é estimada, não
   medida, para o teste e o desenho concordarem sem um canvas.
   ------------------------------------------------------------ */
const ECRA_PEQUENO = 760;
const MAPA_ESTREITO = 260;
const FRAÇÃO_LARGURA_MAPA = 0.52;

export function geometriaDoMapa(w, h) {
  const larg = BBOX[2] - BBOX[0];
  const alt = BBOX[3] - BBOX[1];
  const areaW = w < 900 ? w * 0.88 : w * FRAÇÃO_LARGURA_MAPA;
  const areaH = w < 900 ? h * 0.94 : h * 0.82;
  const esc = Math.min(areaW / larg, areaH / alt);
  return {
    esc,
    ox: (w < 900 ? w * 0.5 : w * 0.66) - (larg * esc) / 2,
    oy: h * 0.5 - (alt * esc) / 2,
  };
}

export function raioAgencia(luz) {
  return 2.6 + 1.6 * luz;
}

/** Largura estimada de um texto em canvas (conservadora: arredonda para cima). */
export function larguraEstimada(texto, tamanho, maiusculas) {
  return Math.ceil(texto.length * tamanho * (maiusculas ? 0.74 : 0.6)) + 2;
}

function cruzam(a, b) {
  return a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
}

/** Caixas e posições das etiquetas do mapa para um canvas `w` x `h`. */
/** O texto da etiqueta de Maputo, a sede da JVI. Só no mapa. */
export const ROTULO_SEDE = 'Maputo — Sede';

export function etiquetasDoMapa(w, h, reservas = []) {
  const { esc, ox, oy } = geometriaDoMapa(w, h);
  const pequeno = w < ECRA_PEQUENO;
  const tamCidade = pequeno ? 8 : 9;
  const tamProv = pequeno ? 9 : 10;
  const px = (c) => ox + (c.x - BBOX[0]) * esc;
  const py = (c) => oy + (c.y - BBOX[1]) * esc;
  const raio = raioAgencia(1);
  const ocupado = [];
  const resultado = [];
  /* Fase 10C: caixas já ocupadas (o avião estático) — as etiquetas cedem. */
  for (const r of reservas) ocupado.push({ ...r, tipo: 'reserva' });

  // os pontos de agência (com o anel) ocupam espaço e contam como obstáculo
  for (const nome of ROTA) {
    const c = CAPITAIS[nome];
    if (!c) continue;
    const r = raio + 2.4 + 1;
    ocupado.push({ x0: px(c) - r, y0: py(c) - r, x1: px(c) + r, y1: py(c) + r, tipo: 'ponto', nome });
  }

  function colocar(tipo, nome, texto, tam, maiusculas, c, candidatos) {
    const lw = larguraEstimada(texto, tam, maiusculas);
    const lh = tam + 2;
    const x = px(c);
    const y = py(c);
    const r = raio + 2.4 + 1;
    let escolhida = null;
    for (const cand of candidatos) {
      const ax = cand.alinha === 'left' ? x + r + 1 : cand.alinha === 'right' ? x - r - 1 : x;
      const ay = y + cand.dy(r, lh);
      const x0 = cand.alinha === 'left' ? ax : cand.alinha === 'right' ? ax - lw : ax - lw / 2;
      const caixa = { x0, y0: ay - lh / 2, x1: x0 + lw, y1: ay + lh / 2, tipo, nome, texto, x: ax, y: ay, alinha: cand.alinha };
      // Fase 10C: uma etiqueta nunca sai do canvas (mapa estreito do telemóvel)
      if (caixa.x0 < 0 || caixa.x1 > w || caixa.y0 < 0 || caixa.y1 > h) continue;
      if (!ocupado.some((o) => cruzam(caixa, o))) { escolhida = caixa; break; }
    }
    if (!escolhida) return null;
    ocupado.push(escolhida);
    resultado.push(escolhida);
    return escolhida;
  }

  const abaixo = { alinha: 'center', dy: (r, lh) => r + lh / 2 };
  const acima = { alinha: 'center', dy: (r, lh) => -(r + lh / 2) };
  const esquerda = { alinha: 'right', dy: () => 0 };
  const direita = { alinha: 'left', dy: () => 0 };
  const abaixoDir = { alinha: 'left', dy: (r, lh) => r };
  const abaixoEsq = { alinha: 'right', dy: (r, lh) => r };
  const acimaDir = { alinha: 'left', dy: (r, lh) => -r };
  const acimaEsq = { alinha: 'right', dy: (r, lh) => -r };
  const maisAcima = { alinha: 'center', dy: (r, lh) => -(r + lh * 1.5) };
  const maisAbaixo = { alinha: 'center', dy: (r, lh) => r + lh * 1.5 };
  const todas = [abaixo, esquerda, direita, abaixoDir, abaixoEsq, acima, acimaDir, acimaEsq, maisAbaixo, maisAcima];

  // 1.º as cidades (o que importa a quem quer saber para onde ir)
  for (const nome of ROTA) {
    const c = CAPITAIS[nome];
    if (!c) continue;
    // Fase 10B (10B.4): a sede diz-se no mapa, como no mapa antigo («Maputo — Sede»).
    colocar('cidade', nome, nome === 'Maputo' ? ROTULO_SEDE : c.nome, tamCidade, false, c, todas);
  }
  // 2.º os nomes das províncias, só quando dizem algo que a cidade não diz.
  // Fase 10C: no mapa estreito (coluna do telemóvel) ficam só as cidades —
  // os nomes das províncias em maiúsculas sobrepunham-se e saíam do canvas.
  if (w >= MAPA_ESTREITO) for (const nome of ROTA) {
    const c = CAPITAIS[nome];
    if (!c || c.nome.toLowerCase() === nome.toLowerCase()) continue;
    colocar('provincia', nome, nome.toUpperCase(), tamProv, true, c, [acima, maisAcima, maisAbaixo, ...todas]);
  }
  return resultado.filter((e) => e.tipo !== 'ponto' && e.tipo !== 'reserva');
}

/* ------------------------------------------------------------
   Fase 10C (10C.1). O avião tem de se ver no telemóvel real.

   - TAMANHO: era 15 px abaixo de 900 — pequeno num ecrã de 360. Passa a ser
     proporcional à largura do canvas (10 %), entre 16 e 24 px; o 24 é o do
     computador, por isso nunca é maior do que lá.
   - DPR: o canvas tem `largura x DPR` píxeis de lado; num Android a 3x isso
     era 9 vezes a área. Fica limitado a 2.
   - SEM ANIMAÇÃO: o avião estático ficava parado à saída de Maputo, em cima
     de «Maputo — Sede». Fica agora a meio do percurso entre Beira e Tete
     (no salto Chimoio → Tete). Sítio fixo: são as etiquetas que lhe cedem
     o lugar (`etiquetasDoMapa(w, h, [caixa])`). `aviaoParado` é pura: o
     teste corre-a.
   ------------------------------------------------------------ */
export const AVIAO_MIN = 16;
export const AVIAO_MAX = 24;
export const DPR_MAX = 2;

export function tamanhoDoAviao(w) {
  if (w >= 900) return AVIAO_MAX;
  return Math.min(AVIAO_MAX, Math.max(AVIAO_MIN, Math.round(w * 0.1)));
}

export function dprDoCanvas(dpr) {
  return Math.min(dpr || 1, DPR_MAX);
}

/** A caixa que o avião ocupa (com a sombra e as asas), centrada em x, y. */
export function caixaDoAviao(x, y, tam) {
  const r = tam * 1.5;
  return { x0: x - r, y0: y - r, x1: x + r, y1: y + r };
}

/** Onde (e para onde aponta) o avião fica quando não há animação. */
export function aviaoParado(w, h) {
  const { esc, ox, oy } = geometriaDoMapa(w, h);
  const tam = tamanhoDoAviao(w);
  const P = (nome) => ({
    x: ox + (CAPITAIS[nome].x - BBOX[0]) * esc,
    y: oy + (CAPITAIS[nome].y - BBOX[1]) * esc,
  });
  const a = P('Manica');
  const b = P('Tete');
  const cx = (a.x + b.x) / 2 + (b.y - a.y) * CURVA;
  const cy = (a.y + b.y) / 2 - (b.x - a.x) * CURVA;
  const em = (t) => {
    const m = 1 - t;
    return { x: m * m * a.x + 2 * m * t * cx + t * t * b.x, y: m * m * a.y + 2 * m * t * cy + t * t * b.y };
  };
  const escolhido = 0.5;
  const p = em(escolhido);
  const q = em(Math.min(1, escolhido + 0.04));
  return { x: p.x, y: p.y, ang: Math.atan2(q.y - p.y, q.x - p.x), tam };
}

/* Fase 10D: false = o avião voa sempre, mesmo com "reduzir movimento". */
export const RESPEITAR_REDUZIR_MOVIMENTO = false;

export function iniciarVoo(canvas, opcoes = {}) {
  const aoProgredir = opcoes.aoProgredir || (() => {});
  const ctxEcra = canvas.getContext('2d', { alpha: true });
  if (!ctxEcra) return () => {};
  /* As funções de desenho pintam em `ctx`. É o do ecrã, excepto enquanto
     `camadaFundo` o troca pelo da camada estática. */
  let ctx = ctxEcra;

  /* Fase 10D: o voo corre mesmo com "reduzir movimento". No telemóvel do
     Ernu o avião não voava e o carrossel não rodava — as duas coisas que só
     param com `prefers-reduced-motion`, que o Android liga com "Remover
     animações". O cliente quer o avião a voar no telemóvel; é um elemento
     da marca, pequeno, que não pisca nem ocupa o ecrã todo. O ramo estático
     fica para quem o reactivar com RESPEITAR_REDUZIR_MOVIMENTO. */
  const reduzir = RESPEITAR_REDUZIR_MOVIMENTO &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let w = 0, h = 0, dpr = 1;
  let esc = 1, ox = 0, oy = 0;
  let rotulos = [];           // etiquetas do mapa, já sem sobreposição (`etiquetasDoMapa`)
  let pontos = [];            // trajectório em coordenadas de ecrã
  let saltos = [];            // {de, para, x0, y0, x1, y1, cx, cy, t0, t1}
  let mapa = {};              // provincia -> factor de iluminação 0..1
  let visivel = false;
  let decorrido = 0;          // ms de voo, só contados com o hero à vista
  let ultimo = null;          // instante do frame anterior
  let fundo = null;           // camada estática: país, províncias e agências
  let parar = false;

  /* ------------------------------------------------ geometria */
  const larg = BBOX[2] - BBOX[0];
  const alt = BBOX[3] - BBOX[1];

  /* O país ocupa a metade direita do hero; o texto fica à esquerda
     (`geometriaDoMapa`, mais acima). */

  function resize() {
    dpr = dprDoCanvas(window.devicePixelRatio);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    if (!w || !h) return;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctxEcra.setTransform(dpr, 0, 0, dpr, 0, 0);

    /* No telemóvel o canvas é uma caixa só do mapa, por baixo do conteúdo
       (Fase 9, 9.8): o país enche-a, em vez de ficar pequeno dentro das
       margens que fazia sentido deixar quando estava por trás do texto. */
    ({ esc, ox, oy } = geometriaDoMapa(w, h));
    if (reduzir) {
      const a = aviaoParado(w, h);
      rotulos = etiquetasDoMapa(w, h, [caixaDoAviao(a.x, a.y, a.tam)]);
    } else {
      rotulos = etiquetasDoMapa(w, h);
    }
  }

  /* As coordenadas vêm projectadas (lon·cos, −lat) de `mapa-dados.js`.
     Subtrair a origem antes de escalar é obrigatório: sem isso o mapa
     é desenhado fora do canvas. */
  const X = (lx) => ox + (lx - BBOX[0]) * esc;
  const Y = (ly) => oy + (ly - BBOX[1]) * esc;

  /* Um salto: a reta da origem ao destino, com o ponto de controlo
     deslocado para o lado, para a curva se ler como um arco e não como uma
     poligonal seca. A Bézier quadrática passa exactamente por `a` e `b` —
     é isto que garante que o avião levanta da origem de cada salto. */
  function saltoDe(a, b) {
    const x0 = X(a.x);
    const y0 = Y(a.y);
    const x1 = X(b.x);
    const y1 = Y(b.y);
    return {
      de: a.nome, para: b.nome,
      x0, y0, x1, y1,
      cx: (x0 + x1) / 2 + (y1 - y0) * CURVA,
      cy: (y0 + y1) / 2 - (x1 - x0) * CURVA,
      t0: 0, t1: 0,
    };
  }

  /** Ponto da Bézier quadrática do salto, no instante `t` (0..1). */
  function em(s, t) {
    const m = 1 - t;
    return {
      x: m * m * s.x0 + 2 * m * t * s.cx + t * t * s.x1,
      y: m * m * s.y0 + 2 * m * t * s.cy + t * t * s.y1,
    };
  }

  /* Catmull-Rom estava aqui e foi removido: as suas tangentes em cada nó
     vêm dos dois vizinhos, e nas pontas não há vizinho de um lado. O
     primeiro salto saía de um sítio arbitrário e o último chegava a um
     sítio arbitrário — o avião não partia de Pemba nem chegava a Maputo. */
  function construirRota() {
    /* As âncoras ficam em coordenadas do MAPA. Quem as projecta para o
       ecrã é `saltoDe` (e a última linha desta função): estavam a ser
       projectadas aqui e outra vez lá, e o traçado, as setas e o avião
       iam parar a ~33 000 px da origem — fora de qualquer canvas. Foi o
       "faltou só o avião" do cliente. `tests/mapa.test.js` corre o
       desenho e confere que fica dentro do canvas. */
    const ancoras = ROTA.map((n) => {
      const c = CAPITAIS[n];
      return { x: c.x, y: c.y, nome: n, rotulo: c.nome };
    });
    const lista = [];
    for (let i = 0; i < ancoras.length - 1; i += 1) {
      const salto = saltoDe(ancoras[i], ancoras[i + 1]);
      const total = (ROTA.length - 1) * PASSOS_POR_SALTO;
      const t0 = (i * PASSOS_POR_SALTO) / total;
      const t1 = ((i + 1) * PASSOS_POR_SALTO) / total;
      saltos.push({ ...salto, t0, t1 });
      for (let s = 0; s < PASSOS_POR_SALTO; s += 1) {
        const t = s / PASSOS_POR_SALTO;
        const p = em(salto, t);
        lista.push({ x: p.x, y: p.y, de: salto.de, para: salto.para, t: t0 + (t1 - t0) * t });
      }
    }
    const ult = ancoras[ancoras.length - 1];
    lista.push({ x: X(ult.x), y: Y(ult.y), de: ult.nome, para: ult.nome, t: 1 });
    return lista;
  }

  function pontoEm(p) {
    const n = pontos.length - 1;
    const i = Math.max(0, Math.min(n - 1, Math.floor(p * n)));
    const f = p * n - i;
    const a = pontos[i];
    const b = pontos[Math.min(n, i + 1)];
    return {
      x: a.x + (b.x - a.x) * f,
      y: a.y + (b.y - a.y) * f,
      de: a.de,
      para: a.para,
      t: a.t + (b.t - a.t) * f,
    };
  }

  /* ---------------------------------------------- desenho: país */
  function caminho(anel, fechar = true) {
    ctx.beginPath();
    for (let i = 0; i < anel.length; i += 1) {
      const [x, y] = anel[i];
      if (i === 0) ctx.moveTo(X(x), Y(y));
      else ctx.lineTo(X(x), Y(y));
    }
    if (fechar) ctx.closePath();
  }

  function desenharPais() {
    // PAIS e uma lista de aneis (o exterior e possiveis ilhas).
    const cx = X((BBOX[0] + BBOX[2]) / 2);
    const cy = Y((BBOX[1] + BBOX[3]) / 2);
    const raio = (BBOX[2] - BBOX[0]) * esc * 0.8;

    ctx.save();
    for (const anel of PAIS) {
      if (anel.length < 3) continue;
      // halo
      caminho(anel, true);
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, raio);
      g.addColorStop(0, 'rgba(169,207,68,0.11)');
      g.addColorStop(1, 'rgba(169,207,68,0.015)');
      ctx.fillStyle = g;
      ctx.fill();
      // contorno
      caminho(anel, true);
      ctx.strokeStyle = 'rgba(169,207,68,0.5)';
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }
    ctx.restore();
  }

  function desenharProvincias() {
    for (const nome in PROVINCIAS) {
      const luz = mapa[nome] || 0;
      /* TODOS os anéis são preenchidos, não só o primeiro. O
         `if (anel === PROVINCIAS[nome][0])` que estava aqui era um bug de
         desenho, não uma optimização: em quatro províncias — Cabo Delgado,
         Sofala, Inhambane e Maputo — o primeiro anel era um resto
         degenerado de três pontos, e o continente ficava só com o contorno,
         sem cor nenhuma por baixo. Foi metade do que o cliente descreveu
         como "as províncias não estão bem delimitadas". */
      for (const anel of PROVINCIAS[nome]) {
        caminho(anel);
        ctx.fillStyle = luz > 0
          ? `rgba(169,207,68,${0.05 + 0.3 * luz})`
          : 'rgba(255,255,255,0.012)';
        ctx.fill();
        ctx.strokeStyle = luz > 0
          ? `rgba(169,207,68,${0.35 + 0.55 * luz})`
          : 'rgba(169,207,68,0.28)';
        ctx.lineWidth = 0.6 + 1.1 * luz;
        ctx.stroke();
      }
      // nome da província acende quando iluminada (se tiver sítio: ver `etiquetasDoMapa`)
      const rot = luz > 0.02 && rotulos.find((e) => e.tipo === 'provincia' && e.nome === nome);
      if (rot) {
        ctx.save();
        ctx.font = `700 ${w < ECRA_PEQUENO ? 9 : 10}px "Plus Jakarta Sans", sans-serif`;
        ctx.fillStyle = `rgba(203,213,225,${0.35 + 0.6 * luz})`;
        ctx.textAlign = rot.alinha;
        ctx.textBaseline = 'middle';
        ctx.fillText(rot.texto, rot.x, rot.y);
        ctx.restore();
      }
    }
  }

  /* ------------------------------------------- desenho: rota */
  /* O traço percorrido é o da PERNA em curso: na ida cresce de Maputo até
     ao avião, na volta de Pemba até ao avião. O degradê vai sempre do
     verde, na ponta de onde se partiu, ao branco, junto ao avião. */
  function desenharRota(estado) {
    const ultimoPonto = pontos.length - 1;
    const i = Math.max(1, Math.min(ultimoPonto, Math.floor(pontos.length * estado.pos)));
    const de = estado.sentido === 1 ? 0 : ultimoPonto;
    const ate = estado.sentido === 1 ? i : Math.min(i, ultimoPonto - 1);
    ctx.save();
    ctx.setLineDash([5, 6]);
    ctx.lineWidth = 1.6;
    // A rota e uma lista de {x, y}, nao de pares [x, y], por isso nao
    // passa pelo caminho() — desenhamos a la mao.
    ctx.beginPath();
    pontos.forEach((p, k) => (k === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.strokeStyle = 'rgba(169,207,68,0.20)';
    ctx.stroke();
    // traço percorrido
    ctx.beginPath();
    ctx.moveTo(pontos[de].x, pontos[de].y);
    for (let k = de; k !== ate; k += estado.sentido) {
      const p = pontos[k + estado.sentido];
      ctx.lineTo(p.x, p.y);
    }
    const grad = ctx.createLinearGradient(pontos[de].x, pontos[de].y, pontos[ate].x, pontos[ate].y);
    grad.addColorStop(0, 'rgba(169,207,68,0.95)');
    grad.addColorStop(1, 'rgba(244,244,245,0.95)');
    ctx.setLineDash([]);
    ctx.strokeStyle = grad;
    ctx.lineWidth = 2.2;
    ctx.shadowColor = 'rgba(169,207,68,0.5)';
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.restore();

    // pontos de partida e chegada
    desenharPortal(pontos[0], BRANCO, 1);
    desenharPortal(pontos[ultimoPonto], BRANCO, 1);
  }

  function desenharPortal(p, cor, escala = 1) {
    ctx.save();
    const pulso = 9 + Math.sin(decorrido / 900) * 3;
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, pulso * 2.2);
    g.addColorStop(0, `rgba(${cor.join(',')},0.5)`);
    g.addColorStop(1, 'transparent');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y, pulso * 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(${cor.join(',')},0.7)`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, pulso * escala, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  /* ------------------------------------------------------------
     A3 — a seta de cada salto.

     No briefing: "cada salto de uma província para a seguinte tem de
     ter uma seta que indique o sentido". Não havia uma única.

     A seta fica a 88% do salto, encostada ao DESTINO e não a meio: ao
     meio, uma seta que cresce enquanto o avião se aproxima lê-se como
     velocidade; encostada ao destino, lê-se como "para aqui vai".
     Aponta na tangente da curva nesse ponto, que é a direcção real do
     voo naquele instante — não a direcção da reta entre capitais, que
     seria diferente nos saltos que dobram.

     Três estados: por fazer (apagada), em curso (meia), feito (acesa).
     A rota inteira lê-se antes de o avião lá chegar, que é o que permite
     perceber para onde vai sem esperar 11 segundos.

     Fase 9: na volta a seta VIRA-SE com o avião. Passa para os 12% do
     salto — encostada ao destino da volta, que é a origem da ida — e
     aponta para sul. Uma seta para norte com o avião a ir para sul dizia
     duas coisas ao mesmo tempo.
     ------------------------------------------------------------ */
  function desenharSeta(s, estado) {
    const ida = estado.sentido === 1;
    const p = em(s, ida ? 0.88 : 0.12);
    const antes = em(s, ida ? 0.84 : 0.16);
    const ang = Math.atan2(p.y - antes.y, p.x - antes.x);
    /* Um tamanho de seta, em píxeis. Era `4 + 2 * esc`, e `esc` são os
       píxeis por grau do mapa: dava setas de 90 px. */
    const r = w < 900 ? 4.5 : 6;
    const feita = ida ? estado.pos >= s.t1 : estado.pos <= s.t0;
    const viva = ida ? estado.pos >= s.t0 : estado.pos <= s.t1;

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(ang);
    ctx.globalAlpha = feita ? 0.95 : (viva ? 0.55 : 0.3);
    ctx.fillStyle = `rgb(${BRANCO.join(',')})`;
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(-r * 0.8, r * 0.75);
    ctx.lineTo(-r * 0.35, 0);
    ctx.lineTo(-r * 0.8, -r * 0.75);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function desenharSetas(estado) {
    ctx.save();
    for (const s of saltos) desenharSeta(s, estado);
    ctx.restore();
  }

  /* ------------------------------------------------------------
     A3 — a agência da JVI em cada província.

     "Cada província tem de mostrar a agência da JVI nessa província:
     um ponto/marcador na província correcta."

     O ponto de presença é a capital da província, e `agencyPoint()` é a
     única fonte. Fica SEMPRE visível, não só quando o avião passa: o
     que se pede é ver onde a JVI está, e um ponto que só acende à
     passagem do avião esconde metade da informação. O que muda com a
     passagem do avião é o brilho.

     O texto é o nome da cidade — Pemba, Beira, Quelimane — e não o da
     província, que `desenharProvincias` já escreve por cima. Aqui é o
     sítio, que é o que interessa a quem quer saber para onde ir.
     ------------------------------------------------------------ */
  function desenharAgencias() {
    ctx.save();
    for (const nome of ROTA) {
      const a = agencyPoint(nome);
      if (!a) continue;
      const x = X(a.x);
      const y = Y(a.y);
      const luz = Math.min(1, (mapa[nome] || 0) + 0.3);
      const raio = raioAgencia(luz);

      ctx.globalAlpha = 0.35 + 0.55 * luz;
      ctx.fillStyle = `rgb(${VERDE.join(',')})`;
      ctx.beginPath();
      ctx.arc(x, y, raio, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 0.3 + 0.5 * luz;
      ctx.strokeStyle = `rgb(${VERDE.join(',')})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y, raio + 2.4, 0, Math.PI * 2);
      ctx.stroke();

      const rot = rotulos.find((e) => e.tipo === 'cidade' && e.nome === nome);
      if (!rot) continue;
      ctx.font = `600 ${w < ECRA_PEQUENO ? 8 : 9}px "Plus Jakarta Sans", sans-serif`;
      ctx.textAlign = rot.alinha;
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#0B0B0C';
      ctx.lineJoin = 'round';
      ctx.globalAlpha = 0.85;
      ctx.strokeText(rot.texto, rot.x, rot.y);
      ctx.fillStyle = `rgba(232,237,245,${0.55 + 0.45 * luz})`;
      ctx.fillText(rot.texto, rot.x, rot.y);
    }
    ctx.restore();
  }

  /* ------------------------------------------ desenho: avião
     Visto de cima, com sombreado para dar volume. É um cargueiro
     de porão largo: o que a JVI efectivamente transporta. */
  function desenharAviao(x, y, ang, escala) {
    const S = escala;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);

    // sombra projectada no "chão", dá noção de altura
    ctx.save();
    ctx.translate(S * 0.5, S * 0.7);
    ctx.rotate(-ang);
    ctx.fillStyle = 'rgba(0,0,0,0.32)';
    ctx.beginPath();
    ctx.ellipse(0, 0, S * 1.5, S * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // fuselagem
    const corpo = ctx.createLinearGradient(-S * 1.5, 0, S * 1.5, 0);
    corpo.addColorStop(0, '#8C97A6');
    corpo.addColorStop(0.35, '#E8EDF5');
    corpo.addColorStop(0.6, '#FFFFFF');
    corpo.addColorStop(1, '#7B8798');
    ctx.fillStyle = corpo;
    ctx.beginPath();
    ctx.moveTo(S * 1.62, 0);
    ctx.bezierCurveTo(S * 1.2, -S * 0.34, S * 0.2, -S * 0.38, -S * 0.9, -S * 0.3);
    ctx.lineTo(-S * 1.35, -S * 0.22);
    ctx.quadraticCurveTo(-S * 1.5, 0, -S * 1.35, S * 0.22);
    ctx.lineTo(-S * 0.9, S * 0.3);
    ctx.bezierCurveTo(S * 0.2, S * 0.38, S * 1.2, S * 0.34, S * 1.62, 0);
    ctx.closePath();
    ctx.fill();

    // asa principal, enflechada
    const asa = ctx.createLinearGradient(0, -S, 0, S);
    asa.addColorStop(0, '#B9C3D0');
    asa.addColorStop(0.45, '#FFFFFF');
    asa.addColorStop(1, '#8A95A4');
    ctx.fillStyle = asa;
    ctx.beginPath();
    ctx.moveTo(S * 0.15, -S * 0.28);
    ctx.lineTo(-S * 0.55, -S * 1.5);
    ctx.lineTo(-S * 0.95, -S * 1.5);
    ctx.lineTo(-S * 0.6, -S * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(S * 0.15, S * 0.28);
    ctx.lineTo(-S * 0.55, S * 1.5);
    ctx.lineTo(-S * 0.95, S * 1.5);
    ctx.lineTo(-S * 0.6, S * 0.3);
    ctx.closePath();
    ctx.fill();

    // deriva
    ctx.fillStyle = '#C7D0DB';
    ctx.beginPath();
    ctx.moveTo(-S * 1.15, 0);
    ctx.lineTo(-S * 1.5, -S * 0.78);
    ctx.lineTo(-S * 1.72, -S * 0.78);
    ctx.lineTo(-S * 1.62, 0);
    ctx.lineTo(-S * 1.72, S * 0.78);
    ctx.lineTo(-S * 1.5, S * 0.78);
    ctx.closePath();
    ctx.fill();

    // motores
    ctx.fillStyle = '#6E7A8B';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(-S * 0.05, s * S * 0.86, S * 0.3, S * 0.17, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(15,23,42,0.65)';
      ctx.beginPath();
      ctx.ellipse(S * 0.2, s * S * 0.86, S * 0.1, S * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#6E7A8B';
    }

    // faixa da JVI
    ctx.strokeStyle = `rgba(${VERDE.join(',')},0.95)`;
    ctx.lineWidth = Math.max(1, S * 0.09);
    ctx.beginPath();
    ctx.moveTo(S * 1.1, 0);
    ctx.lineTo(-S * 1.0, 0);
    ctx.stroke();

    // brilho lateral, reforca o volume
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = Math.max(0.6, S * 0.05);
    ctx.beginPath();
    ctx.moveTo(S * 1.5, -S * 0.06);
    ctx.lineTo(-S * 0.9, -S * 0.06);
    ctx.stroke();

    ctx.restore();
  }

  /* O rastro fica ATRÁS do avião: na ida são os pontos anteriores do
     traçado, na volta os seguintes. */
  function desenharRastro(i, sentido) {
    const N = 26;
    for (let k = N; k >= 1; k -= 1) {
      const idx = Math.max(0, Math.min(pontos.length - 1, i - k * sentido));
      const q = pontos[idx];
      const a = (1 - k / N) * 0.34;
      if (a <= 0.01) continue;
      ctx.save();
      ctx.fillStyle = `rgba(232,237,245,${a})`;
      ctx.beginPath();
      ctx.arc(q.x, q.y, Math.max(0.6, (1 - k / N) * 3.2), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  /* ------------------------------------------------------------
     Fase 9 (9.2) — a camada do fundo.

     O país, as dez províncias e as agências são ~1 100 `lineTo` e dezenas
     de `fill` e `stroke`. Enquanto o voo acabava ao fim de 11 s, isso
     pagava-se 11 s. Com o loop infinito pagava-se enquanto o hero
     estivesse à vista — o mesmo desperdício que o commit 1088b90 tirou do
     mapa de cobertura.

     Depois da primeira ida as províncias estão todas acesas e o fundo já
     não muda. Pinta-se UMA vez para um canvas fora do ecrã, e cada frame
     copia-o com um `drawImage`; por cima só vai o que mexe — o traço, as
     setas, o rastro e o avião. `montar` deita a camada fora quando o
     canvas muda de tamanho.
     ------------------------------------------------------------ */
  function camadaFundo() {
    if (fundo) return fundo;
    fundo = document.createElement('canvas');
    fundo.width = canvas.width;
    fundo.height = canvas.height;
    ctx = fundo.getContext('2d', { alpha: true });
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (const nome in PROVINCIAS) mapa[nome] = 1;
    desenharPais();
    desenharProvincias();
    desenharAgencias();
    ctx = ctxEcra;
    return fundo;
  }

  /* -------------------------------------------------- ciclo */
  function frame(agora) {
    if (parar) return;
    /* Saiu do ecrã: deixa de pedir frames. É a ÚNICA coisa que pára o
       ciclo, agora que o voo não tem fim — por isso vem antes de tudo. O
       relógio é acumulado, de modo que voltar a entrar retoma o voo de
       onde ia. */
    if (!visivel) return;
    decorrido += passoDoRelogio(ultimo, agora);
    ultimo = agora;
    const estado = estadoVoo(decorrido);
    const idx = Math.min(pontos.length - 1, Math.floor(estado.pos * (pontos.length - 1)));

    ctx.clearRect(0, 0, w, h);

    if (estado.perna === 0) {
      desenharPais();

      /* Iluminar ANTES de desenhar, senão o brilho atrasa-se um frame e a
         província de onde o avião acaba de sair fica apagada no instante em
         que sai dela. */
      for (let i = 0; i <= idx; i += 1) {
        const n = pontos[i].de;
        mapa[n] = Math.max(mapa[n] || 0, Math.min(1, (mapa[n] || 0) + 0.035));
        /* A província de DESTINO acende mal o avião lá entra. Sem isto, quem
           olha para Niassa ou Beira não a vê acender: o salto inteiro passa a
           custo zero, e a província só ganhava brilho no frame em que o avião
           já lá estava — ou seja, nunca se via. */
        if (i > 0 && pontos[i].para !== pontos[i].de) {
          const d = pontos[i].para;
          mapa[d] = Math.max(mapa[d] || 0, Math.min(1, (mapa[d] || 0) + 0.02));
        }
      }

      desenharProvincias();
      desenharAgencias();
    } else {
      /* Da primeira volta em diante o fundo é sempre o mesmo. */
      ctx.drawImage(camadaFundo(), 0, 0, w, h);
    }

    desenharSetas(estado);
    desenharRota(estado);

    if (estado.perna > 0 || estado.t > 0.02) {
      const p = pontoEm(estado.pos);
      /* A direcção vem da tangente da curva, não da reta entre o ponto
         actual e o seguinte. Nos saltos que dobram, a reta entre dois
         pontos da mesma curva aponta para fora dela — o avião virava a
         esquina antes de a curva virar. */
      const iSalto = saltos.findIndex((s) => estado.pos < s.t1);
      const salto = saltos[iSalto === -1 ? saltos.length - 1 : iSalto];
      const dentro = salto.t1 > salto.t0
        ? Math.min(1, Math.max(0, (estado.pos - salto.t0) / (salto.t1 - salto.t0)))
        : 0;
      const d0 = em(salto, Math.max(0, dentro - 0.02));
      const d1 = em(salto, Math.min(1, dentro + 0.02));
      const tangente = Math.atan2(d1.y - d0.y, d1.x - d0.x);
      const tam = tamanhoDoAviao(w);
      desenharRastro(idx, estado.sentido);
      desenharAviao(p.x, p.y, rumoDoAviao(tangente, estado), tam);
    }

    /* O título acende palavra a palavra durante a PRIMEIRA ida, e fica
       aceso: na volta não se apaga outra vez. */
    aoProgredir(estado.perna === 0 ? estado.avanco : 1);

    requestAnimationFrame(frame);
  }

  /* ------------------------------------------------- arranque */
  function montar() {
    resize();
    /* `saltos` é reconstruído aqui, não em `construirRota`: o `resize`
       altera `esc`, `ox` e `oy`, e portanto as coordenadas de ecrã de
     todas as pontas. Um `saltos` que ficasse do `montar` anterior apontaria
       para sítios que já não são os mesmos depois de uma janela
     redimensionada. */
    saltos = [];
    pontos = construirRota();
    /* A camada do fundo tem as coordenadas do tamanho antigo. */
    fundo = null;
    /* O brilho das províncias só se perde se o voo ainda vai na primeira
       ida; depois disso estão todas acesas e assim ficam. */
    if (!estadoVoo(decorrido).perna) {
      mapa = {};
      for (const nome in PROVINCIAS) mapa[nome] = 0;
    }
  }
  montar();

  if (reduzir) {
    // sem animação: mostra o país, as agências e a rota completa, estático
    const estatico = () => {
      /* O fim da ida: a rota toda traçada, as setas a apontar para norte. */
      const chegada = { perna: 0, sentido: 1, t: 1, avanco: 1, pos: 1 };
      ctx.clearRect(0, 0, w, h);
      desenharPais();
      for (const nome in PROVINCIAS) mapa[nome] = 0.32;
      desenharProvincias();
      desenharAgencias();
      desenharSetas(chegada);
      desenharRota(chegada);
      /* O avião também aparece sem animação: quem tem "reduzir movimento"
         ligado (no Android é "remover animações") ficava com o mapa e sem
         avião, ou com ele escondido em cima de «Maputo — Sede». Fica parado
         a meio do percurso, num sítio livre (`aviaoParado`). */
      const parado = aviaoParado(w, h);
      desenharAviao(parado.x, parado.y, parado.ang, parado.tam);
      aoProgredir(1);
    };
    requestAnimationFrame(estatico);
    window.addEventListener('resize', () => { montar(); estatico(); }, { passive: true });
    return () => {};
  }

  window.addEventListener('resize', () => {
    if (!parar) { montar(); }
  }, { passive: true });

  if ('IntersectionObserver' in window) {
    /* Pausa nos DOIS sentidos: sem isto, se o utilizador descer o
       scroll durante o voo, o canvas continuava a pintar fora
       do ecrã. O mapa (`iniciarMapa`, em main.js) já fazia assim.
       Com o loop infinito isto deixou de ser um cuidado e passou a ser a
       única paragem do ciclo: sem hero à vista não há frames. `ultimo`
       volta a null para o relógio não contar o tempo que esteve fora. */
    new IntersectionObserver((e) => {
      const dentro = e[0].isIntersecting;
      if (dentro && !visivel && !parar) {
        visivel = true;
        ultimo = null;
        requestAnimationFrame(frame);
      } else if (!dentro) {
        visivel = false;
      }
    }, { threshold: 0.05 }).observe(canvas);
  } else {
    visivel = true;
    requestAnimationFrame(frame);
  }

  return () => { parar = true; visivel = false; };
}

export { ROTA, DURACAO, PASSOS_POR_SALTO, VIRAGEM };
