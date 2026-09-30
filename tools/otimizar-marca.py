#!/usr/bin/env python3
"""Optimiza os activos de marca que são grandes demais para o que pintam.

Medido antes:
  assets/logo.png     189,2 KB  727x885 RGBA   pintado a 46 px de altura
  assets/img/camiao.png 239,4 KB  800x527 RGBA
  assets/logo-cor.png 189,2 KB  byte-idêntico a logo.png, 0 referências

O logo é o maior recurso do primeiro ecrã a seguir ao próprio HTML, e
pinta 38x46 px: um sobre-fetch de ~430x em área de píxeis. O camião é um
PNG com alfa onde um WebP do próprio repositório seria 4,6x mais leve.

O que este script faz:
  - reduz o logo a 3x a maior altura de render (46 px -> 184 px) e
    grava em WebP, mantendo o alfa
  - converte o camião para WebP, mantendo o alfa
  - NÃO toca em nada que seja referenciado por nome com outra extensão,
    para o HTML poder ser actualizado com o resultado

Uso:  python tools/otimizar-marca.py
"""
import hashlib
import sys
from pathlib import Path

from PIL import Image

RAIZ = Path(__file__).resolve().parent.parent
ACTIVO = RAIZ / "assets"

# (entrada, saida, altura maxima, qualidade)
TRABALHOS = [
    (ACTIVO / "logo.png", ACTIVO / "logo.webp", 184, 90),
    (ACTIVO / "img" / "camiao.png", ACTIVO / "img" / "camiao.webp", 800, 82),
]


def guardar_webp(origem: Path, destino: Path, lado: int, qualidade: int) -> tuple[int, int, int, int]:
    with Image.open(origem) as im:
        antes_bytes, antes_tam = origem.stat().st_size, im.size
        if lado and max(im.size) > lado:
            im.thumbnail((lado, lado), Image.LANCZOS)
        # com alfa: guardar como RGBA. RGB faria o PNG transparente
        # ficar com um fundo preto.
        if im.mode in ("RGBA", "LA", "P"):
            im = im.convert("RGBA")
        im.save(destino, "WEBP", quality=qualidade, method=6)
    return antes_bytes, antes_tam, destino.stat().st_size, Image.open(destino).size


def main() -> int:
    if not TRABALHOS:
        print("nada a fazer")
        return 0
    total_antes = total_depois = 0
    for origem, destino, lado, qualidade in TRABALHOS:
        if not origem.exists():
            print(f"{origem.name}: não existe, saltado")
            continue
        ab, tam, dp, tam2 = guardar_webp(origem, destino, lado, qualidade)
        total_antes += ab
        total_depois += dp
        print(f"{origem.name:16s} {tam[0]}x{tam[1]:<5d} {ab / 1024:7.1f} KB  ->  "
              f"{destino.name:16s} {tam2[0]}x{tam2[1]:<5d} {dp / 1024:6.1f} KB")
    print(f"\ntotal: {total_antes / 1024:.0f} KB -> {total_depois / 1024:.0f} KB "
          f"({total_antes / max(total_depois, 1):.1f}x mais leve)")

    # Duplicados byte-a-byte: 189 KB de peso morto no repositório.
    vistos: dict[str, Path] = {}
    for p in sorted(ACTIVO.rglob("*.png")):
        h = hashlib.sha256(p.read_bytes()).hexdigest()
        if h in vistos:
            print(f"\nduplicado byte-a-byte: {p.relative_to(RAIZ)} e "
                  f"{vistos[h].relative_to(RAIZ)} — apague um dos dois")
        else:
            vistos[h] = p
    return 0


if __name__ == "__main__":
    sys.exit(main())
