import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/* ---------------------------------------------------------------------------
   O QUE ESTE FICHEIRO PROTEGE

   A disposição dos três botões do hero nunca esteve escrita em lado
   nenhum. O `.hero__acoes` era um `display: flex; flex-wrap: wrap` — ou
   seja, **qual** botão caía **em que** linha dependia do comprimento do
   texto dos botões. Medido num Chrome real:

     "Pedir orçamento"      204.50px
     "Falar no WhatsApp"    221.20px
     "Como chegar à JVI"    217.88px
     dois gaps de 13px                  ->  669.58px
     largura do contentor                ->  660px

   669.58 > 660. O terceiro botão não cabia na primeira linha e descia
   sozinho, com a largura dele, encostado à esquerda por baixo do botão
   primário de 204.50px: lia-se como botão órfão, e não como uma acção
   secundária.

   Este ficheiro fixa a DISPOSIÇÃO e não os pixels. A primeira linha leva
   dois botões e o das direcções ocupa a linha inteira — por declaração,
   de modo a que voltar a caber ou a não caber depende da largura do texto
   já não possa trocar o desenho de baixo. E o limite de viewport em que
   as acções passam a coluna única é conferido contra a largura que sobra
   dentro do contentor, para nunca apertar dois botões que não caibam.
   --------------------------------------------------------------------------- */

const HTML = fs.readFileSync('index.html', 'utf8');
const CSS = fs.readFileSync(path.join('css', 'styles.css'), 'utf8');

/* As larguras de cima, medidas no browser. O `.btn` usa `font-size: 15px`
   fixo (não é um `clamp()`), portanto valem em qualquer viewport. */
const ORCAMENTO = 204.5;
const WHATSAPP = 221.2;
const DIRECCOES = 217.88;
const PAR_MAIS_LARGO = ORCAMENTO + WHATSAPP;

/* ---------- leitura de CSS ---------- */

const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * O corpo `{...}` da regra que segue um selector. O selector pode ser um
 * prefixo — `corpo('.hero__acoes')` encontra tanto `.hero__acoes {` como
 * `.hero__acoes > * {`, porque o que interessa é a regra do bloco, não
 * a forma exacta do selector.
 */
function corpo(selector, folha = CSS) {
  return new RegExp(`${escapar(selector)}[\\s>,:+~*]*\\{([^}]*)\\}`).exec(folha)?.[1];
}

/** O valor de uma propriedade dentro de um corpo de regra. */
function decl(corpoRegra, propriedade) {
  return new RegExp(`(?:^|;)\\s*${escapar(propriedade)}\\s*:\\s*([^;]+)`)
    .exec(corpoRegra)?.[1].trim();
}

/** O valor em pixels de uma declaração, `13` ou `13px`. */
const px = (valor) => {
  const n = Number.parseFloat(valor ?? '');
  assert.ok(Number.isFinite(n), `valor em px ilegível: ${valor}`);
  return n;
};

/** As declarações de um corpo de regra, `{ propriedade: valor }`. */
function declaracoes(corpoRegra) {
  return Object.fromEntries(
    corpoRegra.split(';').map((d) => d.split(':')).filter((p) => p.length >= 2)
      .map(([prop, ...resto]) => [prop.trim(), resto.join(':').trim()]),
  );
}

/** As declarações que se aplicam ao `.btn--bloco` dentro do hero. */
function declaracoesBlocoNoHero() {
  return {
    ...declaracoes(corpo('.btn--bloco') ?? ''),
    ...declaracoes(corpo('.hero__acoes > .btn--bloco') ?? ''),
  };
}

/**
 * Estas declarações dão ao elemento a largura toda do contentor?
 * `width: 100%`, `flex-basis: 100%` e `flex: <grow> <shrink> 100%`
 * dizem a mesma coisa — a última é a que está no CSS, porque torna
 * explícito que o botão fica sozinho na linha.
 */
function larguraInteira(ds) {
  const n = (v) => (v === undefined ? undefined : px(v));
  if (n(ds.width) === 100) return true;
  if (n(ds['flex-basis']) === 100) return true;
  const flex = ds.flex?.split(/\s+/);
  return flex?.length === 3 && n(flex[2]) === 100;
}

/**
 * A `@media (max-width: Npx)` que contém uma regra sobre este selector,
 * com o limite e o corpo da regra de dentro. Devolve `null` se não houver.
 */
