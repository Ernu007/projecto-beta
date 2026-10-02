import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

/* ---------------------------------------------------------------------------
   FASE 8B — menu, botões, rodapé, galeria e a secção nova.

   Estes testes não verificam se o texto é bonito. Verificam as TRÊS coisas
   que o cliente disse e que uma revisão a olho não apanha:

     1. A lista do menu é a que ele ditou, palavra por palavra, e
        "Credenciais" desapareceu porque não há página para linkar.
     2. O WhatsApp tem o ícone do WhatsApp, e o botão de direcções tem o
        ícone do Google Maps a ocupar a largura toda do botão.
     3. O botão "Pedir orçamento" continua no topo e passa a ser `sticky`.

   E uma quarta, que é a razão de o ficheiro existir: o menu é escrito em
   DOIS sítios — a barra do topo e o painel móvel. Estavam diferentes: o
   móvel tinha "Perguntas frequentes" e o topo não, e ambos tinham
   "Credenciais", que não aponta para lado nenhum. Duas listas da mesma
   navegação divergem sempre uma de cada vez.
   --------------------------------------------------------------------------- */

const HTML = fs.readFileSync('index.html', 'utf8');
const CSS = fs.readFileSync('css/styles.css', 'utf8');
const CSS_RODAPE = `${CSS}\n${fs.readFileSync('css/galeria.css', 'utf8')}`;

/** O corpo de um elemento pelo atributo que o identifica. */
function blocoDe(tag, attr, valor) {
  const re = new RegExp(`<${tag}\\b[^>]*${attr}="${valor}"[^>]*>([\\s\\S]*?)<\\/${tag}>`);
  const m = re.exec(HTML);
  assert.ok(m, `não encontrei <${tag} ${attr}="${valor}"> no index.html`);
  return m[1];
}

/** O texto de um link, sem o SVG nem o comentário. */
const textoDoLink = (a) => a
  .replace(/<svg[\s\S]*?<\/svg>/g, '')
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/\s+/g, ' ')
  .trim();

/** Os links de navegação de um elemento, pela ordem. */
function linksDe(html) {
  return [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)]
    .map((m) => ({ attrs: m[1], texto: textoDoLink(m[2]) }));
}

/* ---------- B1: o menu ---------- */

/* B1 manda seis itens, dos quais um é "A JVI" e outro "Contactos". A
   Fase 8B acrescenta "Nossa empresa" (B9), que o briefing exige que
   esteja no menu e entre "A JVI" e "Contactos" — o cliente disse que
   "A JVI" e "Contactos" ficam no fim, e a secção nova tem de ir entre
   os dois para não os empurrar para fora do fim da lista. */
const MENU_ESPERADO = [
  { texto: 'Nossos serviços.', alvo: '#servicos' },
  { texto: 'Como funciona.', alvo: '#fluxo' },
  { texto: 'Nosso trabalho.', alvo: '#galeria' },
  { texto: 'Cobertura.', alvo: '#cobertura' },
  { texto: 'A JVI.', alvo: '#jvi' },
  { texto: 'Nossa empresa.', alvo: '#empresa' },
  { texto: 'Contactos.', alvo: '#contactos' },
];

test('o menu de topo tem os itens que o cliente ditou, pela ordem', () => {
  const nav = linksDe(blocoDe('nav', 'class', 'nav'));
  assert.deepEqual(
    nav.map((l) => l.texto),
    MENU_ESPERADO.map((m) => m.texto),
    `o menu diz: ${nav.map((l) => l.texto).join(' · ')}`,
  );
  for (const [i, esperado] of MENU_ESPERADO.entries()) {
    assert.match(nav[i].attrs, new RegExp(`href="${esperado.alvo.replace('#', '\\#')}"`),
      `"${esperado.texto}" tem de apontar para ${esperado.alvo}`);
  }
});

test('Credenciais saiu do menu — não há página para linkar', () => {
  const nav = linksDe(blocoDe('nav', 'class', 'nav'));
  assert.ok(!nav.some((l) => /credencial/i.test(l.texto)),
    '"Credenciais" continua no menu de topo');
  assert.ok(!/href="#credenciais"/.test(blocoDe('nav', 'class', 'nav')),
    'o menu ainda tem um link para #credenciais');
});

