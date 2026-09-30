# Decisões do cliente —FINAL

Respondeste às três questões em aberto. São authoritative e substituem o que estiver
divergente no `BRIEFING-JVI.md` e no `docs/decisoes.md`.

## 1. IVA: 16% (confirmado)

O Airwaybill impresso diz 17%, mas **está errado**. O valor correcto é **16%**, que é o
que o site já usa. Não mudes nada na tabela de preços.

Mantém o bloco de aviso sobre a divergência no `docs/decisoes.md`, mas reescreve-o para
deixar de ser uma questão em aberto: regista que o cliente confirmou 16% e que o
impresso com 17% tem de ser corrigido internamente.

## 2. Telefone: só um

**+258 84 793 5035** é o único número correcto, por agora. Os restantes estão errados.

Acções:
- **Decisão já tomada, não perguntes:** remove todos os números antigos e deixa
  **apenas o +258 84 793 5035** em todo o site — contactos, JSON-LD, rodapé, links de
  `wa.me`, meta tags, `js/`, `functions/`. Sem "Alternativo", sem "Escritórios", sem
  lista de números. Um número, em todo o lado, nada mais.
- Se o `functions/submit.js` enviar para vários destinatários, deixa-o enviar para um só.
- A tua nota foi "assim que tiver outro mandarei" — por isso deixa o número como uma
  constante nomeada num único sítio, com um comentário a dizer que é o único número
  válido, para ser fácil de trocar mais tarde sem caçar por strings.
- Actualiza `docs/decisoes.md`: substitui a tabela de divergências por uma nota curta
  de que o cliente confirmou um único número e os outros foram removidos.
- Nos testes, `normalizarTelefone` testa a **formatação** do número que o cliente
  preenche, não os números da empresa — os números antigos aí são fixtures válidos.
  Não apagues esses testes por isso; só remove o que for número *da empresa*.
- Confirma que **não sobra nenhuma ocorrência** dos números antigos da empresa em
  nenhum ficheiro (grep por cada um, incluindo variantes sem o `+258`, com espaços e
  com pontos).

## 3. Morada: Av. 19 de Outubro, Terminal 113 (confirmado)

O poster com "Porta 27, Av. 04 de Outubro" está errado. O site já usa a morada correcta
— confirma e **remove do briefing** a variante do poster, para ninguém a voltar a usar.

Escreve por extenso: **Av. 19 de Outubro, Terminal de Cargas Nº 113**.

---

## Regras

- Não meças o que não te pedi: estas são as três mudanças, nada mais.
- Um commit só, com mensagem clara em português a dizer que são decisões do cliente.
- Não faças merge para `main` — deixa o commit na branch actual.
- Actualiza os testes se algum deles fixar um número ou morada antigos; se não fixar,
  deixa-os como estão.
- No fim, reporta: que ficheiros mudaste, o resultado do `npm test`, e o output do
  `grep` que confirma que os números antigos desapareceram.
