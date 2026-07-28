FROM python:3.11-slim

WORKDIR /backend

# CPU-only PyTorch (smaller install; no CUDA). Installed before other deps.
RUN pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu

COPY requirements-prod.txt .
RUN pip install --no-cache-dir -r requirements-prod.txt

# Cache ResNet50 ImageNet weights at build time (avoids download + memory spike on boot).
ENV TORCH_HOME=/backend/.torch
ENV OMP_NUM_THREADS=1
ENV MKL_NUM_THREADS=1
ENV OPENBLAS_NUM_THREADS=1
RUN mkdir -p /backend/.torch && python -c "from torchvision.models import resnet50, ResNet50_Weights; resnet50(weights=ResNet50_Weights.IMAGENET1K_V1)"

COPY . .

ENV PORT=5000
EXPOSE 5000

# Lazy model load in backend.py — worker boots before PyTorch loads.
# Railway injects PORT (often 8080).
CMD sh -c "gunicorn --bind 0.0.0.0:${PORT:-8080} --workers 1 --threads 2 --timeout 180 backend:app"
