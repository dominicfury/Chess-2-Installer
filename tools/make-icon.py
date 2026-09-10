"""The app icon: a navy tile with the knight from the game's wordmark, as PNG and ICO."""
import os

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'build')
os.makedirs(OUT, exist_ok=True)

SIZE = 256
im = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
d = ImageDraw.Draw(im)
# rounded navy tile with an ivory bevel, like the menu's brand tile
d.rounded_rectangle((8, 8, SIZE - 8, SIZE - 8), radius=40, fill=(32, 45, 88, 255), outline=(242, 238, 220, 255), width=8)
d.rounded_rectangle((28, 28, SIZE - 28, SIZE - 28), radius=26, fill=(38, 110, 224, 255))
font = None
for candidate in ('C:/Windows/Fonts/seguisym.ttf', 'C:/Windows/Fonts/segoeui.ttf', 'C:/Windows/Fonts/arial.ttf'):
    if os.path.exists(candidate):
        font = ImageFont.truetype(candidate, 170)
        break
glyph = '\u265e'  # ♞
box = d.textbbox((0, 0), glyph, font=font)
w, h = box[2] - box[0], box[3] - box[1]
x = (SIZE - w) / 2 - box[0]
y = (SIZE - h) / 2 - box[1] - 6
d.text((x + 6, y + 6), glyph, font=font, fill=(32, 45, 88, 255))
d.text((x, y), glyph, font=font, fill=(242, 238, 220, 255))
# a small gold "2" in the corner
small = ImageFont.truetype('C:/Windows/Fonts/georgiab.ttf' if os.path.exists('C:/Windows/Fonts/georgiab.ttf') else 'C:/Windows/Fonts/arialbd.ttf', 78)
d.text((SIZE - 86, SIZE - 106), '2', font=small, fill=(32, 45, 88, 255))
d.text((SIZE - 90, SIZE - 110), '2', font=small, fill=(255, 229, 154, 255))

im.save(os.path.join(OUT, 'icon.png'))
im.save(os.path.join(OUT, 'icon.ico'), sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
print('ok', OUT)
