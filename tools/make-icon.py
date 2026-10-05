"""The app's art, drawn in the menu logo's chunky pixel letters (BrandLogo.tsx in the chess2 workspace):

- build/icon.png and build/icon.ico: a navy tile with a big "B" in white and gold over a pink bar,
  the title's two colours and the edition's
- build/installerSidebar.bmp: the setup wizard's 164x314 panel, the name stacked down it
- the game's favicon (packages/client/public/favicon.png), when the chess2 checkout sits beside this one

Run: python tools/make-icon.py  (needs Pillow)
"""
import os

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'build')
FAVICON = os.path.join(HERE, '..', '..', 'chess2', 'packages', 'client', 'public', 'favicon.png')
os.makedirs(OUT, exist_ok=True)

# the logo's bold face, strokes two cells thick on a 7x9 grid (the same table as BrandLogo.tsx)
BOLD = {
    'A': ['0111110', '1111111', '1100011', '1100011', '1111111', '1111111', '1100011', '1100011', '1100011'],
    'B': ['1111110', '1111111', '1100011', '1111110', '1111110', '1100011', '1100011', '1111111', '1111110'],
    'C': ['0111111', '1111111', '1100000', '1100000', '1100000', '1100000', '1100000', '1111111', '0111111'],
    'D': ['1111100', '1111110', '1100111', '1100011', '1100011', '1100011', '1100111', '1111110', '1111100'],
    'E': ['1111111', '1111111', '1100000', '1111110', '1111110', '1100000', '1100000', '1111111', '1111111'],
    'H': ['1100011', '1100011', '1100011', '1111111', '1111111', '1100011', '1100011', '1100011', '1100011'],
    'I': ['111111', '111111', '001100', '001100', '001100', '001100', '001100', '111111', '111111'],
    'L': ['1100000', '1100000', '1100000', '1100000', '1100000', '1100000', '1100000', '1111111', '1111111'],
    'N': ['1100011', '1110011', '1111011', '1111011', '1101111', '1101111', '1100111', '1100011', '1100011'],
    'O': ['0111110', '1111111', '1100011', '1100011', '1100011', '1100011', '1100011', '1111111', '0111110'],
    'R': ['1111110', '1111111', '1100011', '1100011', '1111111', '1111110', '1100111', '1100011', '1100011'],
    'S': ['0111111', '1111111', '1100000', '1111110', '0111111', '0000011', '0000011', '1111111', '1111110'],
    'T': ['1111111', '1111111', '0011100', '0011100', '0011100', '0011100', '0011100', '0011100', '0011100'],
    'V': ['1100011', '1100011', '1100011', '1100011', '1100011', '1110111', '0111110', '0111110', '0011100'],
    ':': ['00', '11', '11', '00', '00', '00', '11', '11', '00'],
    ' ': ['0000', '0000', '0000', '0000', '0000', '0000', '0000', '0000', '0000'],
}
LIT_ROWS = 4  # the top rows of each letter take the lighter colour

NAVY = (27, 36, 71, 255)  # the logo's outline and the tile
DROP = (15, 22, 51, 255)  # the solid shadow under it
TITLE = ((255, 255, 255, 255), (255, 226, 122, 255))  # lit, deep
EDITION = ((255, 156, 207, 255), (255, 61, 154, 255))


def word_cells(text, scale=1):
    """The cells a line of text covers, each glyph cell `scale` cells square: {(x, y): row-in-glyph}."""
    cells = {}
    pen = 0
    for i, ch in enumerate(text):
        glyph = BOLD.get(ch, BOLD[' '])
        for y, row in enumerate(glyph):
            for x, bit in enumerate(row):
                if bit == '1':
                    for dx in range(scale):
                        for dy in range(scale):
                            cells[(pen + x * scale + dx, y * scale + dy)] = y
        pen += (len(glyph[0]) + (1 if i < len(text) - 1 else 0)) * scale
    return cells, pen, 9 * scale


def paint_line(img, text, ox, oy, cell, colours, scale=1, outline=NAVY):
    """A line of the logo at (ox, oy) in pixels: the drop, a one-cell outline, then the two-tone letters."""
    cells, _, _ = word_cells(text, scale)
    edge = set()
    for (x, y) in cells:
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                edge.add((x + dx, y + dy))
    put = lambda x, y, c: img.paste(c, (ox + x * cell, oy + y * cell, ox + (x + 1) * cell, oy + (y + 1) * cell))
    for (x, y) in edge:
        for d in (1, 2):
            put(x, y + d, DROP)
    for (x, y) in edge:
        put(x, y, outline)
    for (x, y), row in cells.items():
        put(x, y, colours[0] if row < LIT_ROWS else colours[1])


def line_size(text, cell, scale=1):
    _, w, h = word_cells(text, scale)
    return (w + 2) * cell, (h + 4) * cell


# ── the icon: a 32-cell tile, drawn at 8 px a cell ─────────────────────────────────────────────
CELL = 8
GRID = 32
icon = Image.new('RGBA', (GRID * CELL, GRID * CELL), (0, 0, 0, 0))
tile = lambda x, y, c: icon.paste(c, (x * CELL, y * CELL, (x + 1) * CELL, (y + 1) * CELL))
for y in range(GRID):
    for x in range(GRID):
        # stepped corners, a dark one-cell frame, navy inside
        corner = min(x, GRID - 1 - x) + min(y, GRID - 1 - y)
        if corner < 1:
            continue
        frame = x in (0, GRID - 1) or y in (0, GRID - 1) or corner < 2
        tile(x, y, DROP if frame else NAVY)
# the "B", doubled to 14x18 cells, with its outline and drop, then the edition's pink bar under it
# outlined in the dark shadow colour: a navy outline would vanish into the navy tile
paint_line(icon, 'B', (GRID - 16) // 2 * CELL, 3 * CELL, CELL, TITLE, scale=2, outline=DROP)
for x in range(8, 24):
    for y, colour in ((25, EDITION[0]), (26, EDITION[1]), (27, EDITION[1])):
        tile(x, y, colour)
    tile(x, 28, DROP)
for y in range(25, 28):
    tile(7, y, DROP)
    tile(24, y, DROP)

icon.save(os.path.join(OUT, 'icon.png'))
icon.save(os.path.join(OUT, 'icon.ico'), sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
print('icon ok')

# ── the setup wizard's sidebar: 164x314, navy with scanlines, the tile and the name stacked ──────
side = Image.new('RGBA', (164, 314), NAVY)
for y in range(0, 314, 3):
    side.paste(DROP, (0, y, 164, y + 1))
small = icon.resize((64, 64), Image.NEAREST)
side.paste(small, ((164 - 64) // 2, 22), small)
y = 104
for text, cell, colours in (('BATTLE', 2, TITLE), ('CHESS', 2, TITLE), ('CASINO:', 2, TITLE), ('RAVE', 2, EDITION), ('EDITION', 2, EDITION)):
    w, h = line_size(text, cell)
    paint_line(side, text, (164 - w) // 2, y, cell, colours)
    y += h + (8 if text == 'CASINO:' else 2)
side.convert('RGB').save(os.path.join(OUT, 'installerSidebar.bmp'))
print('sidebar ok')

# ── the game's favicon, from the same tile ─────────────────────────────────────────────────────
if os.path.isdir(os.path.dirname(FAVICON)):
    icon.resize((64, 64), Image.NEAREST).save(FAVICON)
    print('favicon ok', os.path.normpath(FAVICON))
