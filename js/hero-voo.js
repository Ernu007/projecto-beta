/* =========================================================
   Voo da carga — cena do hero
   ------------------------------------------------------------
   Um avião de carga parte de Pemba (Cabo Delgado) e percorre as dez
   províncias por vizinhança geográfica até Maputo, seguindo a promessa
   da JVI: "de Rovuma ao Maputo".

   Desenhado em canvas 2D com sombreamento 3D, sem bibliotecas
   externas e sem pedidos de rede — para carregar depressa em
   ligações lentas, que é o caso comum em Moçambique.

   A cena notifica o progresso (0..1) para o texto do hero se
   revelar palavra a palavra à medida que o avião avança.

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
const LARANJA = [234, 130, 64];
const CLARO = [232, 237, 245];

/* A rota vem de `mapa-dados.js` (que a gera `tools/gerar-mapa.mjs`): as dez
   províncias por vizinhança geográfica, de Pemba a Maputo. A ordem veio da
   revisão do cliente na Fase 8; `docs/decisoes.md` diz porque é esta e não a
   que ele ditou ao telefone. */
const DURACAO = 11000;         // ms de voo — dez províncias a uma velocidade de leitura
const CURVA = 0.16;            // quanto cada salto se afasta da linha recta
const PASSOS_POR_SALTO = 26;   // amostras por salto — desenham a curva, não a reta

