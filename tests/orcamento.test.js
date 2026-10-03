import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PROVINCIAS, normalizarPeso, normalizarTelefone, telefoneLegivel,
  msgEmpresa, msgCliente,
} from '../js/orcamento.js';
import { calcularPreco, formatarMT } from '../js/precos.js';

const CHEIO = {
  nome: 'João Pedro Sissu',
  apelido: 'Sissu',
  provincia: 'Nampula',
  morada: 'Bairro da Sommachine',
  telefone: '87 806 6265',
  destinatario: 'Ana Maria',
  provinciaDestino: 'Cabo Delgado',
  peso: '11.7',
  dimensao: '60 x 40 x 40',
  descricao: 'tintas PLASCON',
  pagamento: 'e-Mola',
  pagarNoLevantamento: 'sim',
};

test('as 11 provincias do briefing estao no select', () => {
  /* Aqui conta QUAIS são; a ORDEM (geográfica, Fase 8C) é testada em
     tests/formulario.test.js. */
  assert.deepEqual([...PROVINCIAS].sort(), [
    'Cabo Delgado', 'Gaza', 'Inhambane', 'Manica', 'Maputo', 'Nampula',
    'Niassa', 'Palma', 'Sofala', 'Tete', 'Zambézia',
  ].sort());
});

test('normalizarPeso aceita ponto e virgula', () => {
  assert.equal(normalizarPeso('11.7'), 11.7);
  assert.equal(normalizarPeso('11,7'), 11.7);
  assert.equal(normalizarPeso(' 12 '), 12);
  assert.equal(normalizarPeso(''), null);
  assert.equal(normalizarPeso('0'), null);
  assert.equal(normalizarPeso('doze'), null);
  assert.equal(normalizarPeso('-3'), null);
});

test('normalizarTelefone reduz qualquer escrita a 258878066265', () => {
  for (const t of ['87 806 6265', '+258 87 806 6265', '258878066265',
    '00258878066265', '258 87 806 6265', '0878066265']) {
    assert.equal(normalizarTelefone(t), '258878066265', `escrita: ${t}`);
  }
});

/* O teste anterior usava seis escritas do MESMO número. Um
   `return '258878066265'` fixo passava-o inteiro, sem exercitar a
   lógica. Estes usam outros números — o que entra aqui é o telefone
   que o CLIENTE preenche no formulário, que pode ser qualquer um, e
   não o número da JVI (esse é a constante `JVI_WHATSAPP`, e é único). */
test('normalizarTelefone funciona com outros numeros, nao so com um', () => {
  assert.equal(normalizarTelefone('82 555 8005'), '258825558005');
  assert.equal(normalizarTelefone('+258 84 470 0012'), '258844700012');
  assert.equal(normalizarTelefone('84 554 6151'), '258845546151');
  assert.equal(normalizarTelefone('00258825558005'), '258825558005');
  assert.equal(normalizarTelefone('258825558005'), '258825558005');
});

test('normalizarTelefone rejeita o "0" de tronco seguido do indicativo', () => {
  /* "0 258 825 555 8005" não é uma marcação de ninguém: o 0 é prefixo
     de tronco nacional, não o +258. Devolve null em vez de adivinhar
     qual dos dois tirar. */
  assert.equal(normalizarTelefone('02558825558005'), null);
});

test('normalizarTelefone nao confunde um prefixo que NAO e 258', () => {
  /* 351 (Portugal) tem 9 dígitos; se o código fosse cortado às cegas,
     o resto passaria a ser um número moçambicano válido. */
  assert.equal(normalizarTelefone('351912345678'), null);
  assert.equal(normalizarTelefone('258878066265999'), null, 'tem dígitos a mais');
});

test('normalizarTelefone rejeita o que nao e telefone moçambicano', () => {
  for (const t of ['', 'abc', '123', null, undefined, '2588780662']) {
    assert.equal(normalizarTelefone(t), null, `entrada: ${String(t)}`);
  }
});

test('telefoneLegivel volta ao formato que se escreve em Moçambique', () => {
  assert.equal(telefoneLegivel('87 806 6265'), '+258 87 806 6265');
  assert.equal(telefoneLegivel('xyz'), '—');
});

