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
/* `.btn--wa` vive em orcamento.css, que é carregado depois de styles.css. */
const CSS_ORC = fs.readFileSync(path.join('css', 'orcamento.css'), 'utf8');

/* As larguras de cima, medidas no browser. O `.btn` usa `font-size: 15px`
   fixo (não é um `clamp()`), portanto valem em qualquer viewport. */
const ORCAMENTO = 204.5;
const WHATSAPP = 221.2;
const DIRECCOES = 217.88;
const PAR_MAIS_LARGO = ORCAMENTO + WHATSAPP;
/* Fase 9 (9.4): os dois primeiros passam a ter a MESMA largura, metade
   cada. O que tem de caber numa metade é o mais largo dos dois. */
const METADE_MINIMA = Math.max(ORCAMENTO, WHATSAPP);

/* Fase 9 (9.8): "é na versão mobile que 99% dos clientes irão ver a
   página". 360 px é o chão realista em Moçambique; 320 px é o mais estreito
   que ainda se vende. 44 px é o alvo de toque mínimo. */
const MOVEL = 360;
const MOVEL_ESTREITO = 320;
const TOQUE = 44;

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

/* ---------- Fase 9 (9.4): metade / metade ---------- */

/** O corpo da regra `.hero__acoes > *` de base — a que está FORA de
 *  qualquer @media. */
function regraDeTodasAsAccoes() {
  const media = mediaMaxComRegra('.hero__acoes');
  const semMedias = media ? CSS.replace(media.bloco, '') : CSS;
  return /\.hero__acoes\s*>\s*\*\s*\{([^}]*)\}/.exec(semMedias)?.[1];
}

