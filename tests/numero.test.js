import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  JVI_WHATSAPP, JVI_TELEFONE, normalizarTelefone, telefoneLegivel, linkWa,
} from '../js/orcamento.js';
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

   FASE 9 (9.1) — DOIS NÚMEROS, DOIS PAPÉIS (D38)

   O 87 806 6265 deixou de ser "o número": é só o do WhatsApp. As
   chamadas passam a ser no 84 470 0012. O erro que este ficheiro passa
   a apanhar é o número certo no papel errado — um `tel:` com o número do
   WhatsApp põe o cliente a ligar para um número que ninguém atende, e a
   olho os dois números parecem ambos "o da JVI".
   --------------------------------------------------------------------------- */

const NOVO = '878066265';          // WhatsApp (Movitel)
const VOZ = '844700012';           // chamadas (Vodacom)
const ANTIGO = '847935035';
const LEGIVEL = '+258 87 806 6265';
const LEGIVEL_VOZ = '+258 84 470 0012';

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

test('9.1: ha uma constante para as chamadas, e nao e a do WhatsApp', () => {
  assert.equal(JVI_TELEFONE, `258${VOZ}`);
  assert.equal(telefoneLegivel(JVI_TELEFONE), LEGIVEL_VOZ);
  assert.notEqual(JVI_TELEFONE, JVI_WHATSAPP);
});

const HTML = fs.readFileSync('index.html', 'utf8');
const LD = JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(HTML)[1]);

test('9.1: todos os wa.me levam o numero do WhatsApp e todos os tel: o das chamadas', () => {
  const wa = [...HTML.matchAll(/https:\/\/wa\.me\/(\d+)/g)].map((m) => m[1]);
  assert.ok(wa.length >= 4, `só encontrei ${wa.length} links wa.me`);
  assert.deepEqual([...new Set(wa)], [`258${NOVO}`]);

  const tel = [...HTML.matchAll(/href="tel:([^"]+)"/g)].map((m) => m[1]);
  assert.ok(tel.length >= 2, `só encontrei ${tel.length} links tel:`);
  assert.deepEqual([...new Set(tel)], [`+258${VOZ}`],
    'um tel: com o número do WhatsApp põe o cliente a ligar para quem não atende');

  assert.match(HTML, /aria-label="Ligar para \+258 84 470 0012"/);
  assert.doesNotMatch(HTML, /Ligar para \+258 87/);
});

test('9.1: o JSON-LD leva o numero de chamadas como telephone, e o WhatsApp a parte', () => {
  assert.equal(LD.telephone, `+258${VOZ}`);
  const pontos = LD.contactPoint ?? [];
  const voz = pontos.filter((p) => p.telephone === `+258${VOZ}`);
  const wa = pontos.filter((p) => p.telephone === `+258${NOVO}`);
  assert.equal(voz.length, 1, 'o contactPoint de chamadas falta ou repete-se');
  assert.equal(wa.length, 1, 'o contactPoint do WhatsApp falta ou repete-se');
  assert.equal(pontos.length, 2, 'há um contactPoint com um número que não é nenhum dos dois');
  assert.equal(wa[0].url, `https://wa.me/258${NOVO}`);
  assert.match(`${wa[0].name ?? ''} ${wa[0].contactType ?? ''}`, /WhatsApp/);
  assert.equal(voz[0].url, undefined, 'o ponto de chamadas não é um link de WhatsApp');
});

test('9.1: os contactos mostram os dois numeros, cada um com o seu rotulo', () => {
  const cont = /<section\b[^>]*id="contactos"[^>]*>([\s\S]*?)<\/section>/.exec(HTML)[1];
  const itens = [...cont.matchAll(/<a class="cont-item" href="([^"]+)"[^>]*>[\s\S]*?<span><b>([^<]*)<\/b>([^<]*)<\/span>\s*<\/a>/g)]
    .map((m) => ({ href: m[1], rotulo: m[2], valor: m[3] }));

  const wa = itens.find((i) => i.href.startsWith('https://wa.me/'));
  assert.ok(wa, 'os contactos não têm o item do WhatsApp');
  assert.match(wa.rotulo, /WhatsApp/);
  assert.equal(wa.valor, LEGIVEL);

  const tel = itens.find((i) => i.href.startsWith('tel:'));
  assert.ok(tel, 'os contactos não têm o item das chamadas');
  assert.match(tel.rotulo, /chamadas/i, 'o rótulo tem de dizer que este é o número para ligar');
  assert.doesNotMatch(tel.rotulo, /WhatsApp/);
  assert.equal(tel.valor, LEGIVEL_VOZ);

  /* E o do WhatsApp diz que não é para ligar: é a metade do rótulo que
     impede a pessoa de ficar à espera numa chamada que ninguém atende. */
  assert.match(wa.rotulo, /mensagens/i);
});

