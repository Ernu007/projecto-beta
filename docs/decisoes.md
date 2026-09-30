# Decisões de implementação

Registo das decisões tomadas ao executar `BRIEFING-JVI.md`, com a razão de cada uma.
O briefing é a fonte de verdade; onde era ambíguo, a decisão está aqui e no commit
que a aplicou.

## Decisões

| # | Decisão | Razão |
|---|---|---|
| D1 | Base e IVA arredondados ao metical; `total = base + iva` | É o único arredondamento em que o total é a soma exacta das partes, e reproduz os 3 480 MT e 4 437 MT que o cliente deu. |
| D2 | Valores apresentados como `3 480 MT` | Como se escreve um preço em Moçambique. `Intl` não é usado, para o resultado ser determinístico no teste. |
| D3 | O peso aceita vírgula decimal | O teclado local escreve vírgula. Um `input type="number"` devolve string vazia para quem escreve `11,7`, e o formulário diria "peso inválido" a quem introduziu um valor válido. |
| D4 | A mensagem para a empresa abre-se sozinha; a do cliente é um botão | O browser bloqueia a segunda `window.open` em sequência. Um botão explícito no ecrã de sucesso funciona sempre; a tentativa automática é apenas açúcar, e o aviso aparece quando o browser recusa. |
| D5 | `functions/submit.js` mantém-se e continua a ser chamado | O briefing manda manter. Um pedido nunca deve depender só de um `wa.me` que o cliente pode fechar sem ler. |
| D6 | Sem expansão para 6-8 páginas | O briefing dizia "considera". O funil é WhatsApp: um sender converte melhor do que seis. Páginas magras de SEO prejudicam o posicionamento em vez de o melhorar. Acrescentou-se em vez disso uma secção de FAQ na página única. |
| D7 | As 11 fotografias indicadas no briefing | Foram identificadas uma a uma pelo cliente. Mas o texto do briefing estava errado em três delas — ver a tabela abaixo. As legendas foram escritas depois de ver as fotos. |
| D8 | Só o telefone confirmado: +258 84 793 5035, em todo o site | Decisão do cliente. Tinha-se mantido a lista toda por precaução; o cliente confirmou que os outros números estavam errados, e um número errado publicado é pior do que nenhum número publicado. Ver "Números de telefone: um só" abaixo. |
| D9 | O formulário vive só no modal | O briefing pede pop-up. Uma segunda instância na secção obrigaria a prefixar todos os `id`, e o `alt` do conteúdo de venda sobrevive sem JavaScript na secção. |
| D10 | O tempo anti-spam conta desde a abertura do formulário | A função serverless descarta pedidos enviados em menos de 3 s. Medido no `submit`, o valor seria ~0 e **todos** os pedidos seriam descartados. |
| D11 | O botão do último passo diz "Enviar" em vez de aparecer um botão novo | Num pop-up de 3 passos, dois botões de acção primária no mesmo ecrã duplicam a acção principal — o que a Fase 6 proíbe. |
| D12 | O peso é `type="text"`, não `type="number"` | Um `input type="number"` **engole a vírgula decimal**: escrever `11,7` produz `value === ""`, e o D3 fica sem efeito nenhum. Com `inputmode="decimal"` o teclado numérico no telemóvel mantém-se e a validação do intervalo passa a ser feita por JS, como já era. |
| D13 | O ecrã de sucesso tem **os dois** links, e nunca se afirma se a abertura automática funcionou | `window.open(url, '_blank', 'noopener')` devolve **sempre `null`** (MDN), logo não dá para saber se o separador abriu. E o browser só abre em resposta directa a um gesto — um `fetch` de 1–3 s consome a activação transitória. Portanto: os links são a entrega garantida, a abertura automática é um bónus sobre o qual não se fala. Sem o link para a JVI, um pedido bloqueado desaparecia por trás de um ecrã verde. |
| D14 | O site publica-se a partir de `dist/`, não da raiz | A raiz tem notas internas que não são para o público (`docs/decisoes.md`, briefings, scripts). Com `publish = "."` isso ficava descarregável. `tools/publicar.py` monta o `dist` com lista explícita. |
| D15 | O `esc()` do servidor corre uma vez, em `campoLimpo` | `esc` não é idempotente. Aplicado duas vezes, um cliente chamado "A & B" chegava à JVI como "A &amp;amp; B", e o `text:` e o `html:` do mesmo e-mail discordavam entre si. Para a folha de cálculo o escape é desnecessário — a `celula()` trata as fórmulas. |
| D16 | **Fase 7B (geolocalização e aviso de aproximação) DESACTIVADA** | Decisão do cliente: sem API key do Google. Sem `duration_in_traffic` não há estimativa de tempo, e sem estimativa não há como decidir que o cliente está "a 5 minutos" — que era o limiar que o cliente pediu. Publicar um "está a 18 minutos" inventado era pior do que não publicar nada. Fica para mais tarde, se houver key com billing. |
| D17 | A Fase 7A é um `<a>` literal no HTML, sem uma linha de JavaScript | Três razões, todas da mesma família. Funciona sem JS. Sem JS não há `navigator.geolocation`, nem `watchPosition`, nem pop-up — logo **não há tracking nenhum para consentir**, e a revisão de privacidade da Fase 7B não se aplica. E o `origin` é omitido de propósito: é ele que faria o Maps usar a localização de quem clica, e essa pergunta passa a ser o Google a fazê-la ao próprio utilizador, no consentimento dele. A JVI não recebe posição de ninguém. |
| D18 | O destino do link é a **morada**, não coordenadas | Não há API de geocodificação, portanto não há um lat/long de confiança. O briefing é explícito: *"Não inventes coordenadas — deixa o valor por preencher é melhor do que um valor errado em produção, que mandaria o cliente para o mato."* O Maps resolve o endereço por si. `MORADA_JVI` em `js/rota.js` é a fonte única, e `tests/rota.test.js` compara o `href` do HTML com o que o módulo produz, byte a byte — a morada está em cinco sítios e é um teste que impede que passem a divergir. |
| D19 | O botão é secundário, a par do "Falar no WhatsApp" | A Fase 6 proíbe duas acções primárias no mesmo ecrã, e o briefing da Fase 7 é explícito: orçamento principal, direcções secundárias "mesmo que o botão de direcções seja grande e tocável". Saiu `btn--vidro`, e `tests/rota.test.js` conta as primárias do `.hero__acoes` para o dia em que alguém promover o link. |
| D20 | A alternativa sem key: o telefone do cliente no aviso, nomeado e normalizado | É o que o cliente queria de facto — *"a JVI sabe e telefona"* — e não precisa de API nenhuma: a JVI liga de volta de um telefone normal, sem browser no meio. O número já ia no aviso; o que faltava era o que a 7B tornava impossível fazer. Passa a chamar-se **"Telefone do cliente"** nos três canais (WhatsApp do cliente, e-mail, folha) porque o pedido tem dois números e "WhatsApp" a solo não desambigua. No e-mail e no WhatsApp vai normalizado para `+258 …` — é o número para onde se telefona, não a grafia do formulário. **A folha guarda o valor cru**: é o registo do que o cliente escreveu. |
| D21 | A política de privacidade foi corrigida no mesmo commit | O site prometia, e com razão na altura: *"o seu endereço IP não é transmitido a servidores externos de Google"* — zero cookies, fontes auto-alojadas. O botão do Maps tornou a promessa falsa. Dizer *"não há consentimento nenhum"* quando há um botão que sai para a Google é pior do que não ter o botão; corrigiu-se a política, e há um teste que falha se a promessa voltar a aparecer sem a ressalva. |
| D22 | A disposição das acções do hero é escrita: duas na primeira linha, as direcções na segunda e a largura toda | O `.hero__acoes` era um `flex-wrap: wrap` sem mais nada, e quem caía em que linha dependia do comprimento do texto. Medido no Chrome, os três botões davam 204.50 + 221.20 + 217.88 + dois gaps de 13 = **669.58px** contra **660px** de contentor: o "Como chegou" nunca coube na primeira linha e desceu sozinho, com a largura dele, encostado à esquerda debaixo do primário — lia-se como botão órfão. Passou a ser `btn--bloco` com `flex: 1 0 100%`, que põe a base a 100% do contentor e garante a linha inteira. O orçamento continua primário e é o primeiro. Abaixo de 520px de viewport as três passam a coluna de botões inteiros, que é o que se toca melhor no telemóvel. `tests/hero-acoes.test.js` fixa o número de botões na primeira linha e confere o limite contra a largura que sobra no contentor, para ninguém reintroduzir a soma ao acaso. |

