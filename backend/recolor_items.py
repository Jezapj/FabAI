"""Recompute the stored colour of every wardrobe image.

Colours are cached on the `images` row, so items classified before the
centre-crop sampling fix keep their old (background-influenced) colour. Run
this once after deploying:  python recolor_items.py
"""
from io import BytesIO

from PIL import Image as PILImage

from assigner import get_dominant_color
from backend import Image, app, db


def main() -> None:
    with app.app_context():
        images = Image.query.all()
        changed = 0

        for img in images:
            if not img.data:
                continue
            pil = PILImage.open(BytesIO(img.data))
            try:
                color = get_dominant_color(pil)
            finally:
                pil.close()

            if color != img.color:
                print(f'  #{img.id} {img.label}: {img.color} -> {color}')
                img.color = color
                changed += 1

        if changed:
            db.session.commit()
        print(f'Updated {changed} of {len(images)} items.')


if __name__ == '__main__':
    main()
