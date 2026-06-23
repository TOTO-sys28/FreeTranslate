import os
import io
import asyncio
import logging
from contextlib import asynccontextmanager
from typing import Optional

import uvicorn
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse, HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from backend.config import (
    DEFAULT_MODEL_KEY,
    DEFAULT_DEVICE,
    CUDA_AVAILABLE,
    MODEL_REGISTRY,
    FAMILY_LANGUAGES
)
from backend.services.translation_engine import (
    load_engine,
    get_active_engine,
    translate_text,
    sse_translate,
    detect_language,
    LANGDETECT_AVAILABLE
)
from backend.services.document_translator import (
    translate_docx,
    translate_pdf
)

# ── Logging ────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger("FreeTranslate")

# ── Pydantic Request Models ────────────────────────────────────────────────
class TranslationRequest(BaseModel):
    text: str
    source_lang: Optional[str] = None
    target_lang: Optional[str] = None
    stream: Optional[bool] = False


class ReloadRequest(BaseModel):
    model_key: str
    device: str


# ── FastAPI Lifespan ───────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize the default translation engine on startup
    load_engine(DEFAULT_MODEL_KEY, DEFAULT_DEVICE)
    yield


app = FastAPI(lifespan=lifespan)

# ── CORS Middleware Configuration ──────────────────────────────────────────
# Required for browser extensions to query the local backend from arbitrary websites
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins (popups, content scripts, background pages)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── API Endpoints ──────────────────────────────────────────────────────────
@app.get("/api/health")
async def health_check():
    """Lightweight liveness check for extension and frontend."""
    engine = get_active_engine()
    return {
        "status": "ok",
        "model": engine.get("model_key"),
        "device": engine.get("device"),
    }


@app.get("/api/config")
async def get_config():
    """Retrieve system status and default options for client-side configuration."""
    active = get_active_engine()
    return {
        "cuda_available": CUDA_AVAILABLE,
        "default_model_key": DEFAULT_MODEL_KEY,
        "default_device": DEFAULT_DEVICE,
        "active_model_key": active["model_key"],
        "active_device": active["device"],
    }


@app.post("/api/reload")
async def reload_engine(payload: ReloadRequest):
    try:
        info = load_engine(payload.model_key, payload.device)
        return {"ok": True, "engine": info}
    except Exception as e:
        return {"ok": False, "error": str(e)}


@app.get("/api/languages")
async def get_languages():
    """Return all supported languages for the currently loaded model."""
    engine = get_active_engine()
    family = engine.get("family", "nllb")
    langs = FAMILY_LANGUAGES.get(family, {})
    return {
        "model_key": engine["model_key"],
        "family": family,
        "languages": langs,
        "default_source": MODEL_REGISTRY[engine["model_key"]]["default_source"],
        "default_target": MODEL_REGISTRY[engine["model_key"]]["default_target"],
    }


@app.post("/api/detect")
async def detect_lang(payload: TranslationRequest):
    engine = get_active_engine()
    family = engine.get("family", "nllb")
    detected = detect_language(payload.text, family=family)
    return {"detected": detected, "available": LANGDETECT_AVAILABLE, "family": family}


@app.post("/api/translate")
async def translate(payload: TranslationRequest):
    if not payload.text.strip():
        return {"translation": "", "stopped": False}

    if payload.stream:
        return StreamingResponse(
            sse_translate(payload.text, payload.source_lang, payload.target_lang),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    loop = asyncio.get_event_loop()
    try:
        translation, stopped, resolved_src = await loop.run_in_executor(
            None,
            translate_text,
            payload.text,
            payload.source_lang,
            payload.target_lang,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    engine = get_active_engine()
    return {
        "translation": translation,
        "stopped": stopped,
        "model": engine["model_key"],
        "device": engine["device"],
        "detected_source": resolved_src,
    }


@app.post("/api/translate/document")
async def translate_document(
    file: UploadFile = File(...),
    source_lang: Optional[str] = None,
    target_lang: Optional[str] = None,
):
    """Translate an uploaded DOCX, PDF, or text file and return the translated file."""
    engine = get_active_engine()
    config = MODEL_REGISTRY[engine["model_key"]]
    src = source_lang or config["default_source"]
    tgt = target_lang or config["default_target"]

    content = await file.read()
    filename = file.filename or "document"
    ext = os.path.splitext(filename)[1].lower()

    loop = asyncio.get_event_loop()

    if ext == ".docx":
        translated_bytes = await loop.run_in_executor(
            None, translate_docx, content, src, tgt
        )
        out_name = f"translated_{os.path.splitext(filename)[0]}.docx"
        media_type = (
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        )
    elif ext == ".pdf":
        translated_bytes = await loop.run_in_executor(
            None, translate_pdf, content, src, tgt
        )
        # Check if FPDF was imported successfully, else fallback to text
        try:
            from fpdf import FPDF
            out_name = f"translated_{os.path.splitext(filename)[0]}.pdf"
            media_type = "application/pdf"
        except ImportError:
            out_name = f"translated_{os.path.splitext(filename)[0]}.txt"
            media_type = "text/plain"
    elif ext in (".txt", ".md"):
        text = content.decode("utf-8", errors="ignore")
        translation, _, _ = await loop.run_in_executor(
            None, translate_text, text, src, tgt
        )
        translated_bytes = translation.encode("utf-8")
        out_name = f"translated_{filename}"
        media_type = "text/plain"
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext}")

    return StreamingResponse(
        io.BytesIO(translated_bytes),
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{out_name}"'},
    )


# ── Mount Frontend GUI ─────────────────────────────────────────────────────
# Serves static files directly from the frontend directory
try:
    app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")
except RuntimeError:
    log.warning("frontend directory not found. Please create 'frontend/' containing index.html.")


if __name__ == "__main__":
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=False)
