
FROM python:3.11-slim

WORKDIR /app

# System dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Upgrade pip
RUN pip install --no-cache-dir --upgrade pip

# Install CPU-only PyTorch
RUN pip install --no-cache-dir \
    --timeout 120 \
    --retries 10 \
    --index-url https://download.pytorch.org/whl/cpu \
    torch==2.5.1

# Copy dependency files
COPY requirements.txt .
COPY constraints.txt .

# Install remaining dependencies
RUN pip install --no-cache-dir \
    --timeout 120 \
    --retries 10 \
    --constraint constraints.txt \
    -r requirements.txt

# Copy application
COPY . .

# Data directory
RUN mkdir -p /app/data

EXPOSE 10000

CMD ["sh", "-c", "uvicorn api.main:app --host 0.0.0.0 --port ${PORT:-10000}"]