FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

RUN python -c "import cv2; print('OpenCV version:', cv2.__version__)"

RUN python -c "from ultralytics import YOLO; YOLO('yolov8n.pt'); print('YOLO model loaded successfully')"

RUN python -c "import easyocr; easyocr.Reader(['en'], gpu=False); print('EasyOCR model loaded successfully')"

COPY app ./app

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]