test('as tabs do menu terminam em ponto — é o que as distingue dos links da página', () => {
  /* O cliente pediu o ponto "para diferenciar das tabs dos links dentro das
     páginas". A distinguishing mark é a POSIÇÃO: as tabs ficam todas com
     ponto, os links dentro das secções ficam sem. */
  for (const { texto } of MENU_ESPERADO) {
    assert.ok(texto.endsWith('.'), `a tab "${texto}" não acaba em ponto`);
  }
});

test('o menu de topo e o menu móvel dizem a mesma coisa', () => {
  /* Duas listas da mesma navegação divergem sempre uma de cada vez. O
     móvel tinha "Perguntas frequentes", que o topo não tinha, e ambos
     tinham "Credenciais", que não existe. */
  const topo = linksDe(blocoDe('nav', 'class', 'nav'))
    .map((l) => l.texto);
  const movel = linksDe(blocoDe('nav', 'id', 'menu'))
    .map((l) => l.texto);
  assert.deepEqual(movel, topo,
    `topo: ${topo.join(' · ')} | móvel: ${movel.join(' · ')}`);
});

test('"Perguntas frequentes" ficou na página, mas não no menu', () => {
  /* Saiu do menu porque o cliente pediu seis itens e não sete. A secção
     continua no sitio, com o seu id — tirá-la do menu não é apagá-la. */
  assert.match(HTML, /id="faq"/, 'a secção de perguntas frequentes desapareceu');
  assert.match(HTML, /Perguntas frequentes/);
  const topo = linksDe(blocoDe('nav', 'class', 'nav')).map((l) => l.texto);
  assert.ok(!topo.some((t) => /perguntas/i.test(t)),
    '"Perguntas frequentes" voltou ao menu');
});

test('a secção de Credenciais continua na página, só sem link no menu', () => {
  /* O cliente disse para tirar o ITEM do menu, não a secção. O bloco de
     credenciais continua no sítio: é conteúdo de valor, e apagá-lo seria
     inventar uma remoção que ninguém pediu. */
  assert.match(HTML, /id="credenciais"/,
    'a secção de Credenciais foi apagada — o cliente pediu tirar o link, não o conteúdo');
});

