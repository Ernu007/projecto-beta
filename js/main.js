/* =========================================================
   JVI Carga & Serviços — Landing Page
   ========================================================= */

const REDUCIDO = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* =========================================================
   HEADER + MENU MÓVEL + BARRA DE PROGRESSO
   ========================================================= */
const header = document.getElementById('header');
const menu = document.getElementById('menu');
const menuBtn = document.getElementById('menuBtn');
const menuFundo = document.getElementById('menuFundo');
const barraTopo = document.getElementById('barraTopo');

let timerMenu = null;
let focoMenu = null;

function alternarMenu(abrir) {
  clearTimeout(timerMenu);
  menuFundo.dataset.visivel = String(abrir);
  menuBtn.setAttribute('aria-expanded', String(abrir));
  /* O nome do botão tem de mudar com o estado: senão um leitor de
     ecrã anuncia "Abrir menu" com o menu já aberto. */
  menuBtn.setAttribute('aria-label', abrir ? 'Fechar menu' : 'Abrir menu');
  if (abrir) {
    delete menu.dataset.estado;
    menu.dataset.aberto = 'true';
    document.body.style.overflow = 'hidden';
    /* O foco entra no painel e fica lá: o fundo fixo bloqueia o rato,
       mas sem isto o Tab caminhava para a página que está por trás. */
    focoMenu = document.activeElement;
    setTimeout(() => menu.querySelector('a, button')?.focus(), 60);
  } else {
    // deixa a animacao de saida correr antes de tirar do layout
    if (menu.dataset.aberto === 'true') {
      menu.dataset.estado = 'a-fechar';
      timerMenu = setTimeout(() => {
        menu.dataset.aberto = 'false';
        delete menu.dataset.estado;
      }, 320);
    }
    document.body.style.overflow = '';
    if (document.body.contains(document.activeElement)
      && !menu.contains(document.activeElement)) {
      (focoMenu === menuBtn ? menuBtn : menuBtn).focus();
    }
  }
}
menuBtn.addEventListener('click', () => alternarMenu(menu.dataset.aberto !== 'true'));
menuFundo.addEventListener('click', () => alternarMenu(false));
menu.querySelectorAll('a, button').forEach((el) => el.addEventListener('click', () => alternarMenu(false)));

/* Scroll: header preso + barra de progresso */
function aoDeslocar() {
  const y = window.scrollY;
  header.classList.toggle('header--preso', y > 40);
  const max = document.documentElement.scrollHeight - window.innerHeight;
  barraTopo.style.width = `${max > 0 ? (y / max) * 100 : 0}%`;
}
window.addEventListener('scroll', aoDeslocar, { passive: true });
aoDeslocar();

/* =========================================================
   ANIMAÇÕES AO SCROLL (IntersectionObserver)
   ========================================================= */
