import os
from typing import Any, Dict, List, Optional

import requests
from fastapi import FastAPI, File, HTTPException, UploadFile, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, RedirectResponse
from pydantic import BaseModel

from .config import (
    ALLOWED_ORIGINS,
    FRONTEND_BASE_URL,
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI,
    MAX_FILE_SIZE_BYTES,
)
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


def build_google_auth_url() -> str:
    base = "https://accounts.google.com/o/oauth2/v2/auth"
    scopes = "openid email profile"
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "response_type": "code",
        "scope": scopes,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "access_type": "offline",
        "prompt": "consent",
    }
    query = "&".join(f"{key}={requests.utils.quote(value)}" for key, value in params.items())
    return f"{base}?{query}"


@app.get("/auth/google/login")
def google_login() -> RedirectResponse:
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="Google OAuth is not configured.")
    return RedirectResponse(url=build_google_auth_url())


@app.get("/auth/google/callback")
def google_callback(request: Request) -> HTMLResponse:
    code = request.query_params.get("code")
    if not code:
        raise HTTPException(status_code=400, detail="Missing authorization code.")

    token_response = requests.post(
        "https://oauth2.googleapis.com/token",
        data={
            "code": code,
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "redirect_uri": GOOGLE_REDIRECT_URI,
            "grant_type": "authorization_code",
        },
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    if not token_response.ok:
        raise HTTPException(status_code=400, detail="Unable to exchange code for token.")

    token_data = token_response.json()
    access_token = token_data.get("access_token")
    if not access_token:
        raise HTTPException(status_code=400, detail="Google did not return an access token.")

    userinfo_response = requests.get(
        "https://www.googleapis.com/oauth2/v2/userinfo",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    if not userinfo_response.ok:
        raise HTTPException(status_code=400, detail="Unable to fetch Google user info.")

    userinfo = userinfo_response.json()
    user_name = userinfo.get("name") or userinfo.get("email") or "Google User"

    redirect_url = f"{FRONTEND_BASE_URL}/login?success=1&name={requests.utils.quote(user_name)}&method=google"
    html = f"<html><head><meta charset=\"utf-8\"></head><body><script>window.location.replace('{redirect_url}');</script></body></html>"
    return HTMLResponse(content=html, status_code=200)


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
