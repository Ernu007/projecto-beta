/* =========================================================
   JVI Carga & Serviços — Netlify Function: envio do pedido
   ------------------------------------------------------------
   Recebe o Airwaybill do site e distribui por:
     1. E-mail          -> RESEND_API_KEY (ou SMTP se configurado)
     2. Google Sheets   -> SHEET_ID + GOOGLE_SERVICE_ACCOUNT_JSON
   Nenhum dos dois é obrigatório: se faltarem chaves, responde 200
   com os canais que conseguiu usar, e o front-end segue para o
   WhatsApp/email do cliente — nunca se perde um lead.

   Variáveis de ambiente (Netlify > Site settings > Environment):
     RESEND_API_KEY=re_xxxxxxxx
     EMAIL_DE=Orcamentos <orcamentos@seudominio.com>   (opcional)
     SHEET_ID=1AbCdEf...
     GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
   ========================================================= */

/* ------------------------------------------------------------
   CORS
   ------------------------------------------------------------
   `Access-Control-Allow-Origin: *` num endpoint público sem
   autenticação é inofensivo por si só. O problema é a combinação com
   NÃO verificar o Content-Type: `text/plain` é um tipo "seguro", por
   isso um `fetch` de uma página atacante com `mode: 'no-cors'` chega
   ao endpoint sem preflight nenhum. Qualquer site da Internet
   passava a poder inundar a caixa e a folha da JVI, e a gastar a
   quota do Resend, a partir do IP do visitante e sem lhe pedir nada.

   Exigir `application/json` — que NÃO é seguro — obriga o browser a
   fazer preflight, e o preflight só passa se a origem estiver na
   lista. Fecha as duas portas.
   ------------------------------------------------------------ */
const ORIGENS = [
  'https://jvicargaservicos.co.mz',
  'https://www.jvicargaservicos.co.mz',
  'http://localhost:8888',
  'http://127.0.0.1:8888',
];

