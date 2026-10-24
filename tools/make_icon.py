"""Renders the Fixify app icon (1024x1024 PNG): a viewfinder with a numbered-marker check,
the same amber marker used on images inside the app."""
import sys
from PIL import Image, ImageDraw, ImageFilter

S = 4096  # supersample, downscaled at the end
img = Image.new("RGB", (S, S))
d = ImageDraw.Draw(img)

# Background: deep signal blue, very subtle vertical falloff.
top, bottom = (31, 86, 245), (14, 44, 160)
for y in range(S):
    t = y / (S - 1)
    d.line([(0, y), (S, y)], fill=tuple(round(a + (b - a) * t) for a, b in zip(top, bottom)))

white = (255, 255, 255)
amber = (255, 182, 30)
ink = (12, 20, 45)

# Viewfinder corner brackets.
m, L, w, r = 860, 640, 230, 230
def bracket(x, y, sx, sy):
    # Horizontal and vertical arm with rounded ends meeting in a rounded corner.
    d.rounded_rectangle([min(x, x + sx * L), y - (w if sy < 0 else 0), max(x, x + sx * L), y + (w if sy > 0 else 0)], r // 2, fill=white)
    d.rounded_rectangle([x - (w if sx < 0 else 0), min(y, y + sy * L), x + (w if sx > 0 else 0), max(y, y + sy * L)], r // 2, fill=white)
bracket(m, m, 1, 1)
bracket(S - m, m, -1, 1)
bracket(m, S - m, 1, -1)
bracket(S - m, S - m, -1, -1)

# Marker: amber disc with soft shadow and a dark check.
c, R = S // 2, 760
shadow = Image.new("L", (S, S), 0)
ImageDraw.Draw(shadow).ellipse([c - R, c - R + 90, c + R, c + R + 90], fill=120)
shadow = shadow.filter(ImageFilter.GaussianBlur(120))
img.paste(Image.new("RGB", (S, S), (6, 18, 70)), (0, 0), shadow)
d = ImageDraw.Draw(img)
d.ellipse([c - R, c - R, c + R, c + R], fill=amber)
d.line([(c - 380, c + 20), (c - 110, c + 290), (c + 400, c - 260)], fill=ink, width=250, joint="curve")
for p in [(c - 380, c + 20), (c + 400, c - 260)]:
    d.ellipse([p[0] - 125, p[1] - 125, p[0] + 125, p[1] + 125], fill=ink)

img.resize((1024, 1024), Image.LANCZOS).save(sys.argv[1])
print("wrote", sys.argv[1])
