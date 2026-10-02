# BRIEFING — FASE 8: revisão do cliente sobre o site actual

Cliente percorrreu o site e deu indicações. Este ficheiro é o que ele disse, limpo.

**Duas fases distintas.** Faz a Fase 8A (mapa) separada da 8B (textos, cartões,
formulário), porque são áreas diferentes e não se misturam.

---

# FASE 8A — Mapa 3D

## A1. As províncias estão mal delimitadas
"Algumas províncias não estão limitadas corretamente, o país não é de limitações de
polícia, não é de forma correta."

Verificar `js/mapa-dados.js`: os limites das províncias estão geometricamente errados e
ou o contorno do país também. Corrigir a geometria, não a cor.

## A2. A rota do avião está errada
O avião parte de Pemba e vai para Maputo — **não depois continua**. O cliente quer:

```
Pemba -> Beira -> Sofala? -> Zambézia -> Tete -> Nampula -> Niassa -> Cabo Delgado
```

Ordem que ele ditou: Pemba, depois Beira, depois (transcrição duvidosa — ver nota),
depois Zambézia, depois Tete, depois Nampula, depois Niassa, depois Cabo Delgado.

**IMPORTANTE:** a transcrição do áudio é muito degradada nesta parte. A sequência
provável pretendida é percorrer as províncias por vizinhança geográfica, terminando em
Cabo Delgado. Confirma a ordem no `js/mapa-dados.js` e na `js/hero-voo.js` — se lá já
existe uma ordem geográfica coerente, respeita-a. **Não inventes.**

## A3. Faltam setas e etiquetas no mapa
- Cada salto de uma província para a seguinte tem de ter uma **seta** que indique o
  sentido
- Cada província tem de mostrar a **agência da JVI** nessa província: um ponto/marcador
  na província correcta
- O avião sai **da origem** de cada salto, não de um ponto fixo

---

# FASE 8B — Textos, cartões e formulário

## B1. Menu principal

| Actual | Novo |
|---|---|
| Serviços | **Nossos serviços** |
| Como funciona | Como funciona |
| Galeria | **Nosso trabalho** |
| Cobertura | Cobertura |
| Credenciais | **(remover — não existe página)** |
| A JVI | A JVI |
| Contactos | Contactos |

Acrescenta um ponto final (`.`) às tabs, para diferenciar dos links dentro das páginas.

## B2. Ícones e botões

- Botões de topo:follow the Gmail-style styling — fundo escuro, com ícones de correio
  Google. Vermelho, verde e branco, um por botão.
- **Botão do WhatsApp: meter o ícone real do WhatsApp.** Agora é um desenho genérico.
  O cliente notou e pediu explicitamente.
- Botão do telefone: está bom, não mexer.

## B3. Título da página 3
"Transporte de carga" -> **"Soluções integradas"**, e os subtítulos de transporte aéreo
e rodoviário mantém-se.

## B4. Botão "Descarregar perfil da JVI"
**Remover de dentro dos cartões.** Fica só no rodapé, junto da carta de apresentação.
Repetido três vezes no áudio — é insistente neste ponto.

## B5. Disposição das imagens nos cartões
Reorganizar para que **fiquem lado a lado**: a imagem de caixas no chão de um lado,
as imagens de encomendas para Zambézia do outro. Agora estão alternadas.

