import io
import os
from typing import Any, Dict, List, Optional

import cv2
import numpy as np
from PIL import Image

try:
    from ultralytics import YOLO
except Exception:  # pragma: no cover - optional dependency
    YOLO = None

try:
    import easyocr
except Exception:  # pragma: no cover - optional dependency
    easyocr = None


MODEL_PATH = os.getenv("YOLO_MODEL", "yolov8n.pt")
OCR_READER: Optional[Any] = None


def _load_ocr_reader() -> Any:
    global OCR_READER
    if OCR_READER is None and easyocr is not None:
        OCR_READER = easyocr.Reader(["en"], gpu=False)
    return OCR_READER


def _load_detector() -> Any:
    if YOLO is None:
        raise RuntimeError("ultralytics is not available")
    return YOLO(MODEL_PATH)


def detect_objects(image_bytes: bytes) -> Dict[str, Any]:
    try:
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        image_np = np.array(image)
        detector = _load_detector()
        results = detector(image_np, stream=True, conf=0.35)
        detections: List[Dict[str, Any]] = []
        for result in results:
            boxes = result.boxes
            for box in boxes:
                x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
                name = result.names[int(box.cls[0])]
                confidence = round(float(box.conf[0]), 2)
                detections.append(
                    {
                        "name": name,
                        "confidence": confidence,
                        "bbox": [x1, y1, x2, y2],
                    }
                )
        return {
            "status": "ok",
            "objects": detections,
            "summary": f"Detected {len(detections)} object(s).",
        }
    except Exception as exc:  # pragma: no cover - runtime path
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
        results = reader.readtext(image_np)
        text = "\n".join([item[1] for item in results if item[1]])
        return {
            "status": "ok" if text else "empty",
            "text": text,
            "message": "Text extracted successfully." if text else "No readable text detected.",
        }
    except Exception as exc:  # pragma: no cover - runtime path
        return {
            "status": "error",
            "text": "",
            "message": "OCR failed while processing the image.",
            "debug": str(exc),
        }


def describe_scene(image_bytes: bytes, detections: Optional[List[Dict[str, Any]]] = None, text: Optional[str] = None) -> Dict[str, Any]:
    try:
        if detections is None:
            detections = detect_objects(image_bytes).get("objects", [])
        if text is None:
            text = ocr_text(image_bytes).get("text", "")
        object_names = [item["name"] for item in detections][:6]
        object_label = ", ".join(object_names) if object_names else "no clear objects"
        if text:
            description = f"The scene appears to include {object_label}; visible text was also detected."
        else:
            description = f"The scene appears to include {object_label}."
        return {
            "status": "ok",
            "description": description,
            "objects": detections,
            "text": text,
        }
    except Exception as exc:  # pragma: no cover - runtime path
        return {
            "status": "error",
            "description": "Scene description is currently unavailable.",
            "objects": [],
            "text": "",
            "message": str(exc),
        }


def safety_warnings(objects: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    warnings: List[Dict[str, Any]] = []
    hazard_names = {"car": "Vehicle detected nearby.", "truck": "Vehicle detected nearby.", "bus": "Vehicle detected nearby.", "bicycle": "Bicycle detected nearby.", "motorbike": "Motorcycle detected nearby.", "motorcycle": "Motorcycle detected nearby.", "person": "Person detected nearby.", "stairs": "Stairs detected nearby."}
    for item in objects:
        name = item.get("name", "").lower()
        if name in hazard_names:
            warnings.append({"name": name, "message": hazard_names[name], "confidence": item.get("confidence", 0)})
    return warnings
