# BRIEFING — FASE 7: "Cliente Perto" (geolocalização + rota + contacto ao chegar)

## Objectivo comercial

A JVI tem muitos concorrentes na mesma zona. O momento certo para converter um cliente
é **quando ele está a chegar** ao terminal. Hoje o site perde esse momento: o cliente
vê a morada, segue para lá, e chega sem que ninguém saiba que ele está a chegar.

Se o site conseguir dizer "a 4 minutos de si, está a 300 m" e oferecer um botão de
chamada, a JVI aparece como a empresa que se preparou para o receber. A JVI também pode
sair ao estacionamento para o ir buscar.

## O que o cliente pediu

1. Um botão na tela inicial
2. Ao clicar, o site obtém a localização do cliente
3. Mostra direcções do cliente até à empresa, usando Google Maps
4. Quando o cliente estiver a menos de 2-5 minutos de chegar, aparece um pop-up
   para ligar à empresa
5. Objectivo: fechar o negócio antes de o cliente chegar lá fora

---

## Decisão do cliente: SEM API key do Google

O cliente decidiu **não usar a API do Google**. Não há API key, não há billing, não há
espera por aprovação.

Isto é válido e é a decisão certa para um site deste tamanho. O que muda:

- **A Fase 7B (pop-up de proximidade e aviso à JVI) fica DESACTIVADA.** Sem
  `duration_in_traffic` não há estimativa de tempo, e sem estimativa não há como
  decidir quando o cliente está "a 5 minutos".
- **A Fase 7A fica activa e é entregue sem key**, usando o link de direcções do Google
  Maps, que é gratuito e não exige conta.

**Não inventes estimativas.** Se não há API, não há número de minutos. É melhor um
botão que abre direcções verdadeiras do que um "está a 18 minutos" inventado.

### Fase 7A (sem key) — o que se implementa

- Botão na tela inicial: **"Como chegar à JVI"**
- Ao clicar, abre o Google Maps em direcções para a empresa. Usa o formato oficial,
  sem key e sem tracking:
  `https://www.google.com/maps/dir/?api=1&destination=<url-encoded>&travelmode=driving`
- **A JVI não sabe a posição de ninguém.** O cliente tem a morada e as direcções, e
  chega lá por si. Ponto final.
- O botão é secundário: a acção primária continua a ser "Pedir orçamento".

Se a 7A te parece pouco, há uma alternativa honesta que **não precisa de key** e
mantém parte da ideia original: quando o cliente preenche o formulário de orçamento, o
aviso para a JVI no WhatsApp passa a incluir **o número de telefone do cliente**, e a
JVI **liga para ele** — que era o que o cliente queria. Não é geolocalização, mas é o
"a empresa sabe e telefona" sem nenhum browser no meio. O `DECISOES-CLIENTE.md` já põe
o telefone como constante única; garante que o número do cliente vai na mensagem.

Implementa **isto** como alternativa à 7B, e deixa a 7B documentada em
`docs/decisoes.md` como "possível mais tarde, requer API key do Google".

---

## LIMITAÇÕES DO BROWSER — lê isto antes de implementar

Estas não sãoOpções de implementação. São imposições da plataforma. Qualquer solução
tem de as respeitar, e o desenho abaixo já as tem em conta.

### L1. Não se pode pedir a localização sem o cliente carregar no botão

A geolocalização web exige **consentimento explícito e por interacção directa**. Não há
`navigator.geolocation.getCurrentPosition()` sem um clique. O botão do ponto 1 é
obrigatório, não é só por UX — é por lei. Um pop-up automático a pedir localização é
considerado prática abusiva e os browsers bloqueiam-no.

O botão pode ser rotulado de forma útil: **"Quanto falta até à JVI?"** ou
**"Indicar-me o caminho"** — é honesto e o cliente clica porque lhe serve.

### L2. O browser não permite disparar uma chamada sozinho

`tel:...` exige sempre um gesto do utilizador. **Nenhum script, nenhum evento, nenhuma
temporização permite lançar a chamada.** A chamada *do cliente para a JVI* não pode ser
automática.

