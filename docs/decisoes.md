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
| D8 | Nenhum telefone foi apagado; o novo é que ficou como WhatsApp principal | O briefing avisa que há divergências. Apagar um número que pode estar a funcionar destrói contacto existente. Ver a tabela de divergências abaixo. |
| D9 | O formulário vive só no modal | O briefing pede pop-up. Uma segunda instância na secção obrigaria a prefixar todos os `id`, e o `alt` do conteúdo de venda sobrevive sem JavaScript na secção. |
| D10 | O tempo anti-spam conta desde a abertura do formulário | A função serverless descarta pedidos enviados em menos de 3 s. Medido no `submit`, o valor seria ~0 e **todos** os pedidos seriam descartados. |
| D11 | O botão do último passo diz "Enviar" em vez de aparecer um botão novo | Num pop-up de 3 passos, dois botões de acção primária no mesmo ecrã duplicam a acção principal — o que a Fase 6 proíbe. |

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

> **A confirmar com o cliente:** o Airwaybill impresso da JVI diz **IVA 17%**,
> enquanto o site e este documento usam **16%**, por instrução do briefing. A
> tabela de preços, o resumo e a mensagem de WhatsApp usam 16%. Se o impresso
> estiver certo, é a tabela que está errada.

## Números de telefone: divergências

O briefing já avisava: *"VERIFICAR, há divergências nas fotos"*. Ao ver as
fotografias, há mais divergências do que o briefing registava.

| Fonte | Números |
|---|---|
| Briefing, Fase 4 (único confirmado) | **+258 84 793 5035** |
| Briefing, secção "Dados de contacto" | +258 84 554 6151 · +258 82 555 8005 |
| Airwaybill 003871 (fotografia) | +258 87 555 8005 · +258 84 470 0012 |
| Poster do terminal (fotografia) | 8454 61151 · 82 555 8005 |

O que o site faz agora:

- **WhatsApp — Operações:** +258 84 793 5035, o único confirmado. É o número
  para onde vão as duas mensagens do formulário, e o link do WhatsApp flutuante.
- **Escritórios:** +258 87 555 8005 · +258 84 470 0012 — os do Airwaybill.
- **Alternativo:** +258 84 554 6151 · +258 82 555 8005 — os do briefing.

Nenhum foi apagado. Os três aparecem no JSON-LD como `contactPoint` separados.

> **A confirmar com o cliente:** qual é o número certo, se 84 470 0012 ainda
> existe, e qual é a morada correcta — o poster diz "Terminal de Carga, Porta 27,
> Av. 04 de Outubro" e o Airwaybill diz "Av. 19 de Outubro, Terminal de Cargas
> Nº 113". O site usa a segunda.

## Testes

`npm test` corre 41 testes com o runner nativo do Node, sem dependências.

| Ficheiro | Cobre |
|---|---|
| `tests/precos.test.js` | A fórmula, os pontos de fronteira, a monotonicidade de 0,02 a 50,01 kg, pesos inválidos, peso gigante, formatação |
| `tests/orcamento.test.js` | Províncias, peso com vírgula, telefone em seis escritas diferentes, as duas mensagens de WhatsApp |
| `tests/confirmacao.test.js` | As linhas do resumo de confirmação, o destaque do TOTAL, casos sem peso e sem dimensões |
| `tests/envio.test.js` | `linkWa` (número, codificação), `dados` (leitura do formulário, valores por omissão) |
| `tests/submit.test.js` | Validação do servidor campo a campo, escape de HTML, injecção de fórmulas na folha de cálculo, formato da mensagem |

`python tools/verificar-html.py` confirma, sem browser, que todos os `id`, todos
os `data-attribute` e todos os ficheiros que o JS procura existem no HTML, e que
todas as ancoras internas têm destino.
