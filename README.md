# JVI Carga & Serviços, Lda — Landing Page

Landing page institucional e formulário de orçamento (Airwaybill) para a
JVI Carga & Serviços, Lda., empresa moçambicana de transporte de carga,
correio e encomendas.

Inclui também a **Carta de Apresentação de 10 páginas** (HTML → PDF).

---

## 1. Como ver o site localmente

Qualquer servidor estático serve. Por exemplo:

```powershell
cd "D:\JVI\Trabalho Jvi"
python -m http.server 8765
# abrir http://127.0.0.1:8765
```

A carta gera-se em `http://127.0.0.1:8765/carta/`.

---

## 2. Estrutura

```
Trabalho Jvi/
├── index.html              Landing page completa
├── package.json            "type": "module" + script de testes
├── css/
│   ├── styles.css          Tokens da marca, layout e conteúdo editorial
│   ├── orcamento.css       Assistente de 3 passos, confirmação, ecrã de sucesso
│   ├── galeria.css         Galeria e luzbox
│   ├── privacidade.css     Diálogo da política de privacidade
│   └── fontes.css          Fontes auto-alojadas
├── js/
│   ├── main.js             Menu, scroll, hero 3D, mapa, modal, FAQs
│   ├── precos.js           Fórmula de preço — puro, sem DOM, tem testes
│   ├── orcamento.js        Assistente, validação, mensagens de WhatsApp — puro + DOM
│   ├── galeria.js          Luzbox acessível
│   ├── hero-voo.js         Voo da carga no hero
│   └── mapa-dados.js       Fronteiras de Moçambique (geoBoundaries ADM1)
├── tests/                  41 testes com o runner nativo do Node
│   ├── precos.test.js
│   ├── orcamento.test.js
│   ├── confirmacao.test.js
│   ├── envio.test.js
│   └── submit.test.js
├── tools/
│   ├── otimizar-galeria.py    Converte as fotos da galeria para WebP
│   └── verificar-html.py      Confere ids, data-attrs, ficheiros e âncoras
├── assets/
│   ├── logo.webp            Logo JVI (verde/laranja), 46 px de altura — header e rodapé
│   ├── logo-branco.png     Versão branca (fundos escuros)
│   ├── logo-full.png       Logo completo com "Carga & Serviços, Lda"
│   ├── favicon.png
│   ├── fonts/              Plus Jakarta Sans auto-alojada
│   └── img/galeria/        Fotografias reais da operação, em WebP
├── functions/submit.js     Netlify Function: regista o pedido (plano B)
├── carta/                  Carta de apresentação (10 páginas A4)
│   ├── index.html
│   ├── style.css
│   ├── mapa.js
│   └── jvi-carta-apresentacao.pdf   (gerado)
├── docs/decisoes.md        Registo das decisões tomadas e do que ficou por confirmar
├── netlify.toml
└── .env.example            Chaves a preencher (ver abaixo)
```

---

## 3. Chaves de ambiente (Fase do formulário)

O formulário **funciona já sem nenhuma chave** — nesse caso o lead é
encaminhado para o WhatsApp/e-mail e o aviso "registo automático
indisponível" é mostrado. Para gravar os pedidos, preencher:

| Variável | Para que serve | Onde obter |
|---|---|---|
| `RESEND_API_KEY` | envia o e-mail com o pedido | https://resend.com/api-keys |
| `EMAIL_DE` | remetente | `onboarding@resend.dev` até ter domínio verificado |
| `EMAIL_PARA` | destinatário | `jvicargaservicos@gmail.com` |
| `SHEET_ID` | folha de cálculo | o ID no URL da folha, entre `/d/` e `/edit` |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | autenticação na Google | Google Cloud > Service Accounts, em JSON, numa linha |

Instruções passo-a-passo em `.env.example`.

**Onde configurar:** Netlify → *Site settings* → *Environment variables*.
Ou, em desenvolvimento, criar um ficheiro `.env` (já está no `.gitignore`).

