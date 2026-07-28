FROM python:3.11-slim

WORKDIR /backend

# CPU-only PyTorch (smaller install; no CUDA). Installed before other deps.
RUN pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu

COPY requirements-prod.txt .
RUN pip install --no-cache-dir -r requirements-prod.txt

COPY . .

ENV PORT=5000
EXPOSE 5000

# One worker keeps a single in-memory PyTorch model instance.
CMD gunicorn --bind 0.0.0.0:$PORT --workers 1 --threads 2 --timeout 120 backend:app