function cabecalhosCORS(req) {
  const origem = req.headers.origin;
  const permitida = Boolean(origem) && ORIGENS.includes(origem);
  return {
    // Sem `*` e sem reflectir origem desconhecida: só a lista.
    ...(permitida ? { 'Access-Control-Allow-Origin': origem } : {}),
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

const DESTINO = process.env.EMAIL_PARA || 'jvicargaservicos@gmail.com';

/* ------------------------------------------------------------
   Escape de HTML. Sem isto, um remetente pode injectar <script>
   ou uma hiperligação na folha de cálculo / no e-mail da JVI.
   ------------------------------------------------------------ */
function esc(valor) {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    /* remove caracteres de controlo e localizacoes de risco (CSV injection).
       Nao faz trim: o trim apagaria o TAB/CR que a proteccao de
       formulas precisa de ver. */
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
}

/* Texto para a folha de cálculo: neutraliza =, +, -, @, tab e CR
   no inicio da celula, que o Sheets interpreta como formula.

   NÃO escapa outra vez: `esc` não é idempotente, e o valor já vem
   escapado de `campoLimpo`. Escapar duas vezes punha `&amp;amp;` no
   campo de uma pessoa chamada "A & B" — falha para o lado seguro,
   mas é corrupção de dados. */
function celula(valor) {
  const s = String(valor ?? '');
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}

/* Limites por campo: evita payloads gigantes e dados sem sentido. */
export const LIMITES = {
  nome: 80, apelido: 80, provincia: 40, morada: 200, telefone: 40,
  destinatario: 120, provinciaDestino: 40, peso: 14, dimensao: 60,
  descricao: 1200, pagamento: 40, pagarNoLevantamento: 6, preco_total: 16,
  origem: 20, website: 200,
};

/* Conjuntos de caracteres em vez de "qualquer coisa menos o sinal": assim um
   email com <script> e rejeitado na validacao, nao escapado em silencio. */
const RE_EMAIL = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const RE_TEL = /^\+?[\d\s().-]{8,25}$/;

function campoLimpo(d, chave) {
  const v = d[chave];
  if (v === undefined || v === null) return '';
  return esc(v).trim().slice(0, LIMITES[chave] ?? 200);
}

/* Uma linha por campo, para a folha de cálculo ter cabeçalho.
   A ORDEM é o que a folha já tem criado — não se mexe. Os rótulos é
   que vão para o e-mail, e é por isso que o do telefone diz de quem
   é: no pedido há o número do cliente e o da JVI, e a JVI é quem vai
   usar este para ligar de volta. */
export const CAMPOS = [
  ['nome', 'Nome (primeiro)'],
  ['apelido', 'Apelido'],
  ['provincia', 'Província do emissor'],
  ['morada', 'Morada / bairro'],
  ['telefone', 'Telefone do cliente'],
  ['destinatario', 'Quem recebe'],
  ['provinciaDestino', 'Província de destino'],
  ['peso', 'Peso (kg)'],
  ['dimensao', 'Dimensões (cm)'],
  ['descricao', 'Descrição da mercadoria'],
  ['pagamento', 'Forma de pagamento'],
  ['pagarNoLevantamento', 'Paga no levantamento'],
  ['preco_total', 'Total calculado (MZN)'],
];

export const PAGAMENTOS = ['e-Mola', 'Cartão de crédito', 'Numerário'];
const LEVANTAMENTO = ['sim', 'nao'];

/* As mesmas 11 do select do formulário. O servidor não pode aceitar
   texto arbitrário numa coluna que deveria ter 11 valores. */
export const PROVINCIAS = [
  'Cabo Delgado', 'Gaza', 'Inhambane', 'Manica', 'Maputo', 'Nampula',
  'Niassa', 'Palma', 'Sofala', 'Tete', 'Zambézia',
];

/* A tabela de preços, replicada do lado do servidor. O `preco_total`
   que vem do cliente é um valor que ele próprio escolheu; para a folha
   de registo interessa o preço que a JVI cobraria, não o que o
   browser calculou. */
const PESO_LIMITE = 10;
const PISO_BASE = 3000;
const TARIFA_KG = 255;
const IVA = 0.16;

export function calcularPrecoServidor(peso) {
  const kg = Number(String(peso ?? '').trim().replace(',', '.'));
  if (!Number.isFinite(kg) || kg <= 0) return null;
  const tarifado = kg <= PESO_LIMITE ? PISO_BASE : kg * TARIFA_KG;
  const base = Math.round(Math.max(tarifado, PISO_BASE));
  const iva = Math.round(base * IVA);
  return { peso: kg, base, iva, total: base + iva };
}

/** Peso numérico, aceitando a vírgula decimal que o teclado local escreve. */
const numPeso = (v) => {
  const s = String(v ?? '').trim().replace(',', '.');
  if (s === '') return NaN;
  return Number(s);
};

/**
 * Valida o payload já limpo. Devolve a lista de problemas (vazia = válido).
 * @param {Record<string,string>} d
 * @returns {string[]}
 */
export function validar(d) {
  const problemas = [];
  const sem = (v) => !String(v ?? '').trim();

  if (sem(d.nome)) problemas.push('nome');
  if (sem(d.apelido)) problemas.push('apelido');
  if (!PROVINCIAS.includes(d.provincia)) problemas.push('província do emissor');
  if (sem(d.morada)) problemas.push('morada');
  if (sem(d.telefone) || !RE_TEL.test(d.telefone) || numDigitos(d.telefone) < 7) {
    problemas.push('telefone');
  }
  if (sem(d.destinatario)) problemas.push('quem recebe');
  if (!PROVINCIAS.includes(d.provinciaDestino)) problemas.push('província de destino');
  if (sem(d.descricao)) problemas.push('descrição da mercadoria');

  const peso = numPeso(d.peso);
  if (!Number.isFinite(peso) || peso <= 0 || peso > 100000) problemas.push('peso');

  if (!PAGAMENTOS.includes(d.pagamento)) problemas.push('forma de pagamento');
  if (!LEVANTAMENTO.includes(d.pagarNoLevantamento)) problemas.push('pagar no levantamento');
  return problemas;
}

/** Quantos dígitos tem o telefone, na verdade. `() () ()` passa no
 *  RE_TEL (que conta caracteres) mas não tem um único dígito. */
const numDigitos = (v) => String(v ?? '').replace(/\D/g, '').length;

/* ------------------------------------------------------------
   O telefone de retorno
   ------------------------------------------------------------
   A Fase 7B (avisar a JVI de que o cliente está a chegar, com a
   posição e a hora) fica DESACTIVADA por falta de API key do Google.
   A alternativa que não precisa de key é esta: o número do cliente
   vai no aviso, e a JVI LIGA DE VOLTA. É uma chamada normal, de um
   telefone normal, sem browser nenhum no meio.

   Para isso o número tem de chegar à JVI no formato em que se marca
   para telefonar. O `RE_TEL` aceita meia dúzia de formas de escrever
   o mesmo número, e o cliente pode escrever qualquer uma.

   Replicado de `normalizarTelefone` em `js/orcamento.js` em vez de
   importado, pelo mesmo motivo que a tabela de preços: a Netlify
   constrói as functions sozinhas, e o servidor tem de validar sem
   confiar em nada que venha do browser.

   O que não normaliza é devolvido tal e qual. Descartar o número por
   a escrita não ser a esperada era perder o contacto.
   ------------------------------------------------------------ */
export function telefoneCallback(valor) {
  const bruto = String(valor ?? '').trim();
  let d = bruto.replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('258')) d = d.slice(3);
  else if (d.startsWith('0')) d = d.slice(1);
  if (!/^[2-9]\d{8}$/.test(d)) return bruto;
  return `+258 ${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5)}`;
}

export function textoWA(d) {
  return [
    '*NOVO PEDIDO DE ORÇAMENTO — JVI Carga & Serviços*',
    '',
    `• Emissor: ${d.nome || '—'} ${d.apelido || ''}`.trim(),
    `• Província: ${d.provincia || '—'}`,
    `• Morada: ${d.morada || '—'}`,
    `• Telefone do cliente: ${telefoneCallback(d.telefone) || '—'}`,
    `• Carga: ${d.peso || '—'} kg · ${d.descricao || '—'}`,
    d.dimensao ? `• Dimensões: ${d.dimensao}` : '',
    `• Recebe: ${d.destinatario || '—'} (${d.provinciaDestino || '—'})`,
    `• Pagamento: ${d.pagamento || '—'} · no levantamento: ${d.pagarNoLevantamento === 'sim' ? 'sim' : 'não'}`,
    d.preco_total ? `• Total: ${d.preco_total} MT` : '',
  ].filter(Boolean).join('\n');
}

/** O valor que vai no aviso, por campo. Só o telefone muda: em vez da
 *  grafia do formulário, o número como se marca para telefonar. A
 *  folha de cálculo continua com o valor cru — é o registo do que o
 *  cliente escreveu, e o e-mail e o WhatsApp é que são lidos para
 *  ligar. */
const valorAviso = (k, v) => (k === 'telefone' ? telefoneCallback(v) : v);

/** Exportada para os testes: o `text:` e o `html:` do MESMO e-mail
 *  discordam quando um dos dois mente, e isso só se vê comparando. */
export function textoEmail(d) {
  const linhas = CAMPOS.filter(([k]) => d[k]).map(([k, label]) => `${label}: ${valorAviso(k, d[k])}`);
  /* `d[k]` já vem escapado de `campoLimpo`. Escapar aqui uma segunda
     vez punha `&amp;amp;` no e-mail e fazia o `text:` e o `html:` do
     MESMO e-mail discordarem. Os rótulos são de uma constante. */
  return {
    subject: `Novo pedido de orçamento — ${String(d.nome || 'Site').slice(0, 60)}`,
    text: `Pedido de orçamento recebido pelo site.\n\n${linhas.join('\n')}\n\n---\nOrigem: ${d.origem || 'site'}`,
    html: `<h2>Novo pedido de orçamento</h2>
      <p>Recebido pelo site da JVI Carga &amp; Serviços.</p>
      <table cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-family:sans-serif">
      ${CAMPOS.filter(([k]) => d[k])
        .map(([k, label]) => `<tr><td style="border:1px solid #ddd;background:#f4f4f4"><b>${esc(label)}</b></td><td style="border:1px solid #ddd">${k === 'telefone' ? esc(telefoneCallback(d[k])) : d[k]}</td></tr>`)
        .join('')}
      </table>
      <p style="color:#666;font-size:12px">Origem: ${esc(d.origem || 'site')}</p>`,
  };
}

/* ---------- E-mail via Resend ---------- */
async function enviarEmail(d) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, motivo: 'RESEND_API_KEY ausente' };
  const { subject, text, html } = textoEmail(d);
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    signal: AbortSignal.timeout(5000),
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.EMAIL_DE || 'JVI Orcamentos <onboarding@resend.dev>',
      to: [DESTINO],
      reply_to: d.emissor_email || undefined,
      subject,
      text,
      html,
    }),
  });
  if (!r.ok) return { ok: false, motivo: `Resend ${r.status}: ${(await r.text()).slice(0, 200)}` };
  return { ok: true };
}