### Folha "Pedidos"
Criar a folha, renomear a aba para `Pedidos` e ter uma linha de cabeçalho
com as 13 colunas na mesma ordem que `CAMPOS` em `functions/submit.js`.
Ao partilhar a folha, dar **Editor** ao e-mail da conta de serviço.

---

## 3b. Correr os testes

Sem dependências: usa o runner nativo do Node (18 ou superior).

```powershell
npm test
```

São 41 testes. Os que mais importam são os de `tests/precos.test.js`, que
verificam a tabela de preços e provam que **o preço nunca desce quando o peso
sobe** (monotonicidade testada de 0,02 a 50,01 kg, em passos de 10 g).

A fórmula de preço e a construção das mensagens de WhatsApp vivem em
`js/precos.js` e `js/orcamento.js`, que são **puros** — não tocam no `document`.
É por isso que o mesmo código que corre no browser é o que os testes verificam,
sem uma segunda implementação para manter em sincronia.

Verificação sem browser, depois de mexer no `index.html`:

```powershell
python tools/verificar-html.py
```

Confirma que todos os `id`, todos os `data-attribute` e todos os ficheiros que
o JS procura existem, e que todas as âncoras internas têm destino.

Ao trocar as fotografias da galeria:

```powershell
python tools/otimizar-galeria.py
```

Redimensiona para 1600 px de lado longo, respeita a orientação EXIF e grava
WebP. Apague depois os `.jpg` originais.

---

## 4. Publicar na Netlify

```powershell
npx netlify-cli deploy --dir . --functions functions --prod
```

Ou pelo painel: **Add new site → Deploy manually**, com a pasta `Trabalho Jvi`
e a directoria de funções `functions`.

O `netlify.toml` já define o publish, as funções, o cache dos assets e os
headers de segurança.

---

## 5. Gerar a carta em PDF

A carta é HTML com `@page A4` e queima-se para PDF pelo Chrome:

```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" `
  --headless=new --disable-gpu --no-sandbox `
  --no-pdf-header-footer --print-to-pdf-no-header `
  --print-to-pdf="carta\jvi-carta-apresentacao.pdf" `
  "http://127.0.0.1:8765/carta/index.html"
```

Ou `Ctrl+P` → *Guardar como PDF* → A4, sem cabeçalhos, *Gráficos de
segundo plano* ligado.

**Ao alterar o conteúdo da carta, voltar a gerar o PDF** — o ficheiro
descarregado pela página é o PDF, não o HTML.

---

## 6. Dados da empresa usados

| | |
|---|---|
| NUEL | 100449137 |
| NUIT | 400501424 |
| Licença | 8732/11/04/PS/2014 |
| **WhatsApp — Operações** | **+258 84 793 5035** |
| Escritórios | +258 87 555 8005 · +258 84 470 0012 |
| Alternativo | +258 84 554 6151 · +258 82 555 8005 |
| Fixo | 21 089 459 |
| Email | jvicargaservicos@gmail.com |
| Sede | Av. 19 de Outubro, Terminal de Cargas Nº 113, Aeroporto de Maputo |

