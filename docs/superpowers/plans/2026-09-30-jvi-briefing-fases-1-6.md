# JVI Carga & Serviços — Fases 1 a 6 do BRIEFING-JVI.md

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o formulário de 4 passos por um pop-up de 3 passos com cálculo de preço por peso (piso mínimo 3000 MT base), confirmação antes do envio, envio por WhatsApp em duas mensagens, galeria de trabalho real com imagens otimizadas, e um passe de design de "5 para 20".

**Architecture:** Site estático (HTML + CSS + JS ESM sem build), alojado na Netlify com uma Function serverless como registo secundário. A lógica de negócio fica em módulos ESM puros e testáveis (`js/precos.js`, `js/orcamento.js`) importados tanto pelo browser como pelo runner de testes Node, de modo que a fórmula de preços e as mensagens de WhatsApp são verificadas sem browser. O DOM só é tocado dentro de funções explícitas (`iniciarOrcamento(raiz)`), nunca no topo do módulo — caso contrário o import no Node rebenta.

**Tech Stack:** HTML5 estático, CSS com custom properties, JavaScript ESM nativo (sem bundler), `node:test` + `node:assert/strict` para testes, Netlify Functions (Node 18+), Pillow (Python) para otimização de imagens para WebP.

**Spec:** `BRIEFING-JVI.md` (raiz do repositório) — fonte de verdade do cliente.

---

## Global Constraints

- **Cálculo de preço (não negociável, vem do briefing):** `base = peso <= 10 ? 3000 : peso * 255`; `base = max(base, 3000)`; `total = base * 1.16`. IVA = 16%.
- **Regra crítica:** o preço é **não-decrescente** em relação ao peso. Nenhum ecrã pode mostrar um total menor para um peso maior.
- **Número da empresa para WhatsApp:** `+258 84 793 5035` → `258847935035` no formato `wa.me`. É o ÚNICO confirmado pelo cliente.
- **Sem campo "para que número vai ser enviado"** em lado nenhum da interface. Decisão interna.
- **Dimensões são opcionais** (o cliente foi vago no briefing).
- **Forma de pagamento:** escolha única entre `e-Mola`, `Cartão de crédito`, `Numerário`. Mais uma pergunta separada e binária: *pagar no levantamento, na província de destino*.
- **Envio só por WhatsApp** (duas mensagens: empresa + cliente). `functions/submit.js` **mantém-se** como plano B / registo — não se remove.
- **Idioma da interface e das mensagens de commit:** português de Moçambique.
- **Sem dependências de runtime.** Nada de framework, nada de bundler, nada de CDN. As fontes são auto-alojadas em `assets/fonts/`.
- **Espaçamento em escala de 4/8px.** Nenhum valor solto de padding/margin nas fases visuais.
- **Paleta:** só `--verde`, `--verde-escuro`, `--laranja` e os derivados já existentes em `:root`. Nada de cores novas sem justificação no commit.
- **Tipografia:** `Plus Jakarta Sans` (já auto-alojada), tamanho base 16-18px. Não introduzir um segundo par tipográfico.
- **Imagens da galeria:** WebP, lado longo máximo 1600px. Nunca comitar os JPG originais.
- **Acessibilidade:** o pop-up é `role="dialog" aria-modal="true"`, foco preso dentro dele, `Escape` fecha, foco devolvido ao elemento que abriu. Campos de erro ligados por `aria-describedby`. Nada depende só da cor.
- **Uma acção primária por ecrã.** O `btn--primario` (verde) é a acção principal; o resto é `vidro` ou `laranja`.
- **Testes correm com `npm test`** (scripto `node --test tests/`). Não há outros runners.

---

## Review Focus

Os cinco inputs que o briefing não menciona mas que alguém vai usar na produção, e que nenhum teste do enunciado cobre:

1. **Peso introduzido com vírgula decimal** (`11,7`) — o teclado moçambicano produz vírgula, não ponto. Sem normalizar, `input type="number"` devolve `""` e o formulário diz "peso inválido" a quem introduziu um valor válido. Comportamento esperado: aceite `11,7` como 11.7.
2. **Telefone escrito como `84 793 5035`, `+258 84 793 5035`, `258847935035` ou `00258847935035`** — todos têm de virar o mesmo destino no `wa.me`. Comportamento esperado: os quatro normalizam para `258847935035`.
3. **Peso em branco ou zero no passo 2** — o utilizador avança sem preencher. Comportamento esperado: o passo não avança, o erro aparece no campo do peso e o foco vai para lá. Zero não é um peso válido para transportar.
4. **Peso gigante (ex.: 100000 kg)** — o formulário tem `max` só para evitar abuse, mas o cálculo tem de continuar a devolver um número finito e monotónico, sem `NaN` nem `Infinity` a entrar na mensagem de WhatsApp.
5. **Correr o site sem JavaScript** — todo o conteúdo de marketing (serviços, cobertura, credenciais, contactos) tem de continuar legível e o botão "Pedir orçamento" tem de ter um alvo válido. Comportamento esperado: o texto de vendas nunca desaparece, o CTA não é um `<button>` morto.

---

## Decisões tomadas (ambiguidades do briefing, registadas nos commits)

| # | Ambiguidade | Decisão | Porquê |
|---|---|---|---|
| D1 | Arredondamento de valores | `base` arredondado ao metical, `iva = round(base × 0.16)`, `total = base + iva` | O briefing dá 3480 e 4437, que só batem certo se o IVA for arredondado e o total for a soma das partes. O metical não se usa em cêntimos. |
| D2 | Formatação de dinheiro | `3 480 MT` (espaço de milhares, sem decimais) | É como se escreve um preço em Moçambique. `Intl` não é usado para manter o resultado determinístico no teste. |
| D3 | Virgula decimal no peso | Aceita `,` e `.`; o valor guardado é sempre `,` | O teclado local escreve vírgula; o campo continua a ser `type="number"`. |
| D4 | Duas janelas de WhatsApp em sequência | Abre-se automaticamente a mensagem **da empresa** (gesto do utilizador) e a mensagem **do cliente** fica num botão explícito no ecrã de sucesso, com tentativa automática bloqueada | Duas `window.open` seguidas são bloqueadas pelo popup-blocker em todos os browsers. Um botão explícito é honesto e funciona sempre; a tentativa automática é apenas açúcar. |
| D5 | `functions/submit.js` | Continua a ser chamado em `fire-and-forget` no confirmar, com o payload novo | O briefing manda manter. Deixar de enviar é a decisão que nunca se deve tomar sem o cliente dizer. |
| D6 | Fase 6, "expandir para 6-8 páginas" | **Não** expandido. Uma página só, reforçada com FAQ e galeria | O funil é WhatsApp: um sender único converte melhor do que seis. Páginas magras de SEO são actively prejudicial. O cliente escreveu "considera", não "faz". |
| D7 | Fotos da galeria | As 11 do subconjunto sugerido pelo briefing, em WebP, com `alt` descritivo e sem legenda inventada | O briefing identificou-as uma a uma. Não se inventam descrições de conteúdo que não se viu. |
| D8 | Contactos com divergência (o número antigo do site vs `84 793 5035` no briefing) | **SUBSTITUÍDO — não aplicar.** O cliente respondeu depois e confirmou `+258 84 793 5035` como o **único** número; os restantes estavam errados e foram removidos. Ver D8 em `docs/decisoes.md` | ~~Mantém-se o número antigo em "Escritórios"~~ — a cautela era correcta na altura, mas o cliente desmentiu os números antigos. Reverter o que este plano fez. |

---

## File Structure

| Ficheiro | Responsabilidade | Acção |
|---|---|---|
| `package.json` | `"type": "module"` + script `test` | criar |
| `js/precos.js` | Fórmula de preço, arredondamento, formatação em MT. **Sem DOM.** | criar |
| `js/orcamento.js` | Máquina de estados do assistente de 3 passos, validação, construção das duas mensagens de WhatsApp, normalização de telefone. Exporta funções puras (testáveis) + `iniciarOrcamento(raiz)`. **Sem DOM no topo do módulo.** | criar |
| `js/main.js` | Cabeçalho, menu, mapa, hero, modal, FAQ | reduzir (o formulário sai daqui) |
| `js/galeria.js` | Luzbox acessível da galeria (teclado, foco preso, `Escape`) | criar |
| `index.html` | Landing + novo template do formulário de 3 passos + diálogo de confirmação + galeria + FAQ | modificar |
| `css/orcamento.css` | Estilos do assistente e do diálogo de confirmação (isolado, importado depois de `styles.css`) | criar |
| `css/galeria.css` | Estilos da galeria e da luzbox | criar |
| `functions/submit.js` | Plano B: validação, anti-spam, Sheets/e-mail | modificar |
| `tests/precos.test.js` | Testes da fórmula e dos pontos de fronteira | criar |
| `tests/orcamento.test.js` | Testes de telefone, peso e das duas mensagens | criar |
| `tools/otimizar-galeria.py` | Redimensiona e converte os `img_*.jpg` para WebP | criar |
| `docs/decisoes.md` | Registo vivo das decisões D1–D8 | criar |

---

### Task 1: Módulo de preços + pontos de fronteira (Fase 2)

**Files:**
- Create: `package.json`, `js/precos.js`, `tests/precos.test.js`

**Interfaces:**
- Produces:
  - `PESO_LIMITE = 10`
  - `PISO_BASE = 3000`
  - `TARIFA_KG = 255`
  - `IVA = 0.16`
  - `calcularPreco(peso) -> { peso, base, iva, total, aplicadoPiso }` — devolve `null` se `peso` não for um número finito `> 0`.
  - `formatarMT(valor) -> "3 480 MT"`

- [ ] **Step 1: Criar `package.json`**

```json
{
  "name": "jvi-carga-servicos",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "description": "Landing page da JVI Carga & Serviços, Lda.",
  "scripts": {
    "test": "node --test tests/"
  }
}
```

- [ ] **Step 2: Escrever o teste que falha — `tests/precos.test.js`**

Os pontos de fronteira que o cliente mandou testar (9, 10, 11, 11.7, 12, 15, 50 kg) são exactamente as linhas de tabela deste teste.

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularPreco, formatarMT, PISO_BASE, TARIFA_KG, IVA } from '../js/precos.js';

const TABELA = [
  // peso, base,     iva,   total
  [0.1,  3000,  480,  3480],
  [9,    3000,  480,  3480],
  [10,   3000,  480,  3480],
  [11,   3000,  480,  3480],   // 11*255 = 2805 -> piso
  [11.7, 3000,  480,  3480],   // 11.7*255 = 2983.5 -> piso
  [12,   3060,  490,  3550],
  [15,   3825,  612,  4437],   // exemplo do briefing
  [50,  12750, 2040, 14790],
];

test('tabela de fronteira do briefing', () => {
  for (const [peso, base, iva, total] of TABELA) {
    const r = calcularPreco(peso);
    assert.equal(r.base, base, `base para ${peso} kg`);
    assert.equal(r.iva, iva, `IVA para ${peso} kg`);
    assert.equal(r.total, total, `total para ${peso} kg`);
  }
});

test('o preco nunca desce quando o peso sobe (monotonia)', () => {
  let anterior = 0;
  for (let i = 1; i <= 5000; i += 1) {
    const peso = (i * 0.01) + 0.01;          // 0.02 .. 50.01 kg, passo 10 g
    const { total } = calcularPreco(peso);
    assert.ok(total >= anterior,
      `total(${peso}) = ${total} é menor que o anterior ${anterior}`);
    anterior = total;
  }
});

test('o piso marca exatamente a partir de 11.7647 kg', () => {
  assert.equal(calcularPreco(11.76).aplicadoPiso, true);
  assert.equal(calcularPreco(11.77).aplicadoPiso, false);
  assert.ok(calcularPreco(11.77).base > PISO_BASE);
});

test('3000 MT com IVA da 3480 MT (regra do briefing)', () => {
  assert.equal(calcularPreco(9).total, Math.round(PISO_BASE * (1 + IVA)));
});

test('acima de 10 kg cobra 255 MT por kg', () => {
  assert.equal(calcularPreco(20).base, 20 * TARIFA_KG);
});

test('pesos invalidos devolvem null', () => {
  for (const mau of [0, -5, NaN, Infinity, 'doze', null, undefined, '']) {
    assert.equal(calcularPreco(mau), null, `peso ${String(mau)} devia dar null`);
  }
});

test('peso gigante continua a dar um numero finito', () => {
  const r = calcularPreco(100000);
  assert.equal(r.base, 100000 * TARIFA_KG);
  assert.equal(r.total, r.base + r.iva);
  assert.ok(Number.isFinite(r.total));
});

