from sklearn.preprocessing import LabelEncoder
import joblib

# Your class names in index order (as seen during training)
class_names = [
    "Blazer",
    "Blouse",
    "Body",
    "Dress",
    "Hat",
    "Hoodie",
    "Longsleeve",
    "Other",
    "Outwear",
    "Pants",
    "Polo",
    "Shirt",
    "Shoes",
    "Shorts",
    "Skip",
    "Skirt",
    "T-Shirt",
    "Top",
    "Undershirt"
]

# Create and fit label encoder
label_encoder = LabelEncoder()
label_encoder.fit(class_names)

# Save the encoder
joblib.dump(label_encoder, "label_encoder.pkl")
print("-Done- Saved label_encoder.pkl with classes:")
for i, label in enumerate(label_encoder.classes_):
    print(f"{i}: {label}")
