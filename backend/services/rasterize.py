"""Convert uploaded plan files (PDF or image) to normalized PNG bytes."""
from __future__ import annotations

import io
from typing import Generator

import pypdfium2 as pdfium
from PIL import Image

# Render PDFs at 150 DPI
PDF_DPI = 150
PDF_SCALE = PDF_DPI / 72.0  # pdfium uses 72 DPI as base


def pdf_to_pages(data: bytes) -> Generator[bytes, None, None]:
    """Yield one PNG bytes object per page of the PDF."""
    doc = pdfium.PdfDocument(data)
    for page_index in range(len(doc)):
        page = doc[page_index]
        bitmap = page.render(scale=PDF_SCALE, rotation=0)
        pil_image = bitmap.to_pil()
        # Ensure RGB (no alpha channel for consistent handling)
        pil_image = pil_image.convert("RGB")
        buf = io.BytesIO()
        pil_image.save(buf, format="PNG", optimize=False)
        yield buf.getvalue()


def image_to_png(data: bytes) -> bytes:
    """Normalize any image format to RGB PNG bytes."""
    img = Image.open(io.BytesIO(data))
    img = img.convert("RGB")
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=False)
    return buf.getvalue()


def is_pdf(filename: str, data: bytes) -> bool:
    """Detect PDF by extension or magic bytes."""
    if filename.lower().endswith(".pdf"):
        return True
    # PDF magic bytes: %PDF
    return data[:4] == b"%PDF"