function mediaMaxComRegra(selector, folha = CSS) {
  for (const m of folha.matchAll(/@media\s*\(\s*max-width:\s*(\d+)px\s*\)\s*\{/g)) {
    const abre = folha.indexOf('{', m.index);
    let fecha = abre + 1;
    for (let nivel = 1; nivel > 0; fecha++) {
      if (folha[fecha] === '{') nivel++;
      else if (folha[fecha] === '}') nivel--;
    }
    const dentro = folha.slice(abre + 1, fecha);
    const regra = corpo(selector, dentro);
    if (regra !== undefined) return { limite: Number(m[1]), corpo: regra, bloco: dentro };
  }
  return null;
}

/* ---------- leitura do hero ---------- */

/** Os elementos que estão dentro do `.hero__acoes`, pela ordem em que aparecem. */
function accoesDoHero() {
  const bloco = /<div class="hero__acoes">([\s\S]*?)<\/div>/.exec(HTML)?.[1];
  assert.ok(bloco, 'não encontrei .hero__acoes no index.html');
  /* O comentário que explica a Fase 7A tem um `<a>` literal escrito dentro,
     e uma tag a meio do texto é uma tag a meio do texto. */
  const semComentarios = bloco.replace(/<!--[\s\S]*?-->/g, '');
  return [...semComentarios.matchAll(/<(button|a)\b([^>]*)>[\s\S]*?<\/\1>/g)]
    .map((m) => ({ tag: m[1], atributos: m[2] }));
}

/* ---------- a disposição ---------- */

test('o hero tem três acções e a última é o link das direcções', () => {
  /* A regra do botão de largura inteira aponta para o ÚLTIMO elemento.
     Se o link das direcções deixar de ser o último, a linha inteira passa
     a ser a de outra acção e este ficheiro tem de dar conta. */
  const accoes = accoesDoHero();
  assert.equal(accoes.length, 3, `o hero tem ${accoes.length} acções — reve a disposição`);
  const ultima = accoes[accoes.length - 1].atributos;
  assert.match(ultima, /google\.com\/maps\/dir/,
    'a última acção do hero deixou de ser o link das direcções');
});

test('o botão das direcções ocupa a linha inteira, declarado e não por acaso', () => {
  const accoes = accoesDoHero();
  const direccoes = accoes[accoes.length - 1].atributos;

  /* A marcação diz que este botão é um bloco de largura inteira — a mesma
     coisa que `btn--bloco` significa nos dois outros sítios do site. */
  assert.match(direccoes, /btn--bloco/,
    'sem btn--bloco o link das direcções fica com a largura do texto e volta a parecer órfão');

  /* E o CSS tem de transformar essa marcação numa LINHA INTEIRA: ou a
     largura a 100%, ou uma base de flex a 100%. Sem isto o `flex-wrap`
     volta a decidir sozinho quem fica em que linha. */
  assert.ok(larguraInteira(declaracoesBlocoNoHero()),
    'o CSS não dá ao .btn--bloco do hero a largura toda — a linha continua a ser decidida pelo flex-wrap');
});

test('a primeira linha leva dois botões, e os dois cabem no contentor', () => {
  const contentor = px(decl(corpo('.hero__conteudo'), 'max-width'));
  const gap = px(decl(corpo('.hero__acoes'), 'gap'));

  /* O número de botões na primeira linha passa a ser o número de botões
     que ficam antes do que ocupa a linha inteira: dois. Esta é a soma
     que tem de caber, e é a que o browser vai juntar. */
  const par = PAR_MAIS_LARGO + gap;
  assert.ok(par <= contentor,
    `dois botões mais o gap dão ${par}px e o contentor dá ${contentor}px — a primeira linha rebenta`);

  /* E porque é que a disposição é declarada: com os três, não cabiam. */
  const osTres = ORCAMENTO + WHATSAPP + DIRECCOES + 2 * gap;
  assert.ok(osTres > contentor,
    `os três botões já cabem em ${contentor}px (${osTres}px) — esta disposição deixou de ser necessária e vale a pena repensa-la`);
});

test('o botão primário continua a ser o primeiro, e não o que ocupa a linha', () => {
  const accoes = accoesDoHero();
  const [primeira, , ultima] = accoes;
  assert.match(primeira.atributos, /btn--primario/,
    'a acção primária do hero deixou de ser a primeira');
  assert.doesNotMatch(ultima.atributos, /btn--primario/,
    'a acção primária passou a ocupar a linha inteira — o peso visual inverteu-se');
});

/* ---------- o limite de viewport ---------- */

test('abaixo do limite as acções do hero são uma coluna de botões inteiros', () => {
  const media = mediaMaxComRegra('.hero__acoes');
  assert.ok(media,
    'não há nenhuma @media que ponha as acções do hero em coluna única — a 320px ficam ragged à esquerda');

  /* Todas, e não só a última: a coluna única existe para o telemóvel. */
  assert.match(media.bloco, /\.hero__acoes\s*>\s*\*/,
    'a @media não se aplica a todos os botões do hero');
  assert.ok(larguraInteira(declaracoes(media.corpo)),
    'a coluna única não dá a largura toda aos botões do hero');
});

test('o limite da coluna única não aperta dois botões que não cabem', () => {
  const media = mediaMaxComRegra('.hero__acoes');
  assert.ok(media, 'não há @media para ler o limite');

  const contentorMax = px(decl(corpo('.hero__conteudo'), 'max-width'));
  const margem = px(decl(corpo('.container'), 'padding-inline')) * 2;
  const gap = px(decl(corpo('.hero__acoes'), 'gap'));

  /* Logo acima do limite a primeira linha volta a ter dois botões. A
     largura disponível aí é o contentor menos as margens laterais, e tem
     de chegar para o par mais largo. */
  const disponivel = Math.min(media.limite + 1, contentorMax) - margem;
  const necessario = PAR_MAIS_LARGO + gap;
  assert.ok(disponivel >= necessario,
    `a ${media.limite + 1}px de viewport ficam ${disponivel}px dentro do contentor e o par mais largo precisa de ${necessario}px`);
});
