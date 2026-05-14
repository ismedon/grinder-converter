"""Generate wabi-sabi style coffee bean icons for the PWA.

The bean is rendered as an ink-on-rice-paper sumi-e study:
  - Warm paper-beige background (#f5f0e8, matches --bg-color), with a
    barely-perceptible directional warmth and visible paper-fibre grain.
  - Bean body in warm sepia / umber, gentle light-to-dark gradient
    aligned with the bean's rotation so the highlight reads as natural.
  - Smooth bean contour with subtle non-uniform scaling (one side fuller
    than the other, one end fatter) so the silhouette reads as
    hand-shaped, not a vector oval. Slight off-center, gentle CCW lean.
  - Soft "ink-soak" shadow under the bean — single offset blurred
    silhouette in earth tone, not a dimensional drop shadow.
  - Single calligraphic seam in negative space, aligned with the bean's
    long axis: fat in the middle, tapering with subtle ink-pressure
    wobble and a gentle S-curve.
  - A single sage-green brush-dot in the lower-right negative space,
    like a calligrapher's chop, ties the icon to the app's
    --accent-color (#6b7c5e).

Outputs PWA + iOS icon set under ../icons.
"""

from PIL import Image, ImageDraw, ImageFilter
import math
import os
import random


# Palette (lifted from index.html :root)
PAPER_BG = (245, 240, 232)          # --bg-color
PAPER_CARD = (250, 248, 244)        # --card-bg
INK_TEXT = (45, 42, 38)             # --text-primary

# Bean palette: warm sepia / umber range with enough light-to-dark span
# that the bean reads as inked on paper, but not so much that it looks
# like a 3D rendered ball.
BEAN_LIGHT = (155, 110, 65)
BEAN_DARK = (90, 62, 35)

# Sage accent for the artist's-mark companion dot (matches --accent-color)
ACCENT_INK = (107, 124, 94)

OUT_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "icons",
)
os.makedirs(OUT_DIR, exist_ok=True)


# --- helpers ---------------------------------------------------------------

def make_gradient(width, height, color_a, color_b, angle_deg):
    """Linear RGB gradient between two solid colors at the given angle."""
    base = Image.linear_gradient("L")
    base = base.rotate(-angle_deg, resample=Image.BICUBIC, expand=True)
    base = base.resize((width, height), Image.LANCZOS)
    img_a = Image.new("RGBA", (width, height), color_a + (255,))
    img_b = Image.new("RGBA", (width, height), color_b + (255,))
    return Image.composite(img_b, img_a, base)


def organic_bean_contour(cx, cy, rx, ry, seed=7, n=192, rotation_deg=0.0):
    """Smooth bean contour with subtle left-right and top-bottom asymmetry.

    Real beans aren't bumpy — they're nearly smooth ovals that just lean
    slightly. Asymmetry comes from non-uniform scaling, not from pebble-like
    perturbations.
    """
    rng = random.Random(seed)
    # Side-to-side and end-to-end asymmetry
    asym_x = rng.uniform(0.04, 0.08) * rng.choice([-1, 1])
    asym_y = rng.uniform(0.05, 0.09) * rng.choice([-1, 1])
    rot = math.radians(rotation_deg)
    sin_r, cos_r = math.sin(rot), math.cos(rot)
    points = []
    for i in range(n):
        t = i / n * math.tau
        # Smooth ovaloid: one side slightly fuller; one end slightly fatter
        x_scale = 1.0 + asym_x * math.sin(t)
        y_scale = 1.0 + asym_y * math.cos(t) * 0.5
        x = math.cos(t) * rx * x_scale
        y = math.sin(t) * ry * y_scale
        rx_pt = x * cos_r - y * sin_r
        ry_pt = x * sin_r + y * cos_r
        points.append((cx + rx_pt, cy + ry_pt))
    return points


def brush_seam(target, cx, cy, length, width, color, angle_deg=22, seed=3):
    """Single calligraphic stroke: fat in the middle, tapered ends, slight S-curve."""
    rng = random.Random(seed)
    samples = 160
    half = length / 2
    angle = math.radians(angle_deg)
    sin_a, cos_a = math.sin(angle), math.cos(angle)
    draw = ImageDraw.Draw(target)
    wobble_phases = [(rng.random() * math.tau, rng.uniform(0.06, 0.14))
                     for _ in range(3)]
    for i in range(samples + 1):
        t = i / samples
        axis_pos = -half + t * length
        perp = math.sin(t * math.pi * 2 - math.pi) * length * 0.030
        gx = cx + perp * cos_a - axis_pos * sin_a
        gy = cy + perp * sin_a + axis_pos * cos_a
        w_factor = math.sin(t * math.pi) ** 0.55
        wobble = 1.0
        for phase, amp in wobble_phases:
            wobble += math.sin(t * math.tau * 4 + phase) * amp * 0.18
        r = (width / 2) * w_factor * wobble
        if r < 0.5:
            continue
        draw.ellipse((gx - r, gy - r, gx + r, gy + r), fill=color)


