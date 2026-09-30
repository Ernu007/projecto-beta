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
    /* Devolve o foco ao gatilho — mas SÓ quando o foco está dentro do
       menu que está a fechar, ou já se perdeu no `<body>`.

       A guarda antiga era `!menu.contains(document.activeElement)`, que
       exclui exactamente o caso que precisa disto: fechar o menu com o
       Escape enquanto um link dele tem o foco. Aí o `focus()` não corria,
       e 320 ms depois o painel ia para `display:none` com o foco num nó
       que deixava de existir — o teclado perdia a posição e a pessoa
       recomeçava do topo do documento.

       E o ternário era `(focoMenu === menuBtn ? menuBtn : menuBtn)`: os
       dois ramos iguais, com `focoMenu` capturado na abertura e nunca
       usado. A intenção era `focoMenu ?? menuBtn`. */
    const dentroDoMenu = menu.contains(document.activeElement);
    const semFoco = document.activeElement === document.body
      || document.activeElement === null;
    if (dentroDoMenu || semFoco) {
      (focoMenu instanceof HTMLElement ? focoMenu : menuBtn).focus();
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
/* `IntersectionObserver` no topo do módulo, sem guarda, é a mesma
   armadilha do `raizOrc`: um `new` que rebenta aqui aborta a avaliação
   do módulo e mata tudo o que está DEBAIXO — o modal do orçamento, o
   diálogo legal, a confirmação, o mapa e a galeria. Numa WebView
   antiga, ou com `dom.intersectionobserver` desligado, uma referência a
   partir do topo do módulo é um ReferenceError.

   Três sítios do projecto usam o observador. Passam todos pela mesma
   constante, para não ficar um deles de fora — que é exactamente como
   o das etapas ficou. */
const TEM_IO = 'IntersectionObserver' in window;
if (TEM_IO && !REDUCIDO) {
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
if (etapas.length && TEM_IO) {
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

/* `modal-aberto` trava o scroll do fundo (`overflow: hidden` em
   styles.css). Quem decidia se a classe estava ou não era cada
   abrir/fechar, a fazer `add` e `remove` por sua conta — e o diálogo
   legal é aberto DE CIMA do modal, a partir da caixa de consentimento
   que está lá dentro.

   O `fecharLegal` tirava a classe sem reparar que o modal continuava
   aberto: fechar a Política de Privacidade destravava o scroll com o
   pop-up do orçamento ainda no ecrã, e a página passava a rolar por trás
   da máscara. Com os dois abertos há ainda dois `aria-modal="true"`
   empilhados sem `inert`, e o leitor de ecrã tem de adivinhar qual é o
   diálogo activo.

   Em vez de alternar, deriva-se do estado: qualquer sobreposição aberta
   mantém a classe, e só quando nenhuma está é que ela sai. */
function sincronizarBody() {
  const algumAberto = [modal, legal, confirm].some((el) => el?.dataset.aberto === 'true');
  document.body.classList.toggle('modal-aberto', algumAberto);
}

function abrirModal() {
  focoAnterior = document.activeElement;
  modal.dataset.aberto = 'true';
  sincronizarBody();
  const primeiro = modal.querySelector('.modal__fechar');
  setTimeout(() => primeiro?.focus(), 60);
}
function fecharModal() {
  modal.dataset.aberto = 'false';
  sincronizarBody();
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
  /* Com a confirmação aberta por cima, o Escape é dela. Sem esta guarda,
     o handler do modal corria primeiro e fechava os dois: a pessoa
     perdia o resumo por confirmar sem aviso. */
  if (confirm?.dataset.aberto === 'true') return;
  /* A mesma precedência para a Política de Privacidade, que também
     abre por cima do modal. Sem esta guarda, um Escape fechava os dois:
     a pessoa lia os termos, carregava Escape para os fechar, e perdia
     o formulário do orçamento que tinha-filled por baixo. */
  if (legal?.dataset.aberto === 'true') return;
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
  /* A Política de Privacidade abre-se de dentro do modal do orçamento
     (é a caixa de consentimento que a chama). Com os dois abertos, o
     modal de baixo tem de ficar `inert`: senão o teclado e o leitor de
     ecrã continuam a passear pelo formulário que está por baixo do
     diálogo que se está a ler, e há dois `aria-modal="true"` sem forma
     de saber qual manda. É o mesmo cuidado que `abrirConfirmacao` já
     toma, com o mesmo comentário de porquê. */
  const sobreModal = modal.dataset.aberto === 'true';
  if (sobreModal) modal.inert = true;
  legal.dataset.sobreModal = sobreModal ? 'true' : 'false';
  legal.dataset.aberto = 'true';
  sincronizarBody();
  setTimeout(() => legal.querySelector('.legal__fechar')?.focus(), 60);
}
function fecharLegal() {
  legal.dataset.aberto = 'false';
  /* Só se desarma o `inert` se foi este diálogo que o pôs. E a classe do
     body sai por `sincronizarBody`, que sabe que o modal continua
     aberto — antes era um `remove` incondicional que destravava o
     scroll com o orçamento ainda no ecrã. */
  if (legal.dataset.sobreModal === 'true') modal.inert = false;
  sincronizarBody();
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
/* `planoEnvio` estava em falta nesta lista e era usado no `enviarPedido`:
   um ReferenceError no clique em "Confirmar e enviar", depois de o
   resumo ja ter fechado — o pedido desaparecia sem mensagem nenhuma.
   Os cinco nomes que estavam aqui (`msgEmpresa`, `msgCliente`,
   `linkWa`, `normalizarTelefone`, `JVI_WHATSAPP`) nunca foram usados
   neste ficheiro: saem com a correccao. Quem manda no texto do
   WhatsApp e' o `planoEnvio`, dentro de `orcamento.js`. */
import {
  iniciarOrcamento, linhasResumo, planoEnvio,
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

/* A raiz do orcamento. `raizOrc` e' lido duas vezes aqui em baixo e
   uma vez no fim do ficheiro, e tinha deixado de estar DECLARADO: o
   `?.` protege contra valor null, nao contra um binding inexistente,
   por isso a linha 500 era um ReferenceError e a 579 (topo do modulo)
   rebentava o `main.js` inteiro assim que a pagina abria. Morriam o
   envio do orcamento, o mapa e a galeria.

   E o aviso do paragrafo seguinte nao apanha este caso: um comentario
   defensivo no MEIO do modulo nao consegue defender o modulo. O que
   apanha e' tests/identificadores.test.js, que varre o ficheiro todo
   e falha se um identificador for usado sem ser declarado nem
   importado. */
const raizOrc = document.getElementById('orcRaiz');

/* Um no que nao exista no HTML nao pode derrubar o modulo inteiro.
   Isto aconteceu: o ecra de sucesso ficou irmao de #orcRaiz em vez de
   descendente, o querySelector devolveu null, e o TypeError matou o
   envio do orcamento, o mapa e a galeria -- tudo o que viesse depois
   da linha no topo do modulo. tests/dom.test.js apanha a versao do
   HTML; isto apanha a proxima, e so avisa em vez de rebentar. */
const noRaiz = (sel) => {
  const el = raizOrc?.querySelector(sel) ?? null;
  if (!el) console.warn(`JVI: ${sel} nao existe dentro de #orcRaiz.`);
  return el;
};

const okCaixa = noRaiz('[data-ok]');
const okNota = noRaiz('[data-ok-nota]');
const okEmpresa = noRaiz('[data-ok-empresa]');
const okCliente = noRaiz('[data-ok-cliente]');

/* Le um campo do formulario, ou string vazia se nao existir. */
const g = (form, nome) => (form.elements[nome]?.value ?? '').toString().trim();
async function enviarPedido(d) {
  const plano = planoEnvio(d);

  /* 1. A abertura automática acontece ANTES de qualquer `await`.
     O browser só permite abrir um separador novo em resposta directa a
     um gesto do utilizador; um `fetch` de 1 a 3 segundos (que é o
     tempo normal em Moçambique) consome a activação transitória e o
     `window.open` é bloqueado. Além disso, com `noopener` o valor de
     retorno é SEMPRE null, por isso não dá para saber se abriu — e é
     por isso que os dois links do ecrã de sucesso são sempre a entrega
     garantida, e a abertura automática é apenas um bónus sobre o qual
     não se diz nada ao utilizador. */
  window.open(plano.empresa.url, '_blank', 'noopener');
  if (plano.cliente) {
    setTimeout(() => window.open(plano.cliente.url, '_blank', 'noopener'), 800);
  }

  /* 2. Ecrã de sucesso, montado antes do registo: se a rede falhar,
     o utilizador tem de ver os links na mesma. */
  okEmpresa.href = plano.empresa.url;
  okEmpresa.hidden = false;
  okEmpresa.querySelector('span').textContent = plano.empresa.rotulo;
  if (plano.cliente) {
    okCliente.href = plano.cliente.url;
    okCliente.hidden = false;
    okCliente.querySelector('span').textContent = plano.cliente.rotulo;
  } else {
    okCliente.hidden = true;
  }
  const avisos = [...plano.avisos];

  formOrc.hidden = true;
  okCaixa.hidden = false;
  okNota.textContent = avisos.join(' ');
  okCaixa.querySelector('h3').focus();

  /* 3. Registo no Netlify — plano B, por último, para não atrasar
     nada do que o utilizador tem de ver. */
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
    /* `r.ok` só diz que a resposta foi 2xx — e o servidor responde 200
       em três situações que não são "registado":

         {ok:true, email:…, sheet:…}        — registado mesmo
         {ok:true, spam:true}               — descartado como bot
         {ok:true, registo:false}           — NENHUM canal funcionou

       A terceira é a configuração por omissão: a função documenta que
       nenhuma das chaves é obrigatória, e sem `RESEND_API_KEY` nem
       `SHEET_ID` — o estado de um site novo — o servidor responde
       200/registo:false e não escreve nada em lado nenhum. Com `r.ok`
       a dizer `true`, o site affirmava "Pedido também registado no
       sistema da JVI" sem que existisse registo, e a Política de
       Privacidade promete ao cliente que o pedido fica numa folha de
       cálculo.

       O que se diz ao utilizador tem de ser o que o servidor respondeu,
       e não o que o HTTP deixou passar.

       A chave é `registo`, sem o "r" — é o que o `functions/submit.js`
       devolve. O `tests/registo.test.js` fixa o nome dos dois lados, que
       é a forma mais barata de isto voltar a divergir em silêncio. */
    const j = await r.json().catch(() => ({}));
    registado = r.ok && j.spam !== true && j.registo !== false;
  } catch {
    registado = false;
  }
  if (registado) {
    okNota.textContent = avisos.concat(
      'Pedido também registado no sistema da JVI.').join(' ');
  }
}

/* Fechar rearma o formulário para o próximo pedido, sem recarregar.
   `form.reset()` repõe VALORES, não atributos: os `data-erro="true"` da
   tentativa anterior ficavam acesos, e quem mandasse dois pedidos na
   mesma sessão abria o segundo formulário já vermelho e com um banner a
   dizer "precisa de aceitar a Política de Privacidade". */
raizOrc.querySelector('[data-ok-fechar]')?.addEventListener('click', () => {
  okCaixa.hidden = true;
  okNota.textContent = '';
  okEmpresa.hidden = true;
  okCliente.hidden = true;
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
  sincronizarBody();
  confirm.querySelector('[data-confirmar]').focus();
}

function fecharConfirmacao() {
  confirm.dataset.aberto = 'false';
  modal.inert = false;
  /* O #modal continua aberto, por isso `sincronizarBody` mantém a classe
     — que é o que se quer. Chamá-lo na mesma é que torna o código
     independente da ordem: se um dia o modal não estiver aberto, a
     classe sai em vez de ficar presa. */
  sincronizarBody();
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