/* ---------- Google Sheets via REST + JWT (sem dependencias) ---------- */
import crypto from 'node:crypto';

function b64url(buf) {
  return Buffer.from(buf).toString('base64url');
}

async function tokenSheets() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return { err: 'GOOGLE_SERVICE_ACCOUNT_JSON ausente' };
  let sa;
  try {
    sa = JSON.parse(raw);
  } catch {
    return { err: 'GOOGLE_SERVICE_ACCOUNT_JSON invalido (JSON)' };
  }

  const agora = Math.floor(Date.now() / 1000);
  const cab = { alg: 'RS256', typ: 'JWT' };
  const corpo = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    iat: agora,
    exp: agora + 3600,
  };
  const assinar = (msg) => crypto.createSign('RSA-SHA256').update(msg).sign(sa.private_key, 'base64url');
  const jwt = `${b64url(JSON.stringify(cab))}.${b64url(JSON.stringify(corpo))}.${assinar(
    `${b64url(JSON.stringify(cab))}.${b64url(JSON.stringify(corpo))}`
  )}`;

  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    signal: AbortSignal.timeout(5000),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  if (!r.ok) return { err: `token ${r.status}: ${(await r.text()).slice(0, 200)}` };
  return { token: (await r.json()).access_token };
}

async function gravarSheet(d) {
  const sheetId = process.env.SHEET_ID;
  if (!sheetId) return { ok: false, motivo: 'SHEET_ID ausente' };
  const auth = await tokenSheets();
  if (auth.err) return { ok: false, motivo: auth.err };

  const linha = [
    new Date().toISOString(),
    ...CAMPOS.map(([k]) => celula(d[k] ?? '')),
    celula(d.canal || 'ambos'),
  ];

  const r = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent('Pedidos!A:AZ')}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
    signal: AbortSignal.timeout(5000),
      headers: { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [linha] }),
    }
  );
  if (!r.ok) return { ok: false, motivo: `sheets ${r.status}: ${(await r.text()).slice(0, 200)}` };
  return { ok: true };
}

