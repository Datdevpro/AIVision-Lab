"""Structured API errors: every error body is ``{"error": {code, message, details}}``."""
from __future__ import annotations

import json
import logging
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger("uvicorn.error.visionlab")


class AppError(Exception):
    def __init__(self, status_code: int, code: str, message: str, details: Any | None = None):
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.details = details


def not_found(what: str) -> AppError:
    return AppError(404, "NOT_FOUND", f"Không tìm thấy {what}.")


def bad_request(code: str, message: str, details: Any | None = None) -> AppError:
    return AppError(400, code, message, details)


def conflict(code: str, message: str, details: Any | None = None) -> AppError:
    return AppError(409, code, message, details)


def _body(code: str, message: str, details: Any | None = None) -> dict:
    return {"error": {"code": code, "message": message, "details": details}}


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(request: Request, exc: AppError):
        log = logger.error if exc.status_code >= 500 else logger.warning
        log("[API] %s %s -> %s %s: %s | details=%s", request.method, request.url.path,
            exc.status_code, exc.code, exc.message, json.dumps(exc.details, ensure_ascii=False, default=str))
        return JSONResponse(status_code=exc.status_code, content=_body(exc.code, exc.message, exc.details))

    @app.exception_handler(RequestValidationError)
    async def _validation_error(request: Request, exc: RequestValidationError):
        fields = [
            {"field": ".".join(str(p) for p in e.get("loc", []) if p != "body"), "message": e.get("msg", ""), "type": e.get("type", "")}
            for e in exc.errors()
        ]
        logger.warning("[API] %s %s -> 422 VALIDATION_ERROR | fields=%s", request.method, request.url.path,
                       json.dumps(fields, ensure_ascii=False))
        return JSONResponse(
            status_code=422,
            content=_body("VALIDATION_ERROR", "Dữ liệu gửi lên không hợp lệ.", fields),
        )

    @app.exception_handler(StarletteHTTPException)
    async def _http_error(request: Request, exc: StarletteHTTPException):
        code = {401: "UNAUTHORIZED", 404: "NOT_FOUND", 405: "METHOD_NOT_ALLOWED"}.get(exc.status_code, "HTTP_ERROR")
        log = logger.error if exc.status_code >= 500 else logger.warning
        log("[API] %s %s -> %s %s: %s", request.method, request.url.path, exc.status_code, code, exc.detail)
        return JSONResponse(status_code=exc.status_code, content=_body(code, str(exc.detail)), headers=exc.headers)

    @app.exception_handler(Exception)
    async def _unexpected_error(request: Request, exc: Exception):
        logger.exception("[API] %s %s -> 500 INTERNAL_ERROR: %s", request.method, request.url.path, exc)
        return JSONResponse(status_code=500, content=_body("INTERNAL_ERROR", "Lỗi máy chủ. Xem log terminal backend để biết chi tiết."))