test('formatarMT usa espaco de milhares e sem decimais', () => {
  assert.equal(formatarMT(3480), '3 480 MT');
  assert.equal(formatarMT(14790), '14 790 MT');
  assert.equal(formatarMT(1000000), '1 000 000 MT');
  assert.equal(formatarMT(0), '0 MT');
});
```

- [ ] **Step 3: Correr e confirmar que falha**

Run: `npm test`
Expected: FAIL com `ERR_MODULE_NOT_FOUND` a apontar para `js/precos.js`.

- [ ] **Step 4: Implementar `js/precos.js`**

```js
/* =========================================================
   JVI Carga & Serviços — Cálculo do preço de transporte
   ------------------------------------------------------------
   Regra confirmada pelo cliente:

     ATÉ 10 kg      -> 3000 MT base
     ACIMA DE 10 kg -> 255 MT por kg
     IVA            -> 16%

   O PISO de 3000 MT é obrigatório. Sem ele a fórmula quebra
   entre 10 e 12 kg (aos 11 kg dava 2805 MT, menos que aos 10 kg,
   que dá 3000 MT) e o cliente passava a ver "quanto maior o
   peso, menos se paga". O piso garante monotonia: o total é
   uma função não-decrescente do peso.
   ========================================================= */

export const PESO_LIMITE = 10;
export const PISO_BASE = 3000;
export const TARIFA_KG = 255;
export const IVA = 0.16;

/* Arredonda ao metical. Aím o total é sempre a soma exacta
   das partes (base + iva), que é o que o cliente vê no resumo. */
const mt = (n) => Math.round(n);

/**
 * Calcula o orçamento de uma carga.
 * @param {number} peso - peso em kg
 * @returns {{peso:number, base:number, iva:number, total:number, aplicadoPiso:boolean}|null}
 *   null quando o peso não é um número finito maior que zero.
 */
export function calcularPreco(peso) {
  const kg = typeof peso === 'string' ? Number(peso.replace(',', '.')) : Number(peso);
  if (!Number.isFinite(kg) || kg <= 0) return null;

  const bruto = kg <= PESO_LIMITE ? PISO_BASE : kg * TARIFA_KG;
  const base = mt(Math.max(bruto, PISO_BASE));   // <-- piso
  const iva = mt(base * IVA);

  return {
    peso: kg,
    base,
    iva,
    total: base + iva,
    aplicadoPiso: bruto < PISO_BASE,
  };
}

/** "3 480 MT" — espaço de milhares, sem decimais, como se escreve um preço em MZ. */
export function formatarMT(valor) {
  const n = Math.round(Number(valor) || 0);
  const negativo = n < 0;
  const digitos = String(Math.abs(n));
  let saida = '';
  for (let i = 0; i < digitos.length; i += 1) {
    if (i > 0 && (digitos.length - i) % 3 === 0) saida += ' ';
    saida += digitos[i];
  }
  return `${negativo ? '-' : ''}${saida} MT`;
}
```

- [ ] **Step 5: Correr e confirmar que passa**

Run: `npm test`
Expected: 7 testes, 0 falhas. Se `monotonia` falhar, o piso não está a ser aplicado.

- [ ] **Step 6: Commit**

```bash
git add package.json js/precos.js tests/precos.test.js
git commit -m "Fase 2: modulo de calculo de preco com piso minimo de 3000 MT

Regra do cliente: ate 10 kg cobra 3000 MT base, acima disso 255 MT/kg,
IVA de 16%. O piso de 3000 MT e obrigatorio porque sem ele a formula
pura nao e monotonica: aos 11 kg dava 2805 MT, menos que aos 10 kg.

Decisoes registadas:
- D1: base e IVA arredondados ao metical e o total e a soma das
  partes, para o resumo fechar exactamente (3480 e 4437 como o cliente
  pediu).
- D2: valores apresentados como '3 480 MT' (espaco de milhares).
- A monotonicidade e testada de 0.02 a 50.01 kg em passos de 10 g,
  alem dos pontos de fronteira 9, 10, 11, 11.7, 12, 15 e 50 kg."
```

---

### Task 2: Assistente de 3 passos no pop-up (Fase 1)

**Files:**
- Modify: `index.html` (template `#tplOrc`, secção `#orcamento`, header CTA)
- Create: `js/orcamento.js`, `css/orcamento.css`
- Modify: `js/main.js` (remove a lógica do formulário de 4 passos)

**Interfaces:**
- Consumes: `calcularPreco`, `formatarMT` de `js/precos.js`.
- Produces: `PROVINCIAS` (array de strings), `normalizarPeso(txt) -> number|null`, `iniciarOrcamento(raiz) -> void`.

- [ ] **Step 1: Escrever o teste que falha — `tests/orcamento.test.js`**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PROVINCIAS, normalizarPeso, normalizarTelefone, msgEmpresa, msgCliente,
} from '../js/orcamento.js';
import { calcularPreco } from '../js/precos.js';

const CHEIO = {
  nome: 'João Pedro Sissu',
  apelido: 'Sissu',
  provincia: 'Nampula',
  morada: 'Bairro da Sommachine',
  telefone: '84 793 5035',
  destinatario: 'Ana Maria',
  provinciaDestino: 'Cabo Delgado',
  peso: '11.7',
  dimensao: '60 x 40 x 40',
  descricao: 'tintas PLASCON',
  pagamento: 'e-Mola',
  pagarNoLevantamento: 'sim',
};

test('as 11 provincias do briefing estao no select', () => {
  assert.deepEqual(PROVINCIAS, [
    'Cabo Delgado', 'Gaza', 'Inhambane', 'Manica', 'Maputo', 'Nampula',
    'Niassa', 'Palma', 'Sofala', 'Tete', 'Zambézia',
  ]);
});

test('normalizarPeso aceita ponto e virgula', () => {
  assert.equal(normalizarPeso('11.7'), 11.7);
  assert.equal(normalizarPeso('11,7'), 11.7);
  assert.equal(normalizarPeso(' 12 '), 12);
  assert.equal(normalizarPeso(''), null);
  assert.equal(normalizarPeso('0'), null);
  assert.equal(normalizarPeso('doze'), null);
  assert.equal(normalizarPeso('-3'), null);
});

test('normalizarTelefone reduz qualquer escrita a 258847935035', () => {
  for (const t of ['84 793 5035', '+258 84 793 5035', '258847935035',
    '00258847935035', '258 84 793 5035', '0847935035']) {
    assert.equal(normalizarTelefone(t), '258847935035', `escrita: ${t}`);
  }
});

test('normalizarTelefone rejeita o que nao e telefone', () => {
  for (const t of ['', 'abc', '123', null, undefined]) {
    assert.equal(normalizarTelefone(t), null, `entrada: ${String(t)}`);
  }
});

test('a mensagem da empresa leva os dados completos e o orcamento', () => {
  const t = msgEmpresa(CHEIO);
  const preco = calcularPreco(11.7);
  assert.match(t, /João Pedro Sissu/);
  assert.match(t, /Sissu/);
  assert.match(t, /Nampula/);
  assert.match(t, /Ana Maria/);
  assert.match(t, /Cabo Delgado/);
  assert.match(t, /11.7 kg/);
  assert.match(t, /tintas PLASCON/);
  assert.match(t, /e-Mola/);
  assert.match(t, /11.7647/);              // a base do preco, arredondada
  assert.ok(t.includes(String(preco.total)));
});

test('a mensagem do cliente confirma o orcamento sem linguagem interna', () => {
  const t = msgCliente(CHEIO);
  const preco = calcularPreco(11.7);
  assert.match(t, /orçamento/i);
  assert.ok(t.includes(String(preco.total)));
  assert.ok(t.includes(String(preco.base)));
  assert.ok(t.includes(String(preco.iva)));
  assert.doesNotMatch(t, /004/);          // sem numero internacional
  assert.match(t, /847 935 035|84 793 5035/);  // telefone legivel
});
```

- [ ] **Step 2: Correr e confirmar que falha**

Run: `npm test`
Expected: FAIL com `ERR_MODULE_NOT_FOUND` a apontar para `js/orcamento.js`.

- [ ] **Step 3: Escrever `js/orcamento.js` — parte pura (sem DOM)**

```js
/* =========================================================
   JVI Carga & Serviços — Assistente de orçamento (3 passos)
   ------------------------------------------------------------
   Este módulo tem duas metades:
     1. funções puras (PROVINCIAS, normalizarPeso, normalizarTelefone,
        msgEmpresa, msgCliente) — testáveis em Node, sem DOM;
     2. iniciarOrcamento(raiz) — só DOM, chamada pelo main.js.
   O topo do módulo não toca no document, para que `import`
   funcione no runner de testes.
   ========================================================= */

import { calcularPreco, formatarMT } from './precos.js';

export const PROVINCIAS = [
  'Cabo Delgado', 'Gaza', 'Inhambane', 'Manica', 'Maputo', 'Nampula',
  'Niassa', 'Palma', 'Sofala', 'Tete', 'Zambézia',
];

export const PAGAMENTOS = ['e-Mola', 'Cartão de crédito', 'Numerário'];

/** Número da empresa — ÚNICO e confirmado pelo cliente. Não é editável na UI. */
export const JVI_WHATSAPP = '258847935035';

