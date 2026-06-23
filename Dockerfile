# Use Python 3.11 slim image as base
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements file
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ ./backend/
COPY frontend/ ./frontend/

# Create directory for models
RUN mkdir -p /app/ct2_models

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV CT2_MODELS_DIR=/app/ct2_models

# Expose port 8000
EXPOSE 8000

# Run the application
CMD ["python", "-m", "backend.main"]
