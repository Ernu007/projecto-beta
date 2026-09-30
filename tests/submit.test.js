/* Testes da validação do lado do servidor.
   Importa as funções puras exportadas por functions/submit.js — o
   handler HTTP não é testado aqui, mas a validação e a formatação
   das mensagens, que é onde vivem os buracos, são. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { validar, textoWA, esc, celula, campoLimpo, RE_EMAIL, RE_TEL,
  LIMITES, calcularPrecoServidor, PROVINCIAS } from '../functions/submit.js';

const BOM = {
  nome: 'João Pedro',
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

test('um pedido completo nao tem problemas', () => {
  assert.deepEqual(validar(BOM), []);
});

test('faltam os campos obrigatorios um a um', () => {
  for (const campo of ['nome', 'apelido', 'provincia', 'morada',
    'destinatario', 'provinciaDestino', 'descricao']) {
    const p = validar({ ...BOM, [campo]: '' });
    assert.ok(p.length > 0, `faltava detectar ${campo} em falta`);
  }
});

test('telefone invalido ou ausente e problema', () => {
  assert.ok(validar({ ...BOM, telefone: '' }).length > 0);
  assert.ok(validar({ ...BOM, telefone: 'abc' }).length > 0);
  assert.ok(validar({ ...BOM, telefone: '123' }).length > 0);
  assert.deepEqual(validar({ ...BOM, telefone: '+258 84 793 5035' }), []);
});

test('peso invalido e problema, e aceita virgula decimal', () => {
  for (const p of ['', '0', '-4', 'doze', 'NaN']) {
    assert.ok(validar({ ...BOM, peso: p }).length > 0, `peso "${p}" devia falhar`);
  }
  assert.deepEqual(validar({ ...BOM, peso: '11,7' }), []);
  assert.deepEqual(validar({ ...BOM, peso: '11.7' }), []);
});

test('so aceita as tres formas de pagamento que o cliente pediu', () => {
  for (const p of ['e-Mola', 'Cartão de crédito', 'Numerário']) {
    assert.deepEqual(validar({ ...BOM, pagamento: p }), [], p);
  }
  for (const p of ['Cheque', 'M-Pesa', 'Bitcoin', '', 'emola']) {
    assert.ok(validar({ ...BOM, pagamento: p }).length > 0, `"${p}" devia falhar`);
  }
});

test('pagarNoLevantamento so aceita sim ou nao', () => {
  assert.deepEqual(validar({ ...BOM, pagarNoLevantamento: 'sim' }), []);
  assert.deepEqual(validar({ ...BOM, pagarNoLevantamento: 'nao' }), []);
  assert.ok(validar({ ...BOM, pagarNoLevantamento: 'talvez' }).length > 0);
});

test('campos a mais sao descartados', () => {
  const p = validar({ ...BOM, paypal: 'x', _t: 9999, canal: 'email' });
  assert.deepEqual(p, []);
});

/* O servidor nao pode aceitar texto arbitrario numa coluna que deveria
   ter 11 valores. `pagamento` ja era allowlisted; `provincia` nao. */
test('a provincia tem de ser uma das 11 do formulario', () => {
  for (const p of ['Maputo', 'Cabo Delgado', 'Zambézia', 'Palma', 'Niassa']) {
    assert.deepEqual(validar({ ...BOM, provincia: p }), [], p);
  }
  for (const p of ['Atlantis', 'Maputo<script>', 'maputo', '', 'M ASSETE']) {
    assert.ok(validar({ ...BOM, provincia: p }).length > 0,
      `provincia "${p}" devia falhar`);
  }
});

test('a provincia de destino tambem e allowlisted', () => {
  assert.deepEqual(validar({ ...BOM, provinciaDestino: 'Tete' }), []);
  assert.ok(validar({ ...BOM, provinciaDestino: 'Narnia' }).length > 0);
});

/* O preco que o browser envia e um valor que o proprio cliente escolheu.
   O servidor recalcula a partir do peso. */