/* ---------- Anti-spam ----------
   Honeypot: campo invisivel que um humano nunca preenche.
   Tempo: um pedido enviado em menos de 3 segundos foi um bot.

   ATENÇÃO — este limite é melhor-esforço, não um controlo duro. Vive
   na memória de UMA instância, e as Netlify Functions escalam na
   horizontal: com N instâncias activas o limite real é N × 1/20 s.
   Para um limite a sério, configurar as Rate Limiting Rules no painel
   da Netlify (ou uma WAF). O `teto` abaixo existe só para o Map não
   crescer sem limite quando vêm muitos IPs diferentes. */
const Janela = new Map();
const TAMANHO_MAX = 5000;

function bloqueadoPorSpam(ip) {
  const agora = Date.now();
  for (const [k, t] of Janela) if (agora - t > 3_600_000) Janela.delete(k);
  const ultimo = Janela.get(ip);
  if (ultimo && agora - ultimo < 20_000) return true; // 1 pedido / 20 s por IP
  return false;
}

function marcarIp(ip) {
  if (Janela.size >= TAMANHO_MAX) Janela.clear();
  Janela.set(ip, Date.now());
}

/* `no-store` e `nosniff` aqui e não só no netlify.toml: os cabeçalhos
   do ficheiro de configuração nem sempre chegam à resposta da função,
   e sem `no-store` um pedido válido podia ficar em cache intermédio. */
const resp = (req, status, obj) => ({
  statusCode: status,
  headers: {
    ...cabecalhosCORS(req),
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  },
  body: JSON.stringify(obj),
});