def paper_grain(size, intensity=20, seed=11):
    """Two-tone speckle that reads as paper fibre, then softly blurred."""
    rng = random.Random(seed)
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    for _ in range(size * size // 50):
        x = rng.randint(0, size - 1)
        y = rng.randint(0, size - 1)
        a = rng.randint(0, intensity)
        draw.point((x, y), fill=(95, 70, 40, a))
    for _ in range(size * size // 90):
        x = rng.randint(0, size - 1)
        y = rng.randint(0, size - 1)
        a = rng.randint(0, intensity // 2)
        draw.point((x, y), fill=(255, 250, 240, a))
    return img.filter(ImageFilter.GaussianBlur(radius=0.45))


def brush_dot(target, cx, cy, radius, color, seed=5):
    """Small organic ink dot — circle with a few overlapping splotches."""
    rng = random.Random(seed)
    draw = ImageDraw.Draw(target)
    draw.ellipse(
        (cx - radius, cy - radius, cx + radius, cy + radius),
        fill=color,
    )
    for _ in range(4):
        angle = rng.uniform(0, math.tau)
        dist = radius * rng.uniform(0.55, 0.95)
        sx = cx + math.cos(angle) * dist
        sy = cy + math.sin(angle) * dist
        sr = radius * rng.uniform(0.30, 0.55)
        draw.ellipse((sx - sr, sy - sr, sx + sr, sy + sr), fill=color)


def render_icon(out_size, safe_zone=1.0):
    SS = 4
    W = out_size * SS

    # --- Background paper ---------------------------------------------------
    img = Image.new("RGBA", (W, W), PAPER_BG + (255,))
    bg_warmth = make_gradient(W, W, PAPER_CARD, PAPER_BG, 135)
    bg_warmth.putalpha(45)
    img.alpha_composite(bg_warmth)
    img.alpha_composite(paper_grain(W, intensity=22, seed=11))

    # --- Bean placement: smaller, slightly off-center, gentle rotation ------
    cx = W * 0.50 - W * 0.012      # 1.2% left of center
    cy = W * 0.50 - W * 0.005      # 0.5% above center
    bean_rx = W * 0.30 * safe_zone
    bean_ry = W * 0.39 * safe_zone
    rotation = -12.0               # gentle counter-clockwise lean
    contour = organic_bean_contour(
        cx, cy, bean_rx, bean_ry,
        seed=7, rotation_deg=rotation,
    )

    mask = Image.new("L", (W, W), 0)
    ImageDraw.Draw(mask).polygon(contour, fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(radius=W * 0.0020))

    # --- Soft ink-soak shadow under the bean --------------------------------
    # One subtle layer instead of separate halo + drop shadow. Reads as
    # ink soaking into the paper directly under the bean, not as a
    # dimensional drop shadow.
    soak = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    ImageDraw.Draw(soak).polygon(
        [(x + W * 0.004, y + W * 0.012) for x, y in contour],
        fill=(60, 40, 22, 65),
    )
    soak = soak.filter(ImageFilter.GaussianBlur(radius=W * 0.014))
    img.alpha_composite(soak)

    # --- Bean body: nearly-flat warm sepia (stamped-ink aesthetic) ----------
    # Very gentle gradient (the two colors are close) so it reads as a
    # real ink chop, not a 3D bean.
    bean = make_gradient(W, W, BEAN_LIGHT, BEAN_DARK, 135 + rotation)

    # Brush seam in negative space (paper colour). Aligned with the bean's
    # long axis: bean is rotated `rotation` degrees off vertical, so seam
    # angle = rotation (in this module's convention 0 = vertical).
    seam_layer = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    short_axis_angle = math.radians(rotation + 90)
    seam_offset = bean_rx * 0.05
    seam_cx = cx + math.cos(short_axis_angle) * seam_offset
    seam_cy = cy + math.sin(short_axis_angle) * seam_offset
    brush_seam(
        seam_layer, seam_cx, seam_cy,
        length=bean_ry * 1.55,
        width=W * 0.038,
        color=PAPER_BG + (255,),
        angle_deg=rotation,
        seed=3,
    )
    seam_layer = seam_layer.filter(ImageFilter.GaussianBlur(radius=W * 0.0028))
    bean.alpha_composite(seam_layer)

    # Add inner paper-grain to the bean for cohesion with the bg
    inner_grain = paper_grain(W, intensity=22, seed=29)
    bean.alpha_composite(inner_grain)

    # Mask bean onto the paper
    img.paste(bean, (0, 0), mask)

    # --- Sage-green artist's mark (single brush dot, lower-right) -----------
    dot_layer = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    dot_cx = W * 0.80
    dot_cy = W * 0.84
    dot_r = W * 0.018
    brush_dot(dot_layer, dot_cx, dot_cy, dot_r, ACCENT_INK + (210,), seed=5)
    dot_layer = dot_layer.filter(ImageFilter.GaussianBlur(radius=W * 0.0018))
    img.alpha_composite(dot_layer)

    # --- Final unifying grain -----------------------------------------------
    img.alpha_composite(paper_grain(W, intensity=10, seed=19))

    return img.resize((out_size, out_size), Image.LANCZOS)


def render_maskable(size):
    return render_icon(size, safe_zone=0.78)


def main():
    targets = [
        ("icon-192.png", 192, False),
        ("icon-512.png", 512, False),
        ("icon-maskable-192.png", 192, True),
        ("icon-maskable-512.png", 512, True),
        ("apple-touch-icon.png", 180, False),
        ("favicon-32.png", 32, False),
    ]
    for name, size, maskable in targets:
        img = render_maskable(size) if maskable else render_icon(size)
        path = os.path.join(OUT_DIR, name)
        img.save(path, "PNG", optimize=True)
        print(f"  {name} ({size}x{size}) -> {os.path.getsize(path)} bytes")


if __name__ == "__main__":
    main()