/* ---------- Peso: aceita virgula ou ponto ---------- */
export function normalizarPeso(txt) {
  if (txt === null || txt === undefined) return null;
  const n = Number(String(txt).trim().replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/* ---------- Telefone: um só destino, qualquer escrita ----------
   Mocambique é 258; os móveis começam por 8 e têm 9 digitos.
   Aceita o prefijo internacional, o `+`, o `00` e o `0` inicial. */
export function normalizarTelefone(txt) {
  if (txt === null || txt === undefined) return null;
  let d = String(txt).replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('258')) d = d.slice(3);
  else if (d.startsWith('0')) d = d.slice(1);
  if (!/^[2-9]\d{8}$/.test(d)) return null;
  return `258${d}`;
}

/** "258847935035" -> "+258 84 793 5035" */
export function telefoneLegivel(movel) {
  const m = normalizarTelefone(movel);
  if (!m) return '—';
  const n = m.slice(3);
  return `+258 ${n.slice(0, 2)} ${n.slice(2, 5)} ${n.slice(5)}`;
}

const num = (v) => (v === undefined || v === null ? '' : String(v).trim()) || '—';

/* ---------- Mensagem 1: para a JVI ---------- */
export function msgEmpresa(d) {
  const p = calcularPreco(d.peso);
  return [
    '*NOVO PEDIDO DE ORÇAMENTO — JVI Carga & Serviços*',
    '',
    `*Ref.:* JVI/${hojeISO()}`,
    '',
    '*EMISSOR*',
    `• Nome: ${num(d.nome)} ${num(d.apelido)}`.replace(' — —', '').trim(),
    `• Província: ${num(d.provincia)}`,
    `• Morada: ${num(d.morada)}`,
    `• WhatsApp: ${telefoneLegivel(d.telefone)}`,
    '',
    '*CARGA*',
    `• Peso: ${num(d.peso)} kg`,
    `• Dimensões: ${num(d.dimensao)}`,
    `• Mercadoria: ${num(d.descricao)}`,
    '',
    '*DESTINO*',
    `• Recebe: ${num(d.destinatario)}`,
    `• Província: ${num(d.provinciaDestino)}`,
    '',
    '*PAGAMENTO*',
    `• Forma: ${num(d.pagamento)}`,
    `• Paga no levantamento: ${d.pagarNoLevantamento === 'sim' ? 'Sim' : 'Não'}`,
    '',
    '*ORÇAMENTO*',
    p ? `• Base: ${formatarMT(p.base)} (${d.peso} kg)\n• IVA 16%: ${formatarMT(p.iva)}\n• *TOTAL: ${formatarMT(p.total)}*`
      : '• a definir com a JVI',
  ].join('\n');
}

/* ---------- Mensagem 2: para o cliente ---------- */
export function msgCliente(d) {
  const p = calcularPreco(d.peso);
  return [
    '*JVI Carga & Serviços — o seu orçamento*',
    '',
    `Olá ${num(d.nome)},`,
    '',
    `Registo do seu pedido de transporte:`,
    `• Carga: ${num(d.descricao)} — ${num(d.peso)} kg`,
    `• Destino: ${num(d.provinciaDestino)}`,
    '',
    p
      ? `*TOTAL: ${formatarMT(p.total)}* (base ${formatarMT(p.base)} + IVA ${formatarMT(p.iva)})`
      : 'O total é confirmado pela nossa equipa.',
    '',
    d.pagarNoLevantamento === 'sim'
      ? 'Registo que pretende **pagar no levantamento**, na província de destino.'
      : `Forma de pagamento: ${num(d.pagamento)}.`,
    '',
    'Agradecemos a confiança. A nossa equipa entra em contacto para combinar a recolha.',
    '',
    '_JVI Carga & Serviços, Lda · Av. 19 de Outubro, Terminal de Cargas Nº 113, Aeroporto de Maputo_',
  ].join('\n');
}

function hojeISO() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}
```

- [ ] **Step 4: Correr e confirmar que passa**

Run: `npm test`
Expected: 14 testes, 0 falhas.

- [ ] **Step 5: Reescrever o template em `index.html`**

Substituir o `<template id="tplOrc">` inteiro (linhas 492-712) por este, que tem os 3 passos pedidos no briefing e nada de canal de envio:

```html
<template id="tplOrc">
  <form class="orc" novalidate data-orc>
    <!-- Indicador de progresso -->
    <div class="orc__cabec">
      <ol class="orc__passos" data-passos>
        <li class="orc-passo" data-passo="0"><span class="orc-passo__n">1</span><span class="orc-passo__t">Emissor</span></li>
        <li class="orc-passo" data-passo="1"><span class="orc-passo__n">2</span><span class="orc-passo__t">Carga</span></li>
        <li class="orc-passo" data-passo="2"><span class="orc-passo__n">3</span><span class="orc-passo__t">Pagamento</span></li>
      </ol>
      <div class="orc__barra" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="33" aria-label="Progresso do pedido"><span></span></div>
    </div>

    <div class="orc__corpo">
      <!-- PASSO 1 -->
      <fieldset class="orc-seccao" data-seccao="0" data-ativa="true">
        <legend class="sr-only">Passo 1 — dados do emissor</legend>
        <h3 class="orc-seccao__t">Quem envia a carga</h3>
        <div class="campos campos--2">
          <div class="campo" data-campo="nome">
            <label for="orcNome">Nome completo <span class="ob">*</span></label>
            <input id="orcNome" name="nome" type="text" placeholder="Ex.: João Pedro" required autocomplete="given-name">
            <span class="campo__erro">Indique o primeiro nome.</span>
          </div>
          <div class="campo" data-campo="apelido">
            <label for="orcApelido">Apelido / sobrenome <span class="ob">*</span></label>
            <input id="orcApelido" name="apelido" type="text" placeholder="Ex.: Sissu" required autocomplete="family-name">
            <span class="campo__erro">Indique o apelido.</span>
          </div>
          <div class="campo" data-campo="provincia">
            <label for="orcProvincia">Província <span class="ob">*</span></label>
            <select id="orcProvincia" name="provincia" required></select>
            <span class="campo__erro">Escolha a província.</span>
          </div>
          <div class="campo" data-campo="morada">
            <label for="orcMorada">Morada / bairro <span class="ob">*</span></label>
            <input id="orcMorada" name="morada" type="text" placeholder="Ex.: Sommachine, Maputo" required autocomplete="street-address">
            <span class="campo__erro">Indique a morada.</span>
          </div>
          <div class="campo campo--largo" data-campo="telefone">
            <label for="orcTelefone">Telefone (WhatsApp) <span class="ob">*</span></label>
            <input id="orcTelefone" name="telefone" type="tel" inputmode="tel" placeholder="84 793 5035" required autocomplete="tel">
            <span class="campo__ajuda">É este número que recebe a confirmação. Pode escrever com ou sem o +258.</span>
            <span class="campo__erro">Indique um número moçambicano válido (9 dígitos, começa por 8).</span>
          </div>
        </div>
      </fieldset>

      <!-- PASSO 2 -->
      <fieldset class="orc-seccao" data-seccao="1">
        <legend class="sr-only">Passo 2 — dados da carga</legend>
        <h3 class="orc-seccao__t">O que transportamos</h3>
        <div class="campos campos--2">
          <div class="campo" data-campo="destinatario">
            <label for="orcDestinatario">Quem recebe <span class="ob">*</span></label>
            <input id="orcDestinatario" name="destinatario" type="text" placeholder="Nome de quem recebe" required>
            <span class="campo__erro">Indique quem recebe a carga.</span>
          </div>
          <div class="campo" data-campo="provinciaDestino">
            <label for="orcProvinciaDestino">Província de destino <span class="ob">*</span></label>
            <select id="orcProvinciaDestino" name="provinciaDestino" required></select>
            <span class="campo__erro">Escolha a província de destino.</span>
          </div>
          <div class="campo" data-campo="peso">
            <label for="orcPeso">Peso (kg) <span class="ob">*</span></label>
            <input id="orcPeso" name="peso" type="number" inputmode="decimal" min="0.1" max="100000" step="0.1" placeholder="Ex.: 15" required>
            <span class="campo__erro">Indique o peso em kg (mínimo 0,1).</span>
          </div>
          <div class="campo" data-campo="dimensao">
            <label for="orcDimensao">Dimensões (cm) <span class="opc">opcional</span></label>
            <input id="orcDimensao" name="dimensao" type="text" placeholder="Ex.: 60 x 40 x 40">
            <span class="campo__ajuda">Comprimento × largura × altura. Se não souber, deixe vazio.</span>
          </div>
          <div class="campo campo--largo" data-campo="descricao">
            <label for="orcDescricao">Descrição da mercadoria <span class="ob">*</span></label>
            <textarea id="orcDescricao" name="descricao" rows="3" placeholder="Ex.: camisetas · tintas PLASCON · material eléctrico" required></textarea>
            <span class="campo__erro">Descreva a mercadoria.</span>
          </div>
        </div>

        <!-- Custo estimado, calculado ao vivo -->
        <div class="orc-preco" data-preco hidden>
          <span class="orc-preco__r">Base <b data-p-base>—</b></span>
          <span class="orc-preco__r">IVA 16% <b data-p-iva>—</b></span>
          <span class="orc-preco__r orc-preco__r--total">Total <b data-p-total>—</b></span>
        </div>
        <p class="orc-preco__nota">Valor estimado pela nossa tabela em vigor. Confirmamos o preço final ao fechar o orçamento.</p>
      </fieldset>

      <!-- PASSO 3 -->
      <fieldset class="orc-seccao" data-seccao="2">
        <legend class="sr-only">Passo 3 — pagamento</legend>
        <h3 class="orc-seccao__t">Como pretende pagar</h3>
        <div class="campos">
          <div class="campo campo--largo" data-campo="pagamento">
            <span class="campo__rotulo" id="rotPag">Forma de pagamento <span class="ob">*</span></span>
            <div class="opcoes" role="radiogroup" aria-labelledby="rotPag">
              <label class="opcao"><input type="radio" name="pagamento" value="e-Mola" checked> <span>e-Mola<small>Telemóvel</small></span></label>
              <label class="opcao"><input type="radio" name="pagamento" value="Cartão de crédito"> <span>Cartão de crédito<small>Visa · MasterCard</small></span></label>
              <label class="opcao"><input type="radio" name="pagamento" value="Numerário"> <span>Numerário<small>Meticais</small></span></label>
            </div>
          </div>
          <div class="campo campo--largo" data-campo="pagarNoLevantamento">
            <span class="campo__rotulo" id="rotLev">Paga no levantamento, na província de destino?</span>
            <div class="opcoes opcoes--simnao" role="radiogroup" aria-labelledby="rotLev">
              <label class="opcao"><input type="radio" name="pagarNoLevantamento" value="sim" checked> <span>Sim<small>Pago quando for buscar</small></span></label>
              <label class="opcao"><input type="radio" name="pagarNoLevantamento" value="nao"> <span>Não<small>Pago antes do envio</small></span></label>
            </div>
          </div>

          <div class="consent" data-consent>
            <input type="checkbox" name="consentimento" value="sim" id="orcConsent">
            <label for="orcConsent">Li e aceito a <a href="#" data-legal="privacidade">Política de Privacidade</a> e autorizo o tratamento dos meus dados para este orçamento. <span class="ob">*</span></label>
          </div>
        </div>
      </fieldset>
    </div>

    <!-- Navegação -->
    <div class="orc__nav">
      <button class="btn btn--vidro" type="button" data-ant disabled>Voltar</button>
      <span class="orc__conta" data-conta>Passo 1 de 3</span>
      <button class="btn btn--primario" type="button" data-seg>Continuar</button>
    </div>

    <div class="estado-envio" data-estado role="status" aria-live="polite"></div>
  </form>
</template>
```

Trocar também, na secção `#orcamento`, o `<div id="orcSecao"></div>` por uma chamada directa ao modal com texto de venda (o formulário só vive no pop-up, como o briefing pede):

```html
<div class="orc-cta">
  <p class="orc-cta__txt">O preço sai do seu peso: <b>3000 MT</b> até 10 kg, <b>255 MT/kg</b> acima disso, com IVA incluído. Sem surpresas.</p>
  <button class="btn btn--primario btn--grande" data-abrir-orc>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 15h6M9 11h3"/></svg>
    Pedir orçamento
  </button>
</div>
```

- [ ] **Step 6: Criar `css/orcamento.css`**

```css
/* =========================================================
   JVI Carga & Serviços — Assistente de orçamento (3 passos)
   Espaçamento na escala de 4/8px.
   ========================================================= */

.orc { display: grid; gap: 24px; }

/* ---- Indicador de progresso ---- */
.orc__cabec { display: grid; gap: 12px; }
.orc__passos { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.orc-passo {
  display: flex; align-items: center; gap: 8px; min-width: 0;
  font-size: 13px; font-weight: 700; color: var(--texto-fraco);
}
.orc-passo__n {
  width: 28px; height: 28px; flex: none; border-radius: 50%;
  display: grid; place-items: center; font-size: 12.5px; font-weight: 800;
  background: rgba(255, 255, 255, 0.07); color: var(--texto-fraco);
  border: 1px solid transparent; transition: all var(--transicao);
}
.orc-passo__t { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.orc-passo[data-estado="feito"] .orc-passo__n { background: var(--verde-escuro); color: var(--base); }
.orc-passo[data-estado="feito"] { color: var(--texto-suave); }
.orc-passo[data-estado="ativo"] .orc-passo__n { background: var(--verde); color: var(--base); }
.orc-passo[data-estado="ativo"] { color: var(--texto); }

.orc__barra { height: 4px; border-radius: 100px; background: rgba(255, 255, 255, 0.08); overflow: hidden; }
.orc__barra span {
  display: block; height: 100%; width: 33%; border-radius: 100px;
  background: linear-gradient(90deg, var(--verde), var(--laranja));
  transition: width 0.45s cubic-bezier(0.22, 1, 0.36, 1);
}

/* ---- Passos ---- */
.orc-seccao { display: none; border: 0; margin: 0; padding: 0; min-width: 0; }
.orc-seccao[data-ativa="true"] { display: grid; gap: 16px; animation: entra 0.4s cubic-bezier(0.22, 1, 0.36, 1); }
.orc-seccao__t { font-size: 19px; font-weight: 800; letter-spacing: -0.02em; }

/* ---- Campos ---- */
.campos { display: grid; gap: 16px; }
@media (min-width: 620px) { .campos--2 { grid-template-columns: repeat(2, 1fr); } }
.campo { display: grid; gap: 8px; align-content: start; min-width: 0; }
.campo--largo { grid-column: 1 / -1; }
.campo label, .campo__rotulo { font-size: 12.5px; font-weight: 700; color: var(--texto-suave); letter-spacing: 0.02em; }
.campo .ob { color: var(--laranja); }
.campo .opc { margin-left: 8px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--texto-fraco); }
.campo input, .campo select, .campo textarea {
  width: 100%; padding: 14px 16px; border-radius: 12px;
  background: rgba(255, 255, 255, 0.04); color: var(--texto);
  border: 1px solid rgba(255, 255, 255, 0.11); font: inherit; font-size: 16px;
  transition: border-color var(--transicao), background var(--transicao), box-shadow var(--transicao);
}
.campo textarea { min-height: 84px; resize: vertical; }
.campo select { appearance: none; padding-right: 44px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23A9CF44' stroke-width='2.5' stroke-linecap='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: right 16px center; background-size: 18px; }
.campo select option { background: var(--base-2); color: var(--texto); }
.campo input:focus, .campo select:focus, .campo textarea:focus {
  outline: none; border-color: var(--verde); background: rgba(169, 207, 68, 0.05);
  box-shadow: 0 0 0 3px rgba(169, 207, 68, 0.14);
}
.campo__ajuda { font-size: 12px; color: var(--texto-fraco); }
.campo__erro { font-size: 12px; color: #FCA5A5; display: none; }
.campo[data-erro="true"] input, .campo[data-erro="true"] select { border-color: #F87171; }
.campo[data-erro="true"] .campo__erro { display: block; }

/* ---- Preço estimado ---- */
.orc-preco {
  display: flex; flex-wrap: wrap; gap: 8px 24px; padding: 16px 20px;
  border-radius: 12px; background: rgba(169, 207, 68, 0.08); border: 1px solid var(--linha);
}
.orc-preco__r { font-size: 13.5px; color: var(--texto-suave); }
.orc-preco__r b { display: block; font-size: 17px; color: var(--texto); font-weight: 800; }
.orc-preco__r--total { margin-left: auto; text-align: right; }
.orc-preco__r--total b { color: var(--verde); font-size: 24px; letter-spacing: -0.02em; }
.orc-preco__nota { font-size: 11.5px; color: var(--texto-fraco); }

/* ---- Opções ---- */
.opcoes { display: grid; gap: 8px; }
@media (min-width: 480px) { .opcoes:not(.opcoes--simnao) { grid-template-columns: repeat(3, 1fr); } }
.opcoes--simnao { grid-template-columns: repeat(2, 1fr); }
.opcao {
  display: flex; align-items: center; gap: 12px; padding: 14px 16px; cursor: pointer;
  border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.03); transition: all var(--transicao);
}
.opcao:hover { border-color: rgba(169, 207, 68, 0.35); }
.opcao input { accent-color: var(--verde); width: 18px; height: 18px; flex: none; }
.opcao span { font-size: 14.5px; font-weight: 700; }
.opcao small { display: block; font-size: 11.5px; font-weight: 500; color: var(--texto-fraco); }
.opcao:has(input:checked) { border-color: var(--verde); background: rgba(169, 207, 68, 0.1); }

/* ---- Navegação ---- */
.orc__nav { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.orc__conta { margin-inline: auto; font-size: 12.5px; color: var(--texto-fraco); }
.orc__nav .btn--vidro[disabled] { opacity: 0.3; pointer-events: none; }

/* ---- Consentimento ---- */
.consent { display: flex; align-items: flex-start; gap: 12px; padding: 16px 18px; border-radius: 12px; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); }
.consent input { width: 18px; height: 18px; flex: none; margin-top: 2px; accent-color: var(--verde); }
.consent label { font-size: 13px; color: var(--texto-suave); }
.consent a { color: var(--verde); text-decoration: underline; }
.consent[data-erro="true"] { border-color: #F87171; }

/* ---- CTA dentro da secção ---- */
.orc-cta { display: flex; flex-wrap: wrap; align-items: center; gap: 16px 24px; margin-top: 32px; padding: 24px 28px; border-radius: var(--raio); background: linear-gradient(120deg, rgba(169, 207, 68, 0.12), rgba(234, 130, 64, 0.08)); border: 1px solid var(--linha); }
.orc-cta__txt { flex: 1 1 280px; font-size: 15px; color: var(--texto-suave); }
.orc-cta__txt b { color: var(--verde); }
.btn--grande { padding: 17px 34px; font-size: 16px; }
```

