import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularPreco, formatarMT, PISO_BASE, TARIFA_KG, IVA } from '../js/precos.js';

/* Os pontos de fronteira que o cliente mandou testar explicitamente.
   [peso, base, iva, total] */
const TABELA = [
  [0.1, 3000, 480, 3480],
  [9, 3000, 480, 3480],
  [10, 3000, 480, 3480],
  [11, 3000, 480, 3480],   // 11*255 = 2805 -> piso
  [11.7, 3000, 480, 3480], // 11.7*255 = 2983.5 -> piso
  [12, 3060, 490, 3550],
  [15, 3825, 612, 4437],   // exemplo do briefing
  [50, 12750, 2040, 14790],
];

test('tabela de fronteira do briefing', () => {
  for (const [peso, base, iva, total] of TABELA) {
    const r = calcularPreco(peso);
    assert.equal(r.base, base, `base para ${peso} kg`);
    assert.equal(r.iva, iva, `IVA para ${peso} kg`);
    assert.equal(r.total, total, `total para ${peso} kg`);
  }
});

test('o preco nunca desce quando o peso sobe (monotonia)', () => {
  let anterior = 0;
  for (let i = 1; i <= 5000; i += 1) {
    const peso = (i * 0.01) + 0.01; // 0.02 .. 50.01 kg, passo de 10 g
    const { total } = calcularPreco(peso);
    assert.ok(total >= anterior,
      `total(${peso}) = ${total} e menor que o anterior ${anterior}`);
    anterior = total;
  }
});

test('o piso marca a partir de 11.7647 kg', () => {
  assert.equal(calcularPreco(11.76).aplicadoPiso, true);
  assert.equal(calcularPreco(11.77).aplicadoPiso, false);
  assert.ok(calcularPreco(11.77).base > PISO_BASE);
});

test('3000 MT com IVA da 3480 MT (regra do briefing)', () => {
  assert.equal(calcularPreco(9).total, Math.round(PISO_BASE * (1 + IVA)));
});

test('acima de 10 kg cobra 255 MT por kg', () => {
  assert.equal(calcularPreco(20).base, 20 * TARIFA_KG);
});

test('pesos invalidos devolvem null', () => {
  for (const mau of [0, -5, NaN, Infinity, 'doze', null, undefined, '']) {
    assert.equal(calcularPreco(mau), null, `peso ${String(mau)} devia dar null`);
  }
});

test('peso gigante continua a dar um numero finito', () => {
  const r = calcularPreco(100000);
  assert.equal(r.base, 100000 * TARIFA_KG);
  assert.equal(r.total, r.base + r.iva);
  assert.ok(Number.isFinite(r.total));
});

test('formatarMT usa espaco de milhares e sem decimais', () => {
  assert.equal(formatarMT(3480), '3 480 MT');
  assert.equal(formatarMT(14790), '14 790 MT');
  assert.equal(formatarMT(1000000), '1 000 000 MT');
  assert.equal(formatarMT(0), '0 MT');
});