test('calcularPrecoServidor reproduz a tabela do cliente', () => {
  assert.equal(calcularPrecoServidor(9).total, 3480);
  assert.equal(calcularPrecoServidor(11).total, 3480);
  assert.equal(calcularPrecoServidor(11.7).total, 3480);
  assert.equal(calcularPrecoServidor(15).total, 4437);
  assert.equal(calcularPrecoServidor('15').total, 4437);
  assert.equal(calcularPrecoServidor('11,7').total, 3480);
  assert.equal(calcularPrecoServidor(0), null);
  assert.equal(calcularPrecoServidor('doze'), null);
});

test('o preco do servidor tambem e monotonico', () => {
  let anterior = 0;
  for (let i = 1; i <= 2000; i += 1) {
    const { total } = calcularPrecoServidor(i * 0.01);
    assert.ok(total >= anterior, `${i * 0.01} kg: ${total} < ${anterior}`);
    anterior = total;
  }
});

/* RE_TEL conta caracteres, nao digitos: `() () ()` passava. */
test('um telefone sem um unico digito e rejeitado', () => {
  for (const t of ['() () ()', '........', '- - - - -', '  ']) {
    assert.ok(validar({ ...BOM, telefone: t }).length > 0,
      `"${t}" devia falhar`);
  }
});

/* esc nao e idempotente, e esc() era aplicado duas vezes a todos os
   campos: uma pessoa chamada "A & B" chegava a JVI como "A &amp; B". */
test('os dados nao sao escapados duas vezes', () => {
  const uma = campoLimpo({ ...BOM, descricao: 'Tintas A & B <Lda>' }, 'descricao');
  assert.equal(uma, 'Tintas A &amp; B &lt;Lda&gt;');
  assert.ok(!uma.includes('&amp;amp;'), 'esc foi aplicado duas vezes');
  assert.equal(celula(uma), uma, 'celula nao pode escapar outra vez');
});

test('celula continua a neutralizar formulas depois de um esc', () => {
  assert.ok(celula(esc('=1+1')).startsWith("'"));
});

test('valores sao cortados ao limite do campo', () => {
  const longo = 'A'.repeat(LIMITES.descricao + 500);
  /* validar() nao devolve o objecto limpo, mas nao deve rebentar */
  assert.doesNotThrow(() => validar({ ...BOM, descricao: longo }));
});

test('esc neutraliza marcacao', () => {
  assert.equal(esc('<script>alert(1)</script>'),
    '&lt;script&gt;alert(1)&lt;/script&gt;');
  assert.equal(esc('a"b\'c&d'), 'a&quot;b&#39;c&amp;d');
  assert.equal(esc('s\x00o'), 'so');          // caracteres de controlo
});

test('celula neutraliza injecao de formula na folha de calculo', () => {
  for (const ataque of ['=1+1', '+cmd', '-2', '@SUM', '\t=x', '\r=y']) {
    assert.ok(celula(ataque).startsWith("'"), `nao neutralizado: ${JSON.stringify(ataque)}`);
  }
  assert.equal(celula('camisetas'), 'camisetas');
});

test('textoWA leva os dados e o total', () => {
  const t = textoWA({ ...BOM, preco_total: 3480 });
  assert.match(t, /NOVO PEDIDO DE ORÇAMENTO/);
  assert.match(t, /João Pedro/);
  assert.match(t, /11\.7 kg/);
  assert.match(t, /tintas PLASCON/);
  assert.match(t, /Cabo Delgado/);
  assert.match(t, /e-Mola/);
  assert.match(t, /no levantamento: sim/);
  assert.match(t, /3480 MT/);
});

test('textoWA sem total nao inventa um valor', () => {
  const t = textoWA(BOM);
  assert.doesNotMatch(t, /MT/);
  assert.doesNotMatch(t, /undefined|NaN/);
});

test('os padroes de email e telefone sao ancorados', () => {
  assert.ok(RE_EMAIL.test('a.b@example.co.mz'));
  assert.ok(!RE_EMAIL.test('a@b@c.com'));
  assert.ok(!RE_EMAIL.test('<script>@x.com'));
  assert.ok(RE_TEL.test('+258 84 793 5035'));
  assert.ok(!RE_TEL.test('abc'));
});
