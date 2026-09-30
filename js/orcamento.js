/* =========================================================
   JVI Carga & Serviços — Assistente de orçamento (3 passos)
   ------------------------------------------------------------
   Este módulo tem duas metades:
     1. funções puras (PROVINCIAS, normalizarPeso, normalizarTelefone,
        telefoneLegivel, msgEmpresa, msgCliente, linhasResumo, linkWa,
        dados) — testáveis em Node, sem DOM;
     2. iniciarOrcamento(form) — só DOM, chamada pelo main.js.

   O topo do módulo não toca no document, para que o `import` funcione
   no runner de testes sem nenhum shim.
   ========================================================= */

import { calcularPreco, formatarMT } from './precos.js';

export const PROVINCIAS = [
  'Cabo Delgado', 'Gaza', 'Inhambane', 'Manica', 'Maputo', 'Nampula',
  'Niassa', 'Palma', 'Sofala', 'Tete', 'Zambézia',
];

export const PAGAMENTOS = ['e-Mola', 'Cartão de crédito', 'Numerário'];

/* ---------- Telefone da empresa ----------
   FONTE ÚNICA do número. É o ÚNICO número válido: o cliente confirmou
   +258 84 793 5035 e mandou remover todos os outros que circulavam no
   material antigo. Quando vier outro, muda-se AQUI e em mais lado nenhum —
   é para não ter de caçar o número pelas cópias soltas no `index.html`, no
   JSON-LD e na carta. Formato `wa.me`: só dígitos, sem `+`. */
export const JVI_WHATSAPP = '258847935035';

/* ---------- Peso: aceita vírgula ou ponto ----------
   Em Moçambique escreve-se 11,7. O `input type="number"` devolve
   string vazia para quem escreve vírgula, por isso normalizamos. */
