FROM python:3.12-slim

# WeasyPrint + CairoSVG system deps (Debian Trixie fix: libgdk-pixbuf-xlib-2.0-0)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpango-1.0-0 \
    libpangoft2-1.0-0 \
    libgdk-pixbuf-xlib-2.0-0 \
    libcairo2 \
    libffi-dev \
    shared-mime-info \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy app code into backend/ package (so `from backend.X import Y` resolves)
COPY backend/ backend/

# Copy config alongside so backend can find config/ai_prompt.json
COPY config/ config/

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
