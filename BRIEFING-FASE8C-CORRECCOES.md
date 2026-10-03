# BRIEFING — FASE 8C: correcções do áudio completo (22 min)

O cliente reenviou a revisão completa. Confirma quase tudo da Fase 8B, mas
**contradiz três coisas já implementadas**. Esta fase corrige-as.

Fonte: transcrição do áudio de 22 min 23 s. Onde a transcrição é duvidosa está
marcado **[INCERTO]** — nesses pontos decide e regista em `docs/decisoes.md`.

---

# C1. A ROTA DO AVIÃO ESTÁ INVERTIDA (contradiz a Fase 8A)

A Fase 8A implementou `Cabo Delgado → … → Maputo`. **Está ao contrário.**

O cliente foi explícito, duas vezes:

> "Pemba, a flecha, Maputo — Pemba para Maputo. Coloque o contrário: de Maputo
> para a Pemba. A sede da JVI (…) então tu deves partir de Maputo para as
> demais províncias."

E ditou a cadeia a partir de Maputo:

> "Maputo para a Gaza, Gaza para a Beira, de Beira para o Chimoio, Chimoio para
> a Zambézia, de Zambézia para a Tete, Tete para a Nampula, Nampula para a
> Lichinga, e de Lichinga para Cabo Delgado."

**A razão de fundo:** a sede da JVI é em Maputo. O avião tem de SAIR da sede
para as províncias, não chegar a ela. Uma seta a apontar para Maputo diz ao
cliente que a JVI é um destino; a apontar de Maputo diz que é uma origem que
serve o país.

## O que implementar

Inverte `ROTA` em `tools/gerar-mapa.mjs` (e regenera `js/mapa-dados.js`):

```js
const ROTA = [
  'Maputo', 'Gaza', 'Inhambane', 'Sofala', 'Manica',
  'Tete', 'Zambézia', 'Niassa', 'Nampula', 'Cabo Delgado',
];
```

**Dois desvios conscientes à cadeia ditada, e porquê:**