## B6. Textos dos cartões
Vários cartões com demasiado texto e títulos vagos. O cliente pediu:
- Títulos mais curtos e directos ("fluxo operacional" em vez de "fluxo operacional do
  colégio", etc.)
- Um cartão que se chame **"Outras províncias"** em vez do texto actual
- Reduzir texto; os cartões estão "muito carregados"

**As palavras exactas estão degradadas na transcrição.** Onde não tiver certeza, escreve
copy decente em português de Portugal para INTENTO, e anota a dúvida no commit.

## B7. Galeria "Nosso trabalho"
Passar a **carrossel**: uma imagem de cada vez, cards pequenos, a passar
automaticamente. Ciclo contínuo. Mostra os trabalhos reais da empresa.

## B8. Botão "Pedir orçamento" no topo
Tem de estar **sempre visível**, no topo da página. Se descer com a página, fica preso
(fixed/sticky). O cliente repetiu isto duas vezes — é o botão que converte.

## B9. Nova secção "Nossa empresa"
Secção nova que apresente a empresa, com a **imagem da carta de apresentação** da JVI
como elemento visual. Disposta com espaço, "sólida" — é a prova de que a empresa existe
para um cliente nuevo.

## B10. Rodapé
- Botão do WhatsApp com **ícone do WhatsApp** (mesmo requisito do B2)
- Botão "Como chegar à JVI" com **ícone do Google Maps**, a ocupar a largura toda do
  botão
- Não tirar o botão de orçamento do topo

---

# Formulário — correcções detalhadas

## C1. Passo 1 — tirar uma frase
Manter a primeira frase ("receba a confirmação") e **eliminar a segunda**, a que sugere
que a pessoa escreva mais qualquer coisa.

## C2. Passo 1 — exemplos nos campos
- Nome: exemplo tipo **"João Pedro"**
- Apelido: exemplo
- Província: o campo **já está certo**, não mexer na lista
- Morada: exemplo de bairro de Maputo. O cliente mandou procurar na internet uma palavra
  que descreva um bairro moçambicano real e usá-la como exemplo. **Faz a pesquisa.**
- Telefone: **tirar a palavra "WhatsApp"** do rótulo. É só "Telefone". O exemplo deve ser
  um número de exemplo, não o número real da empresa.

## C3. Passo 2 — títulos
- "O que transportamos" -> **"A sua carga"**
- A parte de **dimensões não é necessária** para quem usa telemóvel. Não a tornes
  obrigatória — deixa-a opcional ou esconde-a.
- Província de destino: **ordenada alfabeticamente** (ele reclamou duas vezes)
- Peso: exemplo **"15"** ou **"11,7"** — quer mostrar que aceita vírgula
- Descrição da mercadoria: exemplo entre parênteses, tipo **"(ex.: camisetas)"** — não é
  obrigatório, é um exemplo

## C4. Passo 2 — checkbox
Acrescentar uma **caixa de verificação verde**, e é obrigatória para enviar, sobre o
carregamento/embarque da mercadoria. Texto curto.

## C5. Passo 3 — formas de pagamento (correccão importante)
O cliente corrigiu isto explicitamente. As formas de pagamento são:

1. **e-Mola**
2. **M-Pesa** (não "cartão de crédito")
3. **Transferências bancárias** (não "cartão")

## C5. Passo 3 — formas de pagamento (correccão importante)
O cliente corrigiu isto explicitamente. As formas de pagamento são:

1. **e-Mola**
2. **M-Pesa** (não "cartão de crédito")
3. **Transferências bancárias** (não "cartão")

E **separado**, um bloco à parte sobre **quando** se paga:

- **No acto de envio**
- **No acto de levantamento, na província de destino**

O cliente disse: *"colocar acto de envio, não coloca acto de levantamento"* e depois *"só pode usar aquela opção... não é para usar aquela opção"* — o que quer dizer é que **as duas têm de ser opções válidas e nenhuma pode ser a única permitida**. Implementa as duas, com ambas seleccionáveis.

## C6. Termos e condições
- Aceitar os termos é **obrigatório** para enviar o formulário
- **Remover o card de Termos** da página
- Deixar o aviso legal no rodapé apenas

---

# Ordem de execução

1. Fase 8A — mapa (separada)
2. Fase 8B — menu, botões, ícones, rodapé, galeria, secção nova
3. Formulário — C1 a C6

Regras para todos:
- **NÃO faças perguntas.** Onde a transcrição é ambígua, decide tu, escreve copy decente
  em PT-PT e regista a dúvida em `docs/decisoes.md`
- **NÃO escrevas fora do projecto** (usa `./.tmp/`, nunca `AppData/Local/Temp`)
- **NÃO faças merge para `main`**
- Um commit por fase
- Testa o formulário depois das alterações
