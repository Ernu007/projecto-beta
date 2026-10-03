# BRIEFING — FASE 9: dois números, o voo em loop, e o mobile a sério

Revisão do cliente depois de ver o site em `localhost:8099`.

**A regra que atravessa tudo:** *"faça o formato para a versão mobile também,
pois é nela que 99% dos clientes irão ver a página"*. Nenhum item desta fase
está feito se só estiver certo no desktop.

---

## 9.1 Dois números, dois papéis

| Papel | Número | Onde |
|---|---|---|
| **Chamadas** | **844700012** | botão de chamadas, `tel:`, rótulo "Ligar" |
| **WhatsApp** | **878066265** | links `wa.me`, botões de WhatsApp |

Hoje o site usa **878066265 para tudo**. Separa os dois papéis:

- Todos os `tel:` e o botão "Ligar" passam a **+258 84 470 0012**
- Todos os `wa.me` e botões de WhatsApp **mantêm 878066265**
- O JSON-LD leva o de **chamadas** como `telephone` (é o canal de voz); o
  WhatsApp fica como `contactPoint` separado se já existir essa estrutura
- Os contactos no ecrã mostram **os dois**, cada um com o seu rótulo, para
  ninguém ligar para o número de WhatsApp e ficar à espera

O prefixo volta a ser **84** (Vodacom) no número de voz, e o **87** (Movitel)
fica no WhatsApp. A validação tem de aceitar os dois — já aceita desde a troca
anterior, mas confirma com teste.

---

## 9.2 O voo é de ida e volta, em loop infinito

> "faltou só o avião saindo de Maputo e passando por cada um dos aeroportos das
> 10 províncias, e ao chegar a Cabo Delgado, ele contorna e volta fazendo o
> mesmo percurso, saindo de lá para Maputo, criando um loop infinito."

Hoje o avião faz Maputo → Cabo Delgado e **termina**. Passa a:

1. **Ida:** Maputo → … → Cabo Delgado (a `ROTA` actual)
2. **Volta:** Cabo Delgado → … → Maputo (a mesma sequência ao contrário)
3. **Repete**, sem fim

Detalhes que importam:

- **O avião vira-se na volta.** Na ida aponta para norte; ao contornar em Cabo
  Delgado, o ícone tem de rodar e apontar para sul. Um avião a voar de cauda é
  o tipo de erro que se vê logo.
- **Pára com `prefers-reduced-motion`**, como o resto das animações do site.
- **Não desenha a 60 Hz para sempre sem necessidade** — o commit `1088b90` já
  corrigiu esse desperdício no mapa; não o reintroduzas. Se o loop for infinito,
  o `requestAnimationFrame` só corre enquanto o mapa está visível no ecrã
  (`IntersectionObserver`), e pára quando sai.

---

## 9.3 Fora o cartão com os nomes das províncias

> "renova esse card que vem escrito os nomes das províncias, não vejo a
> necessidade de ter! Pois as províncias já estão escritas no mapa!"

Remover o cartão/lista de nomes de províncias da página 1. É informação
duplicada: o mapa já as mostra escritas.

Se houver teste a fixar essa lista, actualiza-o — a remoção é intencional.

---

## 9.4 Botões do hero: metade / metade

> "formate os botões do pedir orçamento e falar no WhatsApp para que ocupem
> metade metade do espaço que o botão como chegar a JVI ocupa"

O "Como chegar à JVI" ocupa a **linha inteira**. Os outros dois ficam **lado a
lado, cada um com 50%** dessa largura (menos o espaço entre eles).

Isto já é quase o que os testes de `tests/hero-acoes.test.js` descrevem —
confirma que os dois primeiros têm a **mesma largura** e que somados dão a
largura do botão de direcções.

**No mobile:** se os dois a 50% ficarem estreitos ao ponto de o texto quebrar,
passam a uma coluna de botões inteiros. Há já um limite declarado no CSS para
isso; mede o texto real, não assumas.

---

## 9.5 As imagens do carrossel estão pequenas

> "aumente o tamanho das imagens do carrossel, está muito pequeno!"

Aumentar o tamanho visível de cada imagem do carrossel. O cliente pediu antes
"cards pequenos" para o carrossel passar um de cada vez — isto **não contradiz**:
o que ele quer é um item por ecrã, mas **grande**.

- No mobile: a imagem ocupa praticamente a largura toda do ecrã
- No desktop: cresce, mas com um máximo para não ficar gigante
- **Mantém a proporção** — nada de esticar as fotografias
- `data-gal-src` e a lightbox têm de continuar a funcionar (há teste)

---

## 9.6 O WhatsApp do hero fica verde

> "o botão falar no WhatsApp que está na página 1 deve ter a mesma cor que o
> botão falar no WhatsApp que está na última página (cor verde)."

O botão de WhatsApp do hero usa hoje o estilo de vidro. Passa a usar **o mesmo
verde** do botão de WhatsApp dos contactos.

**Cuidado com a hierarquia:** o site tem a regra de **uma acção primária por
ecrã** (o verde `btn--primario` é o "Pedir orçamento"). Se o WhatsApp passar a
verde igual, ficam dois verdes a competir no mesmo ecrã. Resolve assim: o
WhatsApp leva o **verde da marca WhatsApp** (que é um verde diferente do verde
JVI), e o "Pedir orçamento" mantém o verde JVI primário. Se os dois verdes
ficarem indistinguíveis no ecrã, diz no commit e no `docs/decisoes.md` qual
escolheste e porquê — mas **o orçamento não pode deixar de ser o botão mais
forte do ecrã**.

Confirma o contraste AA do texto sobre o verde novo — há teste de contraste.

---

## 9.7 O WhatsApp da última página fica do tamanho do "Como chegar"

> "na última página, o botão falar no WhatsApp está pequeno, coloque do mesmo
> tamanho que o botão como chegar a JVI, para ele ficar responsivo."

Nos contactos, o botão de WhatsApp passa a ter a **mesma largura e altura** do
"Como chegar à JVI" — linha inteira, responsivo.

---

## 9.8 Mobile primeiro, não "mobile também"

> "faça o formato para a versão mobile também, pois é nela que 99% dos clientes
> irão ver a página!"

Para **cada** um dos pontos acima, verifica no mobile:

- Larguras em ecrã estreito (360 px é o chão realista em Moçambique)
- Alvos de toque com **pelo menos 44 px** de altura
- Texto dos botões sem quebrar nem ficar cortado
- O carrossel a passar bem com o dedo
- O botão "Pedir orçamento" fixo no topo **sem tapar conteúdo** nem comer
  metade do ecrã pequeno
- O mapa legível num ecrã estreito

Onde houver teste de limite (`hero-acoes`, contraste, DOM), estende-o para o
caso mobile em vez de abrir um ficheiro novo.

---

## Ordem e regras

1. 9.1 números (mecânico, testável)
2. 9.2 voo em loop
3. 9.3 cartão fora
4. 9.4 + 9.6 + 9.7 botões
5. 9.5 carrossel
6. 9.8 passagem mobile a tudo

Regras: **sem perguntas** — decide e registra em `docs/decisoes.md`; copy em
português de Portugal; nada fora de `D:/JVI/Trabalho Jvi/`; **sem merge para
`main`**; um commit por bloco; testes antes da implementação; `npm test` a zero
no fim e `dist/` regenerado.
