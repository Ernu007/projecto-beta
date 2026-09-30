#!/usr/bin/env python3
"""Redimensiona e converte as fotografias da operação para WebP.

Uso:  python tools/otimizar-galeria.py
Entrada: assets/img/galeria/img_*.jpg
Saída:   assets/img/galeria/<mesmo-nome>.webp   (lado longo <= 1600 px, q=80)

Os JPEG originais são removidos no fim: 1,5 MB de JPEG de telefone
não vai para o repositório.
"""
import sys
from pathlib import Path

from PIL import Image, ImageOps

RAIZ = Path(__file__).resolve().parent.parent
ORIGEM = RAIZ / "assets" / "img" / "galeria"
LADO_MAX = 1600
QUALIDADE = 80


def converter(jpg: Path) -> tuple[Path, int, int, int]:
    webp = jpg.with_suffix(".webp")
    with Image.open(jpg) as im:
        # Respeita a orientação EXIF: as fotos de retrato vimam tortas
        # por telefone e aparecem deitadas quando a tag é ignorada.
        im = ImageOps.exif_transpose(im)
        antes = im.size
        im.thumbnail((LADO_MAX, LADO_MAX), Image.LANCZOS)
        # RGB (e não RGBA) porque o WebP com alpha sobe muito de tamanho
        im.convert("RGB").save(webp, "WEBP", quality=QUALIDADE, method=6)
    return webp, antes[0], antes[1], jpg.stat().st_size


def main() -> int:
    jsons = sorted(ORIGEM.glob("img_*.jpg"))
    if not jsons:
        print(f"Nenhuma foto em {ORIGEM}")
        return 1
    total_antes = total_depois = 0
    for jpg in jsons:
        webp, w, h, antes = converter(jpg)
        depois = webp.stat().st_size
        total_antes += antes
        total_depois += depois
        print(f"{jpg.name:26s} {w}x{h:<5d} {antes / 1024:7.0f} KB -> "
              f"{webp.name:26s} {depois / 1024:6.0f} KB")
    print(f"\n{len(jsons)} fotos · {total_antes / 1024 / 1024:.2f} MB -> "
          f"{total_depois / 1024 / 1024:.2f} MB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
