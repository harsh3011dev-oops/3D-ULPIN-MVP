# ─────────────────────────────────────────────
# 3D-ULPIN Backend — Dockerfile
# Optimized for Render.com free tier deployment
# ─────────────────────────────────────────────

FROM python:3.11-slim

# Install system dependencies for OpenCV + GDAL (rasterio)
RUN apt-get update && apt-get install -y \
    libgdal-dev \
    gdal-bin \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements and install Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy entire project
COPY . .

# Expose port
EXPOSE 8001

# Set Python path so ai/ and backend/ modules resolve correctly
ENV PYTHONPATH=/app

# Start FastAPI with uvicorn
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8001"]