## Fase 7: direcções para o terminal, sem API key

O briefing (`BRIEFING-FASE7-GEOLOC.md`) pedia duas coisas: mostrar o caminho
para a empresa, e avisar a JVI quando o cliente estivesse a chegar, com a
posição e a hora, para a JVI poder sair ao encontro.

**O cliente decidiu não usar a API do Google.** Sem key não há billing, não há
espera por aprovação e não há estimativas. O que ficou:

| | Estado | Porquê |
|---|---|---|
| **7A** — botão "Como chegar à JVI" | **Activa, entregue** | O link oficial de direcções do Google Maps não precisa de key, não precisa de conta e não precisa de JavaScript. Abre o Maps com o terminal como destino. |
| **7B** — aviso de aproximação | **Desactivada** | Requer a API Directions com billing. Sem `duration_in_traffic` não há estimativa de viagem, e o limiar que o cliente pediu ("2-5 minutos") é um limiar de **tempo**, não de metros. |
| **Alternativa** — a JVI liga de volta | **Activa, entregue** | Não é geolocalização, mas é o objectivo do cliente sem nenhum browser no meio: o telefone do cliente vai no aviso, nomeado e normalizado, e a JVI liga. Ver D20. |

### O que a 7B fazia, e porque não se publica a 7A com estimativas inventadas

