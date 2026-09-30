# BRIEFING — JVI Carga & Serviços, Lda.

Projecto: landing page de agência de transporte de carga em Moçambique (Pemba / Maputo).
Estado actual: 4 commits git, `index.html` 49KB com hero 3D (voo Pemba->Maputo), mapa de
Moçambique com fronteiras reais, formulário de orçamento, `functions/submit.js` (Netlify).

Este ficheiro é a fonte de verdade do que o cliente pediu. Executa-o por fases.

---

## FASE 1 — Formulário de orçamento (pop-up, 3 passos)

O formulário actual tem de ser substituído por um **pop-up/modal**, acedido por um botão
"Pedir orçamento" visível no hero. Três passos, com indicador de progresso e botão Voltar.

**Passo 1 — Dados do emissor**
- Nome completo (pode ter dois nomes, ex.: "João Pedro Sissu")
- Apelido / sobrenome
- Província (select: Maputo, Gaza, Inhambane, Sofala, Zambézia, Nampula, Cabo Delgado,
  Niassa, Manica, Tete, Palma)
- Morada / bairro
- Telefone (WhatsApp)

**Passo 2 — Dados da carga**
- Nome de quem recebe (destinatário)
- Província de destino (mesmo select)
- Peso em kg (campo numérico, obrigatório)
- Dimensões (comprimento × largura × altura) — campo opcional, o Whisper do cliente foi
  vago aqui e podes torná-lo opcional
- Descrição da mercadoria (textarea, ex.: "camisetas", "tintas PLASCON", "material eléctrico")

**Passo 3 — Pagamento**
Escolha única entre 3 opções:
1. e-Mola
2. Cartão de crédito
3. Numerário

Mais uma condição a perguntar ao cliente:
- A pessoa pode **pagar no levantamento**, na província de destino, quando for buscar a
  encomenda. Inclui isto como pergunta separada (sim/não), porque o cliente mencionou
  explicitamente "pagar depois do envio / no acto de levantamento".

## FASE 2 — Cálculo do preço (regra confirmada pelo cliente)

```
ATÉ 10 kg:      3000 MT base  →  3480 MT com 16% IVA
ACIMA DE 10 kg: 255 MT por kg  →  × 1.16 (IVA 16%)
Exemplo 15 kg:  15 × 255 = 3825  →  4437 MT com IVA
```

**REGRA CRÍTICA — nunca mostrar "quanto maior o peso, menos se paga".**
O cliente detectou que a fórmula pura quebrava entre 10 e 12 kg (aos 11 kg dava 3254 MT,
menos que aos 10 kg, que dá 3480 MT). A correcção é um **piso mínimo**:

```
preco_base = peso <= 10 ? 3000 : peso * 255
preco_base = max(preco_base, 3000)   // <-- piso: nunca abaixo de 3000 MT
preco_final = preco_base * 1.16      // IVA 16%
```

O piso garante monotonia: o preço nunca desce quando o peso sobe. Implementa e **testa
explicitamente** os pontos de fronteira: 9, 10, 11, 11.7, 12, 15, 50 kg. O resultado tem
de ser não-decrescente.

## FASE 3 — Confirmação antes do envio

Ao carregar em "Enviar", mostra um pop-up de resumo com:
- Os dados preenchidos
- O peso, o preço base, o IVA e o total
- Botões "Confirmar e enviar" / "Voltar a editar"

Ao confirmar, envia **só via WhatsApp**. Não mostres ao utilizador campo "para que número
vai ser enviado" — é uma decisão interna.

## FASE 4 — Envio para WhatsApp

Número da empresa (ÚNICO e CONFIRMADO pelo cliente):
**+258 84 793 5035**

Fluxo pretendido: uma mensagem sai para a empresa, outra para o cliente. Ambas via
`wa.me` links, formatadas e legíveis.

- Número da empresa: `+258 84 793 5035` (confirmado)
- Número do cliente: é o `telefone/WhatsApp` que a pessoa preencheu no passo 1
- Ao cliente: a confirmação com o orçamento
- À empresa: os dados completos da carga + o orçamento