**Mas a chamada da JVI para o cliente é uma chamada normal, e essa é a solução.**

Se o site enviar o número do cliente à JVI com a posição e a hora de chegada estimada,
a JVI **liga de volta** — e essa chamada é um acto humano, do outro lado, num telefone
normal. Não há browser nenhum no meio.

Isto é melhor do que o cliente clicar para ligar:

- O cliente não tem de fazer nada. Pedir que lhe liguem é mais natural do que ligar
  ele a um número desconhecido a meio de uma viagem.
- A JVI sabe **aonde** o cliente está e **quando** chega, antes de pegar no telefone.
  Atende com "chegamos em 4 minutos" em vez de "sim, onde fica?".
- A JVI pode **sair ao encontro** do cliente se a zona for conhecida, que é
  exactamente o que o cliente pediu e que nenhum botão no ecrã do cliente consegue.

Isto **torna a L2 irrelevante** e satisfaz o requisito do cliente por completo. Ver
"Desenho" abaixo, onde é a solução principal e não um plano B.

### L3. O tracking só funciona com o separador aberto e visível

`watchPosition` pára quando o separador vai para segundo plano. No telemóvel, se o
cliente minimiza o browser ou o ecrã apaga, deixamos de saber onde está.

Isto é aceitável: o cliente está a ver o ecrã, está a conduzir ou a caminhar. Mas o
código tem de lidar com a pausa e retomar sem mostrar bogus, e tem de ter timeout —
não ficar a mostrar "a 200 m" congelado se o sinal se perdeu.

### L4. Distância em metros não é tempo de viagem

"2-5 minutos" implica conduzir. A geolocalização dá uma linha recta, não um percurso
de estrada. A distância em linha recta entre dois pontos é sempre **inferior ou igual**
à real, e a diferença é grande numa cidade.

A consequência prática: se calibrarmos o raio por metro, nunca coincide com o tempo
real. A solução é pedir direcções à API do Google com o ponto de origem e destino, e
usar o `duration_in_traffic` que o Google devolve. Isso sim é tempo real de viagem.

---

## Desenho

### A ideia central: avisar a JVI, não o cliente

O objectivo é que **a JVI saiba que o cliente está a chegar, com o número dele, a
posição e a hora**. Tudo o resto decorre daí.

A chamada *da JVI para o cliente* é uma chamada de telefone normal. Ninguém está a
contornar nada, não há browser no meio, e a JVI atende uma pessoa que já sabe onde
está e quando chega. Se alguém na JVI puder sair ao encontro, sai.

O pop-up no ecrã do cliente é apenas a confirmação de que o aviso foi dado. Não é a
funcionalidade — é o feedback visual que evita que ele pense que nada aconteceu.

### Geometria da empresa

**Coordenadas confirmadas pelo cliente: `-25.929668, 32.572424`**

O terminal de cargas é a **empresa-mãe**: a JVI e os concorrentes são os "filhos" que
operam lá dentro. Por isso a JVI partilha a morada e as coordenadas com todos os outros
— e é isso que torna a concorrência um problema: estão todos no mesmo terminal, à vista
de todos.

Este link do cliente é a fonte:
`https://maps.apple/p/eQqujn3zMr8DKC` (Terminal de Cargas, Maputo International Airport,
descrito no Apple Maps como "Airport Terminal · Maputo International Airport")

**Não substituas esta coordenada por outra.** Foi o cliente que confirmou. A descrição
dizer "Aeroporto" pode sugerir que é o terminal errado — não é, é o terminal onde todos
operam.

A morada que o site mostra em texto é **Av. 19 de Outubro, Terminal de Cargas Nº 113**
(confirmada pelo cliente). As coordenadas e a morada textual não precisam de coincidir
ao metro: as coordenadas servem para o mapa apontar ao terminal, o endereço serve para
a pessoa chegar à porta certa lá dentro.

O **telefone** é outro assunto e não vem do link: é **+258 84 793 5035**, o único
confirmado. O link do Maps traz um número diferente (+258 84 511 1211) que **não** é
da JVI — não o uses em lado nenhum.

