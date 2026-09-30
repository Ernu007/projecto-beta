import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/* ---------------------------------------------------------------------------
   O QUE ESTE FICHEIRO PROTEGE

   Duas falhas de Nível A / 4.1.2 que ninguém vê numa revisão visual, e
   que a auditoria de acessibilidade encontrou:

   1. Nenhum skip link. Antes do conteúdo principal há 9 elementos
      focáveis (a marca, 7 links de navegação, o botão de orçamento), e
      quem navega só com teclado tinha de carregar Tab nove vezes em cada
      visita. WCAG 2.4.1 Bypass Blocks.

   2. Os alvos da navegação interna não eram focáveis. Isto é o mais
      subtil: pela especificação HTML, um link de fragmento só move o
      FOCO se o destino for focável. Sem `tabindex="-1"`, `#servicos` e
      `#contactos` limitavam-se a mover a posição de partida da
      navegação sequencial. O scroll mudava, o foco ficava no link, e
      quem usasse leitor de ecrã ouvia o menu outra vez em vez do
      conteúdo. Um link de navegação que não move o foco não é
      navegação.

   3. `aria-invalid` nunca era posto em lado nenhum. O texto de erro
      entrava no `aria-describedby` (essa parte já estava bem feita), mas
      o ESTADO inválido não era exposto: em modo de formulário do NVDA e
      do JAWS o campo aparecia como válido, com uma descrição de erro.
      Era o inverso do que a pessoa precisava de ouvir.
   --------------------------------------------------------------------------- */

const HTML = fs.readFileSync('index.html', 'utf8');
const ORC = fs.readFileSync(path.join('js', 'orcamento.js'), 'utf8');

/** Os ids que algum `href="#…"` do documento aponta. */
function alvosInternos() {
  return new Set([...HTML.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]));
}

/** A etiqueta de abertura COMPLETA do elemento que tem um dado id. */
function tagComId(id) {
  const m = HTML.match(new RegExp(`<[a-z0-9]+\\b[^>]*\\bid="${id}"[^>]*>`, 'i'));
  return m ? m[0] : null;
}

test('existe um skip link como primeiro elemento focavel do body', () => {
  const m = HTML.match(/<a\b[^>]*class="[^"]*\bpular\b[^"]*"[^>]*>([^<]*)</);
  assert.ok(m, 'não encontrei o skip link (.pular)');
  assert.match(m[0], /href="#topo"/,
    'o skip link tem de apontar para o #topo, que é o <main>');
  assert.ok(m[1].trim().length > 0, 'o skip link tem de ter texto visível');

  /* Tem de ser o PRIMEIRO: um skip link depois do header não poupa as
     tabulações que existem para saltar. Corta a partir do FIM de
     `<body>`, senão a própria etiqueta `<body>` é a primeira tag. */
  const corpo = HTML.slice(HTML.indexOf('<body>') + '<body>'.length);
  const primeiraTag = corpo.match(/<([a-z0-9]+)\b/i);
  assert.equal(primeiraTag[1].toLowerCase(), 'a',
    'o skip link tem de ser o primeiro elemento do body');
  assert.ok(corpo.indexOf('class="pular"') < corpo.indexOf('<header'),
    'o skip link tem de vir antes do header, senão não poupa nada');
});

test('todo o alvo de link interno é focável', () => {
  const alvos = alvosInternos();
  assert.ok(alvos.size >= 7, `esperava varios alvos internos, achei ${alvos.size}`);

  for (const id of alvos) {
    const tag = tagComId(id);
    assert.ok(tag, `o link #${id} aponta para um id que nao existe`);
    assert.match(tag, /tabindex="-1"/,
      `#${id} e' alvo de um link de fragmento e nao tem tabindex="-1": `
      + 'o scroll muda mas o foco fica no link (WCAG 2.4.1)');
  }
});

test('o <main> tem tabindex="-1" e mostra o anel de foco', () => {
  const main = HTML.match(/<main\b[^>]*>/)?.[0];
  assert.ok(main, 'não encontrei o <main>');
  assert.match(main, /id="topo"/, 'o #topo tem de continuar a ser o <main>');
  assert.match(main, /tabindex="-1"/,
    'sem tabindex="-1" o skip link não move o foco para o conteúdo');

  const CSS = fs.readFileSync(path.join('css', 'styles.css'), 'utf8');
  assert.match(CSS, /\.pular:focus/,
    'o skip link tem de aparecer quando recebe o foco');
  assert.match(CSS, /main:focus-visible/,
    'o foco que entra no <main> tem de ter um sinal visível, ou a pessoa '
    + 'não sabe onde landed');
});

test('aria-invalid é posto quando o campo está mau e tirado quando passa', () => {
  assert.match(ORC, /if \(mau\) inp\.setAttribute\(\s*'aria-invalid',\s*'true'\s*\)/,
    'o estado invalido tem de ser exposto no proprio campo');
  assert.match(ORC, /else inp\.removeAttribute\('aria-invalid'\)/,
    'e tem de ser removido quando o campo passa a valer — um '
    + 'aria-invalid que fica para sempre tambem mente');
});

test('nenhum campo do formulário declara aria-invalid no HTML', () => {
  /* Se estivesse no HTML à partida, o `removeAttribute` nunca surtiria
     efeito e o campo nasceria marcado como inválido. */
  const campos = HTML.slice(HTML.indexOf('<template id="tplOrc"'));
  assert.doesNotMatch(campos, /aria-invalid/,
    'aria-invalid não pode estar marcado no HTML: é o JS que decide, '
    + 'consoante o campo foi validado ou não');
});
