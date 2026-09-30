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
  telefone: '84 793 5035',
  destinatario: 'Ana Maria',
  provinciaDestino: 'Cabo Delgado',
  peso: '11.7',
  dimensao: '60 x 40 x 40',
  descricao: 'tintas PLASCON',
  pagamento: 'e-Mola',
  pagarNoLevantamento: 'sim',
};

test('as 11 provincias do briefing estao no select', () => {
  assert.deepEqual(PROVINCIAS, [
    'Cabo Delgado', 'Gaza', 'Inhambane', 'Manica', 'Maputo', 'Nampula',
    'Niassa', 'Palma', 'Sofala', 'Tete', 'Zambézia',
  ]);
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

test('normalizarTelefone reduz qualquer escrita a 258847935035', () => {
  for (const t of ['84 793 5035', '+258 84 793 5035', '258847935035',
    '00258847935035', '258 84 793 5035', '0847935035']) {
    assert.equal(normalizarTelefone(t), '258847935035', `escrita: ${t}`);
  }
});

test('normalizarTelefone rejeita o que nao e telefone moçambicano', () => {
  for (const t of ['', 'abc', '123', null, undefined, '2588479350']) {
    assert.equal(normalizarTelefone(t), null, `entrada: ${String(t)}`);
  }
});

test('telefoneLegivel volta ao formato que se escreve em Moçambique', () => {
  assert.equal(telefoneLegivel('84 793 5035'), '+258 84 793 5035');
  assert.equal(telefoneLegivel('xyz'), '—');
});

test('a mensagem da empresa leva os dados completos e o orcamento', () => {
  const t = msgEmpresa(CHEIO);
  const preco = calcularPreco(11.7);
  assert.match(t, /NOVO PEDIDO DE ORÇAMENTO/);
  assert.match(t, /João Pedro Sissu/);
  assert.match(t, /Nampula/);
  assert.match(t, /Bairro da Sommachine/);
  assert.match(t, /\+258 84 793 5035/);
  assert.match(t, /Ana Maria/);
  assert.match(t, /Cabo Delgado/);
  assert.match(t, /11\.7 kg/);
  assert.match(t, /60 x 40 x 40/);
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
  assert.doesNotMatch(t, /258847935035/);  // sem numero internacional cru
  assert.doesNotMatch(t, /PISO|floor|3000 MT base/i);
  assert.match(t, /pagar no levantamento/i);
});

test('mensagens com campos vazios nao ficam com "—" a transbordar', () => {
  const vazio = msgEmpresa({ peso: '' });
  assert.match(vazio, /NOVO PEDIDO DE ORÇAMENTO/);
  assert.doesNotMatch(vazio, /undefined|NaN/);
});
