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

A morada da JVI é **uma só**, confirmada pelo cliente, e é a que o site já usa:

**Av. 19 de Outubro, Terminal de Cargas Nº 113**

Usa **uma** coordenada, a dessa morada. **Precisas de a obter**: o endereço não
basta, a API quer lat/long. Coloca-a numa constante nomeada no topo do ficheiro, com
um comentário a dizer que é a morada confirmada e que deve ser substituída se a JVI se
mudar. Não inventes coordenadas — deixa o valor por preencher
é melhor do que um valor errado em produção, que mandaria o cliente para o mato.

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
