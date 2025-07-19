import torch
import joblib
from pathlib import Path
from PIL import Image
from torchvision import models, transforms
from model import ClothingPredictor  # Ensure this matches your class definition
# Import the new weights enum
from torchvision.models import ResNet50_Weights

class ClothingClassifier:
    def __init__(self,
                 model_path="/backend/models/fabAI_clothingClassifierHD.pth",
                 encoder_path="label_encoder.pkl",
                 device="cpu",
                 use_fp16=False):
        self.device = torch.device(device)
        self.use_fp16 = use_fp16

        # Load label encoder
        self.label_encoder = joblib.load(encoder_path)

        # Load feature extractor (ResNet50 without final FC)
        base_model = models.resnet50(weights=ResNet50_Weights.IMAGENET1K_V1)
        self.feature_model = torch.nn.Sequential(*list(base_model.children())[:-1])
        self.feature_model.eval().to(self.device)
        if use_fp16:
            self.feature_model = self.feature_model.half()

        # Load classifier
        self.classifier = ClothingPredictor(input_size=2048)
        self.classifier.load_state_dict(torch.load(model_path, map_location=self.device))
        self.classifier.eval().to(self.device)
        if use_fp16:
            self.classifier = self.classifier.half()

        # Image preprocessor
        self.preprocess = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406],
                                 std=[0.229, 0.224, 0.225])
        ])

    def load_image(self, image_path):
        image = Image.open(image_path).convert('RGB')
        tensor = self.preprocess(image).unsqueeze(0)  # Shape: [1, C, H, W]
        return tensor.to(self.device).half() if self.use_fp16 else tensor.to(self.device)

    def predict(self, image_path):
        image_tensor = self.load_image(image_path)

        with torch.no_grad():
            features = self.feature_model(image_tensor)
            features = torch.flatten(features, 1)

            if self.use_fp16:
                features = features.half()

            logits = self.classifier(features)
            probs = torch.softmax(logits, dim=1)
            pred_index = torch.argmax(probs, dim=1).item()

        return self.label_encoder.inverse_transform([pred_index])[0]