test('a mensagem da empresa leva os dados completos e o orcamento', () => {
  const t = msgEmpresa(CHEIO);
  const preco = calcularPreco(11.7);
  assert.match(t, /NOVO PEDIDO DE ORÇAMENTO/);
  assert.match(t, /João Pedro Sissu/);
  assert.match(t, /Nampula/);
  assert.match(t, /Bairro da Sommachine/);
  assert.match(t, /\+258 87 806 6265/);
  assert.match(t, /Ana Maria/);
  assert.match(t, /Cabo Delgado/);
  assert.match(t, /11\.7 kg/);
  assert.doesNotMatch(t, /Dimensões/, 'as dimensões saíram do formulário (8C/C8)');
  assert.match(t, /tintas PLASCON/);
  assert.match(t, /e-Mola/);
  assert.match(t, /no levantamento: Sim/);
  // o orcamento, com a base que o piso produziu e o total formatado
  assert.ok(t.includes(formatarMT(preco.base)), `base em falta: ${t}`);
  assert.ok(t.includes(formatarMT(preco.iva)), `IVA em falta: ${t}`);
  assert.ok(t.includes(formatarMT(preco.total)), `total em falta: ${t}`);
});

test('a mensagem do cliente confirma o orcamento sem linguagem interna', () => {
  const t = msgCliente(CHEIO);
  const preco = calcularPreco(11.7);
  assert.match(t, /orçamento/i);
  assert.ok(t.includes(formatarMT(preco.total)), `total em falta: ${t}`);
  assert.ok(t.includes(formatarMT(preco.base)), `base em falta: ${t}`);
  assert.ok(t.includes(formatarMT(preco.iva)), `IVA em falta: ${t}`);
  assert.doesNotMatch(t, /258878066265/);  // sem numero internacional cru
  assert.doesNotMatch(t, /PISO|floor|3000 MT base/i);
  assert.match(t, /pagar no levantamento/i);
});

test('mensagens com campos vazios nao ficam com "—" a transbordar', () => {
  const vazio = msgEmpresa({ peso: '' });
  assert.match(vazio, /NOVO PEDIDO DE ORÇAMENTO/);
  assert.doesNotMatch(vazio, /undefined|NaN/);
});

/* ---------------------------------------------------------------------------
   A ALTERNATIVA À FASE 7B, QUE NÃO PRECISA DE API KEY

   A 7B (avisar a JVI quando o cliente está a chegar, com a posição e a
   hora) fica DESACTIVADA: sem `duration_in_traffic` do Google não há
   estimativa de tempo, e sem estimativa não há como decidir que o
   cliente está a 5 minutos. Ver `docs/decisoes.md`.

   O que fica, e é o que o cliente queria de facto — "a JVI sabe e
   telefona" — é o número do cliente no aviso, sem nenhum browser no
   meio: a JVI liga de volta de um telefone normal, que é um acto
   humano. Não é geolocalização, mas é o mesmo objectivo.

   O número JÁ ia no aviso. O que estes testes travam é que continue a
   ir, e que o rótulo diga de quem é — no mesmo aviso há o número do
   cliente e o da JVI, e "WhatsApp" a solo não desambigua.
   --------------------------------------------------------------------------- */

test('o aviso a JVI diz de quem e o numero, para ela ligar de volta', () => {
  const t = msgEmpresa(CHEIO);
  assert.match(t, /• Telefone do cliente: \+258 87 806 6265/);
  assert.doesNotMatch(t, /• WhatsApp:/,
    'o rótulo antigo não diz de quem é o número, e o aviso tem dois');
});

test('no aviso a JVI o numero de retorno e o do CLIENTE, nunca o da JVI', () => {
  /* Se os dois números fossem para o mesmo sítio, a JVI ligava para si
     própria. O número da JVI é a constante `JVI_WHATSAPP` e não pode
     aparecer no corpo do aviso. */
  const t = msgEmpresa({ ...CHEIO, telefone: '82 555 8005' });
  assert.match(t, /• Telefone do cliente: \+258 82 555 8005/);
  assert.doesNotMatch(t, /\+258 87 806 6265/);
  assert.doesNotMatch(t, /258878066265/);
});

