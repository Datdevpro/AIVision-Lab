"""Validate and normalise uploaded images on the backend.

The *content* is validated (not the file extension): corrupted files, unsupported formats,
oversized files and decompression bombs are rejected with a clear Vietnamese reason.
"""
from __future__ import annotations

import hashlib
import io
from dataclasses import dataclass, field

from PIL import Image, ImageOps, UnidentifiedImageError

from app.core.config import Settings

ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}
MIN_SIDE = 32


class ImageRejected(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


@dataclass
class ProcessedImage:
    jpeg_bytes: bytes
    thumb_bytes: bytes
    original_width: int
    original_height: int
    width: int
    height: int
    sha256: str
    dhash: str
    color_hist: list[float] = field(default_factory=list)


def dhash64(im: Image.Image) -> str:
    g = im.convert("L").resize((9, 8), Image.LANCZOS)
    px = list(g.getdata())
    bits = 0
    for row in range(8):
        for col in range(8):
            bits = (bits << 1) | (1 if px[row * 9 + col] > px[row * 9 + col + 1] else 0)
    return f"{bits:016x}"


def color_histogram(im: Image.Image, bins: int = 8) -> list[float]:
    small = im.resize((64, 64), Image.BILINEAR)
    hist = small.histogram()  # 3 x 256
    step = 256 // bins
    out: list[float] = []
    for c in range(3):
        channel = hist[c * 256 : (c + 1) * 256]
        binned = [sum(channel[i : i + step]) for i in range(0, 256, step)]
        total = sum(binned) or 1
        out += [b / total for b in binned]
    return out


def process_image(data: bytes, settings: Settings) -> ProcessedImage:
    if not data:
        raise ImageRejected("EMPTY_FILE", "Tệp rỗng.")
    if len(data) > settings.max_upload_bytes:
        mb = settings.max_upload_bytes // (1024 * 1024)
        raise ImageRejected("FILE_TOO_LARGE", f"Tệp lớn hơn giới hạn {mb} MB.")
    Image.MAX_IMAGE_PIXELS = settings.max_image_pixels
    try:
        with Image.open(io.BytesIO(data)) as probe:
            fmt = probe.format
            probe.verify()  # detects truncated/corrupted data
        if fmt not in ALLOWED_FORMATS:
            raise ImageRejected("UNSUPPORTED_FORMAT", f"Định dạng {fmt} không được hỗ trợ (chỉ JPEG, PNG, WebP).")
        with Image.open(io.BytesIO(data)) as im:
            ow, oh = im.size
            if max(ow, oh) > settings.max_image_dimension:
                raise ImageRejected(
                    "IMAGE_TOO_LARGE", f"Ảnh {ow}x{oh} vượt giới hạn {settings.max_image_dimension}px mỗi cạnh."
                )
            if min(ow, oh) < MIN_SIDE:
                raise ImageRejected("IMAGE_TOO_SMALL", f"Ảnh quá nhỏ ({ow}x{oh}); tối thiểu {MIN_SIDE}px.")
            im.load()
            rgb = ImageOps.exif_transpose(im).convert("RGB")
    except ImageRejected:
        raise
    except Image.DecompressionBombError as exc:
        raise ImageRejected("IMAGE_TOO_LARGE", "Ảnh có số điểm ảnh quá lớn.") from exc
    except (UnidentifiedImageError, OSError, SyntaxError, ValueError) as exc:
        raise ImageRejected("CORRUPTED_IMAGE", "Tệp không phải ảnh hợp lệ hoặc đã bị hỏng.") from exc

    rgb.thumbnail((settings.stored_max_side, settings.stored_max_side), Image.LANCZOS)
    sha = hashlib.sha256(rgb.tobytes()).hexdigest()
    buf = io.BytesIO()
    rgb.save(buf, format="JPEG", quality=92)
    thumb = rgb.copy()
    thumb.thumbnail((160, 160), Image.LANCZOS)
    tbuf = io.BytesIO()
    thumb.save(tbuf, format="JPEG", quality=80)
    return ProcessedImage(
        jpeg_bytes=buf.getvalue(), thumb_bytes=tbuf.getvalue(),
        original_width=ow, original_height=oh, width=rgb.width, height=rgb.height,
        sha256=sha, dhash=dhash64(rgb), color_hist=color_histogram(rgb),
    )


def decode_for_inference(data: bytes, settings: Settings) -> Image.Image:
    """Validate + decode an image for prediction (no re-encoding, nothing is stored)."""
    if not data:
        raise ImageRejected("EMPTY_FILE", "Tệp rỗng.")
    if len(data) > settings.max_upload_bytes:
        raise ImageRejected("FILE_TOO_LARGE", "Ảnh vượt giới hạn dung lượng.")
    Image.MAX_IMAGE_PIXELS = settings.max_image_pixels
    try:
        with Image.open(io.BytesIO(data)) as probe:
            fmt = probe.format
            probe.verify()
        if fmt not in ALLOWED_FORMATS:
            raise ImageRejected("UNSUPPORTED_FORMAT", f"Định dạng {fmt} không được hỗ trợ.")
        with Image.open(io.BytesIO(data)) as im:
            if max(im.size) > settings.max_image_dimension:
                raise ImageRejected("IMAGE_TOO_LARGE", "Ảnh có kích thước quá lớn.")
            im.load()
            return ImageOps.exif_transpose(im).convert("RGB")
    except ImageRejected:
        raise
    except (Image.DecompressionBombError, UnidentifiedImageError, OSError, SyntaxError, ValueError) as exc:
        raise ImageRejected("CORRUPTED_IMAGE", "Tệp không phải ảnh hợp lệ hoặc đã bị hỏng.") from exc