A 7B tinha duas partes: pedir a rota com `origin` + `destination` e ler o
`duration_in_traffic`; e depois `watchPosition` para reavaliar. **As duas
dependem da API.** Distância em metros não substitui tempo: a geolocalização dá
uma linha recta, e a diferença para o percurso de estrada é grande numa cidade —
calibrar o raio por metro nunca coincidiria com o tempo real. Por isso a
única alternativa honesta sem key é o link de direcções, que dá direcções
verdadeiras em vez de um número inventado.

Quando houver key, a 7B é reactivável sem mudar o botão: o `href` estático
passa a ser um link para uma Netlify Function que devolve o `duration_in_traffic`,
e o `watchPosition` entra atrás do consentimento que o briefing já descreve.

### Onde o número do cliente vai

| Canal | Onde | Como aparece |
|---|---|---|
| WhatsApp (o que o cliente manda) | `js/orcamento.js` → `msgEmpresa()` | `• Telefone do cliente: +258 84 793 5035` |
| WhatsApp do registo | `functions/submit.js` → `textoWA()` | `• Telefone do cliente: +258 …` |
| E-mail | `functions/submit.js` → `textoEmail()` | linha "Telefone do cliente" da tabela |
| Folha de cálculo | `functions/submit.js` → `CAMPOS` | coluna "Telefone do cliente", com a grafia do cliente |

O rótulo mudou de "WhatsApp" para "Telefone do cliente" nos quatro. A JVI tem o
número do cliente e o seu próprio no mesmo pedido, e "WhatsApp" não dizia de
quem era o número. `tests/orcamento.test.js` e `tests/submit.test.js` travam
que o número continue a ir, e que o do cliente nunca se confunda com o da JVI.

## Tabela de preços

Regra do cliente: até 10 kg, 3 000 MT base. Acima de 10 kg, 255 MT por kg. IVA de 16%.

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
em passos de 10 g, e não só nos pontos de fronteira.

O piso não é cosmético. Sem ele, aos 11 kg o preço seria 11 × 255 = 2 805 MT —
**menos** do que aos 10 kg, que dá 3 000 MT. O cliente viu exactamente isso e
mandou corrigir.

## Fotografias: onde o briefing estava errado

As legendas foram escritas depois de ver as 11 imagens. Três descrições do
briefing não correspondiam ao que está na fotografia:

| Ficheiro | O briefing dizia | O que a fotografia mostra |
|---|---|---|
| `img_5e0f0d40bd0b` | "Airwaybill nº 003871 (Angola), prova de operacionalidade real" | O Airwaybill 003871 **em branco**, por preencher. Não documenta remessa nenhuma. |
| `img_492cc8a760cc` | "bicicleta/motociclo embalado" | Um **motociclo** envolvido em película de plástico e protegido com cartão — não uma bicicleta, e sem caixote de madeira. Ao lado, uma placa "EXPORTAÇÃO / DOMÉSTICA". |
| `img_d544eaf40b51` | "reboque com **quatro** caixotes" | **Dois** caixotes de madeira na plataforma do reboque. |

Também se abrandou o `alt` de `img_3fcdb0c13597` (é um camião pequeno de
plataforma numa rua molhada; não é confirmável que seja Maputo) e de
`img_06fa9ae40417` (embalagens de tinta PLASCON alinhadas no chão, não bidões
numa oficina).

> **IVA: 16%, fechado.** O cliente confirmou que o valor certo é **16%** e que o
> Airwaybill impresso, que diz 17%, está errado. A correcção é interna da JVI: o
> site, a tabela de preços, o resumo e a mensagem de WhatsApp ficam nos 16%, e não
> se mexem mais nisto. Foi uma questão em aberto; já não é.

## Números de telefone: um só

O briefing avisava: *"VERIFICAR, há divergências nas fotos"*. O cliente
respondeu. O número válido é **+258 84 793 5035**, e é o único: os números que
constavam do Airwaybill, do poster do terminal e das secções antigas do briefing
estavam errados e foram removidos de todo o site — contactos, `contactPoint` do
JSON-LD, botão fixo "Ligar", carta de apresentação e o PDF descarregável. Não há
"Escritórios" nem "Alternativo": um número, em todo o lado.

