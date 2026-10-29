"""
AccessBridge - Accessible Document & Image Reader for Blind Users
Extracts text from PDF documents and images, and generates structured,
voice-friendly explanations using Gemini Multimodal AI.
"""

import io
import base64
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
import pypdf

from backend.app.services.gemini_service import gemini_service

router = APIRouter(prefix="/documents", tags=["Accessible Document Reader"])

class DocumentAnalysisResponse(BaseModel):
    success: bool
    filename: str
    doc_type: str
    page_count: int
    extracted_text: str
    accessible_explanation: str
    error: Optional[str] = None

class DocumentBase64Request(BaseModel):
    filename: str
    base64_data: str
    mime_type: Optional[str] = "application/pdf"

@router.post("/analyze-upload", response_model=DocumentAnalysisResponse)
async def analyze_document_upload(file: UploadFile = File(...)):
    filename = file.filename or "uploaded_document"
    content_type = file.content_type or ""
    file_bytes = await file.read()

    is_pdf = filename.lower().endswith(".pdf") or "pdf" in content_type.lower()
    is_image = any(ext in filename.lower() for ext in [".png", ".jpg", ".jpeg", ".webp"]) or "image" in content_type.lower()

    if not is_pdf and not is_image:
        raise HTTPException(status_code=400, detail="Unsupported file format. Please upload a PDF (.pdf) or image (.png, .jpg, .webp).")

    extracted_text = ""
    page_count = 1
    doc_type = "pdf" if is_pdf else "image"

    try:
        if is_pdf:
            # 1. Read PDF with pypdf
            pdf_stream = io.BytesIO(file_bytes)
            reader = pypdf.PdfReader(pdf_stream)
            page_count = len(reader.pages)
            
            pages_text = []
            for idx, page in enumerate(reader.pages):
                txt = page.extract_text() or ""
                if txt.strip():
                    pages_text.append(f"--- Page {idx + 1} ---\n{txt}")
            extracted_text = "\n\n".join(pages_text).strip()

            if not extracted_text:
                extracted_text = "[No digital text found in PDF. This may be a scanned or photo-based PDF.]"

            # 2. Get accessible narration from Gemini
            gemini_res = gemini_service.explain_document(
                content_text=extracted_text,
                doc_name=filename
            )
            explanation = gemini_res.get("narration") or extracted_text

        else:
            # Handle Image directly with Gemini Vision
            b64 = base64.b64encode(file_bytes).decode("utf-8")
            mime = "image/png" if filename.lower().endswith(".png") else "image/jpeg"
            if filename.lower().endswith(".webp"):
                mime = "image/webp"

            gemini_res = gemini_service.explain_document(
                image_base64=b64,
                doc_name=filename,
                mime_type=mime
            )
            explanation = gemini_res.get("narration") or "Image processed, but no detailed description was returned."
            extracted_text = explanation

        return DocumentAnalysisResponse(
            success=True,
            filename=filename,
            doc_type=doc_type,
            page_count=page_count,
            extracted_text=extracted_text,
            accessible_explanation=explanation
        )

    except Exception as e:
        return DocumentAnalysisResponse(
            success=False,
            filename=filename,
            doc_type=doc_type,
            page_count=0,
            extracted_text="",
            accessible_explanation="Failed to parse document.",
            error=str(e)
        )

@router.post("/analyze-base64", response_model=DocumentAnalysisResponse)
def analyze_document_base64(req: DocumentBase64Request):
    filename = req.filename
    b64_str = req.base64_data
    if "," in b64_str:
        b64_str = b64_str.split(",", 1)[1]

    file_bytes = base64.b64decode(b64_str)
    is_pdf = filename.lower().endswith(".pdf") or "pdf" in req.mime_type.lower()
    doc_type = "pdf" if is_pdf else "image"
    page_count = 1
    extracted_text = ""

    try:
        if is_pdf:
            reader = pypdf.PdfReader(io.BytesIO(file_bytes))
            page_count = len(reader.pages)
            pages_text = []
            for idx, page in enumerate(reader.pages):
                txt = page.extract_text() or ""
                if txt.strip():
                    pages_text.append(f"--- Page {idx + 1} ---\n{txt}")
            extracted_text = "\n\n".join(pages_text).strip()

            gemini_res = gemini_service.explain_document(
                content_text=extracted_text,
                doc_name=filename
            )
            explanation = gemini_res.get("narration") or extracted_text
        else:
            gemini_res = gemini_service.explain_document(
                image_base64=b64_str,
                doc_name=filename,
                mime_type=req.mime_type or "image/jpeg"
            )
            explanation = gemini_res.get("narration") or "Image processed."
            extracted_text = explanation

        return DocumentAnalysisResponse(
            success=True,
            filename=filename,
            doc_type=doc_type,
            page_count=page_count,
            extracted_text=extracted_text,
            accessible_explanation=explanation
        )
    except Exception as e:
        return DocumentAnalysisResponse(
            success=False,
            filename=filename,
            doc_type=doc_type,
            page_count=0,
            extracted_text="",
            accessible_explanation="Error analyzing document",
            error=str(e)
        )
