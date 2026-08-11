"""Regenerate square PWA icons from the source logo.

The source logo is landscape (1890x1417). Declaring it as a square icon in the
web manifest makes Android/iOS stretch it to fit, which squashes it
horizontally. This letterboxes the logo onto a square canvas instead.

Run from react-app/:  python scripts/generate-icons.py
"""
from pathlib import Path

from PIL import Image

PUBLIC = Path(__file__).resolve().parent.parent / 'public'
SOURCE = PUBLIC / 'CirculationsLogoNoBg.png'
BACKGROUND = (10, 10, 18, 255)  # manifest background_color #0a0a12


def load_logo() -> Image.Image:
    """Load the logo trimmed to its opaque bounding box."""
    logo = Image.open(SOURCE).convert('RGBA')
    bbox = logo.getchannel('A').getbbox()
    return logo.crop(bbox) if bbox else logo


def square_icon(size: int, inset: float, background: tuple[int, int, int, int] | None) -> Image.Image:
    """Fit the logo, aspect ratio intact, into a `size` square with `inset` padding."""
    logo = load_logo()
    box = round(size * (1 - 2 * inset))
    logo.thumbnail((box, box), Image.LANCZOS)

    canvas = Image.new('RGBA', (size, size), background or (0, 0, 0, 0))
    canvas.paste(logo, ((size - logo.width) // 2, (size - logo.height) // 2), logo)
    return canvas


def main() -> None:
    # Maskable icons are cropped to a circle/squircle, so the logo needs to sit
    # inside the 80% safe zone on an opaque background.
    targets = [
        ('icon-192.png', 192, 0.06, None),
        ('icon-512.png', 512, 0.06, None),
        ('icon-maskable-512.png', 512, 0.22, BACKGROUND),
        ('apple-touch-icon.png', 180, 0.10, BACKGROUND),
    ]
    for name, size, inset, background in targets:
        icon = square_icon(size, inset, background)
        out = PUBLIC / name
        icon.save(out, 'PNG')
        print(f'wrote {out.name} ({icon.width}x{icon.height})')


if __name__ == '__main__':
    main()