test('9.1: todo o numero escrito por extenso e um dos dois, e o papel bate certo', () => {
  const escritos = [...HTML.matchAll(/\+258 \d{2} \d{3} \d{4}/g)].map((m) => m[0]);
  assert.ok(escritos.length >= 4, `só encontrei ${escritos.length} números por extenso`);
  assert.deepEqual([...new Set(escritos)].sort(), [LEGIVEL_VOZ, LEGIVEL].sort());

  /* A política de privacidade manda LIGAR: é o número das chamadas. */
  const pp = /<div class="pp">([\s\S]*?)<p class="pp__meta pp__meta--fim">/.exec(HTML)?.[1] ?? '';
  assert.ok(pp.includes(`ligar <strong>${LEGIVEL_VOZ}</strong>`),
    'a política de privacidade não manda ligar para o número das chamadas');
  assert.ok(!pp.includes(LEGIVEL), 'a política de privacidade manda ligar para o número do WhatsApp');
});

test('9.1: a carta de apresentacao da o numero de chamadas como Telefone, e o WhatsApp a parte', () => {
  const carta = fs.readFileSync('carta/index.html', 'utf8');
  const escritos = [...carta.matchAll(/\+258 \d{2} \d{3} \d{4}/g)].map((m) => m[0]);
  assert.ok(escritos.length >= 4, `só encontrei ${escritos.length} números na carta`);
  assert.deepEqual([...new Set(escritos)].sort(), [LEGIVEL_VOZ, LEGIVEL].sort());

  /* Tudo o que a carta chama "Telefone" é o número de chamadas. */
  const telefones = [...carta.matchAll(/<b>Telefone[^<]*<\/b>\s*(?:<span>)?\s*(\+258 \d{2} \d{3} \d{4})/g)].map((m) => m[1]);
  assert.ok(telefones.length >= 3, `só encontrei ${telefones.length} "Telefone" na carta`);
  assert.deepEqual([...new Set(telefones)], [LEGIVEL_VOZ]);

  /* E o do WhatsApp só aparece com o nome do WhatsApp ao lado. */
  for (const m of carta.matchAll(/\+258 87 806 6265/g)) {
    const antes = carta.slice(Math.max(0, m.index - 80), m.index);
    assert.match(antes, /WhatsApp/, `a carta dá o número do WhatsApp sem dizer que é WhatsApp: …${antes}`);
  }
});

/* Na Fase 9 o 84 (Vodacom) voltou, para as chamadas, e o 87 (Movitel)
   ficou no WhatsApp: os dois têm de passar em todo o lado. */
test('9.1: o prefixo 84 das chamadas passa nos mesmos normalizadores', () => {
  for (const t of ['84 470 0012', '+258 84 470 0012', '258844700012',
    '00258844700012', '258 84 470 0012', '0844700012']) {
    assert.equal(normalizarTelefone(t), `258${VOZ}`, `normalizarTelefone: ${t}`);
    assert.equal(telefoneCallback(t), LEGIVEL_VOZ, `telefoneCallback: ${t}`);
    assert.ok(RE_TEL.test(t), `RE_TEL: ${t}`);
    assert.deepEqual(validar({
      nome: 'João Pedro', apelido: 'Machava', provincia: 'Nampula', morada: 'Sommerschield',
      destinatario: 'Ana Maria', provinciaDestino: 'Cabo Delgado', peso: '11.7',
      pagamento: 'e-Mola', pagarNoLevantamento: 'sim', telefone: t,
    }), [], `validar: ${t}`);
  }
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