test('9.4: o orçamento e o WhatsApp ocupam metade cada um da linha das direcções', () => {
  /* O cliente: "formate os botões do pedir orçamento e falar no WhatsApp
     para que ocupem metade metade do espaço que o botão como chegar a JVI
     ocupa". Antes cada um tinha a largura do seu texto (204,5 e 221,2 px)
     e a linha de cima acabava a meio da de baixo. */
  const regra = regraDeTodasAsAccoes();
  assert.ok(regra, 'não há regra de base para `.hero__acoes > *`: os botões ficam com a largura do texto');

  const flex = decl(regra, 'flex')?.match(/^(\S+)\s+(\S+)\s+(.+)$/);
  assert.ok(flex, `o flex dos botões do hero não tem as três partes: ${decl(regra, 'flex')}`);
  const [, cresce, , base] = flex;

  /* A base é a mesma para os dois, e os dois crescem por igual: é isso que
     os faz ter a MESMA largura, tenham o texto que tiverem. */
  assert.equal(Number(cresce), 1, 'os botões não crescem para encher a linha');
  const gap = px(decl(corpo('.hero__acoes'), 'gap'));
  const m = /^calc\(\s*50%\s*-\s*([\d.]+)px\s*\)$/.exec(base);
  assert.ok(m, `a base dos botões não é metade da linha: ${base}`);
  /* Duas metades mais o gap dão a linha inteira — a largura do botão das
     direcções, que é `flex: 1 0 100%`. Nem um píxel a mais, senão o segundo
     botão caía para a linha de baixo. */
  assert.equal(2 * Number(m[1]), gap,
    `duas metades de (50% - ${m[1]}px) mais ${gap}px de gap não dão 100%`);

  /* E a regra das direcções continua a ganhar à regra geral. */
  assert.ok(larguraInteira(declaracoesBlocoNoHero()));
  assert.ok(CSS.indexOf('.hero__acoes > .btn--bloco') > CSS.search(/\.hero__acoes\s*>\s*\*\s*\{/),
    'a regra das direcções vem antes da regra geral');
});

test('a primeira linha leva dois botões, e os dois cabem no contentor', () => {
  const contentor = px(decl(corpo('.hero__conteudo'), 'max-width'));
  const gap = px(decl(corpo('.hero__acoes'), 'gap'));

  /* Fase 9 (9.4): cada botão fica com metade da linha, por isso o que tem
     de caber em cada metade é o texto do mais largo. */
  assert.ok(METADE_MINIMA <= (contentor - gap) / 2,
    `metade do contentor são ${(contentor - gap) / 2}px e o botão mais largo precisa de ${METADE_MINIMA}px`);

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

  /* Fase 9 (9.4): com metade / metade a conta é mais exigente — cada
     metade tem de levar o texto do botão MAIS largo, senão o `nowrap`
     empurra o segundo para a linha de baixo com outra largura. */
  const metade = (disponivel - gap) / 2;
  assert.ok(metade >= METADE_MINIMA,
    `a ${media.limite + 1}px de viewport cada metade tem ${metade}px e "Falar no WhatsApp" precisa de ${METADE_MINIMA}px`);
});

/* ---------- Fase 9 (9.8): o hero no telemóvel ---------- */

/** A altura de um `.btn`: o padding vertical mais uma linha de texto. */
function alturaDoBotao(regraBtn, alturaDeLinha) {
  const [vertical] = decl(regraBtn, 'padding').split(/\s+/);
  return 2 * px(vertical) + px(decl(regraBtn, 'font-size')) * alturaDeLinha;
}

test('9.8: no telemóvel as três acções do hero são coluna, cabem e não quebram', () => {
  const media = mediaMaxComRegra('.hero__acoes');
  const margem = px(decl(corpo('.container'), 'padding-inline')) * 2;

  for (const viewport of [MOVEL, MOVEL_ESTREITO]) {
    assert.ok(viewport <= media.limite, `a ${viewport}px o hero ainda tenta pôr dois botões lado a lado`);
    const disponivel = viewport - margem;
    for (const [nome, largura] of [['Pedir orçamento', ORCAMENTO], ['Falar no WhatsApp', WHATSAPP], ['Como chegar à JVI', DIRECCOES]]) {
      assert.ok(largura <= disponivel,
        `a ${viewport}px "${nome}" precisa de ${largura}px e só há ${disponivel}px: o texto sai do botão`);
    }
  }
  /* O texto de um botão nunca parte em duas linhas. */
  assert.match(decl(corpo('.btn'), 'white-space') ?? '', /nowrap/);
});

test('9.8: os botões do hero são alvos de toque de pelo menos 44 px', () => {
  const alturaDeLinha = Number(decl(corpo('body'), 'line-height'));
  assert.ok(alturaDeLinha > 1, 'não consegui ler o line-height do body');
  const altura = alturaDoBotao(corpo('.btn'), alturaDeLinha);
  assert.ok(altura >= TOQUE, `um .btn tem ${altura.toFixed(1)}px de altura`);

  /* O WhatsApp é `.btn--wa`, que redeclara o padding e a letra: tem de dar
     a mesma altura dos outros dois, senão a coluna fica desigual. */
  const wa = corpo('.btn--wa', CSS_ORC);
  assert.ok(wa, 'não encontrei .btn--wa');
  assert.equal(alturaDoBotao(wa, alturaDeLinha), altura,
    'o botão do WhatsApp do hero não tem a altura dos outros dois');
});

/* ---------- Fase 9 (9.6): o WhatsApp do hero fica verde ---------- */

test('9.6: o WhatsApp do hero tem o verde do WhatsApp dos contactos', () => {
  const [, whatsapp] = accoesDoHero();
  assert.match(whatsapp.atributos, /wa\.me\//, 'a segunda acção do hero deixou de ser o WhatsApp');
  assert.match(whatsapp.atributos, /class="btn btn--wa"/,
    'o WhatsApp do hero não usa a classe do botão verde dos contactos');
  assert.doesNotMatch(whatsapp.atributos, /btn--vidro/, 'o WhatsApp do hero continua em vidro');

  /* É a MESMA classe do botão do rodapé — o "da última página" —, e a cor
     vem do mesmo token. */
  const rodape = /<div class="rodape__accoes">([\s\S]*?)<\/div>/.exec(HTML)?.[1] ?? '';
  assert.match(rodape, /<a class="btn btn--wa"[^>]*wa\.me\//, 'o WhatsApp do rodapé mudou de classe');
  assert.match(decl(corpo('.btn--wa', CSS_ORC), 'background'), /^var\(--wa\)$/);
});

test('9.6: o orçamento continua a ser a única acção primária do hero, e a mais forte', () => {
  /* O site tem uma acção primária por ecrã (D19). O WhatsApp verde não é
     uma segunda primária: é o verde da marca WhatsApp, que é outro verde. */
  const accoes = accoesDoHero();
  assert.equal(accoes.filter((a) => /btn--primario/.test(a.atributos)).length, 1);
  assert.match(accoes[0].atributos, /btn--primario/);
  assert.doesNotMatch(accoes[1].atributos, /btn--primario/);

  /* O que distingue os dois à vista: o primário tem degradê e brilho por
     baixo; o do WhatsApp é uma cor lisa, sem sombra. */
  const primario = corpo('.btn--primario');
  assert.match(decl(primario, 'background'), /linear-gradient/);
  assert.ok(decl(primario, 'box-shadow'), 'o botão primário perdeu o brilho');
  const wa = corpo('.btn--wa', CSS_ORC);
  assert.equal(decl(wa, 'box-shadow'), undefined, 'o WhatsApp ganhou sombra: compete com o primário');
  assert.doesNotMatch(decl(wa, 'background'), /gradient|--verde/);
});

/* ---------- Fase 9 (9.7): o WhatsApp do rodapé do tamanho do "Como chegar" ---------- */

test('9.7: no rodapé o WhatsApp tem a largura e a altura do "Como chegar à JVI"', () => {
  const maps = corpo('.btn-maps');
  const wa = corpo('.rodape__accoes .btn--wa');
  assert.ok(maps && wa, 'falta a regra de um dos dois botões do rodapé');

  /* A mesma caixa, declaração a declaração: é isso que dá a mesma altura
     e a mesma largura em qualquer ecrã. */
  for (const prop of ['flex-direction', 'gap', 'width', 'padding-block', 'border-radius']) {
    assert.equal(decl(wa, prop), decl(maps, prop), `${prop}: WhatsApp ${decl(wa, prop)} / Como chegar ${decl(maps, prop)}`);
  }
  assert.equal(px(decl(wa, 'width')), 100, 'o WhatsApp do rodapé não ocupa a linha inteira');

  /* O botão do Maps é `btn--vidro`, que tem 1px de contorno. Sem um
     contorno igual (transparente), o WhatsApp ficava 2px mais baixo —
     medido no Chrome: 106,75 contra 108,75px. */
  const contorno = (regra) => px(decl(regra, 'border'));
  assert.equal(contorno(wa), contorno(corpo('.btn--vidro')),
    'o WhatsApp do rodapé não tem o contorno que iguala a altura à do "Como chegar"');

  /* E o ícone tem a mesma altura, que é o que faz a altura do botão. */
  const alturaIcone = (sel) => px(decl(new RegExp(`${escapar(sel)}\\s*\\{([^}]*)\\}`).exec(CSS)?.[1] ?? '', 'height'));
  assert.equal(alturaIcone('.rodape__accoes .btn--wa svg'), alturaIcone('.rodape__accoes .btn-maps svg'));

  /* Nada o volta a encolher para a largura do texto, em nenhum ecrã. */
  const semComentarios = CSS.replace(/\/\*[\s\S]*?\*\//g, ' ');
  assert.doesNotMatch(semComentarios, /\.rodape__accoes \.btn--wa\s*\{[^}]*justify-self\s*:\s*start/,
    'o WhatsApp do rodapé continua encostado à esquerda, com a largura do texto');
});