Coloca as coordenadas numa constante nomeada no topo do ficheiro, com um comentário a
explicar o que são (terminal partilhado, empresa-mãe) para ninguém as substituir por
outra pesquisa.

### Duas fases de implementação

**Fase 7A — rota, sem tracking** (o valor real, e é simples)

- Botão na tela inicial: "Indicar-me o caminho para a JVI"
- Ao clicar, abre o Maps com direcções para a empresa
- **Com a API `directions` do Google** (backend, porque a key não pode ir no cliente):
  devolve `duration_in_traffic` e a distância do percurso
- Mostra a estimativa: **"Está a cerca de 18 minutos"**, e o mapa

**Fase 7B — proximidade e aviso à JVI** (o que o cliente pediu)

- Depois de pedir a rota, `watchPosition` acompanha o cliente
- Quando o Google estimar **≤ 5 minutos** até ao terminal, dispara **uma vez só**
- Ao disparar:
  1. Envia à JVI, via `functions/`, o aviso de chegada — ver "O aviso" abaixo
  2. Mostra o pop-up de confirmação ao cliente
- O pop-up diz ao cliente: **"A JVI já sabe que está a chegar"**, com a hora estimada
  de chegada. E dá-lhe uma saída se ele preferir ligar ele próprio.

**O aviso** que a JVI recebe, por WhatsApp para +258 84 793 5035 e por email, tem de
ser curto e accionável. Formato sugerido:

```
🚚 JVI — cliente a chegar

Nome: <nome>
Telefone: <telefone>
Chega em: ~4 minutos (<hora prevista>)
Distância: ~1,2 km
Veio de: <bairro/ zona, se reversível>
Mercadoria: <o que escreveu, se preenchido>
```

O "Veio de" só é incluído se for derivável de um nome de bairro ou Via. **Nunca enviar
a coordenada exacta** — para a JVI saber a zona chega, e guardar a posição de um
cliente é um risco que não vale a pena. Ver "Privacidade".

Depois disto, a JVI **liga**. A ligação é o acto seguinte, e é humano.

**Faz a 7A primeiro, e só depois a 7B.** A 7A entrega valor sem nenhum tracking, e é
testável sem um telemóvel. A 7B precisa de ser testada a andar.

### O limiar de proximidade

Não uses metros fixos. Usa **tempo**: pop-up quando o Google estimar **≤ 5 minutos**
de viagem. É o número que o cliente disse, é o que ele percebe, e é o que importa.

Aos 5 minutos de viagem num trajeto urbano, o cliente está a 1-3 km. Não é "quase a
chegar à porta", é "está a decidir se vira a esquina ou segue em frente" — que é
exactamente o momento que interessa.

### API do Google

Precisa de uma **API key com billing activado** na Google Cloud, com as APIs Directions
(e Geocoding, se precisares de converter morada em coordenada). Custa alguns dólares por
mês para um site com este volume, mas **tem de ser uma key de browser com restrição de
referrer** (HTTP referrer) — nunca uma key genérica no cliente.

A chamada tem de ser **server-side**. A key no `index.html` fica visível e abusável.
A `functions/` já tem o padrão de serverless functions para a Netlify — segue-o, e
consulta o `README.md` do projecto para veres como lá estão feitas.

Deixa a key em variável de ambiente, nunca em código. O projecto já tem um
`.env.example` — acrescenta lá o nome da variável.

### Se não houver key

O site tem de funcionar na mesma. Fallback: usar o link de direcções do Google Maps
(`https://www.google.com/maps/dir/?api=1&destination=...`), que **não precisa de key**,
não dá tempo estimado, mas dá direcções. A 7B fica desactivada sem estimativas.

Implementa sempre o fallback. O botão tem de funcionar desde o primeiro dia, mesmo que
a key demore uma semana a ser aprovisionada.

### Privacidade

Isto é tracking de localização. Tem de ser transparente ou não funciona:

- **Pedir o consentimento em texto claro** antes de activar: "Vamos usar a sua
  localização para lhe mostrar o tempo até à JVI. Não guardamos a sua localização."