const alvos = document.querySelectorAll('.revelar');
if ('IntersectionObserver' in window && !REDUCIDO) {
  const obs = new IntersectionObserver(
    (entradas) => {
      entradas.forEach((e) => {
        if (e.isIntersecting) {
          e.target.dataset.visivel = 'true';
          obs.unobserve(e.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
  );
  alvos.forEach((el) => obs.observe(el));
} else {
  alvos.forEach((el) => (el.dataset.visivel = 'true'));
}

/* =========================================================
   ETAPAS — destaca a etapa visível e desenha a linha
   ========================================================= */
const etapas = document.querySelectorAll('.etapa');
const fluxoLinha = document.getElementById('fluxoLinha');
if (etapas.length) {
  const obsEtapas = new IntersectionObserver(
    (entradas) => {
      entradas.forEach((e) => e.target.setAttribute('aria-current', String(e.isIntersecting)));
    },
    { threshold: 0.6 }
  );
  etapas.forEach((e) => obsEtapas.observe(e));

  if (fluxoLinha && !REDUCIDO) {
    const obsLinha = new IntersectionObserver(
      (entradas) => {
        entradas.forEach((e) => {
          if (!e.isIntersecting) return;
          const pai = e.target.parentElement;
  const altura = pai.offsetHeight;
  const topo = e.target.offsetTop;
          const p = Math.min(1, Math.max(0, topo / altura));
          fluxoLinha.style.height = `${p * 100}%`;
        });
      },
      { threshold: [0, 0.5, 1] }
    );
    etapas.forEach((e) => obsLinha.observe(e));
  }
}

/* =========================================================
   HERO — rota a desenhar-se + caixas 3D
   ========================================================= */
/* =========================================================
   HERO — voo da carga (Pemba -> Maputo) e revelacao do titulo
   ========================================================= */
import { iniciarVoo, ROTA } from './hero-voo.js';

const NOME_PALAVRA = {
  0: 'Cabo Delgado', 1: 'Nampula', 2: 'Zambézia',
  3: 'Sofala', 4: 'Gaza', 5: 'Maputo',
};

function iniciarHero() {
  const canvas = document.getElementById('canvasHero');
  const hero = document.getElementById('hero');
  if (!canvas || !hero) return;

  /* Cada palavra do título acende quando o avião entra na província
     correspondente. Sem o scene, o título fica todo visível. */
  const palavras = [...hero.querySelectorAll('.pal')];
  const marca = palavras.map((el) => {
    el.style.setProperty('--p', '0');
    return el;
  });
  /* Se a animação não arrancar, o título não pode ficar apagado: o
     piso de opacidade em CSS segura-se, mas melhor é repô-lo. */
  const reporTitulo = () => marca.forEach((el) => el.style.setProperty('--p', '1'));

  requestAnimationFrame(() => {
    hero.classList.add('pronto');
    try {
      iniciarVoo(canvas, {
        aoProgredir(prog) {
          palavras.forEach((el, i) => {
            const alvo = (i + 0.35) / palavras.length;
            const v = Math.max(0, Math.min(1, (prog - alvo) / 0.16));
            el.style.setProperty('--p', v.toFixed(3));
          });
          marca.length; void NOME_PALAVRA; void ROTA;
        },
      });
    } catch (erro) {
      console.warn('JVI: a animação do hero não arrancou — título reposto.', erro);
      reporTitulo();
    }
  });
  /* Rede de segurança: se daqui a 9 s o título ainda estiver apagado,
     é porque o IntersectionObserver nunca disparou. */
  setTimeout(() => {
    if (palavras.some((el) => Number(el.style.getPropertyValue('--p')) < 1)) {
      reporTitulo();
    }
  }, 9000);
}

/* =========================================================
   MAPA DE MOÇAMBIQUE — provinces reais
   ------------------------------------------------------------
   O desenho vem de js/mapa-dados.js, gerado a partir do
   geoBoundaries ADM1. Aqui so se faz a projecao, o brilho
   quando a rota passa e as etiquetas.
   ========================================================= */
import { BBOX, PROVINCIAS, CAPITAIS } from './mapa-dados.js';

function iniciarMapa() {
  const canvas = document.getElementById('canvasMapa');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const reduzir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const LARG = BBOX[2] - BBOX[0];
  const ALT = BBOX[3] - BBOX[1];

  let w = 0, h = 0, esc = 1, ox = 0, oy = 0;
  let visivel = false;
  let t0 = performance.now();
  const hub = CAPITAIS['Maputo'];
  const brilho = {};

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    if (!w || !h) return;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const pad = w < 700 ? 14 : 40;
    const padB = w < 700 ? 26 : 40;
    esc = Math.min((w - pad * 2) / LARG, (h - pad - padB) / ALT);
    ox = (w - LARG * esc) / 2;
    oy = pad + (h - pad - padB - ALT * esc) / 2;
  }

  /* BBOX ja vem projectado (lon*cos, -lat): subtrair a origem e obrigatorio,
     senao o mapa e desenhado fora do canvas. */
  const X = (lx) => ox + (lx - BBOX[0]) * esc;
  const Y = (ly) => oy + (ly - BBOX[1]) * esc;

  function caminho(anel, fechar) {
    ctx.beginPath();
    for (let i = 0; i < anel.length; i += 1) {
      if (i === 0) ctx.moveTo(X(anel[i][0]), Y(anel[i][1]));
      else ctx.lineTo(X(anel[i][0]), Y(anel[i][1]));
    }
    if (fechar) ctx.closePath();
  }

  function etiqueta(x, y, t, cor, align) {
    ctx.save();
    ctx.font = '700 11px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = '#0F172A';
    ctx.lineJoin = 'round';
    ctx.strokeText(t, x, y);
    ctx.fillStyle = cor;
    ctx.fillText(t, x, y);
    ctx.restore();
  }

  function desenhar(t) {
    ctx.clearRect(0, 0, w, h);

    // provincia a provincia: exterior desenhado por cima da linha verde
    for (const nome in PROVINCIAS) {
      const b = brilho[nome] || 0;
      for (const anel of PROVINCIAS[nome]) {
        caminho(anel, true);
        if (anel === PROVINCIAS[nome][0]) {
          ctx.fillStyle = b > 0
            ? `rgba(169,207,68,${(0.05 + 0.26 * b).toFixed(3)})`
            : 'rgba(169,207,68,0.035)';
          ctx.fill();
        }
        ctx.strokeStyle = b > 0
          ? `rgba(169,207,68,${(0.4 + 0.5 * b).toFixed(3)})`
          : 'rgba(169,207,68,0.5)';
        ctx.lineWidth = 1 + b * 1.1;
        ctx.stroke();
      }
    }

    // rota de cada capital ate ao hub
    for (const nome in CAPITAIS) {
      if (nome === 'Maputo') continue;
      const c = CAPITAIS[nome];
      const p = Math.max(0, Math.min(1, (t - (distancia(c, hub) / 9)) * 1.2));
      if (p <= 0) continue;
      const x = X(c.x);
      const y = Y(c.y);
      const hx = X(hub.x);
      const hy = Y(hub.y);
      const ccx = (x + hx) / 2 + (hy - y) * 0.18;
      const ccy = (y + hy) / 2 - (hx - x) * 0.18;

      ctx.save();
      ctx.setLineDash([4, 5]);
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = 'rgba(169,207,68,0.75)';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(ccx, ccy, hx, hy);
      ctx.stroke();
      ctx.setLineDash([]);

      const e = p * p * (3 - 2 * p);
      const m = 1 - e;
      const tx = m * m * x + 2 * m * e * ccx + e * e * hx;
      const ty = m * m * y + 2 * m * e * ccy + e * e * hy;
      const rg = ctx.createRadialGradient(tx, ty, 0, tx, ty, 9);
      rg.addColorStop(0, '#A9CF44');
      rg.addColorStop(1, 'transparent');
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.arc(tx, ty, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = '#A9CF44';
      ctx.beginPath();
      ctx.arc(x, y, 3.4, 0, Math.PI * 2);
      ctx.fill();
    }

    // hub
    const hx = X(hub.x);
    const hy = Y(hub.y);
    const pulso = 13 + Math.sin(t * 2.2) * 4;
    ctx.save();
    const hg = ctx.createRadialGradient(hx, hy, 0, hx, hy, 28);
    hg.addColorStop(0, 'rgba(234,130,64,0.75)');
    hg.addColorStop(1, 'transparent');
    ctx.fillStyle = hg;
    ctx.beginPath();
    ctx.arc(hx, hy, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = '#EA8240';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.arc(hx, hy, pulso, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#EA8240';
    ctx.beginPath();
    ctx.arc(hx, hy, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // nomes das capitais, por ultimo para ficarem por cima
    if (w > 430) {
      for (const nome in CAPITAIS) {
        const c = CAPITAIS[nome];
        etiqueta(X(c.x) + (c.x < 34 ? -9 : 9), Y(c.y) + 13, c.nome,
          '#A9CF44', c.x < 34 ? 'right' : 'left');
      }
    }
  }

  function distancia(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  resize();
  window.addEventListener('resize', () => { if (visivel) desenhar((performance.now() - t0) / 1000); }, { passive: true });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver((e) => {
      visivel = e[0].isIntersecting;
      if (!visivel) return;
      resize();
      t0 = performance.now();
      if (reduzir) { desenhar(3); return; }
      const passo = (agora) => {
        if (!visivel) return;
        desenhar((agora - t0) / 1000);
        requestAnimationFrame(passo);
      };
      requestAnimationFrame(passo);
    }, { threshold: 0.15 }).observe(canvas);
  } else {
    visivel = true;
    desenhar(3);
  }
  void brilho;
}

/* =========================================================
   MODAL
   ========================================================= */
const modal = document.getElementById('modal');
let focoAnterior = null;

const FOCAVEIS = 'a[href], button:not([disabled]), input:not([disabled]):not([tabindex="-1"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function abrirModal() {
  focoAnterior = document.activeElement;
  modal.dataset.aberto = 'true';
  document.body.classList.add('modal-aberto');
  const primeiro = modal.querySelector('.modal__fechar');
  setTimeout(() => primeiro?.focus(), 60);
}
function fecharModal() {
  modal.dataset.aberto = 'false';
  document.body.classList.remove('modal-aberto');
  focoAnterior?.focus();
}
modal.querySelectorAll('[data-fechar]').forEach((el) => el.addEventListener('click', fecharModal));
document.addEventListener('keydown', (e) => {
  /* O menu móvel também fecha com Escape e prende o foco: é um
     painel sobre o conteúdo, mesmo sem aria-modal. */
  if (menu.dataset.aberto === 'true') {
    if (e.key === 'Escape') { alternarMenu(false); return; }
    if (e.key === 'Tab') {
      const itens = [...menu.querySelectorAll(FOCAVEIS)].filter((el) => el.offsetParent !== null);
      if (itens.length) {
        const primeiro = itens[0];
        const ultimo = itens[itens.length - 1];
        if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
        else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
      }
    }
  }
  if (modal.dataset.aberto !== 'true') return;
  if (e.key === 'Escape') { fecharModal(); return; }
  /* Focus trap: o Tab nao pode sair do dialogo enquanto estiver aberto */
  if (e.key !== 'Tab') return;
  const itens = [...modal.querySelectorAll(FOCAVEIS)].filter((el) => el.offsetParent !== null);
  if (!itens.length) return;
  const primeiro = itens[0];
  const ultimo = itens[itens.length - 1];
  if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
  else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
});

/* =========================================================
   DIÁLOGO LEGAL (política de privacidade)
   ========================================================= */
const legal = document.getElementById('legalPrivacidade');
let focoLegal = null;

function abrirLegal() {
  focoLegal = document.activeElement;
  legal.dataset.aberto = 'true';
  document.body.classList.add('modal-aberto');
  setTimeout(() => legal.querySelector('.legal__fechar')?.focus(), 60);
}
function fecharLegal() {
  legal.dataset.aberto = 'false';
  document.body.classList.remove('modal-aberto');
  focoLegal?.focus();
}
document.querySelectorAll('[data-legal="privacidade"]').forEach((el) => {
  el.addEventListener('click', (e) => { e.preventDefault(); abrirLegal(); });
});
legal.querySelectorAll('[data-fechar-legal]').forEach((el) => el.addEventListener('click', fecharLegal));
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && legal.dataset.aberto === 'true') fecharLegal();
  if (e.key !== 'Tab' || legal.dataset.aberto !== 'true') return;
  const itens = [...legal.querySelectorAll(FOCAVEIS)].filter((el) => el.offsetParent !== null);
  if (!itens.length) return;
  const primeiro = itens[0];
  const ultimo = itens[itens.length - 1];
  if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
  else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
});

/* =========================================================
   FORMULÁRIO DE ORÇAMENTO — 3 passos, dentro do pop-up
   ========================================================= */
import { calcularPreco } from './precos.js';
import { iniciarGaleria } from './galeria.js';
import {
  iniciarOrcamento, msgEmpresa, msgCliente, linkWa, linhasResumo,
  normalizarTelefone, JVI_WHATSAPP,
} from './orcamento.js';

/* O formulário vive só no modal — o briefing pede pop-up, e uma
   segunda instância na secção obligaria a prefixar todos os IDs.
   A secção fica com o CTA e a tabela de preços em texto. */
document.getElementById('orcRaiz').append(
  document.getElementById('tplOrc').content.cloneNode(true)
);
iniciarOrcamento(document.querySelector('#orcRaiz [data-orc]'));

/* Todos os "Pedir orçamento" abrem o pop-up, sem excepções por
   largura de ecrã. */
const formOrc = document.querySelector('#orcRaiz [data-orc]');
document.querySelectorAll('[data-abrir-orc]').forEach((btn) => {
  btn.addEventListener('click', () => {
    /* A função serverless descarta pedidos com menos de 3 s de
       preenchimento como bots. A contagem tem de começar quando o
       formulário é aberto, não quando se carrega em enviar. */
    if (!formOrc.dataset.abertoEm) formOrc.dataset.abertoEm = String(Date.now());
    abrirModal();
  });
});

/* =========================================================
   ENVIO: REGISTO (PLANO B) + DUAS MENSAGENS DE WHATSAPP
   ------------------------------------------------------------
   Decisão D4: o browser bloqueia a segunda `window.open` em
   sequência. Por isso a mensagem para a JVI abre-se sozinha, dentro
   do gesto do utilizador, e a mensagem para o cliente fica num botão
   explícito no ecrã de sucesso. A tentativa automática só existe se a
   primeira janela abriu.
   ========================================================= */
const raizOrc = document.getElementById('orcRaiz');
const okCaixa = raizOrc.querySelector('[data-ok]');
const okNota = raizOrc.querySelector('[data-ok-nota]');
const okCliente = raizOrc.querySelector('[data-ok-cliente]');

/* Lê um campo do formulário, ou string vazia se não existir. */
const g = (form, nome) => (form.elements[nome]?.value ?? '').toString().trim();

/* Um nó que não exista no HTML não pode derrubar o módulo inteiro.
   Isto aconteceu: o ecrã de sucesso ficou irmão de #orcRaiz em vez de
   descendente, o querySelector devolveu null, e o TypeError matou o
   envio do orçamento, o mapa e a galeria — tudo o que viesse depois
   da linha no topo do módulo. O teste em tests/dom.test.js apanha a
   versão do HTML; isto apanha a próxima. */
function noRaiz(seletores) {
  for (const sel of seletores) {
    const el = raizOrc.querySelector(sel);
    if (!el) {
      console.warn(`JVI: ${sel} não existe dentro de #orcRaiz — funcionalidade afectada.`);
      continue;
    }
    return el;
  }
  return null;
}

async function enviarPedido(d) {
  const clienteTel = normalizarTelefone(d.telefone);
  const paraEmpresa = linkWa(JVI_WHATSAPP, msgEmpresa(d));
  const paraCliente = clienteTel ? linkWa(clienteTel, msgCliente(d)) : null;

  /* 1. Registo no Netlify — plano B. Não pode travar o envio. */
  let registado = false;
  const ms = Date.now() - Number(formOrc.dataset.abertoEm || Date.now() - 5000);
  try {
    const r = await fetch('/.netlify/functions/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        origem: 'site',
        ...d,
        preco_total: calcularPreco(d.peso)?.total ?? '',
        website: g(formOrc, 'website'), // honeypot: um humano nunca preenche isto
        _t: ms,
      }),
    });
    registado = r.ok;
  } catch {
    registado = false;
  }

  /* 2. Mensagem para a JVI, dentro do gesto do utilizador. */
  const janela = window.open(paraEmpresa, '_blank', 'noopener');

  /* 3. Mensagem para o cliente. */
  const avisos = [];
  if (paraCliente) {
    okCliente.href = paraCliente;
    okCliente.hidden = false;
    okCliente.querySelector('span').textContent = 'Receber a confirmação no meu WhatsApp';
    if (janela && !janela.closed) {
      setTimeout(() => {
        if (!window.open(paraCliente, '_blank', 'noopener')) {
          avisos.push('O browser bloqueou a abertura automática. Use o botão acima.');
        }
      }, 800);
    } else {
      avisos.push('O browser bloqueou a abertura automática. Use o botão acima.');
    }
  } else {
    okCliente.hidden = true;
    avisos.push('Não conseguimos montar a ligação para o seu número. A JVI entra em contacto pela linha directa.');
  }
  if (!registado) {
    avisos.push('O registo automático está indisponível — o envio por WhatsApp está garantido.');
  }

  formOrc.hidden = true;
  okCaixa.hidden = false;
  okNota.textContent = avisos.join(' ');
  okCaixa.querySelector('h3').focus();
}

/* Fechar rearma o formulário para o próximo pedido, sem recarregar. */
raizOrc.querySelector('[data-ok-fechar]')?.addEventListener('click', () => {
  okCaixa.hidden = true;
  okNota.textContent = '';
  formOrc.reset();
  formOrc.hidden = false;
  formOrc.dispatchEvent(new Event('rearmar'));
  formOrc.dataset.abertoEm = String(Date.now());
  fecharModal();
});

/* =========================================================
   CONFIRMAÇÃO ANTES DO ENVIO
   ------------------------------------------------------------
   O formulário, já validado, emite `orc:pronto` com os dados.
   Aqui desenham-se e espera-se por "Confirmar e enviar".
   ========================================================= */
const confirm = document.getElementById('confirm');
let dadosPedido = null;
let focoConfirm = null;
let confirmarHandler = null;

function abrirConfirmacao(d, aoConfirmar) {
  dadosPedido = d;
  confirmarHandler = aoConfirmar;
  focoConfirm = document.activeElement;
  const dl = confirm.querySelector('[data-resumo-confirm]');
  dl.replaceChildren(...linhasResumo(d).flatMap(({ rotulo, valor, destaque }) => {
    const dt = document.createElement('dt');
    dt.textContent = rotulo;
    const dd = document.createElement('dd');
    dd.textContent = valor;
    if (destaque) dd.dataset.destaque = 'true';
    return [dt, dd];
  }));
  confirm.dataset.aberto = 'true';
  /* Dois aria-modal="true" empilhados confundem o leitor de ecrã: o
     #modal continua na árvore de acessibilidade por baixo de #confirm.
     `inert` tira-o de lá e impede a'interacção por trás. */
  modal.inert = true;
  document.body.classList.add('modal-aberto');
  confirm.querySelector('[data-confirmar]').focus();
}

function fecharConfirmacao() {
  confirm.dataset.aberto = 'false';
  modal.inert = false;
  document.body.classList.remove('modal-aberto');
  focoConfirm?.focus();
}

confirm.querySelectorAll('[data-fechar-confirm]')
  .forEach((el) => el.addEventListener('click', fecharConfirmacao));
confirm.querySelector('[data-confirmar]').addEventListener('click', () => {
  fecharConfirmacao();
  confirmarHandler?.(dadosPedido);
});

/* O resumo só mostra um valor por campo: nunca HTML vindo do
   utilizador, o que fecharia a porta a injecção de marcação. */
document.addEventListener('keydown', (e) => {
  if (confirm.dataset.aberto !== 'true') return;
  if (e.key === 'Escape') { fecharConfirmacao(); return; }
  if (e.key !== 'Tab') return;
  const itens = [...confirm.querySelectorAll(FOCAVEIS)].filter((el) => el.offsetParent !== null);
  if (!itens.length) return;
  const primeiro = itens[0];
  const ultimo = itens[itens.length - 1];
  if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
  else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
});

document.addEventListener('orc:pronto', (e) => {
  abrirConfirmacao(e.detail, enviarPedido);
});

/* =========================================================
   ARRANQUE
   ========================================================= */
document.getElementById('ano').textContent = new Date().getFullYear();
iniciarHero();
iniciarMapa();
iniciarGaleria(document.querySelector('[data-gal]'), document.getElementById('luz'));
