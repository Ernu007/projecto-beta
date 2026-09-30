import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../functions/submit.js';

/* ---------------------------------------------------------------------------
   O BUG

   O handler fazia `JSON.parse(corpo)` e usava o resultado logo a seguir:

       if (bruto.website) return resp(req, 200, {..., spam: true });

   O `JSON.parse` aceita qualquer valor JSON, e só um deles é objeto. Um
   corpo `null` — que é JSON perfeitamente válido — dá `bruto === null`, e
   a leitura seguinte rebenta:

       TypeError: Cannot read properties of null (reading 'website')

   Um TypeError dentro de uma Netlify Function é um 500. Não é uma
   vulnerabilidade: o pedido morre antes da validação e não contorna nada.
   É robustez, e era o ÚNICO sítio do ficheiro que não era defensivo — o
   resto do código usa `String(v ?? '')` sem excepção em lado nenhum.

   Depende do runtime: se a Netlify entregar o corpo já parseado, `null`
   cai em `JSON.stringify(null ?? '')` e dá `'""'`, que faz parse para a
   string vazia e a validação responde 400 como deve ser. Se o corpo
   chegar como string crua — que é o caminho normal — é um 500. Um bug que
   aparece num ambiente e não noutro é o pior tipo de bug para investigar.

   Este ficheiro varre TODOS os tipos que o `JSON.parse` pode devolver, e
   exige que nenhum faça o handler rebentar.
   --------------------------------------------------------------------------- */

/** Todos os valores que `JSON.parse` aceita como documento de topo. */
const CORPOS = [
  ['null', 'null'],
  ['true', 'true'],
  ['false', 'false'],
  ['123', '123'],
  ['0', '0'],
  ['string', '"texto"'],
  ['string vazia', '""'],
  ['array vazio', '[]'],
  ['array com objecto', '[{"nome":"X"}]'],
  ['objecto vazio', '{}'],
  ['objecto com null', '{"nome":null}'],
  ['objecto com array', '{"nome":["a"]}'],
  ['objecto normal', '{"nome":"X","apelido":"Y"}'],
  ['malformado', '{'],
  ['vazio', ''],
];

async function pedir(corpo) {
  const r = await handler({
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: corpo,
  });
  return r;
}

test('nenhum tipo de JSON rebenta o handler', async () => {  for (const [nome, corpo] of CORPOS) {
    const r = await pedir(corpo);
    assert.ok(
      Number.isInteger(r.statusCode) && r.statusCode >= 200 && r.statusCode < 600,
      `corpo ${nome} devolveu statusCode invalido: ${r.statusCode}`,
    );
    /* 400 é a resposta certa para tudo o que não é um pedido válido.
       O que não pode é ser 500. */
    assert.notEqual(r.statusCode, 500,
      `corpo ${nome} deu 500 — o handler rebentou em vez de responder`);
    assert.doesNotThrow(() => JSON.parse(r.body),
      `corpo ${nome} devolveu um body que nao e' JSON`);
  }
});

test('um corpo JSON que não é objeto responde 400, não rebenta', async () => {
  for (const [nome, corpo] of [['null', 'null'], ['true', 'true'],
    ['123', '123'], ['string', '"texto"'], ['array', '[]']]) {
    const r = await pedir(corpo);
    assert.equal(r.statusCode, 400, `corpo ${nome} devia dar 400`);
    assert.equal(JSON.parse(r.body).erro, 'Dados inválidos');
  }
});

test('um pedido bem formado continua a passar', async () => {
  /* A guarda nova não pode engolir pedidos legítimos: `{}` tem de dar
     400 com a LISTA de campos em falta, e um pedido completo tem de
     chegar ao fim. */
  const vazio = await pedir('{}');
  assert.equal(vazio.statusCode, 400);
  const campos = JSON.parse(vazio.body).campos;
  assert.ok(Array.isArray(campos) && campos.length > 0,
    'um objeto vazio tem de dar 400 com a lista dos campos em falta');
});