A fonte única do número é a constante `JVI_WHATSAPP` em `js/orcamento.js`. O
`index.html` repete-o em três sítios que não passam por JS (secção Contactos,
botão fixo e JSON-LD); se vier outro número, mudam-se os quatro juntos.

`functions/submit.js` envia para um só destinatário (`DESTINO`), por isso não
havia nada a reduzir aí.

O mesmo se aplica à morada: **Av. 19 de Outubro, Terminal de Cargas Nº 113**,
confirmada, e a variante do poster removida do briefing para não ser reutilizada.

## Direcções para o terminal (Fase 7A, sem API key)

O botão **"Como chegar à JVI"** está no hero, ao lado de "Pedir orçamento" e
"Falar no WhatsApp". Abre o Google Maps em direcções para o terminal.

**Não há nada para configurar.** O link público de direcções do Google Maps é
gratuito e não exige conta nem API key:

```
https://www.google.com/maps/dir/?api=1&destination=<morada>&travelmode=driving
```

Não há JavaScript envolvido, não há `navigator.geolocation` e não há tracking:
é um `<a>` literal, por isso funciona mesmo com JS desligado. O `origin` é
omitido de propósito — é a única forma de o Maps usar a localização de quem
clica, e a JVI **não recebe, não guarda e não vê a posição de ninguém**. A
pergunta ao utilizador, se houver, é o Google a fazê-la no consentimento dele.

O destino é a **morada**, não coordenadas: sem API de geocodificação não há um
lat/long de confiança, e uma coordenada errada mandava o cliente para o mato.
A fonte única é `MORADA_JVI`, em `js/rota.js`, que só os testes importam —
o `href` está escrito à mão no HTML para o link não depender de JavaScript.
`tests/rota.test.js` compara as duas cópias byte a byte, e amarra a morada aos
outros quatro sítios onde ela vive (JSON-LD, secção Contactos, política de
privacidade).

**A 7B (aviso de aproximação) está DESACTIVADA** e é documentada em
[`docs/decisoes.md`](docs/decisoes.md#fase-7-direcções-para-o-terminal-sem-api-key)
como "possível mais tarde, requer API key do Google". Não há estimativas de
tempo no site, e é de propósito: sem `duration_in_traffic` do Google não há
base para as calcular.

## Testes

`npm test` corre **88 testes** com o runner nativo do Node, sem dependências.

| Ficheiro | Cobre |
|---|---|
| `tests/precos.test.js` | A fórmula, os pontos de fronteira, a monotonicidade de 0,02 a 50,01 kg, pesos inválidos, peso gigante, formatação |
| `tests/orcamento.test.js` | Províncias, peso com vírgula, telefone em várias escritas e com vários números, as duas mensagens de WhatsApp, e que o aviso à JVI nomeia o telefone **do cliente** |
| `tests/rota.test.js` | O link de direcções: formato, codificação, ausência de `origin`; o `href` do HTML byte a byte; a morada igual nos cinco sítios; uma só acção primária no hero; e a política de privacidade sem a promessa que o Maps tornou falsa |
| `tests/confirmacao.test.js` | As linhas do resumo de confirmação, o destaque do TOTAL, casos sem peso e sem dimensões |
| `tests/envio.test.js` | `linkWa` (número, codificação), `dados` (leitura do formulário, valores por omissão) |
| `tests/envio-camada.test.js` | O plano de envio (os dois links, sempre) e que o peso **não** é `type="number"` |
| `tests/dom.test.js` | **Âmbito**: cada nó que o JS procura está dentro do sítio certo — apanha o bug que matou o site |
| `tests/css.test.js` | Tokens definidos e usados, ausência de tokens auto-referenciais, contraste medido a partir do `:root` |
| `tests/submit.test.js` | Validação do servidor campo a campo, escape de HTML, injecção de fórmulas na folha de cálculo, formato das mensagens, `telefoneCallback`, e que o telefone do cliente chega ao e-mail e à folha |

O `tests/envio-camada.test.js` existe por causa de dois bugs que a suite
anterior não apanhou: o `window.open` com `noopener`, que devolve sempre `null`,
e o `type="number"`, que engolia a vírgula decimal.

O `tests/rota.test.js` protege duas coisas que a revisão a olho não apanha. A
primeira é a **codificação**: um `+` trocado por `%20`, uma vírgula crua ou um
`º` perdido mandavam o cliente para o mato, e `%2C` a ler-se como separador de
coordenadas em vez de parte do endereço. A segunda é a **duplicação**: o `href`
está escrito à mão no HTML para o link funcionar sem JavaScript, e `js/rota.js`
é a fonte única da morada — o teste compara as duas cópias para que não
divirjam.

`python tools/verificar-html.py` confirma, sem browser, que todos os `id`, todos
os `data-attribute` e todos os ficheiros que o JS procura existem no HTML, e que
todas as ancoras internas têm destino.