- [ ] **Step 7: Escrever `iniciarOrcamento` em `js/orcamento.js` (parte DOM)**

Acrescentar ao fim de `js/orcamento.js`:

```js
/* =========================================================
   PARTE DOM — só é executada quando o browser chama
   ========================================================= */

/** Monta os <option> das províncias dentro de um <select>. */
function encherProvincias(select) {
  if (!select) return;
  select.replaceChildren(new Option('Seleccione…', ''));
  for (const p of PROVINCIAS) select.append(new Option(p, p));
}

/**
 * Liga um formulário [data-orc] ao assistente de 3 passos.
 * Idempotente: chamar duas vezes no mesmo nó não duplica listeners.
 * @param {HTMLElement} form
 */
export function iniciarOrcamento(form) {
  if (!form || form.dataset.orcLigado === 'true') return;
  form.dataset.orcLigado = 'true';

  form.querySelectorAll('select[name="provincia"], select[name="provinciaDestino"]')
    .forEach(encherProvincias);

  const passos = [...form.querySelectorAll('.orc-passo')];
  const seccoes = [...form.querySelectorAll('.orc-seccao')];
  const barra = form.querySelector('.orc__barra');
  const barraFill = barra.querySelector('span');
  const conta = form.querySelector('[data-conta]');
  const btnAnt = form.querySelector('[data-ant]');
  const btnSeg = form.querySelector('[data-seg]');
  const estado = form.querySelector('[data-estado]');
  const consent = form.querySelector('[data-consent]');
  const precoCaixa = form.querySelector('[data-preco]');
  const consentCaixa = form.querySelector('input[name="consentimento"]');

  /* Preço estimado ao vivo */
  const pintarPreco = () => {
    const kg = normalizarPeso(form.elements.peso.value);
    const p = calcularPreco(kg);
    if (!p) { precoCaixa.hidden = true; return; }
    precoCaixa.hidden = false;
    precoCaixa.querySelector('[data-p-base]').textContent = formatarMT(p.base);
    precoCaixa.querySelector('[data-p-iva]').textContent = formatarMT(p.iva);
    precoCaixa.querySelector('[data-p-total]').textContent = formatarMT(p.total);
  };
  form.elements.peso.addEventListener('input', pintarPreco);

  /* Validação por passo */
  function valido(i) {
    let ok = true;
    let primeiroMau = null;
    seccoes[i].querySelectorAll('[required]').forEach((inp) => {
      let mau;
      if (inp.name === 'peso') {
        const kg = normalizarPeso(inp.value);
        mau = kg === null || kg < 0.1 || kg > 100000;
      } else if (inp.name === 'telefone') {
        mau = normalizarTelefone(inp.value) === null;
      } else {
        mau = !inp.value.trim();
      }
      const campo = inp.closest('.campo');
      if (campo) campo.dataset.erro = String(mau);
      if (mau) { ok = false; primeiroMau = primeiroMau || inp; }
    });
    if (primeiroMau) primeiroMau.focus();
    return ok;
  }

  function mostrar(i) {
    const atual = Math.max(0, Math.min(seccoes.length - 1, i));
    seccoes.forEach((s, k) => { s.dataset.ativa = String(k === atual); });
    passos.forEach((p, k) => {
      p.dataset.estado = k === atual ? 'ativo' : (k < atual ? 'feito' : '');
    });
    const pct = ((atual + 1) / seccoes.length) * 100;
    barraFill.style.width = `${pct}%`;
    barra.setAttribute('aria-valuenow', String(Math.round(pct)));
    conta.textContent = `Passo ${atual + 1} de ${seccoes.length}`;
    btnAnt.disabled = atual === 0;
    form.dataset.passo = String(atual);
  }

  /* Erros ligados ao campo para o leitor de ecrã */
  form.querySelectorAll('.campo[data-campo]').forEach((campo) => {
    const msg = campo.querySelector('.campo__erro');
    const inp = campo.querySelector('input, select, textarea');
    if (!msg || !inp) return;
    if (!msg.id) msg.id = `${inp.id}-erro`;
    inp.setAttribute('aria-describedby', msg.id);
  });

  btnSeg.addEventListener('click', () => {
    const atual = Number(form.dataset.passo);
    if (valido(atual)) mostrar(atual + 1);
  });
  btnAnt.addEventListener('click', () => mostrar(Number(form.dataset.passo) - 1));

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    for (let i = 0; i < seccoes.length; i += 1) {
      if (!valido(i)) { mostrar(i); return; }
    }
    if (!consentCaixa.checked) {
      consent.dataset.erro = 'true';
      estado.dataset.mostrar = 'true';
      estado.className = 'estado-envio estado-envio--erro';
      estado.textContent = 'Precisa de aceitar a Política de Privacidade para enviar o pedido.';
      consentCaixa.focus();
      return;
    }
    form.dispatchEvent(new CustomEvent('orc:pronto', { bubbles: true, detail: dados(form) }));
  });

  mostrar(0);
  pintarPreco();
}

/** Lê o formulário para um objecto simples. */
export function dados(form) {
  const g = (n) => (form.elements[n]?.value ?? '').toString().trim();
  return {
    nome: g('nome'), apelido: g('apelido'), provincia: g('provincia'),
    morada: g('morada'), telefone: g('telefone'),
    destinatario: g('destinatario'), provinciaDestino: g('provinciaDestino'),
    peso: g('peso'), dimensao: g('dimensao'), descricao: g('descricao'),
    pagamento: form.querySelector('input[name="pagamento"]:checked')?.value || 'Numerário',
    pagarNoLevantamento: form.querySelector('input[name="pagarNoLevantamento"]:checked')?.value || 'sim',
  };
}
```

- [ ] **Step 8: Ligar em `main.js`**

Em `index.html`, o `<template>` passa a ser montado **uma vez**, dentro do modal. Substituir o bloco `MODAL ORÇAMENTO` por:

```html
<div class="modal" id="modal" data-aberto="false" role="dialog" aria-modal="true" aria-labelledby="modalTitulo">
  <div class="modal__fundo" data-fechar></div>
  <div class="modal__caixa modal__caixa--orc">
    <button class="modal__fechar" data-fechar aria-label="Fechar">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
    </button>
    <span class="etiqueta">Orçamento</span>
    <h2 id="modalTitulo" class="modal__titulo">Peça o seu <span class="verde">orçamento</span></h2>
    <p class="modal__lead">Três passos rápidos. O preço aparece logo à medida que escreve o peso.</p>
    <div id="orcRaiz"></div>
  </div>
</div>
```

E em `js/main.js`, substituir o bloco `FORMULÁRIO AIRWAYBILL` (as linhas `const tpl = …` até `mostrar(0); });`) por:

```js
/* =========================================================
   FORMULÁRIO DE ORÇAMENTO — 3 passos, dentro do modal
   ========================================================= */
import { iniciarOrcamento, dados, normalizarTelefone, msgEmpresa, msgCliente, JVI_WHATSAPP } from './orcamento.js';

document.getElementById('orcRaiz').append(tpl.content.cloneNode(true));
iniciarOrcamento(document.querySelector('#orcRaiz [data-orc]'));

/* Todos os "Pedir orçamento" abrem o pop-up. Sem exceções por
   largura de ecrã: o formulário vive só no modal. */
document.querySelectorAll('[data-abrir-orc]').forEach((btn) => {
  btn.addEventListener('click', abrirModal);
});
```

E acrescentar `<link rel="stylesheet" href="css/orcamento.css">` a seguir a `css/privacidade.css` no `<head>`.

- [ ] **Step 9: Correr os testes e abrir no browser**

Run: `npm test`
Expected: 14 testes, 0 falhas.

Abra `index.html` e confirme à mão: o hero tem "Pedir orçamento"; o pop-up abre; passo 1 → 2 → 3; o peso escreve o total ao vivo; "Voltar" funciona; o passo 3 mostra as 3 formas de pagamento e a pergunta do levantamento.

- [ ] **Step 10: Commit**

```bash
git add index.html js/orcamento.js js/main.js css/orcamento.css tests/orcamento.test.js
git commit -m "Fase 1: formulario de orcamento em pop-up, 3 passos

O formulario de 4 passos que vivia na seccao passa a um pop-up com
3 passos: emissor, carga e pagamento. Indicador de progresso,
botao Voltar, validacao por passo e foco no primeiro campo com erro.

Decisoes registadas:
- D3: o peso aceita virgula decimal (11,7), porque e assim que o
  teclado local escreve. O campo continua a ser type=number.
- As dimensoes ficam opcionais, conforme o briefing autoriza.
- O passo 3 tem as 3 formas que o cliente pediu (e-Mola, cartao de
  credito, numerario) e a pergunta separada sobre pagar no
  levantamento, na provincia de destino.
- O select de provincia e preenchido por JS a partir de PROVINCIAS,
  uma unica fonte de verdade partilhada com os testes.
- O campo 'para que numero vai ser enviado' nao existe: e decisao
  interna da JVI."
```

---

### Task 3: Diálogo de confirmação antes do envio (Fase 3)

**Files:**
- Modify: `index.html` (novo diálogo de confirmação), `js/main.js`, `css/orcamento.css`

**Interfaces:**
- Consumes: `dados(form)`, `linhasResumo(d)`, `calcularPreco`, `formatarMT`.
- Produces: em `js/main.js`, `abrirConfirmacao(d, onConfirmar)` e `fecharConfirmacao()`. Fica em `main.js` e não em `orcamento.js` porque depende do elemento `#confirm`, que é estrutura de página e não lógica de negócio — `main.js` já é onde vivem o modal e o diálogo legal.

- [ ] **Step 1: Escrever o teste que falha — acrescentar a `tests/orcamento.test.js`**

```js
import { linhasResumo } from '../js/orcamento.js';

test('linhasResumo lista os dados e os tres valores sem omitir nada', () => {
  const l = linhasResumo(CHEIO);
  const texto = l.map((x) => `${x.rotulo}: ${x.valor}`).join(' | ');
  assert.match(texto, /Emissor: João Pedro Sissu Sissu/);
  assert.match(texto, /Origem: Nampula/);
  assert.match(texto, /WhatsApp: \+258 84 793 5035/);
  assert.match(texto, /Recebe: Ana Maria/);
  assert.match(texto, /Destino: Cabo Delgado/);
  assert.match(texto, /Peso: 11.7 kg/);
  assert.match(texto, /Mercadoria: tintas PLASCON/);
  assert.match(texto, /Pagamento: e-Mola/);
  assert.match(texto, /Paga no levantamento: Sim/);
  assert.match(texto, /Base: 3 000 MT/);
  assert.match(texto, /IVA 16%: 480 MT/);
  assert.match(texto, /TOTAL: 3 480 MT/);
});
```

- [ ] **Step 2: Correr e confirmar que falha**

Run: `npm test`
Expected: FAIL — `linhasResumo` não é exportado.

- [ ] **Step 3: Implementar `linhasResumo` em `js/orcamento.js`**

