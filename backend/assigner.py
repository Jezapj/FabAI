from PIL import Image
import numpy as np

NEUTRAL_COLORS = frozenset({'black', 'white', 'grey', 'navy', 'beige'})

FORMALITY_SCORES = {
    "Blazer": 10, "Shirt": 9, "Pants": 9, "Dress": 8, "Blouse": 8,
    "Polo": 7, "Longsleeve": 6, "Outwear": 6, "Top": 5, "Skirt": 5,
    "Body": 5, "Shoes": 5, "Hoodie": 2, "T-Shirt": 2, "Shorts": 1,
    "Undershirt": 3, "Hat": 1, "Other": 3, "Skip": 0,
}

RAIN_FRIENDLY_LABELS = frozenset({"Outwear", "Hoodie", "Longsleeve", "Body", "Pants"})
RAIN_UNFRIENDLY_LABELS = frozenset({"Shorts", "Skirt", "T-Shirt", "Polo"})

DARK_COLORS = frozenset({'black', 'navy', 'grey', 'brown'})


def get_image_intensity(img: Image.Image) -> float:
    """Compute normalized average pixel intensity, scaled roughly to [-5, 5]."""
    try:
        gray_img = img.convert('L')
        img_array = np.array(gray_img)
        avg_intensity = np.mean(img_array)
        normalized_intensity = ((avg_intensity / 255.0) - 0.5) * 10
        return round(normalized_intensity, 2)
    except Exception as e:
        print(f"Error processing image: {e}")
        return -1


def _rgb_to_bucket(r: int, g: int, b: int) -> str:
    brightness = (r + g + b) / 3
    max_c = max(r, g, b)
    min_c = min(r, g, b)
    sat = (max_c - min_c) / max_c if max_c > 0 else 0

    if brightness < 45:
        return 'black'
    if brightness > 225 and sat < 0.12:
        return 'white'
    if sat < 0.12:
        return 'beige' if brightness > 175 else 'grey'

    if r > 95 and g > 55 and b < 90 and r > b and g > b * 0.7:
        return 'lightbrown' if brightness > 135 else 'brown'

    if b >= r and b >= g:
        return 'lightblue' if brightness > 155 else ('navy' if brightness < 110 else 'blue')

    if g >= r and g >= b:
        return 'green'

    if r >= g and r >= b:
        if g > b * 1.15 and brightness > 130:
            return 'orange'
        if brightness > 175:
            return 'pink'
        return 'red'

    return 'other'


def get_dominant_color(img: Image.Image) -> str:
    """Map the dominant garment colour to a named bucket."""
    try:
        rgb = img.convert('RGB').resize((64, 64))
        pixels = np.array(rgb).reshape(-1, 3)

        # Ignore near-white background pixels common in product photos
        mask = np.sum(pixels, axis=1) < 720
        sampled = pixels[mask] if mask.any() else pixels

        buckets = [_rgb_to_bucket(int(r), int(g), int(b)) for r, g, b in sampled]
        return max(set(buckets), key=buckets.count)
    except Exception as e:
        print(f"Error extracting color: {e}")
        return 'grey'


def get_formality_score(label: str) -> int:
    return FORMALITY_SCORES.get(label, 3)


def is_rain_friendly(label: str) -> bool:
    return label in RAIN_FRIENDLY_LABELS


def is_rain_unfriendly(label: str) -> bool:
    return label in RAIN_UNFRIENDLY_LABELS


def clothingAssign(label, img: Image.Image):
    label_map = {
        "Blazer":      {"val": 50, "category": "Top"},
        "Blouse":      {"val": 30, "category": "Top"},
        "Body":        {"val": 40, "category": "Top"},
        "Dress":       {"val": 30, "category": "One piece"},
        "Hat":         {"val": 10, "category": "Optional"},
        "Hoodie":      {"val": 50, "category": "Top"},
        "Longsleeve":  {"val": 40, "category": "Top"},
        "Other":       {"val": 10, "category": "Optional"},
        "Outwear":     {"val": 60, "category": "Top"},
        "Pants":       {"val": 30, "category": "Bottom"},
        "Polo":        {"val": 30, "category": "Top"},
        "Shirt":       {"val": 35, "category": "Top"},
        "Shoes":       {"val": 0,  "category": "Shoes"},
        "Shorts":      {"val": 20, "category": "Bottom"},
        "Skip":        {"val": 0,  "category": "Optional"},
        "Skirt":       {"val": 20, "category": "Bottom"},
        "T-Shirt":     {"val": 20, "category": "Top"},
        "Top":         {"val": 30, "category": "Top"},
        "Undershirt":  {"val": 15, "category": "Top"},
    }

    entry = label_map.get(label, {"val": 0, "category": "Optional"})
    val = entry["val"]
    category = entry["category"]
    color = get_dominant_color(img)

    sense = get_image_intensity(img)
    val += sense

    return val, category, color