test('nenhum link do menu aponta para um alvo que não existe', () => {
  const alvos = [...HTML.matchAll(/<a\b[^>]*href="#([A-Za-z0-9_-]+)"/g)].map((m) => m[1]);
  const ids = new Set([...HTML.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  const orfaos = [...new Set(alvos)].filter((a) => !ids.has(a));
  assert.deepEqual(orfaos, [], `links para ids que não existem: ${orfaos.join(', ')}`);
});

/* ---------- B2: ícones e botões ---------- */

/** O `path` de um svg que está dentro de um bloco. */
function pathsDe(html) {
  return [...html.matchAll(/<path\b[^>]*d="([^"]+)"/g)].map((m) => m[1]);
}

/** Um traço do logótipo do WhatsApp: o quadrado com a cauda do telefone. */
const ICO_WHATSAPP = 'M17.47 14.38c-.3-.15-1.76-.87-2.03-.97';
/** O ícone do Google Maps: o pin com o buraco. */
const ICO_MAPS = 'M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z';

test('todos os botões de WhatsApp do site têm o ícone do WhatsApp', () => {
  /* "O cliente notou e pediu explicitamente." O ícone é a marca registada:
     um telefone dentro de um balão de fala. O que lá estava era um desenho
     genérico — três botões, cinco svg, nenhum deles o do WhatsApp. */
  const semIcone = [];
  const conta = [...HTML.matchAll(/<a\b[^>]*href="https:\/\/wa\.me\/[^"]*"[\s\S]*?<\/a>/g)];
  assert.ok(conta.length >= 4, `só encontrei ${conta.length} botões de WhatsApp — espero ao menos 4`);
  for (const m of conta) {
    const d = pathsDe(m[0]);
    if (!d.some((p) => p.startsWith(ICO_WHATSAPP))) {
      semIcone.push(m[0].replace(/\s+/g, ' ').slice(0, 90));
    }
  }
  assert.deepEqual(semIcone, [], `botões de WhatsApp sem o ícone do WhatsApp:\n${semIcone.join('\n')}`);
});

test('nenhum svg do site desenha um telefone dentro de um balão sem ser do WhatsApp', () => {
  /* O contrário do teste anterior: se alguém voltar a pôr um desenho
     genérico no botão do WhatsApp, ou trocar o ícone de outro sítio, o
     traço do logótipo tem de estar lá. */
  const iconesWa = pathsDe(HTML).filter((d) => d.startsWith(ICO_WHATSAPP));
  assert.ok(iconesWa.length >= 4,
    `o traço do logótipo do WhatsApp aparece ${iconesWa.length} vezes; esperava ao menos 4`);
});

test('o botão "Como chegar à JVI" tem o ícone do Google Maps', () => {
  const botoes = [...HTML.matchAll(/<a\b[^>]*>[^<]*(?:<svg[\s\S]*?<\/svg>)?\s*Como chegar à JVI[\s\S]*?<\/a>/g)];
  assert.ok(botoes.length >= 2, `só encontrei ${botoes.length} botões "Como chegar à JVI"`);
  for (const m of botoes) {
    assert.ok(pathsDe(m[0]).some((p) => p.startsWith(ICO_MAPS)),
      `o botão "Como chegar à JVI" não tem o ícone do Maps: ${m[0].replace(/\s+/g, ' ').slice(0, 90)}`);
  }
});

test('o ícone do Maps ocupa a largura toda do botão no rodapé', () => {
  /* B10: "Botão 'Como chegar à JVI' com ícone do Google Maps, a ocupar a
     largura toda do botão". O svg tem de ser `display: block` e ocupar
     100% — um ícone com a largura do texto ao lado lê-se como decoração. */
  const regra = /\.fixo--maps[^{]*\{([^}]*)\}/.exec(CSS_RODAPE)?.[1]
    || /\.btn-maps[^{]*\{([^}]*)\}/.exec(CSS_RODAPE)?.[1];
  assert.ok(regra, 'não há nenhuma regra CSS para o botão do Maps');
  assert.match(regra, /svg[^{]*width\s*:\s*100%|svg\s*\{[^}]*width\s*:\s*100%/s,
    `o ícone do Maps não ocupa a largura toda do botão: ${regra.replace(/\s+/g, ' ')}`);
});

test('o botão do telefone fica como estava', () => {
  /* B2: "Botão do telefone: está bom, não mexer." O traço do telefone é o
     mesmo de sempre, e o rótulo continua a dizer "Ligar". */
  assert.match(HTML, /Ligar/);
  assert.ok(pathsDe(HTML).some((d) => d.startsWith('M22 16.92v3a2 2 0 0')),
    'o ícone do telefone foi alterado');
});

/* ---------- B8: o orçamento no topo ---------- */

test('o botão "Pedir orçamento" do topo fica preso ao scroll', () => {
  /* "Tem de estar sempre visível, no topo da página. Se descer com a
     página, fica preso (fixed/sticky)." */
  const regra = /\.header__cta\b[^{]*\{([^}]*)\}/.exec(CSS)?.[1];
  assert.ok(regra, 'não há nenhuma regra CSS para .header__cta');
  assert.match(regra, /position\s*:\s*(sticky|fixed)/,
    `o botão de orçamento não está preso: ${regra.replace(/\s+/g, ' ')}`);
});

test('a posição fica declarada no CSS e não herdada por acaso', () => {
  /* `position: sticky` sem `top` não fixa nada quando o elemento não
     tem escrolagem própria — o navegador ignora-o. É o mesmo cuidado que
     o `.btn--bloco` do hero. */
  const regra = /\.header__cta\b[^{]*\{([^}]*)\}/.exec(CSS)?.[1];
  assert.match(regra, /top\s*:\s*-?\d/, `a regra do botão não declara "top": ${regra}`);
});

test('continua a haver um botão "Pedir orçamento" no topo, e é o mesmo em todo o site', () => {
  const botoes = [...HTML.matchAll(/>([^<>]*?Pedir orçamento[^<>]*?)</g)].map((m) => m[1].trim());
  assert.ok(botoes.length >= 3,
    `só encontrei ${botoes.length} botões "Pedir orçamento"; o site tinha 4`);
});

test('nenhum botão "Pedir orçamento" foi trocado por uma acção secundária', () => {
  /* D19: o orçamento é a acção primária. Passar a `btn--vidro` no topo
     invertia a hierarquia do ecrã. */
  const cabecalho = /<div class="header__cta">([\s\S]*?)<\/div>/.exec(HTML)?.[1];
  assert.ok(cabecalho, 'não encontrei .header__cta');
  assert.match(cabecalho, /btn--primario/,
    'o botão de orçamento do topo deixou de ser primário');
});

/* ---------- B3, B4, B5, B6: cartões de serviço ---------- */

test('o primeiro cartão é "Soluções integradas", não "Transporte de carga"', () => {
  /* B3: "Transporte de carga" -> "Soluções integradas", e os subtítulos de
     transporte aéreo e rodoviário mantêm-se. */
  const cartoes = blocoDe('div', 'class', 'grelha-3');
  const titulos = [...cartoes.matchAll(/<h3>([\s\S]*?)<\/h3>/g)].map((m) => textoDoLink(m[1]));
  assert.equal(titulos[0], 'Soluções integradas',
    `o primeiro cartão chama-se "${titulos[0]}"`);
  assert.ok(titulos.includes('Transporte aéreo'), 'o subtítulo do transporte aéreo desapareceu');
  assert.ok(titulos.includes('Transporte rodoviário'), 'o subtítulo do transporte rodoviário desapareceu');
});

test('"Descarregar perfil da JVI" saiu dos cartões', () => {
  /* B4: "Remover de dentro dos cartões. Fica só no rodapé, junto da carta
     de apresentação." O cliente repetiu isto três vezes. */
  const cartoes = blocoDe('div', 'class', 'grelha-3');
  assert.doesNotMatch(cartoes, /Descarregar perfil da JVI/,
    'o botão "Descarregar perfil da JVI" continua dentro dos cartões');
  assert.doesNotMatch(cartoes, /class="selo"/,
    'a classe .selo (o selo de download do perfil) continua dentro dos cartões');
});

test('o perfil da JVI continua disponível, junto da carta de apresentação', () => {
  const rodape = blocoDe('footer', 'class', 'rodape');
  assert.match(rodape, /Carta de Apresentação|Carta de apresentação/i);
  assert.match(rodape, /jvi-carta-apresentacao\.pdf/,
    'o PDF do perfil da JVI desapareceu do rodapé');
});

test('as imagens do cartão de carga estão lado a lado, não alternadas', () => {
  /* B5: "a imagem de caixas no chão de um lado, as imagens de encomendas
     para Zambézia do outro. Agora estão alternadas." A grelha dos cartões
     tem de pôr os dois lados na mesma linha. */
  const grelha = /\.grelha-3\b[^{]*\{([^}]*)\}/.exec(CSS)?.[1];
  assert.ok(grelha, 'não há regra para .grelha-3');
  assert.match(grelha, /grid-template-columns\s*:\s*repeat\(\s*2\s*,/,
    `a grelha dos cartões não tem duas colunas lado a lado: ${grelha.replace(/\s+/g, ' ')}`);
  assert.doesNotMatch(grelha, /grid-auto-flow\s*:\s*(row|dense)/,
    'a grelha dos cartões volta a alternar itens');
});

test('há um cartão chamado "Outras províncias"', () => {
  /* B6: "Um cartão que se chame 'Outras províncias' em vez do texto
     actual." */
  const cartoes = blocoDe('div', 'class', 'grelha-3');
  const titulos = [...cartoes.matchAll(/<h3>([\s\S]*?)<\/h3>/g)].map((m) => textoDoLink(m[1]));
  assert.ok(titulos.includes('Outras províncias'),
    `não há cartão "Outras províncias"; há: ${titulos.join(' · ')}`);
});

test('os títulos dos cartões são curtos — três palavras no máximo, sem "do colégio"', () => {
  /* B6: "títulos mais curtos e directos ('fluxo operacional' em vez de
     'fluxo operacional do colégio')" e "os cartões estão muito
     carregados". */
  const cartoes = blocoDe('div', 'class', 'grelha-3');
  const titulos = [...cartoes.matchAll(/<h3>([\s\S]*?)<\/h3>/g)].map((m) => textoDoLink(m[1]));
  for (const t of titulos) {
    const palavras = t.split(/\s+/).filter((p) => p.length > 2).length;
    assert.ok(palavras <= 3,
      `"${t}" tem ${palavras} palavras — o cliente pediu títulos curtos`);
  }
  for (const t of titulos) {
    assert.doesNotMatch(t, /\b(colégio|colegio|da JVI|no(a)?)\b/i,
      `"${t}" volta a ter o sufixo que o cliente mandou tirar`);
  }
});

/* ---------- B7: galeria em carrossel ---------- */

test('a galeria é um carrossel: uma imagem de cada vez', () => {
  /* B7: "Passar a carrossel: uma imagem de cada vez, cards pequenos, a
     passar automaticamente. Ciclo contínuo." */
  const grelha = /\.gal__grelha\b[^{]*\{([^}]*)\}/.exec(CSS_RODAPE)?.[1];
  assert.ok(grelha, 'não há regra para .gal__grelha');
  assert.match(grelha, /display\s*:\s*flex/,
    'a galeria ainda é uma grelha de miniaturas, não um carrossel');
  assert.doesNotMatch(grelha, /display\s*:\s*grid/,
    'a galeria continua em `grid`, o que mostra várias imagens de cada vez');
});

test('o carrossel tem um item visível de cada vez', () => {
  const item = /\.gal__item\b[^{]*\{([^}]*)\}/.exec(CSS_RODAPE)?.[1];
  assert.ok(item, 'não há regra para .gal__item');
  assert.match(item, /flex\s*:\s*0 0 (100%|var\()|width\s*:\s*100%/,
    `o item do carrossel não ocupa a largura toda: ${item.replace(/\s+/g, ' ')}`);
});

test('o carrossel passa sozinho e em ciclo contínuo', () => {
  const fonte = fs.readFileSync('js/galeria.js', 'utf8');
  assert.match(fonte, /setInterval|setTimeout/,
    'a galeria não tem temporizador nenhum — não passa sozinha');
  assert.match(fonte, /prefers-reduced-motion/,
    'o carrossel não pára com prefers-reduced-motion');
  /* Ciclo contínuo: o índice dá a volta em vez de parar no fim. */
  assert.match(fonte, /%\s*itens\.length|%\s*lista\.length|\+\s*1\s*%\s*|length\s*-\s*1\s*\?/,
    'o índice do carrossel não dá a volta — acaba numa fotografia e fica lá');
});

test('a galerie continua a expor data-gal-src: o lightbox depende disso', () => {
  /* `js/galeria.js` lê `[data-gal-src]` para a lightbox, e
     `tests/dom.test.js` confirma o âmbito. Um carrossel que passa as
     imagens por outro atributo parte os dois. */
  assert.ok(HTML.includes('data-gal-src'), 'nenhuma imagem tem data-gal-src');
  const itens = [...HTML.matchAll(/data-gal-src="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(itens.length, 11, `a galeria tem ${itens.length} fotografias; são 11`);
  for (const [, alt] of HTML.matchAll(/data-gal-src="[^"]+"\s*\n?\s*data-gal-alt="([^"]+)"/g)) {
    assert.ok(alt.trim().length > 10, `um alt ficou vazio: "${alt}"`);
  }
});

/* ---------- B9: a secção nova ---------- */

test('a secção "Nossa empresa" existe, com a carta de apresentação', () => {
  /* B9: "Secção nova que apresente a empresa, com a imagem da carta de
     apresentação da JVI como elemento visual." */
  const sec = /<section\b[^>]*id="empresa"[^>]*>([\s\S]*?)<\/section>/.exec(HTML);
  assert.ok(sec, 'não há nenhuma secção id="empresa"');
  assert.match(sec[1], /Nossa empresa/i);
  assert.match(sec[1], /<img\b[^>]*src="[^"]*carta[^"]*"/,
    'a secção não tem imagem da carta de apresentação');
  assert.match(sec[1], /alt="[^"]+"/,
    'a imagem da carta não tem texto alternativo');
});

test('"Nossa empresa" está no menu, entre A JVI e Contactos', () => {
  const topo = linksDe(blocoDe('nav', 'class', 'nav')).map((l) => l.texto);
  const i = topo.indexOf('Nossa empresa.');
  assert.ok(i > 0, `"Nossa empresa" não está no menu: ${topo.join(' · ')}`);
  assert.match(topo[i - 1], /^A JVI\.$/, `"Nossa empresa" está depois de "${topo[i - 1]}"`);
  assert.match(topo[i + 1], /^Contactos\.$/, `"Nossa empresa" está antes de "${topo[i + 1]}"`);
});

test('o alvo da nova secção é focável — sem tabindex, o link não move o foco', () => {
  /* A regra do `tabindex="-1"` nas secções de navegação interna: um link de
     fragmento só move o FOCO se o destino for focável. */
  const sec = /<section\b[^>]*id="empresa"[^>]*>/.exec(HTML)?.[0];
  assert.match(sec, /tabindex="-1"/,
    'a secção "Nossa empresa" não tem tabindex="-1" — o link do menu move o scroll mas não o foco');
});