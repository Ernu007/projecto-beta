#!/usr/bin/env python3
"""Monta a directoria de publicação (`dist/`) a partir da raiz.

Porquê isto existir: o `netlify.toml` publica `dist`, não `.`. A raiz
contém material que não deve ir para a Internet —

  docs/                 notas internas: quais telefones não estão
                         confirmados, a divergência do IVA (17% no
                         Airwaybill impresso contra 16% no briefing),
                         a divergência de moradas
  BRIEFING-JVI.md       o briefing do cliente, com o número de WhatsApp
                         e a lista de contactos
  package.json, tests/  o livro de receitas da suite
  tools/, .env.example, netlify.toml, .gitignore

Com `publish = "."` tudo isto ficava em /docs/decisoes.md e afins, uma
linha de URL cada, descarregável por qualquer pessoa. A lista abaixo
é explícita de propósito: acrescentar um ficheiro ao topo passa a
exigir uma decisão, em vez de o publicar por omissão.

Uso:  python tools/publicar.py
Saída: dist/ — o que a Netlify serve
"""
import shutil
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
DIST = RAIZ / "dist"

# O que vai para o site. Tudo o que não está aqui NÃO é publicado.
INCLUIR_ARVORE = ["index.html", "robots.txt", "sitemap.xml", "carta"]
INCLUIR_PASTAS = ["css", "js", "assets"]


def copiar_arvore(origem: Path, destino: Path) -> int:
    """Copia uma árvore, ignorando o que for código-fonte."""
    n = 0
    if origem.is_file():
        destino.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(origem, destino)
        return 1
    for p in sorted(origem.rglob("*")):
        if not p.is_file():
            continue
        # nada de código-fonte, nada de notas internas
        partes = set(p.relative_to(origem).parts)
        if partes & {"node_modules", ".git", ".superpowers", "tests", "tools", "docs"}:
            continue
        if p.suffix in {".py", ".md"} and p.name != "README.md":
            continue
        rel = p.relative_to(origem)
        destino_rel = destino / rel
        destino_rel.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(p, destino_rel)
        n += 1
    return n


def main() -> int:
    if DIST.exists():
        shutil.rmtree(DIST)
    DIST.mkdir(parents=True)

    total = 0
    for nome in INCLUIR_ARVORE:
        p = RAIZ / nome
        if not p.exists():
            print(f"AVISO: {nome} não existe")
            continue
        total += copiar_arvore(p, DIST / nome)
    for pasta in INCLUIR_PASTAS:
        p = RAIZ / pasta
        if not p.exists():
            print(f"AVISO: {pasta}/ não existe")
            continue
        total += copiar_arvore(p, DIST / pasta)

    # o .html.valida.txt e lixo de auditoria anterior
    for lixo in DIST.rglob("*.valida.txt"):
        lixo.unlink()
        total -= 1

    tamanho = sum(f.stat().st_size for f in DIST.rglob("*") if f.is_file())
    print(f"dist/ — {total} ficheiros, {tamanho / 1024:.0f} KB")

    # Conference: nada que não deva estar lá
    problemas = []
    for f in DIST.rglob("*"):
        if f.is_file() and f.suffix in {".py", ".md"} and f.name != "README.md":
            problemas.append(f)
        if f.is_file() and f.name in {".env", "package.json", "netlify.toml", "BRIEFING-JVI.md"}:
            problemas.append(f)
    if problemas:
        print("\nPROBLEMAS — ficheiros internos na publicação:")
        for p in problemas:
            print(f"  - {p.relative_to(DIST)}")
        return 1
    print("OK: nada de código-fonte nem notas internas em dist/.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
