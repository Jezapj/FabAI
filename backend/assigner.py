from PIL import Image
import numpy as np

def get_image_intensity(img: Image.Image) -> float:
    """
    Compute normalized average pixel intensity from a PIL Image,
    scaled roughly to [-5, 5].
    """
    try:
        gray_img = img.convert('L')
        img_array = np.array(gray_img)
        avg_intensity = np.mean(img_array)
        normalized_intensity = ((avg_intensity / 255.0) - 0.5) * 10
        return round(normalized_intensity, 2)
    except Exception as e:
        print(f"Error processing image: {e}")
        return -1

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

    sense = get_image_intensity(img)
    val += sense

    return val, category