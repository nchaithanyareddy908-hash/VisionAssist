import io
import os
import threading
from typing import Any, Dict, List, Optional

import numpy as np
from PIL import Image

try:
    from ultralytics import YOLO
except Exception:
    YOLO = None

try:
    import easyocr
except Exception:
    easyocr = None


MODEL_PATH = os.getenv("YOLO_MODEL", "yolov8n.pt")

# Keep the models loaded in memory so they are not recreated
# every time the user clicks Capture Frame.
DETECTOR: Optional[Any] = None
OCR_READER: Optional[Any] = None

DETECTOR_LOCK = threading.Lock()
OCR_LOCK = threading.Lock()


def _load_detector() -> Any:
    global DETECTOR

    if YOLO is None:
        raise RuntimeError("ultralytics is not available")

    if DETECTOR is None:
        with DETECTOR_LOCK:
            if DETECTOR is None:
                print("Loading YOLO model...")
                DETECTOR = YOLO(MODEL_PATH)
                print("YOLO model loaded successfully.")

    return DETECTOR


def _load_ocr_reader() -> Any:
    global OCR_READER

    if easyocr is None:
        return None

    if OCR_READER is None:
        with OCR_LOCK:
            if OCR_READER is None:
                print("Loading OCR reader...")
                OCR_READER = easyocr.Reader(["en"], gpu=False)
                print("OCR reader loaded successfully.")

    return OCR_READER


def detect_objects(image_bytes: bytes) -> Dict[str, Any]:
    try:
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")

        # Convert PIL image to NumPy array for YOLO
        image_np = np.array(image)

        detector = _load_detector()

        print("Running YOLO detection...")

        results = detector(
            image_np,
            imgsz=640,
            conf=0.35,
            device="cpu",
            verbose=False,
            max_det=20,
        )

        detections: List[Dict[str, Any]] = []

        for result in results:
            boxes = result.boxes

            if boxes is None:
                continue

            for box in boxes:
                x1, y1, x2, y2 = map(
                    int,
                    box.xyxy[0].tolist()
                )

                class_id = int(box.cls[0])
                name = result.names[class_id]
                confidence = round(float(box.conf[0]), 2)

                detections.append(
                    {
                        "name": name,
                        "confidence": confidence,
                        "bbox": [x1, y1, x2, y2],
                    }
                )

        print(f"YOLO detection completed. Found {len(detections)} object(s).")

        return {
            "status": "ok",
            "objects": detections,
            "summary": f"Detected {len(detections)} object(s).",
        }

    except Exception as exc:
        print(f"Object detection error: {exc}")

        return {
            "status": "error",
            "objects": [],
            "summary": "Object detection is currently unavailable.",
            "message": str(exc),
        }


def ocr_text(image_bytes: bytes) -> Dict[str, Any]:
    try:
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        image_np = np.array(image)

        reader = _load_ocr_reader()

        if reader is None:
            return {
                "status": "error",
                "text": "",
                "message": "OCR is unavailable in the current environment.",
            }

        print("Running OCR...")

        results = reader.readtext(image_np)

        text = "\n".join(
            [item[1] for item in results if item[1]]
        )

        print("OCR completed.")

        return {
            "status": "ok" if text else "empty",
            "text": text,
            "message": (
                "Text extracted successfully."
                if text
                else "No readable text detected."
            ),
        }

    except Exception as exc:
        print(f"OCR error: {exc}")

        return {
            "status": "error",
            "text": "",
            "message": "OCR failed while processing the image.",
            "debug": str(exc),
        }


def describe_scene(
    image_bytes: bytes,
    detections: Optional[List[Dict[str, Any]]] = None,
    text: Optional[str] = None,
) -> Dict[str, Any]:

    try:
        if detections is None:
            detection_result = detect_objects(image_bytes)
            detections = detection_result.get("objects", [])

        if text is None:
            ocr_result = ocr_text(image_bytes)
            text = ocr_result.get("text", "")

        object_names = [
            item["name"]
            for item in detections
        ][:6]

        object_label = (
            ", ".join(object_names)
            if object_names
            else "no clear objects"
        )

        if text:
            description = (
                f"The scene appears to include {object_label}; "
                "visible text was also detected."
            )
        else:
            description = (
                f"The scene appears to include {object_label}."
            )

        return {
            "status": "ok",
            "description": description,
            "objects": detections,
            "text": text,
        }

    except Exception as exc:
        print(f"Scene description error: {exc}")

        return {
            "status": "error",
            "description": "Scene description is currently unavailable.",
            "objects": [],
            "text": "",
            "message": str(exc),
        }


def safety_warnings(
    objects: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:

    warnings: List[Dict[str, Any]] = []

    hazard_names = {
        "car": "Vehicle detected nearby.",
        "truck": "Vehicle detected nearby.",
        "bus": "Vehicle detected nearby.",
        "bicycle": "Bicycle detected nearby.",
        "motorbike": "Motorcycle detected nearby.",
        "motorcycle": "Motorcycle detected nearby.",
        "person": "Person detected nearby.",
        "stairs": "Stairs detected nearby.",
    }

    for item in objects:
        name = item.get("name", "").lower()

        if name in hazard_names:
            warnings.append(
                {
                    "name": name,
                    "message": hazard_names[name],
                    "confidence": item.get("confidence", 0),
                }
            )

    return warnings