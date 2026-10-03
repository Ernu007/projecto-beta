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

/* Lê as cores do `:root` em vez de as escrever à mão. A versão
   anterior testava hexadecimais literais, pelo que mudar `--laranja` ou
   `--texto-fraco` mantinha o teste verde a medir uma cor que já não
   existe. */
function token(nome) {
  const m = new RegExp(
    `^\\s*${nome}\\s*:\\s*(#[0-9A-Fa-f]{3,8}|rgba?\\([^;]*?\\)|rgb\\(.*?\\)|[\\d\\s]+)\\s*;`,
    'm',
  ).exec(bloco);
  if (!m) throw new Error(`token ${nome} não encontrado no :root`);
  return m[1];
}

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
const rgba = (v) => {
  const m = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/.exec(v);
  return [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]];
};

/** Resolve um valor de cor do `:root` para [frente, alfa], seja
 *  #hex, rgba(...), rgb(var(--canal-rgb) / alfa) ou um canal `R G B`. */
function resolver(valor) {
  if (valor.startsWith('#')) return [hex(valor), 1];
  if (valor.startsWith('rgb(var(')) {
    const canal = /var\((--[a-z-]+)\)/.exec(valor)[1];
    const alfa = Number(/\/\s*([\d.]+)\s*\)/.exec(valor)[1]);
    return [resolver(token(canal))[0], alfa];
  }
  if (valor.startsWith('rgb(')) return [[255, 255, 255], 1];
  // canal "R G B" (--verde-rgb: 169 207 68)
  const canais = valor.trim().split(/\s+/).map(Number);
  if (canais.length >= 3 && canais.every(Number.isFinite)) return [canais.slice(0, 3), 1];
  const [r, g, b, a] = rgba(valor);
  return [[r, g, b], a];
}

/** Compõe uma cor com alfa sobre um fundo opaco, como o browser faz. */
const sobre = (frente, alpha, fundo) =>
  frente.map((c, i) => Math.round(alpha * c + (1 - alpha) * fundo[i]));

test('o contraste do texto principal continua a passar AA', () => {
  const fundos = { '--base': hex(token('--base')), '--base-2': hex(token('--base-2')),
    '--base-3': hex(token('--base-3')), '--rodape': hex(token('--rodape')) };

  for (const nome of ['--texto', '--texto-suave', '--texto-fraco', '--claro',
    '--verde', '--verde-escuro', '--laranja']) {
    const [frente, alpha] = resolver(token(nome));
    for (const [fnome, fundo] of Object.entries(fundos)) {
      const r = ratio(sobre(frente, alpha, fundo), fundo);
      assert.ok(r >= 4.5, `${nome} sobre ${fnome} dá ${r.toFixed(2)}:1`);
    }
  }
});

/* Fase 9 (9.6). O botão de WhatsApp do hero passou de vidro a verde — o
   verde da marca WhatsApp (`--wa`), com o texto em `--sobre-wa`. Os três
   botões de cor sólida do site têm texto escuro sobre cor viva; nenhum
   estava medido, porque o teste de cima só mede texto sobre os fundos
   escuros. */
test('9.6: o texto dos botoes de cor solida passa AA sobre a cor do botao', () => {
  const pares = [
    ['--sobre-wa', '--wa'],              // WhatsApp: hero, rodapé, ecrã de sucesso
    ['--base', '--verde'],               // primário, ponta clara do degradê
    ['--base', '--verde-escuro'],        // primário, ponta escura do degradê
    ['--sobre-laranja', '--laranja'],    // "Descarregar PDF"
  ];
  for (const [texto, fundo] of pares) {
    const r = ratio(hex(token(texto)), hex(token(fundo)));
    assert.ok(r >= 4.5, `${texto} sobre ${fundo} dá ${r.toFixed(2)}:1`);
  }

  /* E são mesmo essas as cores do botão do WhatsApp. */
  const orc = CSS.find(([, f]) => f === 'orcamento.css')[2];
  const wa = /\.btn--wa\s*\{([^}]*)\}/.exec(orc)?.[1] ?? '';
  assert.match(wa, /background:\s*var\(--wa\)/);
  assert.match(wa, /color:\s*var\(--sobre-wa\)/);
});

/* "Usa o verde da marca WhatsApp (diferente do verde JVI) para não ficarem
   dois verdes a competir." Diferente tem de se ver: mede-se o tom. */
test('9.6: o verde do WhatsApp nao se confunde com o verde da JVI', () => {
  const tom = ([r, g, b]) => {
    const [x, y, z] = [r, g, b].map((c) => c / 255);
    const max = Math.max(x, y, z);
    const d = max - Math.min(x, y, z);
    const h = max === x ? ((y - z) / d) % 6 : max === y ? (z - x) / d + 2 : (x - y) / d + 4;
    return (h * 60 + 360) % 360;
  };
  assert.equal(token('--wa').toUpperCase(), '#25D366', 'o --wa deixou de ser o verde da marca WhatsApp');
  const wa = tom(hex(token('--wa')));
  for (const nome of ['--verde', '--verde-escuro']) {
    const jvi = tom(hex(token(nome)));
    assert.ok(Math.abs(wa - jvi) >= 40,
      `o tom do WhatsApp (${wa.toFixed(0)}°) está a ${Math.abs(wa - jvi).toFixed(0)}° do ${nome} (${jvi.toFixed(0)}°)`);
  }
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

  // pior caso: cada cor do degradê do título, composta sobre o fundo do
  // hero com a opacidade no piso. As cores vêm do gradiente no CSS.
  const fundo = hex(token('--base'));
  const gradiente = /\.pal\s*\{[\s\S]*?linear-gradient\([^;]*?([\s\S]*?)\);/.exec(bloco)?.[1] ?? '';
  const cores = [...gradiente.matchAll(/var\((--[a-z-]+)\)/g)]
    .map((x) => x[1])
    .map((nome) => hex(token(nome)));
  assert.ok(cores.length >= 3, 'não encontrei as cores do degradê do título');

  for (const frente of cores) {
    const composta = frente.map((c, i) => Math.round(piso * c + (1 - piso) * fundo[i]));
    const r = ratio(composta, fundo);
    assert.ok(r >= 3, `cor do degradê a opacidade ${piso} dá ${r.toFixed(2)}:1, abaixo de 3:1`);
  }
});
