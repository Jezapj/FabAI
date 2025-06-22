FROM python:3.11-slim

WORKDIR /app
COPY . .

# Install packages directly (add more libs like matplotlib later)
RUN pip install -r requirements.txt

# Expose the port Flask runs on
EXPOSE 5000
CMD ["python", "app.py"]