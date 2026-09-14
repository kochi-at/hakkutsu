from io import BytesIO
from pathlib import Path
from typing import Annotated
from uuid import uuid4

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, UnidentifiedImageError
from relic import evaluate_photo

app = FastAPI(title="写真アップロードAPI")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["POST"],
    allow_headers=["*"],
)

UPLOAD_DIR = Path(__file__).resolve().parent / "uploads"
MAX_FILE_SIZE = 10 * 1024 * 1024
IMAGE_TYPES = {
    "PNG": ("image/png", ".png"),
    "JPEG": ("image/jpeg", ".jpg"),
    "WEBP": ("image/webp", ".webp"),
}


@app.post("/upload", status_code=201)
def upload_photo(file: Annotated[UploadFile, File()]):
    """FormDataのfileを受け取り、検証した写真をローカルに保存する。"""
    try:
        # 上限を超えたデータをすべてメモリに読み込まない。
        contents = file.file.read(MAX_FILE_SIZE + 1)
        if not contents:
            raise HTTPException(status_code=400, detail="写真が空です")
        if len(contents) > MAX_FILE_SIZE:
            raise HTTPException(status_code=413, detail="写真は10MiB以下にしてください")

        try:
            with Image.open(BytesIO(contents)) as image:
                image_format = image.format
                if image_format not in IMAGE_TYPES:
                    raise HTTPException(
                        status_code=415, detail="PNG・JPEG・WebPの写真を送信してください"
                    )
                width, height = image.size
                image.verify()
            # verifyだけでなく、実際に画素をデコードして破損を確認する。
            with Image.open(BytesIO(contents)) as image:
                image.load()
        except (UnidentifiedImageError, OSError, SyntaxError, ValueError,
                Image.DecompressionBombError) as exc:
            raise HTTPException(status_code=400, detail="有効な画像ではありません") from exc

        content_type, extension = IMAGE_TYPES[image_format]
        evaluation = evaluate_photo(contents, content_type)
        # クライアントのファイル名を保存先に使用せず、重複も避ける。
        photo_id = uuid4().hex
        filename = f"{photo_id}{extension}"
        UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
        (UPLOAD_DIR / filename).write_bytes(contents)

        return {
            "message": "写真を受け取りました",
            "photo_id": photo_id,
            "filename": filename,
            "content_type": content_type,
            "size": len(contents),
            "width": width,
            "height": height,
            "evaluation": evaluation,
        }
    finally:
        file.file.close()
