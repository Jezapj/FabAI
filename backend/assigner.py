from PIL import Image
import numpy as np

def get_image_intensity(filepath: str) -> float:
    """
    Compute normalized average pixel intensity from image at `filepath`,
    scaled to the range [0, 100].

    Supports grayscale and color images.
    """
    try:
        with Image.open(filepath) as img:
            # Convert to grayscale
            gray_img = img.convert('L')  # 'L' mode is 8-bit pixels, black and white
            img_array = np.array(gray_img)

            # Compute average intensity (0–255)
            avg_intensity = np.mean(img_array)

            # Normalize to [-5, 5]
            normalized_intensity = ((avg_intensity / 255.0) - 0.5) * 10

            return round(normalized_intensity, 2)
    except Exception as e:
        print(f"Error processing image: {e}")
        return -1  # or raise exception if preferred

def clothingAssign(label, filepath) -> int:
    # From 0 - 100
    # Heat value
    val = 0
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


    entry = label_map.get(label, {"val": None, "category": "Optional"})
    val = entry["val"]
    category = entry["category"]

    sense = get_image_intensity(filepath)
    val += sense

    return val, category
