"""APIキーを表示せずに、認証とモデルの利用可否を確認する。"""
import os
import re
import sys
from io import BytesIO
from unittest.mock import patch

import httpx

import relic  # .envを読み込む
from fastapi import HTTPException
from PIL import Image


def main():
    key = os.getenv("GEMINI_API_KEY", "").strip()
    model = os.getenv("GEMINI_MODEL", "gemini-3.6-flash").strip()
    print("API key configured:", bool(key))
    print("Model:", model)
    if not key:
        return
    try:
        response = httpx.get(
            f"https://generativelanguage.googleapis.com/v1beta/models/{model}",
            headers={"x-goog-api-key": key}, timeout=30,
        )
        print("HTTP:", response.status_code)
        data = response.json()
        if response.is_success:
            print("Supported methods:", data.get("supportedGenerationMethods", []))
            if "--generation" in sys.argv:
                class DiagnosticClient(httpx.Client):
                    def post(self, *args, **kwargs):
                        result = super().post(*args, **kwargs)
                        print("Generation HTTP:", result.status_code)
                        if not result.is_success:
                            message = str(result.json().get("error", {}).get("message", ""))
                            print("Generation message:", re.sub(r"AIza[\w-]+", "[REDACTED]", message.replace(key, "[REDACTED]")))
                        return result
                image = BytesIO()
                Image.new("RGB", (32, 32), "red").save(image, "PNG")
                with patch("relic.httpx.Client", DiagnosticClient):
                    try:
                        evaluation = relic.evaluate_photo(image.getvalue(), "image/png")
                        print("Evaluation valid:", bool(evaluation))
                    except HTTPException as exc:
                        print("Evaluation error:", exc.detail)
        else:
            error = data.get("error", {})
            print("Status:", error.get("status"))
            message = str(error.get("message", "")).replace(key, "[REDACTED]")
            print("Message:", re.sub(r"AIza[\w-]+", "[REDACTED]", message))
    except httpx.RequestError:
        print("Network connection failed")


if __name__ == "__main__":
    main()