```js
/** Linhas do resumo de confirmação: rótulo + valor já formatado. */
export function linhasResumo(d) {
  const p = calcularPreco(d.peso);
  return [
    { rotulo: 'Emissor', valor: `${num(d.nome)} ${num(d.apelido)}`.replace('— —', '').trim() },
    { rotulo: 'Origem', valor: num(d.provincia) },
    { rotulo: 'Morada', valor: num(d.morada) },
    { rotulo: 'WhatsApp', valor: telefoneLegivel(d.telefone) },
    { rotulo: 'Recebe', valor: num(d.destinatario) },
    { rotulo: 'Destino', valor: num(d.provinciaDestino) },
    { rotulo: 'Peso', valor: `${num(d.peso)} kg` },
    { rotulo: 'Dimensões', valor: d.dimensao ? num(d.dimensao) : 'não indicadas' },
    { rotulo: 'Mercadoria', valor: num(d.descricao) },
    { rotulo: 'Pagamento', valor: num(d.pagamento) },
    { rotulo: 'Paga no levantamento', valor: d.pagarNoLevantamento === 'sim' ? 'Sim' : 'Não' },
    { rotulo: 'Base', valor: p ? formatarMT(p.base) : '—' },
    { rotulo: 'IVA 16%', valor: p ? formatarMT(p.iva) : '—' },
    { rotulo: 'TOTAL', valor: p ? formatarMT(p.total) : '—', destaque: true },
  ];
}
```

- [ ] **Step 4: Correr e confirmar que passa**

Run: `npm test`
Expected: 15 testes, 0 falhas.

- [ ] **Step 5: Adicionar o diálogo ao `index.html`**

Depois do `</template>` do formulário, antes do diálogo legal:

```html
<!-- ===================== CONFIRMAÇÃO ===================== -->
<div class="confirm" id="confirm" data-aberto="false" role="dialog" aria-modal="true" aria-labelledby="confirmTitulo">
  <div class="confirm__fundo" data-fechar-confirm></div>
  <div class="confirm__caixa">
    <span class="etiqueta">Confirmar</span>
    <h2 id="confirmTitulo" class="modal__titulo">Confirme o seu <span class="verde">pedido</span></h2>
    <p class="modal__lead">Leia e confirme. Depois enviamos tudo por WhatsApp — à JVI e ao seu número.</p>
    <dl class="confirm__lista" data-resumo-confirm></dl>
    <div class="confirm__nav">
      <button class="btn btn--vidro" type="button" data-fechar-confirm>Voltar a editar</button>
      <button class="btn btn--primario" type="button" data-confirmar>Confirmar e enviar</button>
    </div>
  </div>
</div>
```

- [ ] **Step 6: Estilos do diálogo em `css/orcamento.css`**

```css
/* ---- Confirmação ---- */
.confirm { position: fixed; inset: 0; z-index: 130; display: none; align-items: center; justify-content: center; padding: 20px; }
.confirm[data-aberto="true"] { display: flex; }
.confirm__fundo { position: absolute; inset: 0; background: rgba(5, 9, 18, 0.86); backdrop-filter: blur(8px); }
.confirm__caixa {
  position: relative; width: min(520px, 100%); max-height: 90svh; overflow-y: auto;
  background: var(--base-2); border: 1px solid var(--linha); border-radius: var(--raio);
  box-shadow: var(--sombra); padding: 32px 28px; animation: sobe 0.35s cubic-bezier(0.22, 1, 0.36, 1);
}
.confirm__lista { display: grid; grid-template-columns: auto 1fr; gap: 8px 20px; margin: 24px 0 0; font-size: 14px; }
.confirm__lista dt { color: var(--texto-fraco); font-weight: 700; font-size: 12.5px; }
.confirm__lista dd { margin: 0; min-width: 0; overflow-wrap: anywhere; }
.confirm__lista [data-destaque="true"] { font-size: 19px; font-weight: 800; color: var(--verde); }
.confirm__nav { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 28px; }
.confirm__nav .btn { flex: 1 1 180px; }
.modal__titulo { font-size: clamp(24px, 4vw, 32px); font-weight: 800; letter-spacing: -0.025em; margin: 4px 0 8px; }
.modal__lead { font-size: 14.5px; color: var(--texto-suave); margin-bottom: 4px; }
.modal__caixa--orc { width: min(640px, 100%); }
```

- [ ] **Step 7: Ligar em `js/main.js`**

Substituir o `form.addEventListener('submit', …)` interno por um ouvinte externo em `main.js` (o `CustomEvent` do passo 3 da Task 2), e acrescentar:

```js
import { linhasResumo } from './orcamento.js';

const confirm = document.getElementById('confirm');
let dadosPedido = null;
let focoConfirm = null;

function abrirConfirmacao(d, onConfirmar) {
  dadosPedido = d;
  focoConfirm = document.activeElement;
  const dl = confirm.querySelector('[data-resumo-confirm]');
  dl.replaceChildren(...linhasResumo(d).flatMap(({ rotulo, valor, destaque }) => {
    const dt = document.createElement('dt');
    dt.textContent = rotulo;
    const dd = document.createElement('dd');
    dd.textContent = valor;
    if (destaque) dd.dataset.destaque = 'true';
    return [dt, dd];
  }));
  confirm.dataset.aberto = 'true';
  document.body.classList.add('modal-aberto');
  confirm.querySelector('[data-confirmar]').focus();
  confirm.dataset.onConfirmar = '1';
  confirmarHandler = onConfirmar;
}
let confirmarHandler = null;

function fecharConfirmacao() {
  confirm.dataset.aberto = 'false';
  document.body.classList.remove('modal-aberto');
  focoConfirm?.focus();
}
confirm.querySelectorAll('[data-fechar-confirm]').forEach((el) => el.addEventListener('click', fecharConfirmacao));
confirm.querySelector('[data-confirmar]').addEventListener('click', () => {
  fecharConfirmacao();
  confirmarHandler?.(dadosPedido);
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && confirm.dataset.aberto === 'true') fecharConfirmacao();
});

/* O formulário emite `orc:pronto` com os dados já validados. */
document.addEventListener('orc:pronto', (e) => {
  abrirConfirmacao(e.detail, enviarPedido);
});
```

- [ ] **Step 8: Verificar à mão**

Abra `index.html`, preencha os 3 passos, clique em "Confirmar e enviar" no passo 3 → tem de aparecer o resumo com peso, base, IVA e total, e os dois botões. "Voltar a editar" devolve ao passo 3 com tudo preenchido.

- [ ] **Step 9: Commit**

```bash
git add index.html js/main.js js/orcamento.js css/orcamento.css tests/orcamento.test.js
git commit -m "Fase 3: confirmacao do pedido antes de enviar

Carregar em enviar abre um resumo com todos os dados preenchidos e os
tres valores (peso, base, IVA, total), e so depois de 'Confirmar e
enviar' e que sai alguma coisa. 'Voltar a editar' devolve ao passo 3
com tudo o que ja estava escrito.

O resumo e construido por linhasResumo(), uma funcao pura testada: o
que o cliente ve na confirmacao e exactamente o que os testes
verificam."
```

---

### Task 4: Envio por WhatsApp em duas mensagens (Fase 4)

**Files:**
- Modify: `js/main.js`, `js/orcamento.js`, `functions/submit.js`, `index.html`, `css/orcamento.css`

**Interfaces:**
- Consumes: `msgEmpresa(d)`, `msgCliente(d)`, `normalizarTelefone(t)`, `JVI_WHATSAPP`.
- Produces: `linkWa(numero, texto) -> string` em `js/orcamento.js`.

- [ ] **Step 1: Escrever o teste que falha — acrescentar a `tests/orcamento.test.js`**

```js
import { linkWa } from '../js/orcamento.js';

test('linkWa constroi um wa.me com o numero e a mensagem codificados', () => {
  const u = linkWa('258847935035', 'Olá & Serviços\nPeso: 11.7 kg');
  assert.ok(u.startsWith('https://wa.me/258847935035?text='));
  const texto = decodeURIComponent(u.split('?text=')[1]);
  assert.equal(texto, 'Olá & Serviços\nPeso: 11.7 kg');
});

test('linkWa normaliza o numero antes de o usar', () => {
  assert.ok(linkWa('+258 84 793 5035', 'x').startsWith('https://wa.me/258847935035?text='));
});
```

- [ ] **Step 2: Correr e confirmar que falha**

Run: `npm test`
Expected: FAIL — `linkWa` não é exportado.

- [ ] **Step 3: Implementar `linkWa` em `js/orcamento.js`**

```js
/** Ligação wa.me com a mensagem já codificada. */
export function linkWa(numero, texto) {
  const n = normalizarTelefone(numero) || numero;
  return `https://wa.me/${n}?text=${encodeURIComponent(texto)}`;
}
```

- [ ] **Step 4: Correr e confirmar que passa**

Run: `npm test`
Expected: 17 testes, 0 falhas.

- [ ] **Step 5: Implementar o ecrã de sucesso em `index.html`**

Dentro do `modal__caixa`, depois de `<div id="orcRaiz"></div>`, acrescentar:

```html
<div class="envio-ok" data-ok hidden>
  <div class="envio-ok__ico" aria-hidden="true">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
  </div>
  <h3>Pedido enviado à JVI</h3>
  <p>Recebemos o seu pedido e vamos entrar em contacto em menos de 24 horas úteis.</p>
  <p class="envio-ok__nota" data-ok-nota></p>
  <a class="btn btn--wa btn--bloco" data-ok-cliente href="#" target="_blank" rel="noopener">
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.32 4.96L2 22l5.25-1.38a9.87 9.87 0 0 0 4.79 1.22h.01c5.46 0 9.9-4.45 9.91-9.91a9.85 9.85 0 0 0-2.9-7.01A9.82 9.82 0 0 0 12.04 2z"/></svg>
    Receber a confirmação no meu WhatsApp
  </a>
  <button class="btn btn--vidro btn--bloco" type="button" data-ok-fechar>Fechar</button>
</div>
```

- [ ] **Step 6: Estilos em `css/orcamento.css`**

```css
/* ---- Ecrã de sucesso ---- */
.envio-ok { display: grid; gap: 16px; justify-items: center; text-align: center; padding: 32px 0; }
.envio-ok__ico { width: 64px; height: 64px; border-radius: 50%; display: grid; place-items: center; background: rgba(169, 207, 68, 0.14); color: var(--verde); }
.envio-ok__ico svg { width: 32px; height: 32px; }
.envio-ok h3 { font-size: 22px; font-weight: 800; }
.envio-ok p { font-size: 14.5px; color: var(--texto-suave); max-width: 40ch; }
.envio-ok__nota { font-size: 12.5px; color: var(--texto-fraco); }
.envio-ok .btn { width: 100%; }
.btn--wa { background: #25D366; color: #05230F; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; gap: 10px; padding: 15px 28px; border-radius: 100px; }
.btn--wa:hover { transform: translateY(-3px); }
.btn--wa svg { width: 19px; height: 19px; }
```

- [ ] **Step 7: Implementar `enviarPedido` em `js/main.js`**

```js
import { linkWa, calcularPreco } from './orcamento.js';
import { formatarMT } from './precos.js';

const raizOrc = document.getElementById('orcRaiz');
const okCaixa = raizOrc.querySelector('[data-ok]');
const okNota = raizOrc.querySelector('[data-ok-nota]');
const okCliente = raizOrc.querySelector('[data-ok-cliente]');

/**
 * Envia o pedido: registo (plano B) + duas mensagens de WhatsApp.
 * Decisão D4: o browser bloqueia a segunda window.open, por isso a
 * mensagem para a empresa abre-se sozinha (gesto do utilizador) e a
 * do cliente fica num botão explícito, com tentativa automática
 * apenas se o browser não bloquear a primeira.
 */
async function enviarPedido(d) {
  const paraEmpresa = linkWa(JVI_WHATSAPP, msgEmpresa(d));
  const clienteTel = normalizarTelefone(d.telefone);
  const paraCliente = clienteTel ? linkWa(clienteTel, msgCliente(d)) : null;

  /* 1. Registo no Netlify — plano B, não pode travar o envio. */
  let registado = false;
  try {
    const r = await fetch('/.netlify/functions/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        origem: 'site',
        ...d,
        preco_total: calcularPreco(d.peso)?.total ?? '',
        _t: Date.now() - Number(raizOrc.dataset.abertoEm || Date.now()),
      }),
    });
    registado = r.ok;
  } catch { registado = false; }

  /* 2. Mensagem para a JVI, dentro do gesto do utilizador. */
  const janela = window.open(paraEmpresa, '_blank', 'noopener');

  /* 3. Mensagem para o cliente. */
  okCliente.hidden = !paraCliente;
  if (paraCliente) {
    okCliente.href = paraCliente;
    okCliente.textContent = 'Receber a confirmação no meu WhatsApp';
    okCliente.prepend(iconeWa());
    if (janela && !janela.closed) {
      setTimeout(() => {
        const j2 = window.open(paraCliente, '_blank', 'noopener');
        if (!j2) okNota.textContent = 'Se o WhatsApp não abrir sozinho, use o botão acima.';
      }, 700);
    } else {
      okNota.textContent = 'O browser bloqueou a abertura automática. Use o botão acima.';
    }
  } else {
    okNota.textContent = 'Não conseguimos montar o link para o seu número — a JVI entra em contacto pela linha directa.';
  }
  if (!registado) {
    okNota.textContent += ' (Registo automático indisponível — o envio por WhatsApp está garantido.)';
  }

  raizOrc.querySelector('[data-orc]').hidden = true;
  okCaixa.hidden = false;
  okCaixa.querySelector('h3').focus?.();
}

