import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import handler, { validar } from '../functions/submit.js';

/* ---------------------------------------------------------------------------
   O BUG

   O `enviarPedido` no `js/main.js` fazia:

       registado = r.ok;

   e depois escrevia ao utilizador "Pedido também registado no sistema da
   JVI" sempre que isso fosse verdade.

   `r.ok` só quer dizer que veio um 2xx. E o servidor responde 200 em três
   situações que não são "o pedido ficou registado":

       {ok:true, email:true,  sheet:true }   registado mesmo
       {ok:true, spam:true}                  deitado fora como bot
       {ok:true, registro:false}             NENHUM canal funcionou

   A terceira é a configuração por omissão. O cabeçalho da própria função
   diz que nenhuma das chaves é obrigatória, e sem `RESEND_API_KEY` nem
   `SHEET_ID` — o estado de um site acabado de publicar — o servidor
   responde 200 com `registro:false` e não escreve nada em lado nenhum.

   O efeito era o pior dos dois: o site affirmava ao cliente que o pedido
   estava registado, e a Política de Privacidade promete que o pedido fica
   numa folha de cálculo. O cliente acreditava num registo que não
   existia, e a JVI não tinha o pedido.

   Este ficheiro fixa o contrato nos dois sentidos: o servidor tem de dizer
   `registro:false` quando nada foi escrito, e o browser tem de o ler.
   --------------------------------------------------------------------------- */

const MAIN = fs.readFileSync('js/main.js', 'utf8');

/** Payload mínimo que passa a validação do servidor. */
const BOM = {
  nome: 'João Pedro', apelido: 'Sissu', provincia: 'Nampula',
  morada: 'Sommachine', telefone: '87 806 6265',
  destinatario: 'Ana Maria', provinciaDestino: 'Cabo Delgado',
  peso: '11.7', dimensao: '60 x 40 x 40', descricao: 'tintas PLASCON',
  pagamento: 'e-Mola', pagarNoLevantamento: 'sim',
};

/** Chama o handler com um `req` forjado. */
async function pedir(body, headers = {}) {
  const req = {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  };
  const r = await handler(req);
  return { status: r.statusCode, corpo: JSON.parse(r.body) };
}

test('o servidor diz registo:false quando nenhum canal funcionou', async () => {
  /* Sem RESEND_API_KEY nem SHEET_ID no ambiente, nenhum canal escreve. */
  const antes = {
    email: process.env.RESEND_API_KEY,
    sheet: process.env.SHEET_ID,
  };
  delete process.env.RESEND_API_KEY;
  delete process.env.SHEET_ID;
  try {
    const { status, corpo } = await pedir(BOM);
    assert.equal(status, 200, 'o servidor responde 200 para não perder o lead');
    assert.equal(corpo.ok, true);
    assert.equal(corpo.email, false);
    assert.equal(corpo.sheet, false);
    /* A CHAVE TEM DE EXISTIR. Sem ela o browser não tem nada para ler e
       volta a mentir com o `r.ok`.

       O nome é `registo`, sem o "r" do castelhano. Foi `registro` na
       primeira versão deste teste e na primeira versão da correcção do
       `main.js` — e o teste apanhou logo: o lado do browser ficava à
       espera de uma chave que o servidor nunca envia, o que é a mesma
       mentira por outro caminho. */
    assert.equal(corpo.registo, false,
      'a resposta de falha tem de trazer registo:false — é isto que o '
      + 'browser lê para não dizer ao cliente que o pedido ficou registado');
  } finally {
    if (antes.email !== undefined) process.env.RESEND_API_KEY = antes.email;
    if (antes.sheet !== undefined) process.env.SHEET_ID = antes.sheet;
  }
});

test('o browser le o corpo da resposta e nao se fica pelo r.ok', () => {
  /* `registado = r.ok;` era o bug. Tem de haver leitura do corpo. */
  assert.match(MAIN, /await r\.json\(\)/,
    'o enviarPedido tem de ler o corpo da resposta');
  assert.doesNotMatch(MAIN, /registado\s*=\s*r\.ok\s*;/,
    '`registado = r.ok` mente: o servidor responde 200 tambem quando '
    + 'nada foi registado');

  /* E tem de cobrir os dois casos em que o 200 nao é um registo. */
  assert.match(MAIN, /registo\s*!==\s*false/,
    'tem de distinguir a resposta de "nenhum canal funcionou" — e a chave '
    + 'é `registo`, sem o "r", que é o que o servidor devolve');
  assert.match(MAIN, /spam\s*!==\s*true/,
    'tem de distinguir a resposta de "descartado como bot"');
});

test('o payload de teste e aceite pela validacao do servidor', () => {
  assert.deepEqual(validar(BOM), [],
    'o fixture tem de ser um pedido válido, senão o teste acima está a '
    + 'medir a validação e não o que interessa');
});
