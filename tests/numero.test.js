import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { JVI_WHATSAPP, normalizarTelefone, telefoneLegivel, linkWa } from '../js/orcamento.js';
import { telefoneCallback, RE_TEL, validar } from '../functions/submit.js';

/* ---------------------------------------------------------------------------
   O NÚMERO DA EMPRESA MUDOU (D35 em docs/decisoes.md)

   De 84 793 5035 (Vodacom) para 87 806 6265 (Movitel). O número está
   escrito à mão em vários sítios que não passam por JS — links `wa.me`,
   `tel:`, JSON-LD, política de privacidade, carta — e um único sítio
   esquecido punha o cliente a ligar para um número que já não é da JVI.

   Este ficheiro varre o que se publica e o que o sustenta. Os briefings
   e o registo de decisões ficam de fora de propósito: são o registo do
   que foi dito na altura.
   --------------------------------------------------------------------------- */

const NOVO = '878066265';
const ANTIGO = '847935035';
const LEGIVEL = '+258 87 806 6265';

/** Ficheiros de texto vivos: o que se publica, o servidor, os testes e o
 *  que diz a quem mantém o site onde o número está. */
function vivos() {
  const lista = ['index.html', 'carta/index.html', 'README.md', '.env.example'];
  for (const dir of ['js', 'functions', 'tests', 'carta']) {
    for (const f of fs.readdirSync(dir)) {
      if (/\.(js|mjs|html|css)$/.test(f)) lista.push(path.join(dir, f).replace(/\\/g, '/'));
    }
  }
  /* Este ficheiro tem de nomear o número antigo para o poder procurar. */
  return [...new Set(lista)].filter((f) => f !== 'tests/numero.test.js');
}

test('o numero antigo nao sobra em nenhum ficheiro vivo', () => {
  const sobras = [];
  for (const f of vivos()) {
    const linhas = fs.readFileSync(f, 'utf8').split('\n');
    linhas.forEach((l, i) => {
      /* Só dígitos: apanha `84 793 5035`, `847935035` e `847 935 035`. */
      if (l.replace(/[\s().-]/g, '').includes(ANTIGO)) sobras.push(`${f}:${i + 1}`);
    });
  }
  assert.deepEqual(sobras, [], `o número antigo ainda está em: ${sobras.join(', ')}`);
});

test('a constante e o formato legivel sao os do numero novo', () => {
  assert.equal(JVI_WHATSAPP, `258${NOVO}`);
  assert.equal(telefoneLegivel(JVI_WHATSAPP), LEGIVEL);
  assert.ok(linkWa(JVI_WHATSAPP, 'x').startsWith(`https://wa.me/258${NOVO}?text=`));
});

test('o index.html usa o numero novo em todos os links e no JSON-LD', () => {
  const html = fs.readFileSync('index.html', 'utf8');

  const wa = [...html.matchAll(/https:\/\/wa\.me\/(\d+)/g)].map((m) => m[1]);
  assert.ok(wa.length >= 4, `só encontrei ${wa.length} links wa.me`);
  assert.deepEqual([...new Set(wa)], [`258${NOVO}`]);

  const tel = [...html.matchAll(/href="tel:([^"]+)"/g)].map((m) => m[1]);
  assert.ok(tel.length >= 2, `só encontrei ${tel.length} links tel:`);
  assert.deepEqual([...new Set(tel)], [`+258${NOVO}`]);

  assert.equal(/"telephone":\s*"([^"]+)"/.exec(html)?.[1], `+258${NOVO}`);
  assert.match(html, /aria-label="Ligar para \+258 87 806 6265"/);

  /* Todo o número escrito por extenso é o novo. */
  const escritos = [...html.matchAll(/\+258 \d{2} \d{3} \d{4}/g)].map((m) => m[0]);
  assert.ok(escritos.length >= 4, `só encontrei ${escritos.length} números por extenso`);
  assert.deepEqual([...new Set(escritos)], [LEGIVEL]);

  const pp = /<div class="pp">([\s\S]*?)<p class="pp__meta pp__meta--fim">/.exec(html)?.[1] ?? '';
  assert.ok(pp.includes(LEGIVEL), 'a política de privacidade não tem o número novo');
});

test('a carta de apresentacao usa o numero novo', () => {
  const carta = fs.readFileSync('carta/index.html', 'utf8');
  const escritos = [...carta.matchAll(/\+258 \d{2} \d{3} \d{4}/g)].map((m) => m[0]);
  assert.ok(escritos.length >= 4, `só encontrei ${escritos.length} números na carta`);
  assert.deepEqual([...new Set(escritos)], [LEGIVEL]);
});

/* O prefixo passou de 84 (Vodacom) para 87 (Movitel). Nada no site pode
   assumir que um móvel moçambicano começa por 84. */
test('o prefixo 87 passa em todos os normalizadores e padroes ancorados', () => {
  for (const t of ['87 806 6265', '+258 87 806 6265', '258878066265',
    '00258878066265', '258 87 806 6265', '0878066265']) {
    assert.equal(normalizarTelefone(t), `258${NOVO}`, `normalizarTelefone: ${t}`);
    assert.equal(telefoneCallback(t), LEGIVEL, `telefoneCallback: ${t}`);
    assert.ok(RE_TEL.test(t), `RE_TEL: ${t}`);
  }
  /* E os outros prefixos móveis continuam a passar: 82/83 (Tmcel),
     84/85 (Vodacom), 86/87 (Movitel). */
  for (const p of ['82', '83', '84', '85', '86', '87']) {
    assert.equal(normalizarTelefone(`${p} 123 4567`), `258${p}1234567`, `prefixo ${p}`);
  }
});

test('o servidor aceita um cliente com telefone 87', () => {
  const pedido = {
    nome: 'João Pedro', apelido: 'Machava', provincia: 'Nampula', morada: 'Sommerschield',
    destinatario: 'Ana Maria', provinciaDestino: 'Cabo Delgado', peso: '11.7',
    pagamento: 'e-Mola', pagarNoLevantamento: 'sim',
  };
  for (const telefone of ['87 123 4567', '+258 87 123 4567', '0871234567']) {
    assert.deepEqual(validar({ ...pedido, telefone }), [], `telefone: ${telefone}`);
  }
});
