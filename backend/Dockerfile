# paisa backend — FastAPI on Python 3.12 slim
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Install deps first for better layer caching.
COPY requirements.txt .
RUN python -m pip install --no-cache-dir "pip @ https://files.pythonhosted.org/packages/3f/06/3e4420302363fbb71be3c7f35ce042f54bfca330e3e66b3a2e3c4cca579f/pip-26.2.2-py3-none-any.whl#sha256=fd7f4dfa8190e014013b9f08f3e973f4e4c26ffd179a204895533a7254813a70" \
    && python -m pip install --no-cache-dir -r requirements.txt

# App code (includes ./migrations, run on startup by app.db.init_db).
COPY . .

EXPOSE 8000

# Railway provides $PORT; default to 8000 locally.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
