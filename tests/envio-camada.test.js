import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { planoEnvio } from '../js/orcamento.js';

const CHEIO = {
  nome: 'João Pedro', apelido: 'Sissu', provincia: 'Nampula',
  morada: 'Sommachine', telefone: '84 793 5035',
  destinatario: 'Ana Maria', provinciaDestino: 'Cabo Delgado',
  peso: '11.7', dimensao: '60 x 40 x 40', descricao: 'tintas PLASCON',
  pagamento: 'e-Mola', pagarNoLevantamento: 'sim',
};

/* ---------------------------------------------------------------------------
   O BUG

   `window.open(url, '_blank', 'noopener')` devolve SEMPRE null. Está
   escrito no MDN: "If this feature is set, the new window will not have
   access to the originating window via Window.opener **and returns
   null**."

   O código da Fase 4 fazia:

       const janela = window.open(paraEmpresa, '_blank', 'noopener');
       if (janela && !janela.closed) { ... } else { aviso }

   Logo `janela` é sempre `null`: o `if` era código morto e o aviso
   "O browser bloqueou a abertura automática" aparecia em TODOS os
   pedidos, mesmo os que abriam à primeira.

   E o pior: o único botão do ecrã de sucesso mandava a mensagem para o
   CLIENTE. Se a mensagem para a JVI não abrisse, o pedido não chegava
   a lado nenhum — por baixo de um ecrã verde de sucesso.
--------------------------------------------------------------------------- */

test('planoEnvio dá SEMPRE um link para a JVI', () => {
  const p = planoEnvio(CHEIO);
  assert.ok(p.empresa, 'tem de haver sempre um link para a JVI');
  assert.ok(p.empresa.url.startsWith('https://wa.me/258847935035?text='));
});

test('planoEnvio dá um link para o cliente quando o telefone é válido', () => {
  const p = planoEnvio(CHEIO);
  assert.ok(p.cliente, 'devia haver link para o cliente');
  assert.ok(p.cliente.url.startsWith('https://wa.me/258847935035?text='));
});

test('sem telefone válido, o link do cliente é omitido mas o da JVI não', () => {
  const p = planoEnvio({ ...CHEIO, telefone: 'não é telefone' });
  assert.equal(p.cliente, null);
  assert.ok(p.empresa, 'a JVI nunca pode ficar sem link — é o pedido');
});

test('planoEnvio nunca promete que a abertura automática funcionou', () => {
  /* O valor de retorno do window.open não diz nada com noopener, por
     isso não se pode construir um aviso a partir dele. O que se diz ao
     utilizador é o facto, não uma adivinhação sobre o browser. */
  const p = planoEnvio(CHEIO);
  assert.equal(p.avisoAbertura, null,
    'não se pode afirmar nada sobre a abertura automática');
  assert.equal(p.avisos.length, 0);
});

test('planoEnvio aceita um segundo número de telefone', () => {
  const p = planoEnvio({ ...CHEIO, telefone: '82 555 8005' });
  assert.ok(p.cliente.url.startsWith('https://wa.me/258825558005?text='));
});

/* O ecrã de sucesso tem de ter os DOIS links, porque o window.open é
   um bónus e não uma entrega. */
test('o ecra de sucesso tem um link para a JVI e outro para o cliente', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  const bloco = /<div class="envio-ok"[\s\S]*?<\/div>\s*<\/div>/.exec(html)?.[0] ?? '';
  assert.ok(bloco, 'não encontrei o ecrã de sucesso');
  assert.match(bloco, /data-ok-empresa/,
    'falta o link para a JVI no ecrã de sucesso');
  assert.match(bloco, /data-ok-cliente/,
    'falta o link para o cliente no ecrã de sucesso');
});

/* ---------------------------------------------------------------------------
   O SEGUNDO BUG CRÍTICO

   D3 diz, com a razão certa, que um `input type="number"` devolve string
   vazia para quem escreve `11,7`. Mas o HTML continuava a ser
   `type="number"`. Normalizar não resolvia: se o browser devolve `""`,
   o `normalizarPeso` não tem vírgula nenhuma para normalizar.

   Escrever 11,7 — a notação normal em Moçambique — produzia `value === ""`,
   o campo parecia vazio, e a pessoa recebia "Indique o peso em
   quilogramas (mínimo 0,1)" sem pista de que o problema era a vírgula.
--------------------------------------------------------------------------- */

test('o campo do peso NÃO é type=number, senão a vírgula nunca chega ao JS', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  const campo = /<input[^>]*id="orcPeso"[^>]*>/.exec(html)?.[0];
  assert.ok(campo, 'não encontrei o campo do peso');
  assert.doesNotMatch(campo, /type="number"/,
    'type=number engole a vírgula decimal: o value fica vazio e o D3 não se cumpre');
  assert.match(campo, /type="text"/);
  /* inputmode mantém o teclado numérico no telemóvel. */
  assert.match(campo, /inputmode="decimal"/);
});

test('os campos de texto do formulário têm maxlength', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  /* Sem maxlength, uma descrição de 5000 caracteres passa o formulário,
     é truncada a 1200 em silêncio no registo, e um corpo > 20 KB leva
     a 413 — o que o front-end traduz por "registo indisponível". */
  for (const [id, max] of [['orcNome', 80], ['orcApelido', 80],
    ['orcMorada', 200], ['orcDescricao', 1200]]) {
    const campo = new RegExp(`<input[^>]*id="${id}"[^>]*>|<textarea[^>]*id="${id}"[^>]*>`).exec(html)?.[0];
    assert.ok(campo, `não encontrei #${id}`);
    assert.ok(campo.includes(`maxlength="${max}"`),
      `#${id} sem maxlength="${max}"`);
  }
});
