import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const CSS = fs.readdirSync('css')
  .filter((f) => f.endsWith('.css'))
  .map((f) => ['css', f, fs.readFileSync(path.join('css', f), 'utf8')]);

const RAIZ = path.resolve('css/styles.css');
const bloco = CSS.find(([d, f]) => path.resolve(d, f) === RAIZ)[2];

/* Um token que se refere a si mesmo não tem cor nenhuma: o browser
   descarta a declaração. Foi o que aconteceu quando o script de
   tokenização substituiu `#25D366` por `var(--wa)` dentro da
   definição de `--wa`. Este teste existe para isso não voltar. */
test('nenhum token se define a si mesmo', () => {
  const auto = [...bloco.matchAll(/(--[a-z0-9-]+)\s*:\s*var\(\s*\1\s*\)/g)];
  assert.deepEqual(auto.map((m) => m[1]), [],
    'token auto-referencial: ' + auto.map((m) => m[0]).join(', '));
});

test('todo token usado tem de estar definido em :root', () => {
  const definidos = new Set([...bloco.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
  const usados = new Set();
  for (const [, , txt] of CSS) {
    for (const m of txt.matchAll(/var\(\s*(--[a-z0-9-]+)/g)) usados.add(m[1]);
  }
  // `--p` é escrito por js/hero-voo.js com style.setProperty, em runtime.
  usados.delete('--p');
  assert.deepEqual([...usados].filter((t) => !definidos.has(t)), []);
});

test('as tres cores de marca so aparecem como token, nunca literais', () => {
  const literais = { '169, 207, 68': 'verde', '234, 130, 64': 'laranja' };
  for (const [canal, nome] of Object.entries(literais)) {
    for (const [dir, ficheiro, txt] of CSS) {
      // fora da definição do próprio token de canal
      const usos = [...txt.matchAll(new RegExp(`rgba\\(\\s*${canal}\\s*,`, 'g'))];
      const linhaDefinicao = new RegExp(`--${nome}-rgb\\s*:`);
      for (const u of usos) {
        const linha = txt.slice(0, u.index).split('\n').length;
        const linhaTxt = txt.split('\n')[linha - 1];
        assert.ok(linhaDefinicao.test(linhaTxt),
          `${ficheiro}:${linha} ainda escreve rgb(${canal}, ...) à mão`);
      }
    }
  }
});

test('o contraste do texto principal continua a passar AA', () => {
  // Reproduz o cálculo de tools/contraste.py para os dois piores pares.
  const lin = (c) => {
    c /= 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const ratio = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };
  const hex = (h) => [0, 2, 4].map((i) => parseInt(h.slice(1 + i, 3 + i), 16));

  // --texto-fraco (claro a 0.66) sobre --base-3: o pior par do site.
  const composto = [203, 213, 225].map((c, i) => Math.round(0.66 * c + 0.34 * hex('#1B2740')[i]));
  assert.ok(ratio(composto, hex('#1B2740')) >= 4.5);

  // --laranja sobre --base-3, o pior par da cor de marca.
  assert.ok(ratio(hex('#EA8240'), hex('#1B2740')) >= 4.5);
});

/* O titulo do hero comeca apagado e acende com a animacao do voo. Com
   o piso antigo (0.12) o <h1> ficava a 1,26:1 durante ~7 segundos, e
   para sempre se o canvas nao arrancasse. O piso tem de manter o pior
   estado acima de 3:1, que e o que o WCAG exige para texto grande. */
test('o titulo do hero mantem-se legivel mesmo no pior estado', () => {
  const m = /opacity:\s*calc\(\s*([\d.]+)\s*\+\s*[\d.]+\s*\*\s*var\(--p/.exec(bloco);
  assert.ok(m, 'a regra de opacidade do .pal mudou de forma');
  const piso = Number(m[1]);
  assert.ok(piso >= 0.6,
    `o piso do titulo desceu para ${piso} — o h1 fica ilegivel no pior estado`);

  const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const hex = (h) => [0, 2, 4].map((i) => parseInt(h.slice(1 + i, 3 + i), 16));

  // pior caso: cada cor do degradê do título, composta sobre o fundo do
  // hero com a opacidade no piso
  const fundo = hex('#0F172A');
  for (const cor of ['#A9CF44', '#82C91E', '#EA8240']) {
    const frente = hex(cor);
    const composta = frente.map((c, i) => Math.round(piso * c + (1 - piso) * fundo[i]));
    const r = ratio(composta, fundo);
    assert.ok(r >= 3, `${cor} a opacidade ${piso} dá ${r.toFixed(2)}:1, abaixo de 3:1`);
  }
});
