"""Generate wabi-sabi style coffee bean icons for the PWA.

Style matches the app's palette:
  - background: warm beige #f5f0e8 (mirrors --bg-color)
  - bean: muted earth tone #6b4423 with subtle inner curve
  - tone-on-tone, no harsh edges, slight texture
"""

from PIL import Image, ImageDraw, ImageFilter
import os
import math
import random

OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "icons")
os.makedirs(OUT_DIR, exist_ok=True)

BG = (245, 240, 232)         # #f5f0e8
BEAN = (107, 68, 35)         # #6b4423 muted earth brown
BEAN_HIGHLIGHT = (145, 95, 55)
SEAM = (245, 240, 232)       # central seam in bg color
SHADOW = (60, 40, 25, 30)


def render_icon(size: int, safe_zone_ratio: float = 1.0) -> Image.Image:
    """Render at high resolution then downscale for smoother edges.

    safe_zone_ratio < 1.0 shrinks the bean (used for maskable icons that
    get cropped by Android masks).
    """
    SS = 4  # supersample factor
    W = size * SS
    img = Image.new("RGBA", (W, W), BG + (255,))
    draw = ImageDraw.Draw(img)

    # Subtle paper texture noise
    rng = random.Random(42)
    noise = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    nd = ImageDraw.Draw(noise)
    for _ in range(W * W // 80):
        x = rng.randint(0, W - 1)
        y = rng.randint(0, W - 1)
        a = rng.randint(0, 12)
        nd.point((x, y), fill=(60, 40, 25, a))
    img.alpha_composite(noise)

    # Coffee bean: slightly tilted oval with central seam
    cx, cy = W / 2, W / 2
    bean_w = W * 0.62 * safe_zone_ratio
    bean_h = W * 0.78 * safe_zone_ratio
    angle_deg = -18

    # Render bean to its own layer to allow rotation
    layer = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    # Soft drop shadow (offset down-right)
    shadow_layer = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow_layer)
    sd.ellipse(
        (cx - bean_w / 2 + W * 0.015, cy - bean_h / 2 + W * 0.025,
         cx + bean_w / 2 + W * 0.015, cy + bean_h / 2 + W * 0.025),
        fill=(40, 25, 15, 70),
    )
    shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(radius=W * 0.012))
    layer.alpha_composite(shadow_layer)

    # Bean body
    ld.ellipse(
        (cx - bean_w / 2, cy - bean_h / 2,
         cx + bean_w / 2, cy + bean_h / 2),
        fill=BEAN + (255,),
    )

    # Subtle highlight on upper-left of bean
    hl_layer = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    hd = ImageDraw.Draw(hl_layer)
    hd.ellipse(
        (cx - bean_w / 2 + W * 0.06, cy - bean_h / 2 + W * 0.06,
         cx + bean_w / 4, cy + bean_h / 8),
        fill=BEAN_HIGHLIGHT + (90,),
    )
    hl_layer = hl_layer.filter(ImageFilter.GaussianBlur(radius=W * 0.025))
    layer.alpha_composite(hl_layer)

    # Central seam: a curved gap. Approximate by drawing a thin
    # rectangle along the long axis with slight curvature via two arcs.
    seam_w = max(2, int(W * 0.018))
    seam_layer = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    sld = ImageDraw.Draw(seam_layer)
    # Curve: draw a thin oval much narrower than the bean, slightly
    # offset to give an S-curve impression.
    sld.ellipse(
        (cx - seam_w, cy - bean_h / 2 + W * 0.055,
         cx + seam_w, cy + bean_h / 2 - W * 0.055),
        fill=SEAM + (255,),
    )
    layer.alpha_composite(seam_layer)

    # Rotate the bean layer (with shadow + bean + seam) and composite
    layer = layer.rotate(angle_deg, resample=Image.BICUBIC, center=(cx, cy))
    img.alpha_composite(layer)

    # Downsample with antialiasing
    return img.resize((size, size), Image.LANCZOS)


def render_maskable(size: int) -> Image.Image:
    """Maskable icon: bean fits in 80% safe zone so any mask shape works."""
    return render_icon(size, safe_zone_ratio=0.78)


def main() -> None:
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