/* ---------- Handler ---------- */
export default async (req) => {
  if (req.method === 'OPTIONS') {
    return { statusCode: 204, headers: cabecalhosCORS(req), body: '' };
  }
  if (req.method !== 'POST') {
    const r = resp(req, 405, { erro: 'Método não permitido' });
    return { ...r, headers: { ...r.headers, Allow: 'POST, OPTIONS' } };
  }

  /* Origem desconhecida: recusa. Sem isto, qualquer site poderia
     submeter pedidos para a caixa da JVI. */
  const origem = req.headers.origin;
  if (origem && !ORIGENS.includes(origem)) {
    return resp(req, 403, { erro: 'Origem não permitida' });
  }

  /* Exigir application/json fecha a via sem preflight (`text/plain`
     é um Content-Type seguro e chegava sem qualquer verificação). */
  const tipo = String(req.headers['content-type'] || '');
  if (!/^application\/json\b/i.test(tipo)) {
    return resp(req, 415, { erro: 'Content-Type inválido' });
  }

  /* Limite de tamanho do corpo antes de gastar memoria a parsear.
     O corpo pode já vir parseado, consoante o runtime. */
  const corpo = typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? '');
  if (corpo.length > 20_000) return resp(req, 413, { erro: 'Pedido demasiado grande' });

  let bruto;
  try {
    bruto = JSON.parse(corpo || '{}');
  } catch {
    return resp(req, 400, { erro: 'JSON inválido' });
  }

  /* `JSON.parse` aceita qualquer valor JSON, e só um é objeto. Um corpo
     `null` — que é JSON válido — dá `bruto === null`, e o `bruto.website`
     a seguir rebentava com um TypeError, que o runtime da Netlify
     transforma num 500. Verificado: com `null` rebenta, e com `true`,
     `123`, `"texto"`, `[]`, `{}` e `{"nome":null}` o handler responde 400
     como deve ser. Este era o único sítio do ficheiro que não era
     defensivo — o resto usa `String(v ?? '')` sem excepção. */
  if (bruto === null || typeof bruto !== 'object' || Array.isArray(bruto)) {
    return resp(req, 400, { erro: 'Dados inválidos' });
  }

  /* Honeypot preenchido = bot. Respondemos 200 para não o ajudar a calibrar. */
  if (bruto.website) return resp(req, 200, { ok: true, email: false, sheet: false, spam: true });

  /* Tempo de preenchamento absurdo = bot */
  const ms = Number(bruto._t);
  if (Number.isFinite(ms) && ms > 0 && ms < 3000) {
    return resp(req, 200, { ok: true, email: false, sheet: false, spam: true });
  }

  const ip = req.headers['x-nf-client-connection-ip']
    || req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || 'desconhecido';
  if (bloqueadoPorSpam(ip)) return resp(req, 429, { erro: 'Demasiados pedidos. Tente novamente em instantes.' });

  /* Limpar e validar */
  const d = {};
  for (const k of Object.keys(LIMITES)) d[k] = campoLimpo(bruto, k);

  const problemas = validar(d);
  if (problemas.length) return resp(req, 400, { erro: 'Dados inválidos', campos: problemas });

  /* O total é recalculado aqui. Confiar no `preco_total` que vem do
     browser era gravar na folha um valor que o cliente escolheu — com
     as DevTools abertas, `preco_total: "1"` chegava ao registo. */
  d.preco_total = String(calcularPrecoServidor(d.peso)?.total ?? '');

  marcarIp(ip);

  const [email, sheet] = await Promise.all([
    enviarEmail(d).catch((e) => ({ ok: false, motivo: String(e) })),
    gravarSheet(d).catch((e) => ({ ok: false, motivo: String(e) })),
  ]);

  if (!email.ok && !sheet.ok) {
    /* O 502 distinguia "chaves não configuradas" de "chaves
       configuradas e correu tudo" — o que permitia a quem queresse
       sondar se o registo estava activo. O detalhe vai para o log do
       Netlify; o cliente recebe sempre 200, e é o front-end que
       avisa que o envio por WhatsApp está garantido na mesma. */
    console.error('JVI: registo falhou', {
      email: email.motivo, sheet: sheet.motivo, peso: d.peso,
    });
    return resp(req, 200, {
      ok: true,
      email: false,
      sheet: false,
      registo: false,
    });
  }

  return resp(req, 200, {
    ok: true,
    email: email.ok,
    sheet: sheet.ok,
  });
};

export { esc, celula, campoLimpo, RE_EMAIL, RE_TEL };
