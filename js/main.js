/* =========================================================
   JVI Carga & Serviços — site de 5 páginas (Fase 10)
   ========================================================= */


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

/* Fase 10B: menu de âncoras. O item da secção visível leva aria-current.
   Escolhe-se a última secção cujo topo já passou da linha do cabeçalho;
   o IntersectionObserver só avisa quando alguma muda de estado. */
const ligacoesMenu = [...document.querySelectorAll('.nav a[href^="#"], .menu a[href^="#"]')];
const seccoesMenu = ['inicio', 'servicos', 'orcamento', 'sobre', 'contactos']
  .map((id) => document.getElementById(id)).filter(Boolean);
function marcarSeccaoActual() {
  const linha = header.offsetHeight + 24;
  let actual = seccoesMenu[0];
  for (const s of seccoesMenu) if (s.getBoundingClientRect().top <= linha) actual = s;
  /* No fim da página, a última secção pode ser curta demais para chegar à linha. */
  if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
    actual = seccoesMenu[seccoesMenu.length - 1];
  }
  ligacoesMenu.forEach((a) => {
    if (a.getAttribute('href') === `#${actual?.id}`) a.setAttribute('aria-current', 'true');
    else a.removeAttribute('aria-current');
  });
}
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver(marcarSeccaoActual, { threshold: [0, 0.1, 0.5, 1] });
  seccoesMenu.forEach((s) => io.observe(s));
}
window.addEventListener('scroll', marcarSeccaoActual, { passive: true });
window.addEventListener('resize', marcarSeccaoActual);
marcarSeccaoActual();

/* =========================================================
   HERO — voo da carga (Maputo -> Pemba -> Maputo, em loop)
   ========================================================= */
import { iniciarVoo } from './hero-voo.js';

function iniciarHero() {
  const canvas = document.getElementById('canvasHero');
  const hero = document.getElementById('inicio');
  if (!canvas || !hero) return;

  /* Fase 10B: o título não depende deste código — está visível desde o
     primeiro paint. Aqui só arranca o voo. */
  /* Fase 10C: no telemóvel o mapa fica no canto de baixo do primeiro ecrã,
     onde estão os botões fixos. Com o hero à vista os fixos escondem-se (o
     hero tem o seu próprio WhatsApp) e voltam ao sair dele. O CSS só aplica
     a classe abaixo de 900 px. */
  const fixos = document.querySelector('.fixos');
  if (fixos && 'IntersectionObserver' in window) {
    new IntersectionObserver((e) => {
      fixos.classList.toggle('fixos--sobre-hero', e[0].intersectionRatio >= 0.25);
    }, { threshold: [0, 0.25] }).observe(hero);
  }

  requestAnimationFrame(() => {
    try {
      iniciarVoo(canvas);
    } catch (erro) {
      console.warn('JVI: a animação do hero não arrancou.', erro);
    }
  });
}

/* =========================================================
   DIÁLOGOS: scroll do fundo e teclado do menu
   ========================================================= */
const legal = document.getElementById('legalPrivacidade');
const confirm = document.getElementById('confirm');

const FOCAVEIS = 'a[href], button:not([disabled]), input:not([disabled]):not([tabindex="-1"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/* `modal-aberto` trava o scroll do fundo (`overflow: hidden` em
   styles.css). Em vez de cada abrir/fechar fazer `add` e `remove` por sua
   conta, deriva-se do estado: qualquer sobreposição aberta mantém a
   classe, e só quando nenhuma está é que ela sai. */
function sincronizarBody() {
  const algumAberto = [legal, confirm].some((el) => el?.dataset.aberto === 'true');
  document.body.classList.toggle('modal-aberto', algumAberto);
}

document.addEventListener('keydown', (e) => {
  /* O menu móvel também fecha com Escape e prende o foco: é um
     painel sobre o conteúdo, mesmo sem aria-modal. */
  if (menu.dataset.aberto !== 'true') return;
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
});

/* =========================================================
   DIÁLOGO LEGAL (política de privacidade)
   ========================================================= */
let focoLegal = null;

function abrirLegal() {
  focoLegal = document.activeElement;
  legal.dataset.aberto = 'true';
  sincronizarBody();
  setTimeout(() => legal.querySelector('.legal__fechar')?.focus(), 60);
}
function fecharLegal() {
  legal.dataset.aberto = 'false';
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
import { iniciarGaleria, iniciarCarrossel } from './galeria.js';
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

/* Fase 10: o formulário vive na secção `#orcamento` de `index.html`, dentro de
   `#orcRaiz`. Nas outras páginas não há `#orcRaiz` e nada disto arranca:
   `iniciarOrcamento(null)` devolve logo. */
document.getElementById('orcRaiz')?.append(
  document.getElementById('tplOrc').content.cloneNode(true)
);
iniciarOrcamento(document.querySelector('#orcRaiz [data-orc]'));

/* A função serverless descarta pedidos com menos de 3 s de preenchimento
   como bots. A contagem começa quando o formulário aparece, não quando se
   carrega em enviar. */
const formOrc = document.querySelector('#orcRaiz [data-orc]');
if (formOrc) formOrc.dataset.abertoEm = String(Date.now());

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
  if (raizOrc && !el) console.warn(`JVI: ${sel} nao existe dentro de #orcRaiz.`);
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
raizOrc?.querySelector('[data-ok-fechar]')?.addEventListener('click', () => {
  okCaixa.hidden = true;
  okNota.textContent = '';
  okEmpresa.hidden = true;
  okCliente.hidden = true;
  formOrc.reset();
  formOrc.hidden = false;
  formOrc.dispatchEvent(new Event('rearmar'));
  formOrc.dataset.abertoEm = String(Date.now());
  formOrc.querySelector('input, select, textarea')?.focus();
});

/* =========================================================
   CONFIRMAÇÃO ANTES DO ENVIO
   ------------------------------------------------------------
   O formulário, já validado, emite `orc:pronto` com os dados.
   Aqui desenham-se e espera-se por "Confirmar e enviar".
   ========================================================= */
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
  sincronizarBody();
  confirm.querySelector('[data-confirmar]').focus();
}

function fecharConfirmacao() {
  confirm.dataset.aberto = 'false';
  sincronizarBody();
  focoConfirm?.focus();
}

confirm?.querySelectorAll('[data-fechar-confirm]')
  .forEach((el) => el.addEventListener('click', fecharConfirmacao));
confirm?.querySelector('[data-confirmar]').addEventListener('click', () => {
  fecharConfirmacao();
  confirmarHandler?.(dadosPedido);
});

/* O resumo só mostra um valor por campo: nunca HTML vindo do
   utilizador, o que fecharia a porta a injecção de marcação. */
document.addEventListener('keydown', (e) => {
  if (confirm?.dataset.aberto !== 'true') return;
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
const anoEl = document.getElementById('ano');
if (anoEl) anoEl.textContent = new Date().getFullYear();
iniciarHero();
iniciarGaleria(document.querySelector('[data-gal]'), document.getElementById('luz'));
iniciarCarrossel(document.querySelector('[data-gal]'));