export function normalizarPeso(txt) {
  if (txt === null || txt === undefined) return null;
  const n = Number(String(txt).trim().replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/* ---------- Telefone: um só destino, qualquer escrita ----------
   Moçambique é 258; os móveis começam por 8 e têm 9 dígitos.
   Aceita o prefixo internacional, o `+`, o `00` e o `0` inicial. */
export function normalizarTelefone(txt) {
  if (txt === null || txt === undefined) return null;
  let d = String(txt).replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('258')) d = d.slice(3);
  else if (d.startsWith('0')) d = d.slice(1);
  if (!/^[2-9]\d{8}$/.test(d)) return null;
  return `258${d}`;
}

/** "258847935035" -> "+258 84 793 5035" */
export function telefoneLegivel(movel) {
  const m = normalizarTelefone(movel);
  if (!m) return '—';
  const n = m.slice(3);
  return `+258 ${n.slice(0, 2)} ${n.slice(2, 5)} ${n.slice(5)}`;
}

const num = (v) => (v === undefined || v === null ? '' : String(v).trim()) || '—';

/* ---------- Mensagem 1: para a JVI ----------
   O telefone do cliente vai NOMEADO como tal, e não como "WhatsApp":
   este aviso é lido no telefone da JVI, e a linha seguinte ao número é
   a que a JVI usa para LIGAR DE VOLTA. O rótulo desambigua os dois
   números do pedido — o do cliente e o da JVI, que é a constante
   `JVI_WHATSAPP` e só aparece no endereço do link.

   É a alternativa honesta à Fase 7B (avisar a JVI da aproximação do
   cliente com a posição), que fica desactivada por falta de API key
   do Google. Ver `docs/decisoes.md`. */
export function msgEmpresa(d) {
  const p = calcularPreco(d.peso);
  return [
    '*NOVO PEDIDO DE ORÇAMENTO — JVI Carga & Serviços*',
    '',
    `*Ref.:* JVI/${refInterno()}`,
    '',
    '*EMISSOR*',
    `• Nome: ${num(d.nome)} ${num(d.apelido)}`.replace('— —', '').trim(),
    `• Província: ${num(d.provincia)}`,
    `• Morada: ${num(d.morada)}`,
    `• Telefone do cliente: ${telefoneLegivel(d.telefone)}`,
    '',
    '*CARGA*',
    `• Peso: ${num(d.peso)} kg`,
    `• Dimensões: ${num(d.dimensao)}`,
    `• Mercadoria: ${num(d.descricao)}`,
    '',
    '*DESTINO*',
    `• Recebe: ${num(d.destinatario)}`,
    `• Província: ${num(d.provinciaDestino)}`,
    '',
    '*PAGAMENTO*',
    `• Forma: ${num(d.pagamento)}`,
    `• Paga no levantamento: ${d.pagarNoLevantamento === 'sim' ? 'Sim' : 'Não'}`,
    '',
    '*ORÇAMENTO*',
    p
      ? `• Base: ${formatarMT(p.base)} (${num(d.peso)} kg)\n• IVA 16%: ${formatarMT(p.iva)}\n• *TOTAL: ${formatarMT(p.total)}*`
      : '• a definir com a JVI',
  ].join('\n');
}

/* ---------- Mensagem 2: para o cliente ---------- */
export function msgCliente(d) {
  const p = calcularPreco(d.peso);
  return [
    '*JVI Carga & Serviços — o seu orçamento*',
    '',
    `Olá ${num(d.nome)},`,
    '',
    'Registo do seu pedido de transporte:',
    `• Carga: ${num(d.descricao)} — ${num(d.peso)} kg`,
    `• Destino: ${num(d.provinciaDestino)}`,
    '',
    p
      ? `*TOTAL: ${formatarMT(p.total)}* (base ${formatarMT(p.base)} + IVA ${formatarMT(p.iva)})`
      : 'O total é confirmado pela nossa equipa.',
    '',
    d.pagarNoLevantamento === 'sim'
      ? 'Registo que pretende *pagar no levantamento*, na província de destino.'
      : `Forma de pagamento: ${num(d.pagamento)}.`,
    '',
    'Agradecemos a confiança. A nossa equipa entra em contacto para combinar a recolha.',
    '',
    '_JVI Carga & Serviços, Lda · Av. 19 de Outubro, Terminal de Cargas Nº 113, Aeroporto de Maputo_',
  ].join('\n');
}

/* ---------- Resumo da confirmação ---------- */
/** Linhas do resumo que o cliente lê antes de confirmar: rótulo + valor. */
export function linhasResumo(d) {
  const p = calcularPreco(d.peso);
  return [
    { rotulo: 'Emissor', valor: `${num(d.nome)} ${num(d.apelido)}`.replace('— —', '').trim() },
    { rotulo: 'Origem', valor: num(d.provincia) },
    { rotulo: 'Morada', valor: num(d.morada) },
    { rotulo: 'WhatsApp', valor: telefoneLegivel(d.telefone) },
    { rotulo: 'Recebe', valor: num(d.destinatario) },
    { rotulo: 'Destino', valor: num(d.provinciaDestino) },
    { rotulo: 'Peso', valor: `${num(d.peso)} kg` },
    { rotulo: 'Dimensões', valor: d.dimensao ? num(d.dimensao) : 'não indicadas' },
    { rotulo: 'Mercadoria', valor: num(d.descricao) },
    { rotulo: 'Pagamento', valor: num(d.pagamento) },
    { rotulo: 'Paga no levantamento', valor: d.pagarNoLevantamento === 'sim' ? 'Sim' : 'Não' },
    { rotulo: 'Base', valor: p ? formatarMT(p.base) : '—' },
    { rotulo: 'IVA 16%', valor: p ? formatarMT(p.iva) : '—' },
    { rotulo: 'TOTAL', valor: p ? formatarMT(p.total) : '—', destaque: true },
  ];
}

/* ---------- Leitura do formulário ---------- */
/**
 * Lê o formulário para um objecto simples.
 * Só precisa de `form.elements[nome]` e de `form.querySelector`, por isso
 * também corre fora do browser — e é assim que os testes o exercitam.
 */
export function dados(form) {
  const g = (n) => (form.elements[n]?.value ?? '').toString().trim();
  return {
    nome: g('nome'), apelido: g('apelido'), provincia: g('provincia'),
    morada: g('morada'), telefone: g('telefone'),
    destinatario: g('destinatario'), provinciaDestino: g('provinciaDestino'),
    peso: g('peso'), dimensao: g('dimensao'), descricao: g('descricao'),
    pagamento: form.querySelector('input[name="pagamento"]:checked')?.value || 'Numerário',
    pagarNoLevantamento: form.querySelector('input[name="pagarNoLevantamento"]:checked')?.value || 'sim',
  };
}

/** Ligação wa.me com o número normalizado e a mensagem codificada. */
export function linkWa(numero, texto) {
  const n = normalizarTelefone(numero) || String(numero).replace(/\D/g, '');
  return `https://wa.me/${n}?text=${encodeURIComponent(texto)}`;
}

/**
 * Decide o que o ecrã de sucesso mostra depois de confirmar.
 *
 * Porquê uma função em vez de lógica no clique: o `window.open` com
 * `noopener` devolve SEMPRE `null` (MDN), portanto não dá para saber se
 * a abertura automática funcionou. A decisão passou a ser "mostra os
 * dois links, sempre", e a abertura automática é um bónus de que não se
 * fala. O link para a JVI é o pedido — sem ele, um pedido bloqueado
 * desaparecia por trás de um ecrã verde de sucesso.
 *
 * @param {object} d - o mesmo objecto que `dados(form)` devolve
 * @returns {{empresa:{url:string,rotulo:string},
 *            cliente:{url:string,rotulo:string}|null,
 *            avisoAbertura:null, avisos:string[]}}
 */
export function planoEnvio(d) {
  const clienteTel = normalizarTelefone(d.telefone);
  const avisos = [];
  if (!clienteTel) {
    avisos.push('Não conseguimos montar a ligação para o seu número. A JVI entra em contacto pela linha directa.');
  }
  return {
    empresa: {
      url: linkWa(JVI_WHATSAPP, msgEmpresa(d)),
      rotulo: 'Enviar o pedido à JVI',
    },
    cliente: clienteTel
      ? { url: linkWa(clienteTel, msgCliente(d)), rotulo: 'Receber a confirmação no meu WhatsApp' }
      : null,
    // Sempre null: o valor de retorno do window.open não diz nada.
    avisoAbertura: null,
    avisos,
  };
}

function refInterno() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

/* =========================================================
   PARTE DOM — só corre quando o browser chama
   ========================================================= */

/** Preenche um <select> com as províncias do briefing. */
function encherProvincias(select) {
  if (!select) return;
  select.replaceChildren(new Option('Seleccione…', ''));
  for (const p of PROVINCIAS) select.append(new Option(p, p));
}

/**
 * Monta o `aria-describedby` de um campo: sempre a ajuda, e o erro
 * apenas quando o campo está em erro. Devolve a lista, para os testes.
 */
function describedPor(campo, inp, ajuda, msg) {
  const descritos = [];
  if (ajuda?.id) descritos.push(ajuda.id);
  if (msg?.id && campo.dataset.erro === 'true') descritos.push(msg.id);
  if (descritos.length) inp.setAttribute('aria-describedby', descritos.join(' '));
  else inp.removeAttribute('aria-describedby');
  return descritos;
}

/**
 * Liga um formulário [data-orc] ao assistente de 3 passos.
 * Idempotente: chamar duas vezes no mesmo nó não duplica listeners.
 *
 * @param {HTMLFormElement} form
 */
export function iniciarOrcamento(form) {
  if (!form || form.dataset.orcLigado === 'true') return;
  form.dataset.orcLigado = 'true';

  form.querySelectorAll('select[name="provincia"], select[name="provinciaDestino"]')
    .forEach(encherProvincias);

  const passos = [...form.querySelectorAll('.orc-passo')];
  const seccoes = [...form.querySelectorAll('.orc-seccao')];
  const barra = form.querySelector('.orc__barra');
  const barraFill = barra.querySelector('span');
  const conta = form.querySelector('[data-conta]');
  const btnAnt = form.querySelector('[data-ant]');
  const btnSeg = form.querySelector('[data-seg]');
  const estado = form.querySelector('[data-estado]');
  const consent = form.querySelector('[data-consent]');
  const consentCaixa = form.querySelector('input[name="consentimento"]');
  const precoCaixa = form.querySelector('[data-preco]');

  /* Preço estimado ao vivo, com o mesmo módulo que os testes usam.
     Vai com atraso de propósito: a região é uma live region, e sem
     atraso o leitor de ecrã anunciaria cada tecla por separado em vez
     de uma frase. 250 ms é o bastante para agrupar uma palavra. */
  function pintarPreco() {
    const p = calcularPreco(normalizarPeso(form.elements.peso.value));
    if (!p) { precoCaixa.hidden = true; return; }
    precoCaixa.hidden = false;
    precoCaixa.querySelector('[data-p-base]').textContent = formatarMT(p.base);
    precoCaixa.querySelector('[data-p-iva]').textContent = formatarMT(p.iva);
    precoCaixa.querySelector('[data-p-total]').textContent = formatarMT(p.total);
  }
  let temporizadorPreco = null;
  form.elements.peso.addEventListener('input', () => {
    clearTimeout(temporizadorPreco);
    temporizadorPreco = setTimeout(pintarPreco, 250);
  });

  /* Erro de cada campo ligado ao campo por aria-describedby, para o
     leitor de ecrã anunciar a falha quando o campo recebe o foco.
     O texto de ajuda (".campo__ajuda") entra sempre na lista; o texto
     de erro SÓ quando existe — senão quem usa leitor de ecrã ouvia
     "Indique o apelido." ao focar um campo perfeitamente válido. */
  form.querySelectorAll('.campo[data-campo]').forEach((campo) => {
    const inp = campo.querySelector('input, select, textarea');
    const ajuda = campo.querySelector('.campo__ajuda');
    const msg = campo.querySelector('.campo__erro');
    if (!inp) return;
    if (ajuda && !ajuda.id) ajuda.id = `${inp.id}-ajuda`;
    if (msg && !msg.id) msg.id = `${inp.id}-erro`;
    describedPor(campo, inp, ajuda, msg);
  });

  /* Um campo por vez, para o ecrã não ficar coberto de vermelhos. */
  form.addEventListener('input', (e) => {
    const campo = e.target.closest?.('.campo[data-campo]');
    if (campo && campo.dataset.erro === 'true') validoDoCampo(e.target);
  });

  function validoDoCampo(inp) {
    const mau = campoMau(inp);
    const campo = inp.closest('.campo');
    if (campo) {
      campo.dataset.erro = String(mau);
      const ajuda = campo.querySelector('.campo__ajuda');
      const msg = campo.querySelector('.campo__erro');
      describedPor(campo, inp, ajuda, msg);
    }
    return !mau;
  }

  function campoMau(inp) {
    if (inp.name === 'peso') {
      const kg = normalizarPeso(inp.value);
      return kg === null || kg < 0.1 || kg > 100000;
    }
    if (inp.name === 'telefone') return normalizarTelefone(inp.value) === null;
    return !inp.value.trim();
  }

  function valido(i) {
    let ok = true;
    let primeiroMau = null;
    seccoes[i].querySelectorAll('[required]').forEach((inp) => {
      if (!validoDoCampo(inp)) { ok = false; primeiroMau = primeiroMau || inp; }
    });
    if (primeiroMau) primeiroMau.focus();
    return ok;
  }

  function mostrar(i) {
    const atual = Math.max(0, Math.min(seccoes.length - 1, i));
    seccoes.forEach((s, k) => { s.dataset.ativa = String(k === atual); });
    passos.forEach((p, k) => {
      p.dataset.estado = k === atual ? 'ativo' : (k < atual ? 'feito' : 'por-fazer');
    });
    const pct = ((atual + 1) / seccoes.length) * 100;
    barraFill.style.width = `${pct}%`;
    barra.setAttribute('aria-valuenow', String(Math.round(pct)));
    conta.textContent = `Passo ${atual + 1} de ${seccoes.length}`;
    btnAnt.disabled = atual === 0;
    /* No último passo o botão diz "Enviar" em vez de "Continuar". */
    btnSeg.lastChild.textContent = atual === seccoes.length - 1 ? ' Enviar' : ' Continuar';
    form.dataset.passo = String(atual);
  }

  btnSeg.addEventListener('click', () => {
    const atual = Number(form.dataset.passo);
    if (atual === seccoes.length - 1) { form.requestSubmit(); return; }
    if (valido(atual)) mostrar(atual + 1);
  });
  btnAnt.addEventListener('click', () => mostrar(Number(form.dataset.passo) - 1));

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    for (let i = 0; i < seccoes.length; i += 1) {
      if (!valido(i)) { mostrar(i); return; }
    }
    if (!consentCaixa.checked) {
      consent.dataset.erro = 'true';
      estado.dataset.mostrar = 'true';
      estado.className = 'estado-envio estado-envio--erro';
      estado.textContent = 'Precisa de aceitar a Política de Privacidade para enviar o pedido.';
      consentCaixa.focus();
      return;
    }
    consent.dataset.erro = 'false';
    form.dispatchEvent(new CustomEvent('orc:pronto', { bubbles: true, detail: dados(form) }));
  });

  /* Rearmar para o próximo pedido, sem recarregar a página. `reset()`
     repõe valores, não atributos: sem isto, os `data-erro="true"` da
     tentativa anterior ficavam acesos por baixo de campos vazios, e o
     banner de erro continuaria a ser anunciado em voz alta. */
  form.addEventListener('rearmar', () => {
    form.querySelectorAll('.campo').forEach((c) => { delete c.dataset.erro; });
    const consent = form.querySelector('[data-consent]');
    if (consent) delete consent.dataset.erro;
    const estado = form.querySelector('[data-estado]');
    if (estado) {
      delete estado.dataset.mostrar;
      estado.textContent = '';
      estado.className = 'estado-envio';
    }
    mostrar(0);
    pintarPreco();
  });

  mostrar(0);
  pintarPreco();
}