- **A coordenada do cliente nunca é guardada pela JVI.** O aviso manda um nome de zona
  ou bairro quando é possível, nunca lat/long. O tracking corre no browser do cliente.
- **O aviso de chegada é opt-in explícito.** Nada de tracking contínuo: o cliente
  active-o, e é aí que ele aceita que a JVI saiba a zona por onde vai.
- Botão para **parar** o tracking, sempre visível enquanto estiver activo.
- Nada disto entra no `contactPoint` do JSON-LD.
- **Sem isto a 7B não entra.** Se não der para explicar ao cliente, em português
  simples, o que vai acontecer, a funcionalidade não é publicada.

### Se não for possível sem key

Documenta na decisão: "7B desactivada por falta de API key". A 7A com o link de Maps
continua a funcionar. Não inventes estimativas.

---

## Notas de integração com o resto

- O botão novo é a **segunda** acção primária da tela. A primeira continua a ser
  "Pedir orçamento". **Duas acções primárias é violar a Fase 6** — se ficarem lado a
  lado com o mesmo peso visual, dá-as hierarquia: orçamento como principal, direcções
  como secundária, mesmo que o botão de direcções seja grande e tocável.
- Número: **+258 84 793 5035**, a constante única, conforme a Fase anterior.
- O tracking só deve começar **depois** de o cliente pedir a rota. Nunca ao abrir a
  página.
- O pop-up de proximidade **não pode** aparecer sobre o pop-up do orçamento. Se ambos
  estiverem abertos, o de proximidade espera.
- A pop-up de proximidade tem de fechar como qualquer outra: ESC,
  botão de fechar, e não roubar o foco.

## Como entregar

- Commits separados para a 7A e a 7B
- Testes: a lógica de comparação de distância e a de formatação do tempoestimated
  são funções puras — testa-as, com os limiares à volta dos 5 minutos
- Actualiza `.env.example` e `docs/decisoes.md`
- Actualiza o briefing se alguma decisão mudar
- **Reporta explicitamente:** a 7B está activa ou desactivada, e porquê

---

## O que foi entregue (Setembro de 2026)

A **7A está ACTIVA**. A **7B está DESACTIVADA**, e a alternativa que não
precisa de key também está activa.

| | Estado | Onde |
|---|---|---|
| **7A** — botão "Como chegar à JVI" | **Activa** | `index.html` (hero) + `js/rota.js` |
| **Alternativa** — a JVI liga de volta | **Activa** | `js/orcamento.js` (`msgEmpresa`) e `functions/submit.js` (`textoWA`, `textoEmail`, `CAMPOS`) |
| **7B** — aviso de aproximação | **Desactivada** | Nada implementado. Ver `docs/decisoes.md` D16. |

**Porque é que a 7B não foi feita, e não vai ser feita sem key.** O limiar que
o cliente pediu — "2-5 minutos" — é um limiar de **tempo**, não de metros. A
única fonte de tempo real de viagem é o `duration_in_traffic` da API Directions,
que exige API key com billing. A geolocalização do browser só dá linha recta, e
calibrar o raio por metro nunca coincidiria com o tempo real. Publicar um
"está a 18 minutos" sem fonte seria inventar. Fica para mais tarde, se houver
key — e é reactivável sem mexer no botão.

**O que a alternativa entrega, e porque é o que o cliente queria.** O número
do cliente vai no aviso à JVI nos três canais, nomeado como "Telefone do
cliente" e normalizado para `+258 …`, e a JVI **liga**. É uma chamada normal,
de um telefone normal, sem browser no meio. Não é geolocalização e não diz ao
JVI que o cliente está a chegar — mas é o "a JVI sabe e telefona" que o
cliente descreveu, e não precisa de API key nenhuma.

**O que ficou por confirmar com o cliente:** a JVI sabe que pode ligar de volta
a partir do aviso? O número é sempre o melhor para contacto directo, ou
convém pedir um segundo número no formulário (o `planoEnvio` já suporta)?