1. **Inhambane entra entre Gaza e Sofala.** O cliente saltou-a ("Gaza para a
   Beira"), mas Gaza e Sofala não são vizinhas — Inhambane fica no meio. Saltá-la
   dava um salto no mapa.
2. **Tete → Zambézia → Niassa → Nampula** em vez de "Zambézia → Tete → Nampula
   → Lichinga". Tete não faz fronteira com Nampula; a cadeia dele tinha saltos.
   Esta ordem respeita os extremos que ele deu (parte de Maputo, acaba em Cabo
   Delgado) e mantém **todos os saltos entre vizinhas**, que é o que
   `tests/mapa.test.js` verifica.

Actualiza os dois testes de `tests/mapa.test.js` que fixam a direcção antiga:
`'a rota parte de Pemba e chega a Maputo'` passa a exigir o contrário.

---

# C2. ORDEM DAS PROVÍNCIAS: geográfica, NÃO alfabética

A Fase 8B diz "ordem alfabética". **Errado.** O cliente disse:

> "Organiza de forma crescente, começando de Maputo (…) para Cabo Delgado."

É a ordem **geográfica sul → norte**, a mesma que a rota do avião:

```
Maputo, Gaza, Inhambane, Sofala, Manica, Tete, Zambézia, Niassa, Nampula, Cabo Delgado
```

Aplica-se aos **dois** selects do formulário: província de origem e de destino.
A lista tem 11 entradas (a cidade de Maputo e a província), mantém as 11 —
muda só a ordem.

---

# C3. O CARTÃO DA MATOLA SAI

> "Maputo — traça a sede, porque a sede da JVI é em Maputo. Matola não precisa
> colocar, pode remover a Matola, porque a Matola faz parte de Maputo."

- **Remover** o cartão/entrada da Matola da secção de cobertura
- **Marcar Maputo como sede** — um rótulo visível ("Sede"), não só mais um ponto

---

# C4. Cartões da cobertura

- O cartão **"Porque a JVI"**: alargar ("estende ali para a direita") e acabar
  com ponto final, como as tabs
- **"Fluxo operacional do colégio"** → **"Fluxo de entrada"**, e alargar o cartão
- O cartão da **capacidade** → **"Outras províncias"** (já na 8B), mas também
  **aumentar e centrar** o cartão
- Cada província mostra a **agência da JVI** com um ponto, e os saltos levam
  **setas** com o nome da província de destino

---

# C5. Botões com as cores do Google

> "Os botões, façam um botão do Gmail. Coloque as cores do Gmail, do Google.
> Aquela ali vem verde, acho que é vermelho, o que é em branco. Coloque os
> poucos cruzados ali para dar mais profissionalismo."

Os botões de contacto do topo passam a usar a paleta do Google — **vermelho,
verde e branco**, um por botão. **[INCERTO]** a atribuição exacta de cor por
botão; a leitura mais natural é e-mail=vermelho (Gmail), WhatsApp=verde,
telefone=branco. Decide e regista.

**Não mexer no botão do telefone** além da cor: "o telefone está bom".

---

# C6. Secção "Nossa empresa": a imagem é o panfleto

> "Na parte onde está escrito 'vamos conectar o seu negócio', onde é essa imagem
> do caminhão, coloque aquela imagem do panfleto da empresa (…) porque eles vão
> conhecer a empresa."

- A imagem da secção é o **panfleto/carta de apresentação da JVI**, não o camião
- A secção tem de ser **larga e visível** — "tem que ser uma parte na mesma
  sólida"
- O título é **"Nossa empresa"**

---

# C7. SEO (pedido novo, não estava na 8B)

> "Entre um pouco no rodapé (…) uma parte de SEO, em que vai colocar lá dezentes
> palavras-chave de SEO para este site (…) procurando na internet as palavras
> que as pessoas pesquisam para aderir a este produto. Focando-se no público
> moçambicano, nesse específico."

O que fazer:

1. **Pesquisar** os termos que um moçambicano escreve ao procurar este serviço
   (agência de carga, despacho, envio de encomendas para as províncias, carga
   aérea Maputo, transporte rodoviário Moçambique, …)
2. Meter esses termos onde contam: `<title>`, `meta description`,
   `JSON-LD`, e os `h1`/`h2` que já existem — **sem keyword stuffing** e sem
   texto escondido, que o Google penaliza
3. Um bloco discreto no rodapé com os serviços/províncias em texto real
   (links internos), que é SEO legítimo e útil ao utilizador

**Não inventes volumes de pesquisa.** Se não puderes verificar, escolhe termos
pela lógica do negócio e di-lo em `docs/decisoes.md`.

---

# C8. Formulário — detalhes novos ou corrigidos

| Campo | O que o cliente disse |
|---|---|
| Nome | exemplo **"João Pedro"** |
| Apelido | exemplo (um apelido comum) |
| Morada/bairro | exemplo **"Sommerschield"** — bairro real de Maputo. **[INCERTO]**: na transcrição sai "somar chile"; Sommerschield é a leitura que faz sentido para um bairro de Maputo |
| Telefone | **tirar "WhatsApp" do parêntese** — fica só "Telefone". O exemplo é um número fictício, nunca o da empresa |
| Passo 1, texto | manter a 1.ª frase ("receba a confirmação"), **eliminar a 2.ª** |
| Passo 2, título | "O que transportamos" → **"A sua carga"** |
| Dimensões | **remover** — "não é preciso" |
| Peso | exemplo **"15"** ou **"11,7"** (mostra que aceita vírgula) |
| Descrição da mercadoria | exemplo **entre parênteses**, opcional |
| Checkbox | **verde**, obrigatória para avançar |
| Passo 3, título | **"Como pretende pagar"** |
| e-Mola + M-Pesa | **no mesmo cartão** (dinheiro móvel) |
| Transferências bancárias | **substitui** o cartão de crédito/Visa |
| Quando paga | dois cartões: **"No acto de envio"** e **"No acto de levantamento, na província de destino"** — texto "Paga no acto de envio ou no acto de levantamento da carga" |
| Termos | obrigatórios para enviar; **remover o cartão de termos** da página |

---

# Ordem de execução

1. **C1** (rota invertida) — regenerar o mapa e corrigir os testes da rota
2. **C2** (ordem das províncias) nos dois selects
3. **C3** + **C4** (cobertura: Matola fora, Maputo sede, cartões)
4. **C5** (cores Google) + **C6** (secção empresa com panfleto)
5. **C8** (formulário)
6. **C7** (SEO) — por último, porque depende do texto final

Regras: **sem perguntas**; copy em português de Portugal; nada escrito fora de
`D:/JVI/Trabalho Jvi/`; **sem merge para `main`**; um commit por bloco;
`npm test` a zero no fim.
