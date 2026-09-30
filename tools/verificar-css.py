"""Confere o CSS: tokens definidos, tokens usados, e vars de cor literais.

`--p` nao aparece aqui: e escrito por `js/hero-voo.js` com
`style.setProperty`, para acender as palavras do titulo do hero uma a
uma. Nao e um token de CSS, e por isso nao conta como em falta.

Uso: python tools/verificar-css.py
"""
import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
CSS = sorted(RAIZ.glob("css/*.css"))

# Tokens que o JS injecta em tempo de execucao.
INJECTADOS_POR_JS = {"--p"}

definidos = set()
usados = set()
cores_literais = {}

for f in CSS:
    txt = f.read_text(encoding="utf-8")
    definidos |= set(re.findall(r"^\s*(--[a-z0-9-]+)\s*:", txt, re.M))
    usados |= set(re.findall(r"var\(\s*(--[a-z0-9-]+)", txt))
    for m in re.finditer(r"^\s*([.#][a-zA-Z0-9_.-]+[^{]*)\{([^}]*)\}", txt, re.M | re.S):
        sel, corpo = m.group(1).strip(), m.group(2)
        for cor in re.findall(r"(#[0-9A-Fa-f]{3,8}|rgba?\([^)]*\))", corpo):
            cores_literais.setdefault(cor, []).append(f"{f.name} {sel}")

problemas = []
faltam = sorted((usados - definidos) - INJECTADOS_POR_JS)
sobram = sorted((definidos - usados) - INJECTADOS_POR_JS)

if faltam:
    problemas.append(f"tokens USADOS mas nao definidos: {faltam}")
if sobram:
    print(f"tokens definidos e nunca usados: {sobram}")
    print("  (nao e erro, mas indica regra morta)")

print(f"tokens definidos: {len(definidos)}   usados: {len(usados)}")
print(f"cores literais distintas: {len(cores_literais)}")

TOKENS_COR = {t for t in definidos if t.startswith("--")}
print("\ncores literais (fora dos tokens):")
for cor, usos in sorted(cores_literais.items(), key=lambda kv: -len(kv[1])):
    tag = "acucar sintatico (gradiente/svg/data-uri)" if any("data:image" in u or "svg" in u for u in usos) else ""
    print(f"  {cor:<42} {len(usos):>3} usos  {tag}")

if problemas:
    print("\nPROBLEMAS:")
    for p in problemas:
        print(f"  - {p}")
    sys.exit(1)
print("\nOK: nenhum token em falta.")
