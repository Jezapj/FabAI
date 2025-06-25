FROM python:3.11-slim

WORKDIR /backend
COPY . .

# Install packages directly (add more libs like matplotlib later)
RUN pip install -r requirements.txt

# Expose the port Flask runs on
EXPOSE 5000
CMD ["python", "backend.py"]

# docker build -t backend .      
# docker run -p 5000:5000 backend 