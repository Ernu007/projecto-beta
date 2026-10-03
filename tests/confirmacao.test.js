import test from 'node:test';
import assert from 'node:assert/strict';
import { linhasResumo } from '../js/orcamento.js';
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

test('linhasResumo lista os dados e os tres valores sem omitir nada', () => {
  const l = linhasResumo(CHEIO);
  const texto = l.map((x) => `${x.rotulo}: ${x.valor}`).join(' | ');
  assert.match(texto, /Emissor: João Pedro Sissu Sissu/);
  assert.match(texto, /Origem: Nampula/);
  assert.match(texto, /Morada: Bairro da Sommachine/);
  assert.match(texto, /Telefone: \+258 87 806 6265/);
  assert.match(texto, /Recebe: Ana Maria/);
  assert.match(texto, /Destino: Cabo Delgado/);
  assert.match(texto, /Peso: 11\.7 kg/);
  assert.match(texto, /Mercadoria: tintas PLASCON/);
  assert.match(texto, /Pagamento: e-Mola/);
  assert.match(texto, /Paga no levantamento: Sim/);
  assert.match(texto, /Base: 3 000 MT/);
  assert.match(texto, /IVA 16%: 480 MT/);
  assert.match(texto, /TOTAL: 3 480 MT/);
});

test('linhasResumo assinala o TOTAL como destacado', () => {
  const l = linhasResumo(CHEIO);
  const total = l.find((x) => x.rotulo === 'TOTAL');
  assert.equal(total.destaque, true);
  assert.equal(l.filter((x) => x.destaque).length, 1);
});

test('linhasResumo diz que o total so se baseia no que o preco precisa', () => {
  const preco = calcularPreco(11.7);
  const l = linhasResumo(CHEIO);
  assert.equal(l.find((x) => x.rotulo === 'Base').valor, formatarMT(preco.base));
  assert.equal(l.find((x) => x.rotulo === 'IVA 16%').valor, formatarMT(preco.iva));
  assert.equal(l.find((x) => x.rotulo === 'TOTAL').valor, formatarMT(preco.total));
});

test('linhasResumo sem peso nao inventa um total', () => {
  const l = linhasResumo({ ...CHEIO, peso: '' });
  const texto = l.map((x) => `${x.rotulo}: ${x.valor}`).join(' | ');
  assert.match(texto, /TOTAL: —/);
  assert.doesNotMatch(texto, /NaN|undefined/);
});

test('linhasResumo com liftamento marcado como nao', () => {
  const l = linhasResumo({ ...CHEIO, pagarNoLevantamento: 'nao' });
  assert.equal(l.find((x) => x.rotulo === 'Paga no levantamento').valor, 'Não');
});

test('linhasResumo já não tem dimensões nem chama "WhatsApp" ao telefone (8C/C8)', () => {
  const l = linhasResumo(CHEIO);
  assert.equal(l.find((x) => x.rotulo === 'Dimensões'), undefined);
  assert.equal(l.find((x) => x.rotulo === 'WhatsApp'), undefined);
});
