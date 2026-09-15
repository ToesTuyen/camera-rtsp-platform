FROM python:3.11-slim

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends libglib2.0-0 libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
# PyPI Torch hiện kéo CUDA toolkit ngay cả khi `AI_DEVICE=cpu`. Cài CPU wheel từ index
# chính thức trước, rồi để Ultralytics dùng đúng dependency đã có. Ultralytics kéo
# opencv-python (có GUI), vì vậy cài lại bản headless ở cuối để không cần X11.
RUN pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu \
      torch==2.14.0 torchvision==0.29.0 \
    && pip install --no-cache-dir -r requirements.txt \
    && pip install --no-cache-dir --force-reinstall --no-deps 'opencv-python-headless>=4.10,<5'

COPY app ./app
CMD ["python", "-m", "app.main"]