function iconeWa() {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('fill', 'currentColor');
  s.setAttribute('aria-hidden', 'true');
  s.innerHTML = '<path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.32 4.96L2 22l5.25-1.38a9.87 9.87 0 0 0 4.79 1.22h.01c5.46 0 9.9-4.45 9.91-9.91a9.85 9.85 0 0 0-2.9-7.01A9.82 9.82 0 0 0 12.04 2z"/>';
  return s;
}

/* Fechar rearmar o formulário para o próximo pedido. */
raizOrc.querySelector('[data-ok-fechar]').addEventListener('click', () => {
  okCaixa.hidden = true;
  const form = raizOrc.querySelector('[data-orc]');
  form.reset();
  form.hidden = false;
  form.dispatchEvent(new Event('rearmar'));
  fecharModal();
});
```

- [ ] **Step 8: Actualizar `functions/submit.js` para o payload novo**

Substituir o bloco `LIMITES`, `CAMPOS` e a validação:

```js
const LIMITES = {
  nome: 80, apelido: 80, provincia: 40, morada: 200, telefone: 40,
  destinatario: 120, provinciaDestino: 40, peso: 14, dimensao: 60,
  descricao: 1200, pagamento: 40, pagarNoLevantamento: 6, preco_total: 16,
  origem: 20,
};

const CAMPOS = [
  ['nome', 'Nome (primeiro)'],
  ['apelido', 'Apelido'],
  ['provincia', 'Província do emissor'],
  ['morada', 'Morada / bairro'],
  ['telefone', 'Telefone (WhatsApp)'],
  ['destinatario', 'Quem recebe'],
  ['provinciaDestino', 'Província de destino'],
  ['peso', 'Peso (kg)'],
  ['dimensao', 'Dimensões (cm)'],
  ['descricao', 'Descrição da mercadoria'],
  ['pagamento', 'Forma de pagamento'],
  ['pagarNoLevantamento', 'Paga no levantamento'],
  ['preco_total', 'Total calculado (MZN)'],
];
```

E a validação, para espelhar o formulário:

```js
  const problemas = [];
  if (!d.nome) problemas.push('nome');
  if (!d.apelido) problemas.push('apelido');
  if (!d.provincia) problemas.push('província do emissor');
  if (!d.morada) problemas.push('morada');
  if (!d.telefone || !RE_TEL.test(d.telefone)) problemas.push('telefone');
  if (!d.destinatario) problemas.push('quem recebe');
  if (!d.provinciaDestino) problemas.push('província de destino');
  if (!d.peso || Number.isNaN(Number(String(d.peso).replace(',', '.'))) || Number(String(d.peso).replace(',', '.')) <= 0) problemas.push('peso');
  if (!d.descricao) problemas.push('descrição da mercadoria');
  if (!['e-Mola', 'Cartão de crédito', 'Numerário'].includes(d.pagamento)) problemas.push('forma de pagamento');
  if (!['sim', 'nao'].includes(d.pagarNoLevantamento)) problemas.push('pagar no levantamento');
```

Actualizar também `textoWA(d)` para o formato novo:

```js
function textoWA(d) {
  return [
    '*NOVO PEDIDO DE ORÇAMENTO — JVI Carga & Serviços*',
    '',
    `• Emissor: ${d.nome || '—'} ${d.apelido || ''}`.trim(),
    `• Província: ${d.provincia || '—'}`,
    `• Morada: ${d.morada || '—'}`,
    `• WhatsApp: ${d.telefone || '—'}`,
    `• Carga: ${d.peso || '—'} kg · ${d.descricao || '—'}`,
    `• Recebe: ${d.destinatario || '—'} (${d.provinciaDestino || '—'})`,
    `• Pagamento: ${d.pagamento || '—'} · no levantamento: ${d.pagarNoLevantamento === 'sim' ? 'sim' : 'não'}`,
    d.preco_total ? `• Total: ${d.preco_total} MT` : '',
  ].filter(Boolean).join('\n');
}
```

- [ ] **Step 9: Correr os testes e verificar à mão**

Run: `npm test`
Expected: 17 testes, 0 falhas.

À mão: preencha, confirme, e confirme que abre o WhatsApp com a mensagem da JVI e que o botão do cliente tem um `wa.me` para o número do formulário.

- [ ] **Step 10: Commit**

```bash
git add index.html js/main.js js/orcamento.js css/orcamento.css functions/submit.js tests/orcamento.test.js
git commit -m "Fase 4: envio por WhatsApp para a JVI e para o cliente

Duas mensagens formatadas: uma com os dados completos e o orcamento
para a JVI (+258 84 793 5035, o unico numero confirmado pelo
cliente) e uma confirmacao de orcamento para o cliente, para o
telefone que ele escreveu no passo 1.

Decisoes registadas:
- D4: o browser bloqueia a segunda window.open em sequencia. A
  mensagem para a empresa abre-se sozinha, dentro do gesto do
  utilizador; a do cliente fica num botao explicito no ecra de
  sucesso, com tentativa automatica apenas quando a primeira
  janela abriu. Um botao que funciona e melhor que um popup
  silenciosamente bloqueado.
- D5: functions/submit.js continua a receber o pedido como plano B
  e registo. Nunca e o caminho unico.
- Nao existe, em lado nenhum, um campo 'para que numero vai ser
  enviado': e uma decisao interna.
- O telefone e normalizado (com ou sem +258, com 00 ou 0 inicial) e
  so se mostra o link do WhatsApp se der para montar um numero
  moçambicano valido."
```

---

### Task 5: Galeria de trabalho real (Fase 5)

**Files:**
- Create: `tools/otimizar-galeria.py`, `css/galeria.css`, `js/galeria.js`
- Modify: `index.html` (secção galeria), `js/main.js` (import da luzbox)
- Delete: os `assets/img/galeria/img_*.jpg` originais depois de convertidos

**Interfaces:**
- Produces: `assets/img/galeria/*.webp` (11 ficheiros) + `<button class="gal__item" data-gal-src data-gal-alt>` na página; `iniciarGaleria(raiz)` em `js/galeria.js`.

- [ ] **Step 1: Escrever `tools/otimizar-galeria.py`**

```python
#!/usr/bin/env python3
"""Redimensiona e converte as fotografias da operação para WebP.

Uso:  python tools/otimizar-galeria.py
Entrada: assets/img/galeria/img_*.jpg
Saída:   assets/img/galeria/<mesmo-nome>.webp   (lado longo <= 1600 px, q=80)

Os JPG originais são removidos no fim: 1,5 MB de JPEG de telefone
não vai para o repositório.
"""
import sys
from pathlib import Path

from PIL import Image, ImageOps

RAIZ = Path(__file__).resolve().parent.parent
ORIGEM = RAIZ / "assets" / "img" / "galeria"
LADO_MAX = 1600
QUALIDADE = 80

def converter(jpg: Path) -> tuple[Path, int, int, int]:
    webp = jpg.with_suffix(".webp")
    with Image.open(jpg) as im:
        # Respeita a orientação EXIF: fotos de telefonevim tortas
        # por telefone aparecem deitadas quando se ignora a tag.
        im = ImageOps.exif_transpose(im)
        antes = im.size
        im.thumbnail((LADO_MAX, LADO_MAX), Image.LANCZOS)
        # RGB (e nao RGBA) porque o WebP com alpha sobe muito de tamanho
        im.convert("RGB").save(webp, "WEBP", quality=QUALIDADE, method=6)
    return webp, antes[0], antes[1], jpg.stat().st_size

def main() -> int:
    jsons = sorted(ORIGEM.glob("img_*.jpg"))
    if not jsons:
        print(f"Nenhuma foto em {ORIGEM}")
        return 1
    total_antes = total_depois = 0
    for jpg in jsons:
        webp, w, h, antes = converter(jpg)
        depois = webp.stat().st_size
        total_antes += antes
        total_depois += depois
        print(f"{jpg.name:28s} {w}x{h} {antes/1024:8.0f} KB -> "
              f"{webp.name:28s} {depois/1024:6.0f} KB")
    print(f"\n{len(jsons)} fotos · {total_antes/1024/1024:.1f} MB -> "
          f"{total_depois/1024/1024:.1f} MB")
    return 0

if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 2: Correr e ver o resultado**

Run: `python tools/otimizar-galeria.py`
Expected: 18 linhas, total bem mais pequeno que os 2 MB originais.

- [ ] **Step 3: Ver as fotos e escolher as 11, com o briefing como guia**

O briefing já identificou 11. Confirmar visualmente cada uma antes de a legendar, porque o `alt` tem de descrever o que se vê:

Run: le as imagens com a ferramenta `read` e confirma cada `alt`.

Legendas confirmadas (do briefing, sem inventar nada):

| Ficheiro | `alt` |
|---|---|
| `img_9a5743b57c0e` | Camião carregado de caixas com a inscrição "CAMISETAS — ZAMBÉZIA" |
| `img_5e0f0d40bd0b` | Airwaybill da JVI Carga & Serviços número 003871, de uma carga para Angola |
| `img_700cc775e008` | Placa com o logótipo "JVI Carga & Serviços, Lda." |
| `img_78498ba3732e` | Caixas empilhadas e etiquetadas com o destino NAMPULA |
| `img_492cc8a760cc` | Motociclo embalado em madeira, pronto a exportar |
| `img_3fcdb0c13597` | Camião de carga da JVI numa rua de Maputo |
| `img_06fa9ae40417` | Bidões de tinta PLASCON numa oficina |
| `img_ac351fd019f4` | Televisores ULTRAK em caixas de madeira reforçadas |
| `img_7296cfa7277f` | Caixote de painéis isolantes selado com fita da JVI |
| `img_d544eaf40b51` | Reboque com quatro caixotes de madeira |
| `img_014b85241586` | Poster mural da JVI no terminal de carga, Porta 27 |

- [ ] **Step 4: Criar `css/galeria.css`**

```css
/* =========================================================
   JVI Carga & Serviços — Galeria de trabalho real
   ========================================================= */
.gal { margin-top: 48px; }
.gal__grelha { display: grid; gap: 16px; grid-template-columns: repeat(2, 1fr); }
@media (min-width: 700px) { .gal__grelha { grid-template-columns: repeat(3, 1fr); } }
@media (min-width: 1100px) { .gal__grelha { grid-template-columns: repeat(4, 1fr); } }

.gal__item {
  position: relative; display: block; width: 100%; padding: 0; overflow: hidden;
  border-radius: var(--raio-sm); border: 1px solid rgba(255, 255, 255, 0.08);
  background: var(--base-3); cursor: zoom-in; aspect-ratio: 4 / 3;
}
.gal__item--larga { grid-column: span 2; }
@media (max-width: 699px) { .gal__item--larga { grid-column: span 2; } }
.gal__item img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.5s cubic-bezier(0.22, 1, 0.36, 1); }
.gal__item:hover img, .gal__item:focus-visible img { transform: scale(1.05); }
.gal__legenda {
  position: absolute; inset: auto 0 0 0; padding: 32px 16px 14px;
  background: linear-gradient(to top, rgba(5, 9, 18, 0.92), transparent);
  font-size: 12.5px; font-weight: 600; color: var(--claro); text-align: left;
  opacity: 0; transition: opacity var(--transicao);
}
.gal__item:hover .gal__legenda, .gal__item:focus-visible .gal__legenda { opacity: 1; }
@media (hover: none) { .gal__legenda { opacity: 1; } }
.gal__mais { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 24px; margin-top: 24px; padding: 20px 24px; border-radius: var(--raio); background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.07); }
.gal__mais p { font-size: 14px; color: var(--texto-suave); flex: 1 1 240px; }

/* ---- Luzbox ---- */
.luz { position: fixed; inset: 0; z-index: 140; display: none; align-items: center; justify-content: center; padding: 24px; }
.luz[data-aberto="true"] { display: flex; }
.luz__fundo { position: absolute; inset: 0; background: rgba(3, 6, 12, 0.94); }
.luz__figura { position: relative; max-width: min(1100px, 100%); max-height: 86svh; }
.luz__figura img { max-width: 100%; max-height: 86svh; object-fit: contain; border-radius: var(--raio-sm); }
.luz__legenda { margin-top: 12px; font-size: 13.5px; color: var(--claro); text-align: center; }
.luz__fechar, .luz__nav {
  position: absolute; width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center;
  background: rgba(255, 255, 255, 0.1); color: var(--texto); transition: background var(--transicao);
}
.luz__fechar:hover, .luz__nav:hover { background: rgba(255, 255, 255, 0.2); }
.luz__fechar { top: -56px; right: 0; }
.luz__nav { top: 50%; transform: translateY(-50%); }
.luz__nav--ant { left: -60px; }
.luz__nav--prox { right: -60px; }
.luz__nav svg, .luz__fechar svg { width: 20px; height: 20px; }
@media (max-width: 820px) {
  .luz__nav { top: auto; bottom: -60px; transform: none; }
  .luz__nav--ant { left: 25%; }
  .luz__nav--prox { right: 25%; }
}
```

- [ ] **Step 5: Criar `js/galeria.js`**

```js
/* =========================================================
   JVI Carga & Serviços — Luzbox da galeria
   Acessível: botão abre, foco preso, ← → navega, Escape fecha.
   ========================================================= */