export function iniciarVoo(canvas, opcoes = {}) {
  const aoProgredir = opcoes.aoProgredir || (() => {});
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return () => {};

  const reduzir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let w = 0, h = 0, dpr = 1;
  let esc = 1, ox = 0, oy = 0;
  let pontos = [];            // trajectório em coordenadas de ecrã
  let saltos = [];            // {de, para, x0, y0, x1, y1, cx, cy, t0, t1}
  let mapa = {};              // provincia -> factor de iluminação 0..1
  let visivel = false;
  let inicio = performance.now();
  let parar = false;

  /* ------------------------------------------------ geometria */
  const larg = BBOX[2] - BBOX[0];
  const alt = BBOX[3] - BBOX[1];

  /* O país ocupa a metade direita do hero; o texto fica à esquerda. */
  const FRAÇÃO_LARGURA = 0.52;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    if (!w || !h) return;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const areaW = w < 760 ? w * 0.80 : w * FRAÇÃO_LARGURA;
    const areaH = h * 0.82;
    esc = Math.min(areaW / larg, areaH / alt);
    // ox/oy sao o canto superior esquerdo do pais no ecra, para ficar centrado
    ox = (w < 760 ? w * 0.5 : w * 0.66) - (larg * esc) / 2;
    oy = h * 0.5 - (alt * esc) / 2;
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
    const ancoras = ROTA.map((n) => {
      const c = CAPITAIS[n];
      return { x: X(c.x), y: Y(c.y), nome: n, rotulo: c.nome };
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

  function desenharProvincias(prog) {
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
      // nome da província acende quando iluminada
      if (luz > 0.02) {
        const c = CAPITAIS[nome];
        ctx.save();
        ctx.font = '700 10px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = `rgba(203,213,225,${0.35 + 0.6 * luz})`;
        ctx.textAlign = 'center';
        ctx.fillText(nome.toUpperCase(), X(c.x), Y(c.y) - 9);
        ctx.restore();
      }
    }
    void prog;
  }

  /* ------------------------------------------- desenho: rota */
  function desenharRota(prog) {
    const n = Math.max(2, Math.floor(pontos.length * prog));
    ctx.save();
    ctx.setLineDash([5, 6]);
    ctx.lineWidth = 1.6;
    // A rota e uma lista de {x, y}, nao de pares [x, y], por isso nao
    // passa pelo caminho() — desenhamos a la mao.
    ctx.beginPath();
    pontos.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.strokeStyle = 'rgba(169,207,68,0.20)';
    ctx.stroke();
    // traço percorrido
    ctx.beginPath();
    for (let i = 0; i < n; i += 1) {
      const p = pontos[i];
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    const ult = pontos[n - 1];
    const grad = ctx.createLinearGradient(pontos[0].x, pontos[0].y, ult.x, ult.y);
    grad.addColorStop(0, 'rgba(169,207,68,0.95)');
    grad.addColorStop(1, 'rgba(234,130,64,0.95)');
    ctx.setLineDash([]);
    ctx.strokeStyle = grad;
    ctx.lineWidth = 2.2;
    ctx.shadowColor = 'rgba(169,207,68,0.5)';
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.restore();

    // pontos de partida e chegada
    desenharPortal(pontos[0], LARANJA, 1);
    desenharPortal(pontos[pontos.length - 1], LARANJA, 1);
  }

  function desenharPortal(p, cor, escala = 1) {
    ctx.save();
    const pulso = 9 + Math.sin(inicio / 260) * 3;
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

     Três estados: por fazer (apagada), em curso (meia), feito (a
    ceso). A rota inteira lê-se antes de o avião lá chegar, que é o que
     permite perceber para onde vai sem esperar 11 segundos.
     ------------------------------------------------------------ */
  function desenharSeta(s, prog) {
    const p = em(s, 0.88);
    const antes = em(s, 0.84);
    const ang = Math.atan2(p.y - antes.y, p.x - antes.x);
    const r = 4 + 2 * esc;
    const feita = prog >= s.t1;
    const viva = prog >= s.t0;

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(ang);
    ctx.globalAlpha = feita ? 0.95 : (viva ? 0.55 : 0.3);
    ctx.fillStyle = `rgb(${LARANJA.join(',')})`;
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(-r * 0.8, r * 0.75);
    ctx.lineTo(-r * 0.35, 0);
    ctx.lineTo(-r * 0.8, -r * 0.75);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function desenharSetas(prog) {
    ctx.save();
    for (const s of saltos) desenharSeta(s, prog);
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
      const raio = 2.6 + 1.6 * luz;

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

      ctx.font = '600 9px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#0F172A';
      ctx.lineJoin = 'round';
      ctx.globalAlpha = 0.85;
      ctx.strokeText(a.nome, x, y + raio + 9);
      ctx.fillStyle = `rgba(232,237,245,${0.55 + 0.45 * luz})`;
      ctx.fillText(a.nome, x, y + raio + 9);
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

  function desenharRastro(p, ang, i) {
    const N = 26;
    for (let k = N; k >= 1; k -= 1) {
      const idx = Math.max(0, i - k);
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
    void p; void ang;
  }

  /* -------------------------------------------------- ciclo */
  function normalizar(t) {
    return Math.max(0, Math.min(1, t));
  }

  function ease(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function frame(agora) {
    if (parar) return;
    /* Saiu do ecrã: deixa de pedir frames. O `inicio` fica guardado, de
       modo que voltar a entrar retoma de onde ia em vez de recomeçar. */
    if (!visivel) return;
    const t = reduzir ? 1 : normalizar((agora - inicio) / DURACAO);
    const prog = ease(t);

    ctx.clearRect(0, 0, w, h);
    desenharPais();

    /* Iluminar ANTES de desenhar, senão o brilho atrasa-se um frame e a
       província de onde o avião acaba de sair fica apagada no instante em
       que sai dela. */
    const idx = Math.min(pontos.length - 1, Math.floor(prog * (pontos.length - 1)));
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

    desenharProvincias(prog);
    desenharAgencias();
    desenharSetas(prog);
    desenharRota(prog);

    if (t > 0.02) {
      const p = pontoEm(prog);
      /* A direcção vem da tangente da curva, não da reta entre o ponto
         actual e o seguinte. Nos saltos que dobram, a reta entre dois
         pontos da mesma curva aponta para fora dela — o avião virava a
         esquina antes de a curva virar. */
      const iSalto = saltos.findIndex((s) => prog < s.t1);
      const salto = saltos[iSalto === -1 ? saltos.length - 1 : iSalto];
      const dentro = salto.t1 > salto.t0
        ? Math.min(1, Math.max(0, (prog - salto.t0) / (salto.t1 - salto.t0)))
        : 0;
      const d0 = em(salto, Math.max(0, dentro - 0.02));
      const d1 = em(salto, Math.min(1, dentro + 0.02));
      const ang = Math.atan2(d1.y - d0.y, d1.x - d0.x);
      const tam = (w < 760 ? 15 : 24);
      desenharRastro(p, ang, idx);
      desenharAviao(p.x, p.y, ang, tam);
    }

    aoProgredir(prog);

    if (t >= 1) {
      // no fim fica estatico, a resplandor no Maputo
      setTimeout(() => { parar = true; }, 600);
      return;
    }
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
    mapa = {};
    for (const nome in PROVINCIAS) mapa[nome] = 0;
  }
  montar();

  window.addEventListener('resize', () => {
    if (!parar) { montar(); }
  }, { passive: true });

  if (reduzir) {
    // sem animação: mostra o país, as agências e a rota completa, estático
    requestAnimationFrame(() => {
      const prog = ease(1);
      ctx.clearRect(0, 0, w, h);
      desenharPais();
      for (const nome in PROVINCIAS) mapa[nome] = 0.32;
      desenharProvincias(prog);
      desenharAgencias();
      desenharSetas(prog);
      desenharRota(prog);
      aoProgredir(prog);
    });
    return () => {};
  }

  if ('IntersectionObserver' in window) {
    /* Pausa nos DOBOS sentidos: sem isto, se o utilizador descer o
       scroll durante o voo, o canvas continuava a pintar fora
       do ecrã. O mapa (`iniciarMapa`, em main.js) já fazia assim.
       `inicio` mantém-se, por isso voltar a entrar retoma o voo de
       onde ia em vez de recomeçar. */
    new IntersectionObserver((e) => {
      const dentro = e[0].isIntersecting;
      if (dentro && !visivel && !parar) {
        visivel = true;
        requestAnimationFrame(frame);
      } else if (!dentro) {
        visivel = false;
      }
    }, { threshold: 0.2 }).observe(canvas);
  } else {
    visivel = true;
    requestAnimationFrame(frame);
  }

  return () => { parar = true; visivel = false; };
}

export { ROTA, DURACAO, PASSOS_POR_SALTO };
