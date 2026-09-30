"""Substitui rgba() escritos à mão por rgb(var(--token-rgb) / alfa).

As três cores de marca já viviam em rgba() literal em dezenas de linhas,
o que fazia "mudar a cor da JVI" ser uma edição de 70 sítios. Este
script converte-as em canal RGB, para passarem a derivar do token.

Só toca em padrões exactos e verificados; qualquer coisa que não
reconheça é deixada como está e reportada.

Uso: python tools/tokenizar-cores.py [--verificar]
"""
import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
CSS = sorted(RAIZ.glob("css/*.css"))

# rgba(169, 207, 68, a)  ->  rgb(var(--verde-rgb) / a)
CORPOES = {
    "169, 207, 68": "--verde-rgb",
    "234, 130, 64": "--laranja-rgb",
    "15, 23, 42": "--base-rgb",
    "203, 213, 225": "--claro-rgb",
}

# Cor literal -> token, para valores escritos sem alfa.
LITERais = {
    "#25D366": "var(--wa)",
    "#FCA5A5": "var(--erro-txt)",
    "#F87171": "var(--erro)",
    "#F5B183": "var(--aviso-txt)",
    "#93C5FD": "var(--tel-claro)",
    "#1A0D03": "var(--sobre-laranja)",
    "#05230F": "var(--sobre-wa)",
    "#2A1206": "var(--sobre-mail)",
    "#0B1220": "var(--rodape)",
    "#16243D": "var(--mapa)",
}

PADRAO_RGBA = re.compile(
    r"rgba\(\s*(" + "|".join(re.escape(c) for c in CORPOES) + r")\s*,\s*([\d.]+)\s*\)"
)


def converter(txt):
    mudancas = 0

    def sub_rgba(m):
        nonlocal mudancas
        canal = CORPOES[m.group(1)]
        alfa = m.group(2)
        # Alfa inteiro dispensa o ponto: / .5 -> / 0.5
        if alfa.startswith("0."):
            alfa = alfa[1:]
        alfa = alfa.rstrip("0").rstrip(".") if "." in alfa else alfa
        mudancas += 1
        return f"rgb(var({canal}) / {alfa})"

    # Uma DEFINICAO de token (`--wa: #25D366`) nao pode virar
    # `var(--wa)` -- isso torna o token autorreferencial e deixa-o sem cor
    # nenhuma. Por isso so se converte o que esta a ser USADO: as linhas
    # que comecam por `--algo:` ficam de fora.
    def fora_das_definicoes(t, fn):
        partes = re.split(r"(?m)^(\s*--[a-z0-9-]+\s*:.*)$", t)
        return "".join(p if i % 2 == 1 else fn(p) for i, p in enumerate(partes))

    txt = fora_das_definicoes(txt, lambda p: PADRAO_RGBA.sub(sub_rgba, p))

    for cor, token in LITERais.items():
        nome = re.match(r"var\((--[a-z0-9-]+)\)", token).group(1)
        # Se a propria definicao deste token e a cor, nao a converter.
        definicao = re.search(rf"(?m)^\s*{re.escape(nome)}\s*:\s*{re.escape(cor)}\b", txt)
        if definicao:
            continue
        antes = txt
        txt = fora_das_definicoes(txt, lambda p, c=cor, t=token: p.replace(c, t))
        if txt != antes:
            mudancas += 1

    return txt, mudancas


def main():
    verificar = "--verificar" in sys.argv
    total = 0
    restantes = {}

    for f in CSS:
        txt = f.read_text(encoding="utf-8")
        novo, n = converter(txt)
        if n:
            total += n
            if not verificar:
                f.write_text(novo, encoding="utf-8")
            print(f"{f.name}: {n} substituicoes")
        # o que sobrou, para revisão manual
        for m in re.finditer(r"rgba?\(\s*(" + "|".join(re.escape(c) for c in CORPOES) + r")\s*,", novo):
            restantes.setdefault(m.group(1), []).append(f.name)

    print(f"\ntotal: {total} substituicoes")
    if restantes:
        print("NAO CONVERTIDOS (rever a mao):")
        for c, ficheiros in restantes.items():
            print(f"  rgb({c} -> {len(ficheiros)} ficheiro(s): {sorted(set(ficheiros))}")
    else:
        print("nenhuma rgb() de marca por converter.")


if __name__ == "__main__":
    main()
