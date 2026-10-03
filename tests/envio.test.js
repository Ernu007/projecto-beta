import test from 'node:test';
import assert from 'node:assert/strict';
import { linkWa, dados, JVI_WHATSAPP } from '../js/orcamento.js';

test('JVI_WHATSAPP e o numero unico confirmado pelo cliente', () => {
  assert.equal(JVI_WHATSAPP, '258847935035');
});

test('linkWa constroi um wa.me com o numero e a mensagem codificados', () => {
  const u = linkWa('258847935035', 'Olá & Serviços\nPeso: 11.7 kg');
  assert.ok(u.startsWith('https://wa.me/258847935035?text='), u);
  const texto = decodeURIComponent(u.split('?text=')[1]);
  assert.equal(texto, 'Olá & Serviços\nPeso: 11.7 kg');
});

test('linkWa normaliza o numero antes de o usar', () => {
  for (const t of ['84 793 5035', '+258 84 793 5035', '00258847935035']) {
    assert.ok(linkWa(t, 'x').startsWith('https://wa.me/258847935035?text='), t);
  }
});

test('linkWa nunca deixa o texto rebentar o URL', () => {
  const u = linkWa('258847935035', 'a & b = c? d #e 100%');
  assert.ok(u.startsWith('https://wa.me/258847935035?text='));
  assert.equal(decodeURIComponent(u.split('?text=')[1]), 'a & b = c? d #e 100%');
});

/* `dados` recebe um objecto com a mesma forma de um <form>: um `elements`
   indexado por nome e um `querySelector`. Assim testamos a leitura sem DOM. */
const FORM_FALSO = (valores, marcado = {}) => ({
  elements: Object.fromEntries(
    Object.entries(valores).map(([k, v]) => [k, { value: v }])
  ),
  querySelector: (sel) => {
    const m = /^input\[name="(.+)"\]:checked$/.exec(sel);
    return m && marcado[m[1]] ? { value: marcado[m[1]] } : null;
  },
});

test('dados le o formulario para um objecto simples e aparado', () => {
  const form = FORM_FALSO(
    {
      nome: ' João Pedro ', apelido: 'Sissu', provincia: 'Nampula',
      morada: 'Sommachine', telefone: '84 793 5035',
      destinatario: 'Ana Maria', provinciaDestino: 'Cabo Delgado',
      peso: '11.7', dimensao: '60 x 40 x 40', descricao: 'tintas PLASCON',
    },
    { pagamento: 'M-Pesa', pagarNoLevantamento: 'nao' }
  );
  assert.deepEqual(dados(form), {
    nome: 'João Pedro', apelido: 'Sissu', provincia: 'Nampula',
    morada: 'Sommachine', telefone: '84 793 5035',
    destinatario: 'Ana Maria', provinciaDestino: 'Cabo Delgado',
    peso: '11.7', dimensao: '60 x 40 x 40', descricao: 'tintas PLASCON',
    pagamento: 'M-Pesa', pagarNoLevantamento: 'nao',
  });
});

test('dados cai nos valores por omissao quando os radios nao existem', () => {
  const d = dados(FORM_FALSO({ nome: 'Ana' }));
  assert.equal(d.pagamento, 'e-Mola');
  assert.equal(d.pagarNoLevantamento, 'sim');
  assert.equal(d.apelido, '');
});
