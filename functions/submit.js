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

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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
   no inicio da celula, que o Sheets interpreta como formula. */
function celula(valor) {
  const s = esc(valor);
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

/* Uma linha por campo, para a folha de cálculo ter cabeçalho. */
export const CAMPOS = [
  ['nome', 'Nome (primeiro)'],
  ['apelido', 'Apelido'],
  ['provincia', 'Província do emissor'],
  ['morada', 'Morada / bairro'],
  ['telefone', 'Telefone (WhatsApp)'],
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
  if (sem(d.provincia)) problemas.push('província do emissor');
  if (sem(d.morada)) problemas.push('morada');
  if (sem(d.telefone) || !RE_TEL.test(d.telefone)) problemas.push('telefone');
  if (sem(d.destinatario)) problemas.push('quem recebe');
  if (sem(d.provinciaDestino)) problemas.push('província de destino');
  if (sem(d.descricao)) problemas.push('descrição da mercadoria');

  const peso = numPeso(d.peso);
  if (!Number.isFinite(peso) || peso <= 0 || peso > 100000) problemas.push('peso');

  if (!PAGAMENTOS.includes(d.pagamento)) problemas.push('forma de pagamento');
  if (!LEVANTAMENTO.includes(d.pagarNoLevantamento)) problemas.push('pagar no levantamento');

  if (d.preco_total) {
    const t = Number(d.preco_total);
    if (!Number.isFinite(t) || t < 0) problemas.push('total');
  }
  return problemas;
}

export function textoWA(d) {
  return [
    '*NOVO PEDIDO DE ORÇAMENTO — JVI Carga & Serviços*',
    '',
    `• Emissor: ${d.nome || '—'} ${d.apelido || ''}`.trim(),
    `• Província: ${d.provincia || '—'}`,
    `• Morada: ${d.morada || '—'}`,
    `• WhatsApp: ${d.telefone || '—'}`,
    `• Carga: ${d.peso || '—'} kg · ${d.descricao || '—'}`,
    d.dimensao ? `• Dimensões: ${d.dimensao}` : '',
    `• Recebe: ${d.destinatario || '—'} (${d.provinciaDestino || '—'})`,
    `• Pagamento: ${d.pagamento || '—'} · no levantamento: ${d.pagarNoLevantamento === 'sim' ? 'sim' : 'não'}`,
    d.preco_total ? `• Total: ${d.preco_total} MT` : '',
  ].filter(Boolean).join('\n');
}

function textoEmail(d) {
  const linhas = CAMPOS.filter(([k]) => d[k]).map(([k, label]) => `${label}: ${d[k]}`);
  return {
    subject: `Novo pedido de orçamento — ${String(d.emissor_nome || 'Site').slice(0, 60)}`,
    text: `Pedido de orçamento recebido pelo site.\n\n${linhas.join('\n')}\n\n---\nCanal pedido: ${d.canal || 'ambos'}`,
    html: `<h2>Novo pedido de orçamento</h2>
      <p>Recebido pelo site da JVI Carga &amp; Serviços.</p>
      <table cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-family:sans-serif">
      ${CAMPOS.filter(([k]) => d[k])
        .map(([k, label]) => `<tr><td style="border:1px solid #ddd;background:#f4f4f4"><b>${esc(label)}</b></td><td style="border:1px solid #ddd">${esc(d[k])}</td></tr>`)
        .join('')}
      </table>
      <p style="color:#666;font-size:12px">Canal pedido: ${esc(d.canal || 'ambos')}</p>`,
  };
}

/* ---------- E-mail via Resend ---------- */
async function enviarEmail(d) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, motivo: 'RESEND_API_KEY ausente' };
  const { subject, text, html } = textoEmail(d);
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
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
      headers: { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [linha] }),
    }
  );
  if (!r.ok) return { ok: false, motivo: `sheets ${r.status}: ${(await r.text()).slice(0, 200)}` };
  return { ok: true };
}

/* ---------- Anti-spam ----------
   Honeypot: campo invisivel que um humano nunca preenche.
   Tempo: um pedido enviado em menos de 3 segundos foi um bot. */
const Janela = new Map();

function bloqueadoPorSpam(ip) {
  const agora = Date.now();
  for (const [k, t] of Janela) if (agora - t > 3_600_000) Janela.delete(k);
  const ultimo = Janela.get(ip);
  if (ultimo && agora - ultimo < 20_000) return true; // 1 pedido / 20 s por IP
  return false;
}

function marcarIp(ip) {
  Janela.set(ip, Date.now());
}

const resp = (status, obj) => ({
  statusCode: status,
  headers: { ...CORS, 'Content-Type': 'application/json' },
  body: JSON.stringify(obj),
});

/* ---------- Handler ---------- */
export default async (req) => {
  if (req.method === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (req.method !== 'POST') return resp(405, { erro: 'Método não permitido' });

  /* Limite de tamanho do corpo antes de gastar memoria a parsear */
  if ((req.body || '').length > 20_000) return resp(413, { erro: 'Pedido demasiado grande' });

  let bruto;
  try {
    bruto = JSON.parse(req.body || '{}');
  } catch {
    return resp(400, { erro: 'JSON inválido' });
  }

  /* Honeypot preenchido = bot. Respondemos 200 para não o ajudar a calibrar. */
  if (bruto.website) return resp(200, { ok: true, email: false, sheet: false, spam: true });

  /* Tempo de preenchamento absurdo = bot */
  const ms = Number(bruto._t);
  if (Number.isFinite(ms) && ms > 0 && ms < 3000) {
    return resp(200, { ok: true, email: false, sheet: false, spam: true });
  }

  const ip = req.headers['x-nf-client-connection-ip']
    || req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || 'desconhecido';
  if (bloqueadoPorSpam(ip)) return resp(429, { erro: 'Demasiados pedidos. Tente novamente em instantes.' });

  /* Limpar e validar */
  const d = {};
  for (const k of Object.keys(LIMITES)) d[k] = campoLimpo(bruto, k);

  const problemas = validar(d);
  if (problemas.length) return resp(400, { erro: 'Dados inválidos', campos: problemas });

  marcarIp(ip);

  const [email, sheet] = await Promise.all([
    enviarEmail(d).catch((e) => ({ ok: false, motivo: String(e) })),
    gravarSheet(d).catch((e) => ({ ok: false, motivo: String(e) })),
  ]);

  if (!email.ok && !sheet.ok) {
    return resp(502, {
      ok: false,
      erro: 'Não foi possível registar o pedido. Use o WhatsApp ou o email.',
      email: false,
      sheet: false,
    });
  }

  return resp(200, {
    ok: true,
    email: email.ok,
    sheet: sheet.ok,
  });
};

export { esc, celula, RE_EMAIL, RE_TEL };