⚠️ **Os telefones ainda não estão confirmados.** O briefing já avisava que havia
divergências; ao ver as fotografias, há mais do que o briefing registava. A
tabela completa da divergência está em
[`docs/decisoes.md`](docs/decisoes.md#números-de-telefone-divergências).
Nenhum número foi apagado do site — acrescentar um nunca custa, tirar um pode.

**Para alterar contactos:** `index.html` (secção Contactos, botões fixos, JSON-LD)
e `js/orcamento.js` (constante `JVI_WHATSAPP`, o número para onde vão as
mensagens do formulário — tem teste próprio).

Para alterar contactos: `js/main.js` (constante `JVI`, usada pelo formulário)
e `index.html` (secção Contactos, botões fixos e rodapé).

---

## 7. Identidade visual

Extraída do logo original:

| Token | Hex |
|---|---|
| Verde JVI | `#A9CF44` |
| Verde escuro | `#82C91E` |
| Laranja JVI | `#EA8240` |
| Base escura | `#0F172A` |
| Cinza claro | `#CBD5E1` |

Estão em `:root`, no topo de `css/styles.css`. Mudar a marca = mudar aí.

---

## 8. As imagens

### Galeria (`assets/img/galeria/`)

São as fotografias **reais** da operação, fornecidas pelo cliente, e já
convertidas para WebP (lado longo ≤ 1600 px, qualidade 80). A galeria usa 11
delas; as outras 7 ficaram no repositório como reserva, e não são carregadas
porque não estão referenciadas.

Ao substituí-las: deite os `.jpg` em `assets/img/galeria/`, corra
`python tools/otimizar-galeria.py`, apague os `.jpg`, e actualize o `alt` de
cada `<button class="gal__item">` em `index.html`.

> O `alt` de cada fotografia foi escrito **depois de ver a foto**. Três das
> descrições do briefing não correspondiam ao que estava na imagem — a tabela
> está em [`docs/decisoes.md`](docs/decisoes.md#fotografias-onde-o-briefing-estava-errado).
> Se trocar as fotos, ver também as fotos antes de escrever o `alt`.

### Imagens de serviço (`assets/img/`)

`camiao.webp`, `terminal.jpg` e `aviao.jpg` vieram da carta de apresentação e
são **placeholders** — o camião é um camião de stock, não um da JVI. Para usar
as fotos reais, substituir com o **mesmo nome**:

| Ficheiro | Onde é usado | Dimensões reais | Peso |
|---|---|---|---|
| `camiao.webp` | Serviço 01 + Contactos | 800×527 | ~37 KB |
| `terminal.jpg` | Serviço 02 | 1120×1120 | ~152 KB |
| `aviao.jpg` | Serviço 03 | 1116×1491 | ~89 KB |

Mantenha `width`/`height` no HTML iguais às dimensões reais, senão a caixa salta
ao carregar.

O `logo.webp` também pode ser substituído, **mantendo a proporção e o alfa**.
Repare no tamanho de render: o CSS pinta-o a 46 px de altura, por isso 184 px
chega com folga para ecrãs de densidade 2.

Depois de substituir imagens, medir e converter:

```powershell
python tools/otimizar-marca.py      # logo e camião -> WebP; aponta duplicados
python tools/otimizar-galeria.py    # fotografias da galeria -> WebP
```

O `otimizar-marca.py` imprime também quaisquer ficheiros **byte-idênticos**
uns aos outros. Já apanhou um: `logo-cor.png` era cópia exacta de `logo.png`,
189 KB no repositório e zero referências.

---

## 9. Detalhes técnicos

- **Sem dependências**, sem passo de build. Abre directamente no browser.
- **Texto** (HTML + CSS + JS) 205 KB brutos, ~52 KB comprimidos. A Netlify serve
  Brotli por omissão, portanto no fio é ainda menos.
- **Primeiro ecrã** ~253 KB comprimidos, dos quais **178 KB eram um único PNG de
  logo que pintava 38×46 px**. Passou a `logo.webp`, 10,8 KB.
- **Fotografias da galeria** 788 KB, todas com `loading="lazy"`,
  `decoding="async"` e dimensões correctas, e nenhuma no primeiro ecrã.
- **O PDF da carta** (1,7 MB) só descarrega quando o utilizador clica. Não há
  `<embed>`, `<iframe>` nem `preload` a antecipar o fetch.
- **Fontes**: 4 subsets auto-alojados, `font-display: swap` e `unicode-range` nas
  20 regras. Só o subset **latino** é pré-carregado — o português não precisa de
  cirílico nem vietnamita.
- **`modulepreload`** nos 5 módulos de que `main.js` importa: as transferências
  arrancam em paralelo durante o parse do HTML, em vez de o browser só descobrir
  os imports depois de `main.js` chegar e ser pré-parseado.
- **Canvas**: `dpr` limitado a 2, `prefers-reduced-motion` respeitado, e os dois
  com `IntersectionObserver` a **pausar** quando saem do ecrã.
- **Responsivo** de 360 px a 1920 px, testado sem overflow horizontal.
- **`prefers-reduced-motion`** respeitado: sem rota animada nem caixas 3D.
- **Acessibilidade**: ver a secção 12.
- **SEO**: meta description, Open Graph, Twitter Card, `robots.txt`,
  `sitemap.xml`, JSON-LD `Organization` com os três telefones, cabeçalhos
  `h1`–`h4` em ordem.

---

## 10. Segurança e privacidade

| Medida | Onde |
|---|---|
| Escape de HTML em todo o input | `functions/submit.js` → `esc()` |
| Protecção contra CSV/formula injection na Sheet | `functions/submit.js` → `celula()` |
| Limite de tamanho por campo (8–1200 chars) | `functions/submit.js` → `LIMITES` |
| Validação estrita de email e telefone | `functions/submit.js` → `RE_EMAIL`, `RE_TEL` |
| Honeypot + descarte de formulários < 3 s | campo `website` e `_t` |
| Rate limit: 1 pedido / 20 s por IP | `functions/submit.js` → `Janela` |
| Limite de corpo do pedido (20 KB) | `functions/submit.js` |
| Métodos não-POST recusados (405) | `functions/submit.js` |
| CSP, HSTS, `X-Frame-Options`, `nosniff`, `Permissions-Policy` | `netlify.toml` |
| Consentimento obrigatório antes de enviar | `index.html` + `js/main.js` |
| Política de privacidade publicada | diálogo acessível no rodapé |

**Zero cookies.** A tipografia é auto-hospedada em `assets/fonts/`, portanto
não há pedidos ao Google Fonts e o IP do visitante não sai do site.
Verificado: `performance.getEntriesByType('resource')` devolve `[]`.

**Antes de publicar**, define no Netlify o domínio real e actualiza em
`index.html` (`<link rel="canonical">`, Open Graph) e em `robots.txt` +
`sitemap.xml`. Hoje apontam para `https://jvicargaservicos.co.mz/`.

---

## 11. Geração do PDF da carta

Ao alterar `carta/index.html`, `carta/style.css` ou `carta/mapa.js`, volta a
gerar o PDF (ver secção 5). O botão de download na página e no selo
`Descarregar perfil da JVI` apontam para o ficheiro em
`carta/jvi-carta-apresentacao.pdf` — se o PDF não for regenerado, o
utilizador vê a versão antiga.

---

## 12. Acessibilidade

O que está implementado, e onde:

| Medida | Onde |
|---|---|
| Um único `h1`; `h2`–`h4` em ordem, sem saltos | `index.html` |
| Foco visível em tudo o que recebe foco | `:focus-visible` em `css/styles.css` |
| Nenhum `outline: none` sem substituto visível | `css/styles.css` |
| Erro de campo ligado por `aria-describedby` | `js/orcamento.js` → `iniciarOrcamento()` |
| Foco no primeiro campo com erro ao bloquear um passo | `js/orcamento.js` → `valido()` |
| Um erro por vez, não o formulário inteiro a vermelho | `js/orcamento.js` |
| Passo e progresso anunciados | `data-conta` com `aria-live="polite"`, `aria-valuenow` na barra |
| Modais com `role="dialog"`, `aria-modal`, foco preso, `Escape`, e foco devolvido | `js/main.js` (modal e confirmação), `js/galeria.js` (luzbox) |
| Cada fotografia da galeria é um `<button>`, abre com Enter | `index.html`, `js/galeria.js` |
| Navegação da luzbox com ← e → | `js/galeria.js` |
| `prefers-reduced-motion` respeitado em todas as animações | `css/styles.css` |
| Espaçamento e corpo de texto na escala de 4/8 px e ≥ 16 px | `css/*.css` |

**Por testar à mão, ainda:** leitor de ecrã (NVDA ou VoiceOver) a percorrer o
assistente de 3 passos, e contraste real com o filtro de daltonismo. Nenhum
browser estava ligado quando este trabalho foi feito, por isso estas duas
verificações ficaram por fazer.
