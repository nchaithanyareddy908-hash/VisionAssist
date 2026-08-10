import os
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .config import ALLOWED_ORIGINS, MAX_FILE_SIZE_BYTES
from .database import Database
from .services import describe_scene, detect_objects, ocr_text, safety_warnings

app = FastAPI(title="VisionAssist API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

db = Database()


class HistoryPayload(BaseModel):
    analysis_type: str
    result: Dict[str, Any]


@app.get("/api/health")
def health() -> Dict[str, Any]:
    return {"status": "ok", "message": "VisionAssist backend is running."}


@app.post("/api/detect")
async def detect(file: UploadFile = File(...)) -> Dict[str, Any]:
    if not file.filename:
        raise HTTPException(status_code=400, detail="Please provide an image file.")
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(status_code=413, detail="Image too large.")
    if not contents:
        raise HTTPException(status_code=400, detail="The uploaded image is empty.")
    result = detect_objects(contents)
    if result.get("status") == "error":
        raise HTTPException(status_code=422, detail=result.get("message", "Detection failed."))
    return result


@app.post("/api/ocr")
async def ocr(file: UploadFile = File(...)) -> Dict[str, Any]:
    if not file.filename:
        raise HTTPException(status_code=400, detail="Please provide an image file.")
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(status_code=413, detail="Image too large.")
    result = ocr_text(contents)
    if result.get("status") == "error":
        raise HTTPException(status_code=422, detail=result.get("message", "OCR failed."))
    return result


@app.post("/api/describe")
async def describe(file: UploadFile = File(...)) -> Dict[str, Any]:
    if not file.filename:
        raise HTTPException(status_code=400, detail="Please provide an image file.")
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(status_code=413, detail="Image too large.")
    detection_result = detect_objects(contents)
    ocr_result = ocr_text(contents)
    description_result = describe_scene(contents, detections=detection_result.get("objects", []), text=ocr_result.get("text", ""))
    warnings = safety_warnings(detection_result.get("objects", []))
    return {
        "status": "ok",
        "description": description_result["description"],
        "objects": detection_result.get("objects", []),
        "text": ocr_result.get("text", ""),
        "warnings": warnings,
    }


@app.get("/api/history")
def get_history() -> List[Dict[str, Any]]:
    return db.list_history()


@app.post("/api/history")
def create_history(payload: HistoryPayload) -> Dict[str, Any]:
    return db.insert_analysis(payload.analysis_type, payload.result)


@app.delete("/api/history/{history_id}")
def delete_history(history_id: int) -> Dict[str, Any]:
    success = db.delete_history(history_id)
    if not success:
        raise HTTPException(status_code=404, detail="History item not found.")
    return {"status": "ok", "deleted": history_id}


@app.delete("/api/history")
def clear_history() -> Dict[str, Any]:
    count = db.clear_history()
    return {"status": "ok", "deleted": count}
