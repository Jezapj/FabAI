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

# Railway injects PORT at runtime (usually 8080). Do NOT set PORT=5000 here — it can
# desync public routing from the port gunicorn binds (502 while internal health passes).
EXPOSE 8080

RUN sed -i 's/\r$//' /backend/start.sh && chmod +x /backend/start.sh

CMD ["/backend/start.sh"]