Mantém o `functions/submit.js` (Netlify) funcionando como plano B / registo, sem o
remover. Implementa o envio de WhatsApp como camada principal e client-side.

## FASE 5 — Galeria de trabalho real

O cliente forneceu 15 fotografias reais da operação (caminhãoloads de caixas, roadblocks
Angola, air waybill, motociclos, material eléctrico). Coloca-as numa secção de galeria
"Os nossos trabalhos" / "Carga entregue".

Estas imagens foram enviadas pelo cliente e estão em:
`C:\Users\IdealPad\AppData\Local\hermes\cache\images\`
(ficheiros `img_*.jpg`)

Sugestão de subconjunto, por serem as mais fortes e identificadas:
- `img_9a5743b57c0e.jpg` — camião cheio de caixas "CAMISETAS AMARELAS ZAMBEZIA"
- `img_5e0f0d40bd0b.jpg` — Airwaybill JVI nº 003871 (Angola), prova de operacionalidade real
- `img_700cc775e008.jpg` — placa/signário JVI "Carga & Serviços, Lda."
- `img_78498ba3732e.jpg` — caixas empilhadas com rótulos NAMPULA
- `img_492cc8a760cc.jpg` — bicicleta/motociclo embalado, pronto a exportar
- `img_3fcdb0c13597.jpg` — camião carregado numa rua de Maputo
- `img_06fa9ae40417.jpg` — bidões PLASCON (tintas) numa oficina
- `img_ac351fd019f4.jpg` — TVs ULTRAK em caixas de madeira, reforçadas
- `img_7296cfa7277f.jpg` — caixote de painéis isolantes com fita JVI
- `img_d544eaf40b51.jpg` — reboque com quatro caixotes de madeira
- `img_14b85241586.jpg` — poster mural JVI (Terminal de Carga, Porta 27)

IMPORTANTE: antes de usar, **redimensiona e otimiza** (WebP, máx 1600px lado longo) e
move para `assets/img/galeria/`. Não comitear ficheiros gigantes.

## FASE 6 — Melhorar o design (o cliente disse que está "em 5, quero em 20")

- Espaçamento consistente (escala de 4/8px, não valores soltos)
- Hierarquia clara de botões: uma acção primária por ecrã
- Paleta consistente com a identidade JVI (verde e laranja do logo)
- Tipografia: um par tipográfico coeso e legível, tamanho base 16-18px
- Passa o rato por cada secção e pergunta: isto vende o serviço?
- Considera expandir para 6-8 páginas: Serviços, Rotas, Sobre, Galeria, Contacto, FAQ,
 ＋ a landing actual

## Dados de contacto (das imagens fornecidas, para uso no site)

- Telefone: **+258 84 793 5035** — ÚNICO número válido, confirmado pelo cliente.
  Todos os outros números que aparecem no material antigo (Airwaybill, poster,
  secções anteriores deste briefing) estão errados e foram removidos.
- Email: **jvicargaeservicos@gmail.com** — confirmado pelo cliente, fica assim (sem
  o "s" que falta em "servicos"). Não corrigir.
- Morada: **Av. 19 de Outubro, Terminal de Cargas Nº 113** — ÚNICA morada
  válida, confirmada pelo cliente.
- NUT: 400501424

> **IVA: 16%** — confirmado pelo cliente. O Airwaybill impresso diz 17% e está
> errado; a correcção é interna da JVI, o site fica nos 16%.

---

## Como trabalhar

1. Usa os agentes disponíveis em `.opencode/agents/` (107 instalados: engineering, design,
   testing, security, project-management, product). Ex.: subagentes de frontend e de UI
   review para as fases visuais.
2. Faz commits incrementais, um por fase, com mensagens claras em português.
3. Testa o cálculo de preços com os valores de fronteira da Fase 2 e reporta o resultado.
4. No fim, faz review: acessibilidade, segurança, SEO, performance.
5. Se algo do briefing for ambíguo, **decide tu** e anota a decisão no commit. Não fiques
   bloqueado à espera de resposta.