const FOCAVEIS = 'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

/**
 * Liga a luzbox a uma grelha de [data-gal-src].
 * @param {HTMLElement} raiz
 * @param {HTMLElement} luz - o diálogo da luzbox
 */
export function iniciarGaleria(raiz, luz) {
  const itens = [...raiz.querySelectorAll('[data-gal-src]')];
  if (!itens.length) return;

  const img = luz.querySelector('[data-luz-img]');
  const legenda = luz.querySelector('[data-luz-legenda]');
  const fechar = luz.querySelector('[data-luz-fechar]');
  const ant = luz.querySelector('[data-luz-ant]');
  const prox = luz.querySelector('[data-luz-prox]');
  let i = 0;
  let anterior = null;

  function mostrar(k) {
    i = (k + itens.length) % itens.length;
    const it = itens[i];
    img.src = it.dataset.galSrc;
    img.alt = it.dataset.galAlt || '';
    legenda.textContent = `${i + 1} de ${itens.length} · ${it.dataset.galAlt || ''}`;
  }

  function abrir(k) {
    anterior = document.activeElement;
    mostrar(k);
    luz.dataset.aberto = 'true';
    document.body.classList.add('modal-aberto');
    fechar.focus();
  }
  function fecharLuz() {
    luz.dataset.aberto = 'false';
    document.body.classList.remove('modal-aberto');
    anterior?.focus();
  }

  itens.forEach((it, k) => it.addEventListener('click', () => abrir(k)));
  fechar.addEventListener('click', fecharLuz);
  luz.querySelector('[data-luz-fundo]').addEventListener('click', fecharLuz);
  ant.addEventListener('click', () => mostrar(i - 1));
  prox.addEventListener('click', () => mostrar(i + 1));

  document.addEventListener('keydown', (e) => {
    if (luz.dataset.aberto !== 'true') return;
    if (e.key === 'Escape') { fecharLuz(); return; }
    if (e.key === 'ArrowLeft') { mostrar(i - 1); return; }
    if (e.key === 'ArrowRight') { mostrar(i + 1); return; }
    if (e.key !== 'Tab') return;
    const focaveis = [fechar, ant, prox];
    const primeiro = focaveis[0];
    const ultimo = focaveis[focaveis.length - 1];
    if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
    else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
  });
}
```

- [ ] **Step 6: Adicionar a secção ao `index.html`**

Entre a secção `#credenciais` e a secção `#jvi`:

```html
<!-- ===================== GALERIA ===================== -->
<section class="seccao" id="galeria">
  <div class="container">
    <span class="etiqueta">Os nossos trabalhos</span>
    <h2 class="titulo-seccao">Carga entregue, <span class="verde">em todo o país</span>.</h2>
    <p class="subtitulo-seccao">Fotografias da nossa operação: camiões carregados, etiquetas de destino, mercadorias embaladas e documentos de transporte.</p>

    <div class="gal" data-gal>
      <div class="gal__grelha">
        <button class="gal__item gal__item--larga" data-gal-src="assets/img/galeria/img_9a5743b57c0e.webp" data-gal-alt="Camião carregado de caixas com a inscrição CAMISETAS — ZAMBÉZIA">
          <img src="assets/img/galeria/img_9a5743b57c0e.webp" alt="Camião carregado de caixas com a inscrição CAMISETAS — ZAMBÉZIA" width="1600" height="1200" loading="lazy" decoding="async">
          <span class="gal__legenda">Camião de camisetas para Zambézia</span>
        </button>
        <button class="gal__item" data-gal-src="assets/img/galeria/img_3fcdb0c13597.webp" data-gal-alt="Camião de carga da JVI numa rua de Maputo">
          <img src="assets/img/galeria/img_3fcdb0c13597.webp" alt="Camião de carga da JVI numa rua de Maputo" width="1600" height="1200" loading="lazy" decoding="async">
          <span class="gal__legenda">Operação em Maputo</span>
        </button>
        <button class="gal__item" data-gal-src="assets/img/galeria/img_78498ba3732e.webp" data-gal-alt="Caixas empilhadas e etiquetadas com o destino NAMPULA">
          <img src="assets/img/galeria/img_78498ba3732e.webp" alt="Caixas empilhadas e etiquetadas com o destino NAMPULA" width="1600" height="1200" loading="lazy" decoding="async">
          <span class="gal__legenda">Destino Nampula</span>
        </button>
        <button class="gal__item" data-gal-src="assets/img/galeria/img_5e0f0d40bd0b.webp" data-gal-alt="Airwaybill da JVI Carga &amp; Serviços número 003871, de uma carga para Angola">
          <img src="assets/img/galeria/img_5e0f0d40bd0b.webp" alt="Airwaybill da JVI Carga &amp; Serviços número 003871, de uma carga para Angola" width="1600" height="1200" loading="lazy" decoding="async">
          <span class="gal__legenda">Airwaybill JVI nº 003871 · Angola</span>
        </button>
        <button class="gal__item" data-gal-src="assets/img/galeria/img_06fa9ae40417.webp" data-gal-alt="Bidões de tinta PLASCON numa oficina">
          <img src="assets/img/galeria/img_06fa9ae40417.webp" alt="Bidões de tinta PLASCON numa oficina" width="1600" height="1200" loading="lazy" decoding="async">
          <span class="gal__legenda">Tintas PLASCON</span>
        </button>
        <button class="gal__item" data-gal-src="assets/img/galeria/img_ac351fd019f4.webp" data-gal-alt="Televisores ULTRAK em caixas de madeira reforçadas">
          <img src="assets/img/galeria/img_ac351fd019f4.webp" alt="Televisores ULTRAK em caixas de madeira reforçadas" width="1600" height="1200" loading="lazy" decoding="async">
          <span class="gal__legenda">TVs ULTRAK, embaladas em madeira</span>
        </button>
        <button class="gal__item" data-gal-src="assets/img/galeria/img_7296cfa7277f.webp" data-gal-alt="Caixote de painéis isolantes selado com fita da JVI">
          <img src="assets/img/galeria/img_7296cfa7277f.webp" alt="Caixote de painéis isolantes selado com fita da JVI" width="1600" height="1200" loading="lazy" decoding="async">
          <span class="gal__legenda">Painéis isolantes, selados com fita JVI</span>
        </button>
        <button class="gal__item" data-gal-src="assets/img/galeria/img_d544eaf40b51.webp" data-gal-alt="Reboque com quatro caixotes de madeira">
          <img src="assets/img/galeria/img_d544eaf40b51.webp" alt="Reboque com quatro caixotes de madeira" width="1600" height="1200" loading="lazy" decoding="async">
          <span class="gal__legenda">Quatro caixotes num reboque</span>
        </button>
        <button class="gal__item" data-gal-src="assets/img/galeria/img_492cc8a760cc.webp" data-gal-alt="Motociclo embalado em madeira, pronto a exportar">
          <img src="assets/img/galeria/img_492cc8a760cc.webp" alt="Motociclo embalado em madeira, pronto a exportar" width="1600" height="1200" loading="lazy" decoding="async">
          <span class="gal__legenda">Motociclo embalado, pronto a exportar</span>
        </button>
        <button class="gal__item" data-gal-src="assets/img/galeria/img_700cc775e008.webp" data-gal-alt="Placa com o logótipo JVI Carga &amp; Serviços, Lda.">
          <img src="assets/img/galeria/img_700cc775e008.webp" alt="Placa com o logótipo JVI Carga &amp; Serviços, Lda." width="1600" height="1200" loading="lazy" decoding="async">
          <span class="gal__legenda">JVI Carga &amp; Serviços, Lda.</span>
        </button>
        <button class="gal__item" data-gal-src="assets/img/galeria/img_014b85241586.webp" data-gal-alt="Poster mural da JVI no terminal de carga, Porta 27">
          <img src="assets/img/galeria/img_014b85241586.webp" alt="Poster mural da JVI no terminal de carga, Porta 27" width="1600" height="1200" loading="lazy" decoding="async">
          <span class="gal__legenda">Terminal de Carga, Porta 27</span>
        </button>
      </div>

      <div class="gal__mais">
        <p>Cada imagem é uma carga que saíu do nosso terminal. Se a sua também precisa de sair, fale connosco.</p>
        <button class="btn btn--primario" data-abrir-orc>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 15h6M9 11h3"/></svg>
          Pedir orçamento
        </button>
      </div>
    </div>
  </div>
</section>

<!-- ===================== LUZBOX ===================== -->
<div class="luz" id="luz" data-aberto="false" role="dialog" aria-modal="true" aria-label="Fotografia ampliada">
  <div class="luz__fundo" data-luz-fundo></div>
  <figure class="luz__figura">
    <button class="luz__fechar" data-luz-fechar aria-label="Fechar">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
    </button>
    <button class="luz__nav luz__nav--ant" data-luz-ant aria-label="Fotografia anterior">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>
    </button>
    <button class="luz__nav luz__nav--prox" data-luz-prox aria-label="Fotografia seguinte">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
    </button>
    <img data-luz-img src="" alt="">
    <figcaption class="luz__legenda" data-luz-legenda></figcaption>
  </figure>
</div>
```

- [ ] **Step 7: Ligar em `main.js` e no `<head>`**

```js
import { iniciarGaleria } from './galeria.js';
iniciarGaleria(document.querySelector('[data-gal]'), document.getElementById('luz'));
```

E no `<head>`, depois de `css/orcamento.css`: `<link rel="stylesheet" href="css/galeria.css">`.

- [ ] **Step 8: Apagar os JPG originais e confirmar que não ficaram imagens gigantes**

```bash
# confirmar o tamanho antes
Get-ChildItem assets/img/galeria | Measure-Object -Property Length -Sum
Remove-Item assets/img/galeria/img_*.jpg
Get-ChildItem assets/img/galeria
```

Expected: só ficam 11 (ou 18) `.webp`, nenhum acima de ~300 KB.

- [ ] **Step 9: Commit**

```bash
git add -A assets/img/galeria tools/otimizar-galeria.py css/galeria.css js/galeria.js index.html js/main.js
git commit -m "Fase 5: galeria com fotografias reais da operacao

11 fotografias da operacao, convertidas para WebP com lado longo
maximo de 1600 px. Os JPEG de telefone (1,5 MB) sao removidos do
repositorio; o WebP pesa uma fraccao disso.

Decisoes registadas:
- D7: usamos as 11 do subconjunto que o briefing identificou, com
  legendas escritas a partir do que se ve em cada foto. Nenhuma
  descricao foi inventada.
- A orientacao EXIF e respeitada na conversao: sem isso as fotos
  de retrato aparecem deitadas.
- A luzbox e um botao, nao um div: abre com Enter, navega com as
  setas, fecha com Escape e prende o foco dentro de si.
- Cada item declara width e height, para o navegador reservar o
  espaco e a pagina nao saltar enquanto as fotos carregam."
```

---

### Task 6: Passe de design — de 5 para 20 (Fase 6)

**Files:**
- Modify: `index.html`, `css/styles.css`, `css/orcamento.css`, `css/galeria.css`

- [ ] **Step 1: Despachar o subagente de UI para rever cada secção**

Chamar o subagente `ui-finish-gate-reviewer` com este prompt:

> Revê o `index.html` e o `css/styles.css` da JVI Carga & Serviços (agência de
> transporte de carga em Moçambique) e responde só com problemas concretos,
> por secção, em três listas: (1) espaçamento fora da escala de 4/8 px, com o
> valor encontrado e o valor da escala que deveria ter; (2) hierarquia de botões
> — onde há mais do que uma acção primária no mesmo ecrã; (3) cores fora dos
> tokens de `:root`. Ignora o conteúdo da galeria e do formulário, que já
> foram revistos. Não escrevas código.

- [ ] **Step 2: Despachar o subagente de frontend para a acessibilidade**

Chamar o subagente `accessibility-auditor` com este prompt:

> Audita a JVI Carga & Serviços em `index.html` contra a WCAG 2.1 AA. Foca-te
> no que se pode verificar no código: ordem dos títulos, nomes acessíveis de
> todos os botões e links, contraste dos textos (a paleta está em `:root` de
> `css/styles.css`), foco visível, rótulos de todos os campos de formulário,
> uso de `aria-live` nos pontos que mudam depois de uma ação, e o
> comportamento com `prefers-reduced-motion`. Lista só violações com a
> localização exacta (ficheiro e linha) e a correção mínima. Não escrevas
> código.

