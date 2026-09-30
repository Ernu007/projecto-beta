"""Verificacao estatica do ficheiro: confirma que todos os IDs e
data-attributes que o JS procura existem no HTML, e que os ficheiros
referenciados existem. Sem browser, sem jsdom.

Uso: python tools/verificar-html.py
"""
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
HTML = RAIZ / "index.html"

# Selectores que o JS consulta, com o ficheiro onde sao usados.
SELECTORES = {
    "js/main.js": [
        "modal", "orcRaiz", "tplOrc", "tplOrc", "ano", "menu", "menuBtn",
        "menuFundo", "header", "barraTopo", "canvasHero", "canvasMapa",
        "fluxoLinha", "heroRota", "heroRotaTxt", "legalPrivacidade",
    ],
    "js/orcamento.js": [
        # dentro do <template> ou do modal
        "tplOrc", "orcRaiz",
    ],
}

# Atributos data-* que o JS procura e que têm de existir no HTML.
# `orc:pronto` e `rearmar` ficam de fora de propósito: são CustomEvent
# despachados pelo JS, não atributos presentes no markup.
DATA_ATTRS = [
    "abrir-orc", "fechar", "fechar-legal", "legal", "orc", "ant", "seg",
    "conta", "estado", "consent", "preco", "passos", "campo", "passo",
    "seccao", "ativa", "p-base", "p-iva", "p-total",
]


class Recoletor(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.ids = set()
        self.datas = set()
        self.srcs = set()
        self.hrefs = set()
        self.rotas_inexistentes = []

    def handle_starttag(self, tag, attrs):
        d = dict(attrs)
        if "id" in d:
            self.ids.add(d["id"])
        for k, v in d.items():
            if k.startswith("data-"):
                self.datas.add(k[5:])
        if tag in ("script", "link"):
            u = d.get("src") or d.get("href") or ""
            if u and not u.startswith(("http", "#", "data:", "mailto:", "tel:")):
                self.srcs.add(u)
        if tag == "a" and d.get("href", "").startswith("#") and len(d["href"]) > 1:
            self.hrefs.add(d["href"][1:])
        if tag == "img" and d.get("src"):
            self.srcs.add(d["src"])


def main() -> int:
    texto = HTML.read_text(encoding="utf-8")
    r = Recoletor()
    r.feed(texto)

    problemas = []

    # 1. IDs que o JS procura
    for ficheiro, ids in SELECTORES.items():
        for i in ids:
            if i not in r.ids:
                problemas.append(f"id ausente #{i} (procurado por {ficheiro})")

    # 2. data-attributes que o JS procura
    for a in DATA_ATTRS:
        if a not in r.datas:
            problemas.append(f"data-attribute ausente data-{a}")

    # 3. ficheiros referenciados
    for s in sorted(r.srcs):
        if not (RAIZ / s).exists():
            problemas.append(f"ficheiro inexistente: {s}")

    # 4. ancoras internas
    for h in sorted(r.hrefs):
        if h not in r.ids:
            problemas.append(f"ancora interna sem destino: #{h}")

    print(f"IDs: {len(r.ids)}  data-attrs: {len(r.datas)}  ficheiros: {len(r.srcs)}  ancoras: {len(r.hrefs)}")
    if problemas:
        print("\nPROBLEMAS:")
        for p in problemas:
            print(f"  - {p}")
        return 1
    print("\nOK: nenhum problema encontrado.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
