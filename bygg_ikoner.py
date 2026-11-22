#!/usr/bin/env python3
"""Ikoner och småbilder till Marre & Marta – ritade, inga externa filer.

Motivet är en kvast som sopar upp en stjärna: städningen och belöningen i samma
bild, läsbar även i 32 px.
"""
from __future__ import annotations

import math
import pathlib

from PIL import Image, ImageDraw

APP = pathlib.Path(__file__).resolve().parent
PUB = APP / "public"

ORANGE = (224, 89, 47)
ORANGE_MORK = (184, 65, 29)
PAPPER = (250, 247, 242)
GULD = (233, 182, 47)
TRÄ = (196, 152, 104)
TRÄ_MORK = (150, 110, 72)
VITT = (255, 255, 255)


def runda(d, box, radie, farg):
    d.rounded_rectangle(box, radius=radie, fill=farg)


def stjarna(d, cx, cy, r, farg):
    punkter = []
    for i in range(10):
        vinkel = -math.pi / 2 + i * math.pi / 5
        radie = r if i % 2 == 0 else r * 0.45
        punkter.append((cx + radie * math.cos(vinkel), cy + radie * math.sin(vinkel)))
    d.polygon(punkter, fill=farg)


def ikon(storlek: int = 512, maskable: bool = False) -> Image.Image:
    im = Image.new("RGBA", (storlek, storlek), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    insats = int(storlek * 0.1) if maskable else 0
    inre = storlek - 2 * insats
    radie = int(inre * (0.5 if maskable else 0.26))
    runda(d, (insats, insats, insats + inre - 1, insats + inre - 1), radie, ORANGE)

    # kvastskaftet: en diagonal pinne
    x0 = insats + inre * 0.62
    y0 = insats + inre * 0.12
    x1 = insats + inre * 0.36
    y1 = insats + inre * 0.66
    d.line([(x0, y0), (x1, y1)], fill=TRÄ, width=int(inre * 0.1))
    d.line([(x0, y0), (x1, y1)], fill=TRÄ_MORK, width=int(inre * 0.035))

    # borst
    bx = insats + inre * 0.36
    by = insats + inre * 0.66
    d.polygon(
        [
            (bx - inre * 0.20, by - inre * 0.02),
            (bx + inre * 0.13, by + inre * 0.08),
            (bx + inre * 0.02, by + inre * 0.26),
            (bx - inre * 0.30, by + inre * 0.14),
        ],
        fill=TRÄ,
    )
    for i in range(5):
        t = i / 4
        sx = bx - inre * 0.26 + t * inre * 0.24
        sy = by + inre * 0.10 + t * inre * 0.05
        d.line([(sx, sy), (sx - inre * 0.02, sy + inre * 0.13)], fill=TRÄ_MORK, width=max(2, int(inre * 0.022)))

    # stjärnan som sopas upp
    stjarna(d, insats + inre * 0.23, insats + inre * 0.28, inre * 0.175, GULD)
    return im


def favicon_svg() -> str:
    return """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="17" fill="#e0592f"/>
  <path d="M40 9 23 42" stroke="#c49868" stroke-width="6" stroke-linecap="round"/>
  <path d="M23 42 37 47 31 56 17 50Z" fill="#c49868"/>
  <path d="M15 19l3.2 6.5 7.2 1-5.2 5.1 1.2 7.1-6.4-3.4-6.4 3.4 1.2-7.1L4.8 26.5l7.2-1z" fill="#e9b62f"/>
</svg>
"""


def main() -> None:
    PUB.mkdir(parents=True, exist_ok=True)
    ikon(512).save(PUB / "icon-512.png")
    ikon(512, maskable=True).save(PUB / "icon-maskable-512.png")
    ikon(192).save(PUB / "icon-192.png")
    ikon(180).save(PUB / "apple-touch-icon.png")
    ikon(64).save(PUB / "favicon.png")
    (PUB / "favicon.svg").write_text(favicon_svg(), encoding="utf-8")
    print("ikoner skrivna i", PUB)


if __name__ == "__main__":
    main()