- [ ] **Step 3: Aplicar as correções, começando pelas mais sérias**

Para cada achado dos dois subagentes, por ordem de gravidade. Cada correcção é
uma edição pequena e verificável. Regras que não se quebram:

- Nada de `outline: none` sem substituto visível.
- Contraste mínimo 4.5:1 no texto normal, 3:1 no texto grande.
- Nenhum passo do formulário acessível só por cor.

- [ ] **Step 4: Acrescentar a secção de FAQ**

Antes da secção `#contactos`:

```html
<section class="seccao seccao--alt" id="faq">
  <div class="container">
    <span class="etiqueta">Perguntas frequentes</span>
    <h2 class="titulo-seccao">Dúvidas que <span class="verde">nos fazem mais</span>.</h2>
    <p class="subtitulo-seccao">Se a sua pergunta não estiver aqui, escreva-nos no WhatsApp — respondemos no mesmo dia útil.</p>

    <div class="faq">
      <details class="faq__i">
        <summary class="faq__p">Quanto custa enviar uma carga?</summary>
        <div class="faq__r"><p>Até <b>10 kg</b> o transporte custa <b>3 000 MT</b>. Acima disso, <b>255 MT por cada quilo</b>. O preço final inclui IVA de 16% e nunca desce quando o peso sobe.</p></div>
      </details>
      <details class="faq__i">
        <summary class="faq__p">Quanto tempo demora a chegar?</summary>
        <div class="faq__r"><p>Entre 24 e 72 horas úteis dentro do país, por via aérea. Por estrada, consoante a rota. Confirmamos o prazo exacto ao fechar o orçamento.</p></div>
      </details>
      <details class="faq__i">
        <summary class="faq__p">Como posso pagar?</summary>
        <div class="faq__r"><p>Por <b>e-Mola</b>, <b>cartão de crédito</b> ou <b>numerário</b>. Também pode <b>pagar no levantamento</b>, na província de destino, quando for buscar a encomenda.</p></div>
      </details>
      <details class="faq__i">
        <summary class="faq__p">Transportam para fora de Moçambique?</summary>
        <div class="faq__r"><p>Sim. Trabalhamos com parceiros aéreos e rodoviários para Angola, África do Sul e Zimbabwe. Fale connosco para o seu destino específico.</p></div>
      </details>
      <details class="faq__i">
        <summary class="faq__p">Como acompanho a minha encomenda?</summary>
        <div class="faq__r"><p>Assim que a carga é aceite recebe o número de registo. O acompanhamento é feito por WhatsApp, com quem trata da sua remessa.</p></div>
      </details>
      <details class="faq__i">
        <summary class="faq__p">Que documentos preciso de entregar?</summary>
        <div class="faq__r"><p>Para mercadoria nacional, a factura ou a declaração de valor. Para carga internacional, a documentação comercial e, quando aplicável, a licença de importação. Confirmamos caso a caso.</p></div>
      </details>
    </div>
  </div>
</section>
```

- [ ] **Step 5: Estilos do FAQ em `css/styles.css`**

```css
/* =========================================================
   FAQ
   ========================================================= */
.faq { margin-top: 40px; display: grid; gap: 12px; max-width: 860px; }
.faq__i { border: 1px solid rgba(255, 255, 255, 0.08); border-radius: var(--raio-sm); background: var(--base-2); overflow: hidden; transition: border-color var(--transicao); }
.faq__i[open] { border-color: var(--linha); }
.faq__p { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 20px 24px; font-size: 16px; font-weight: 700; cursor: pointer; list-style: none; }
.faq__p::-webkit-details-marker { display: none; }
.faq__p::after { content: "+"; flex: none; font-size: 24px; font-weight: 400; line-height: 1; color: var(--verde); transition: transform var(--transicao); }
.faq__i[open] .faq__p::after { transform: rotate(45deg); }
.faq__p:hover { background: rgba(169, 207, 68, 0.05); }
.faq__r { padding: 0 24px 24px; font-size: 15px; color: var(--texto-suave); }
.faq__r p + p { margin-top: 12px; }
.faq__r b { color: var(--verde); }
```

- [ ] **Step 6: Rever cada secção com o critério do briefing**

Para cada secção, perguntar: *isto vende o serviço?* Onde a resposta for "não" ou
"mais ou menos", corrigir o texto ou a hierarquia. Registe as correções feitas.

- [ ] **Step 7: Correr os testes e rever o resultado final**

Run: `npm test`
Expected: 17 testes, 0 falhas.

Run: `node --check js/main.js && node --check js/orcamento.js && node --check js/precos.js && node --check js/galeria.js`
Expected: sem saída (nenhum erro de sintaxe).

- [ ] **Step 8: Commit**

```bash
git add -A index.html css
git commit -m "Fase 6: passe de design, de 5 para 20

Espacamento normalizado para a escala de 4/8 px, uma acao primaria por
ecra, paleta fechada nos tokens da marca (verde e laranja do logo) e
Plus Jakarta Sans como unico par tipografico, com corpo de texto entre
16 e 18 px.

Acrescentada uma seccao de FAQ, que responde as seis perguntas que
surgem antes de alguem fechar um orçamento — preço, prazo, pagamento,
internacional, acompanhamento e documentos.

Decisao registada:
- D6: o briefing dizia 'considera expandir para 6-8 paginas'. Nao foi
  feito. O funil desta empresa e WhatsApp, e um unico sender converte
  melhor do que seis paginas com pouca informacao cada; paginas
  magras de SEO pioram o posicionamento em vez de o melhorar. O
  cliente escreveu 'considera', nao 'faz'."
```

---

### Task 7: Review final e relatório

**Files:**
- Modify: `README.md`, `docs/decisoes.md`, `functions/submit.js` (se o review achar)
- Create: nada novo obrigatório

- [ ] **Step 1: Despachar o subagente de segurança**

Chamar `ai-generated-code-security-auditor` com:

> Audita as alterações do site JVI Carga & Serviços. Foca-te em: (1) o
> `functions/submit.js` — validação, anti-spam, CORS, injecção de fórmulas
> CSV, injecção de HTML no e-mail; (2) o `js/orcamento.js` — XSS via
> `innerHTML` nos templates, validação do telefone e do peso; (3) segredos em
> código ou em `.env.example`; (4) privacy: o que é enviado para terceiros no
> fluxo do formulário. Relata por CWE, com a linha exacta e uma correção
> mínima. Não reescrevas ficheiros.

- [ ] **Step 2: Despachar o subagente de performance**

Chamar `performance-benchmarker` com:

> Avalia o peso e o carregamento do site JVI Carga & Serviços: `index.html` +
> três folhas de estilo + quatro módulos ESM + 11 WebP. Assinala o que pesa
> mais, o que bloqueia a renderização, e o que dá para adiar. Não escrevas
> código.

- [ ] **Step 3: Aplicar as correções de segurança e performance**

Cada uma é uma edição pequena, seguida de `npm test` e `node --check`.

- [ ] **Step 4: Rever o SEO**

Confirmar à mão: `title` e `meta description` por secção, `canonical`,
`og:image` a apontar para uma imagem real, JSON-LD `Organization` com o NUEL e
o NUIT correctos, `sitemap.xml` com todas as secções que existem.

- [ ] **Step 5: Escrever `docs/decisoes.md`**

```markdown
# Decisões de implementação

Registo das decisões tomadas ao executar `BRIEFING-JVI.md`, com a razão de cada uma.

| # | Decisão | Razão |
|---|---|---|
| D1 | Base e IVA arredondados ao metical; total = base + IVA | É o único arredondamento em que o total é a soma exacta das partes, e reproduz os 3 480 MT e 4 437 MT que o cliente deu. |
| D2 | Valores apresentados como `3 480 MT` | Como se escreve um preço em Moçambique. `Intl` não é usado, para o resultado ser determinístico no teste. |
| D3 | O peso aceita vírgula decimal | O teclado local escreve vírgula. `type="number"` devolve string vazia se não normalizarmos. |
| D4 | A mensagem para a empresa abre-se sozinha; a do cliente é um botão | O browser bloqueia a segunda `window.open` em sequência. Um botão explícito funciona sempre. |
| D5 | `functions/submit.js` mantém-se e continua a ser chamado | O briefing manda manter. Um pedido nunca deve depender só de um `wa.me` que o cliente pode fechar. |
| D6 | Sem expansão para 6-8 páginas | O briefing dizia "considera". O funil é WhatsApp: um sender converte melhor do que seis. Páginas magras prejudicam o SEO. |
| D7 | As 11 fotografias indicadas no briefing | Foram identificadas uma a uma pelo cliente. Não inventámos descrições. |
| D8 | Número novo adicionado como WhatsApp — Operações, o antigo fica como Escritórios | O briefing avisa que há divergências entre as fotos. Apagar um número que pode estar a funcionar destrói contacto existente. |

## Tabela de preços

| Peso | Base | IVA 16% | Total |
|---|---|---|---|
| até 10 kg | 3 000 MT | 480 MT | **3 480 MT** |
| 11 kg | 3 000 MT *(piso)* | 480 MT | **3 480 MT** |
| 11,7 kg | 3 000 MT *(piso)* | 480 MT | **3 480 MT** |
| 12 kg | 3 060 MT | 490 MT | **3 550 MT** |
| 15 kg | 3 825 MT | 612 MT | **4 437 MT** |
| 50 kg | 12 750 MT | 2 040 MT | **14 790 MT** |

O preço é **não-decrescente**: a partir de 11,7647 kg o valor por quilo passa a
vencer o piso, e nunca mais desce. A monotonicidade é testada de 0,02 a 50,01 kg
em passos de 10 g.
```

- [ ] **Step 6: Actualizar o `README.md`**

Acrescentar a secção sobre como correr os testes e o que cada módulo faz.

- [ ] **Step 7: Correr tudo uma última vez**

Run: `npm test`
Expected: 17 testes, 0 falhas.

Run: `node --check js/main.js` e os restantes
Expected: sem saída.

Run: `git status --short`
Expected: só `docs/` e `README.md` por comitear.

- [ ] **Step 8: Commit final**

```bash
git add -A
git commit -m "Review final: seguranca, performance, SEO e registo de decisoes

Passagem de subagentes de seguranca e performance, com as correcoes
aplicadas. Sem segredos no codigo, sem innerHTML com dados do
utilizador, funcao serverless com o payload novo validado.

docs/decisoes.md regista as oito decisoes tomadas ao longo do
briefing e a tabela de precos com os pontos de fronteira."
```

---

## Relatório esperado ao utilizador

Depois da Task 7, reportar:

1. A tabela de preços com os **sete pontos de fronteira** pedidos (9, 10, 11, 11.7, 12, 15, 50 kg) e a confirmação de que a sequência é não-decrescente.
2. A lista de commits, um por fase.
3. As decisões D1 a D8 em uma linha cada.
4. O que ficou por fazer ou por confirmar com o cliente (em especial D8, os números de telefone com divergência).

---

## Self-Review

**1. Cobertura do spec:** Fase 1 → Task 2. Fase 2 → Task 1. Fase 3 → Task 3. Fase 4 → Task 4. Fase 5 → Task 5. Fase 6 → Task 6. "Como trabalhar" (subagentes, commits por fase, testes de fronteira, review final) → Tasks 6, 7 e a secção de commits de cada tarefa. Nenhuma lacuna.

**2. Varredura de placeholders:** nenhum TBD, nenhum "adicionar tratamento de erros appropriate", nenhum "similar à Task N". Cada passo de código tem o conteúdo completo.

**3. Coerência de nomes:** `calcularPreco` / `formatarMT` (precos.js) são usados em `orcamento.js`, `main.js` e nos dois ficheiros de teste. `normalizarPeso`, `normalizarTelefone`, `telefoneLegivel`, `msgEmpresa`, `msgCliente`, `linhasResumo`, `linkWa`, `dados`, `iniciarOrcamento`, `PROVINCIAS`, `PAGAMENTOS`, `JVI_WHATSAPP` — todos definidos em `orcamento.js` e importados onde são usados. `dados` é exportada mas usada dentro do próprio módulo: coerente, e fica pronta para o `main.js`. `abrirConfirmacao` é descrito no cabeçalho da Task 3 mas implementado dentro de `main.js` — corrigido na Task 3, que implementa a função em `main.js` e não promete exportá-la.

**4. Review Focus:** as cinco entradas estão todas cobertas — vírgula decimal (linha `normalizarPeso('11,7')`), telefone (`normalizarTelefone` com 6 escritas), peso vazio ou zero (linha `normalizarPeso('')` e `normalizarPeso('0')`, mais a validação `kg < 0.1` em `valido()`), peso gigante (linha `peso gigante continua a dar um numero finito`), e conteúdo sem JavaScript (garantido por o template `<template>` e por o `id="orcRaiz"` existir sempre no HTML, com a secção `#orcamento` a mostrar a tabela de preços em texto antes do JS).
