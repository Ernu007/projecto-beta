/* =========================================================
   Voo da carga — cena do hero
   ------------------------------------------------------------
   Um avião de carga parte de Pemba (Cabo Delgado) e desce até
   Maputo, seguindo a promessa da JVI: "de Rovuma ao Maputo".

   Desenhado em canvas 2D com sombreamento 3D, sem bibliotecas
   externas e sem pedidos de rede — para carregar depressa em
   ligações lentas, que é o caso comum em Moçambique.

   A cena notifica o progresso (0..1) para o texto do hero se
   revelar palavra a palavra à medida que o avião avança.
   ========================================================= */

import { BBOX, PAIS, PROVINCIAS, CAPITAIS } from './mapa-dados.js';

const VERDE = [169, 207, 68];
const LARANJA = [234, 130, 64];
const CLARO = [232, 237, 245];

/* Rota: Pemba -> Maputo. Passa por Nampula, Zambezia, Sofala e Gaza. */
const ROTA = ['Cabo Delgado', 'Nampula', 'Zambézia', 'Sofala', 'Gaza', 'Maputo'];

const DURACAO = 7000;          // ms de voo
const CURVA = 0.34;            // quanto a rota se afasta da linha recta

export function iniciarVoo(canvas, opcoes = {}) {
  const aoProgredir = opcoes.aoProgredir || (() => {});
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return () => {};

  const reduzir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let w = 0, h = 0, dpr = 1;
  let esc = 1, ox = 0, oy = 0;
  let pontos = [];            // trajectory em coordenadas de ecrã
  let mapa = [];              // provincia -> fator de iluminacao 0..1
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

  /* BBOX ja vem em unidades projectadas (lon*cos, -lat), por isso
     subtraimos a origem antes de escalar. Sem este desvio o mapa
     saia inteiramente fora do canvas. */
  const X = (lx) => ox + (lx - BBOX[0]) * esc;
  const Y = (ly) => oy + (ly - BBOX[1]) * esc;

  /* Catmull-Rom: a rota passa mesmo pelas capitais, com curvas suaves. */
  function construirRota() {
    const ancoras = ROTA.map((n) => {
      const c = CAPITAIS[n];
      return { x: X(c.x), y: Y(c.y), nome: n };
    });
    const curva = [];
    for (let i = 0; i < ancoras.length - 1; i += 1) {
      const a = ancoras[i];
      const b = ancoras[i + 1];
      const p0 = ancoras[i - 1] || a;
      const p3 = ancoras[i + 2] || b;
      for (let s = 0; s < 24; s += 1) {
        const t = s / 24;
        const t2 = t * t;
        const t3 = t2 * t;
        curva.push({
          x: 0.5 * ((2 * a.x) + (-p0.x + b.x) * t
            + (2 * p0.x - 5 * a.x + 4 * b.x - p3.x) * t2
            + (-p0.x + 3 * a.x - 3 * b.x + p3.x) * t3),
          y: 0.5 * ((2 * a.y) + (-p0.y + b.y) * t
            + (2 * p0.y - 5 * a.y + 4 * b.y - p3.y) * t2
            + (-p0.y + 3 * a.y - 3 * b.y + p3.y) * t3),
          de: a.nome,
        });
      }
    }
    const ult = ancoras[ancoras.length - 1];
    curva.push({ x: X(CAPITAIS[ult.nome].x), y: Y(CAPITAIS[ult.nome].y), de: ult.nome });
    return curva;
  }

  function pontoEm(p) {
    const n = pontos.length - 1;
    const i = Math.max(0, Math.min(n - 1, Math.floor(p * n)));
    const f = p * n - i;
    const a = pontos[i];
    const b = pontos[Math.min(n, i + 1)];
    return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, de: a.de };
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
      for (const anel of PROVINCIAS[nome]) {
        caminho(anel);
        if (anel === PROVINCIAS[nome][0]) {
          ctx.fillStyle = luz > 0
            ? `rgba(169,207,68,${0.05 + 0.3 * luz})`
            : 'rgba(255,255,255,0.012)';
          ctx.fill();
        }
        if (luz > 0) {
          ctx.strokeStyle = `rgba(169,207,68,${0.35 + 0.55 * luz})`;
          ctx.lineWidth = 0.6 + 1.1 * luz;
          ctx.stroke();
        }
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
    desenharProvincias(prog);
    desenharRota(prog);

    // ilumina as províncias por onde o avião já passou
    const idx = Math.min(pontos.length - 1, Math.floor(prog * (pontos.length - 1)));
    for (let i = 0; i <= idx; i += 1) {
      const n = pontos[i].de;
      mapa[n] = Math.max(mapa[n] || 0, Math.min(1, (mapa[n] || 0) + 0.035));
    }

    if (t > 0.02) {
      const p = pontoEm(prog);
      const q = pontos[Math.min(idx + 1, pontos.length - 1)];
      const ang = Math.atan2(q.y - p.y, q.x - p.x);
      const s = (w < 760 ? 15 : 24);
      desenharRastro(p, ang, idx);
      desenharAviao(p.x, p.y, ang, s);
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
    pontos = construirRota();
    mapa = {};
    for (const nome in PROVINCIAS) mapa[nome] = 0;
  }
  montar();

  window.addEventListener('resize', () => {
    if (!parar) { montar(); }
  }, { passive: true });

  if (reduzir) {
    // sem animação: mostra o país e a rota completa, estático
    requestAnimationFrame((agora) => {
      const t = 1;
      const prog = ease(t);
      ctx.clearRect(0, 0, w, h);
      desenharPais();
      for (const nome in PROVINCIAS) mapa[nome] = 0.32;
      desenharProvincias(prog);
      desenharRota(prog);
      aoProgredir(prog);
    });
    return () => {};
  }

  if ('IntersectionObserver' in window) {
    /* Pausa nos DOBOS sentidos: sem isto, se o utilizador descer o
       scroll durante os 7 s do voo, o canvas continuava a pintar fora
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

export { ROTA, DURACAO };
