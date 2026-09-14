"""閾値調整のためのデバッグ用API。本番のフロントからは使用しない。"""

from io import BytesIO
from pathlib import Path
from typing import Annotated
from uuid import uuid4

import numpy as np
import numpy.typing as npt
from fastapi import APIRouter, File, HTTPException, Response, UploadFile
from fastapi import Path as PathParam
from PIL import Image, ImageDraw, ImageFont

from appraisal import (
    RGB_TO_YIQ,
    SUBJECT_RADIUS_RATIO,
    AppraisalError,
    appraise,
    center_circle_mask,
    dct_degrade,
    load_rgb_array,
)

router = APIRouter(prefix="/debug", tags=["debug"])

# 可視化画像の置き場。Git管理からは除外している。
VISUALIZATION_DIR = Path(__file__).resolve().parent / "debug_images"
MAX_FILE_SIZE = 10 * 1024 * 1024

# I・Qを色に変換するときの表示上の最大値。この値で正負の色が最も濃くなる。
CHANNEL_DISPLAY_SCALE = 0.6

# 各チャンネルの表示色(正の向き, 負の向き)。YIQの軸の意味に合わせている。
IN_PHASE_COLORS = ((255, 140, 0), (0, 180, 255))
QUADRATURE_COLORS = ((190, 60, 220), (120, 200, 60))

LABEL_HEIGHT = 26
GRID_MAX_EDGE = 1024


def _to_image(channels: npt.NDArray[np.float64]) -> Image.Image:
    """0〜1の配列をPILの画像に変換する。"""
    return Image.fromarray((np.clip(channels, 0.0, 1.0) * 255.0).astype(np.uint8))


def _subject_panel(rgb: npt.NDArray[np.float64], height: int, width: int) -> Image.Image:
    """元画像に、対象領域として使った円を重ねて描く。"""
    panel = _to_image(rgb)
    radius = min(height, width) * SUBJECT_RADIUS_RATIO
    center_x = (width - 1) / 2.0
    center_y = (height - 1) / 2.0
    ImageDraw.Draw(panel).ellipse(
        [center_x - radius, center_y - radius, center_x + radius, center_y + radius],
        outline=(255, 255, 255),
        width=3,
    )
    return panel


def _axis_panel(
    channel: npt.NDArray[np.float64], colors: tuple[tuple[int, int, int], tuple[int, int, int]]
) -> Image.Image:
    """I・Qのように正負を持つ軸を、正なら第1の色・負なら第2の色で塗り分ける。"""
    # 表示用に-1〜1へ収め、0(無彩色)が黒、絶対値が大きいほど濃い色になるようにする。
    scaled = np.clip(channel / CHANNEL_DISPLAY_SCALE, -1.0, 1.0)
    positive, negative = np.array(colors[0]) / 255.0, np.array(colors[1]) / 255.0
    color = np.where(scaled[..., None] >= 0.0, positive, negative)
    return _to_image(color * np.abs(scaled)[..., None])


def render_channels(image_bytes: bytes) -> bytes:
    """DCT劣化後・Y・I・Qを2×2に並べた確認用のPNGを作る。appraise()と同じ画像を可視化する。"""
    rgb = dct_degrade(load_rgb_array(image_bytes))
    height, width = rgb.shape[:2]
    yiq = rgb @ RGB_TO_YIQ.T

    panels = [
        ("DCT-degraded RGB + subject area", _subject_panel(rgb, height, width)),
        ("Y (luminance)", _to_image(np.repeat(yiq[..., :1], 3, axis=2))),
        ("I (orange <-> cyan)", _axis_panel(yiq[..., 1], IN_PHASE_COLORS)),
        ("Q (purple <-> green)", _axis_panel(yiq[..., 2], QUADRATURE_COLORS)),
    ]

    grid = Image.new("RGB", (width * 2, (height + LABEL_HEIGHT) * 2), (0, 0, 0))
    draw = ImageDraw.Draw(grid)
    font = ImageFont.load_default(size=18)
    for index, (label, panel) in enumerate(panels):
        x = (index % 2) * width
        y = (index // 2) * (height + LABEL_HEIGHT)
        draw.text((x + 8, y + 4), label, fill=(255, 255, 255), font=font)
        grid.paste(panel, (x, y + LABEL_HEIGHT))

    # 1枚が大きくなりすぎないよう縮小してから書き出す。
    grid.thumbnail((GRID_MAX_EDGE, GRID_MAX_EDGE), Image.LANCZOS)
    buffer = BytesIO()
    grid.save(buffer, format="PNG")
    return buffer.getvalue()


@router.post("/appraise")
def debug_appraise(file: Annotated[UploadFile, File()]):
    """写真の鑑定結果と、YIQ変換の確認用画像のURLを返す。"""
    try:
        contents = file.file.read(MAX_FILE_SIZE + 1)
        if len(contents) > MAX_FILE_SIZE:
            raise HTTPException(status_code=413, detail="写真は10MiB以下にしてください")
        try:
            appraisal = appraise(contents)
            visualization = render_channels(contents)
        except AppraisalError as exc:
            raise HTTPException(status_code=400, detail="有効な画像ではありません") from exc

        VISUALIZATION_DIR.mkdir(parents=True, exist_ok=True)
        image_id = uuid4().hex
        (VISUALIZATION_DIR / f"{image_id}.png").write_bytes(visualization)

        return {
            **appraisal.model_dump(),
            "visualization_url": f"/debug/visualization/{image_id}.png",
        }
    finally:
        file.file.close()


@router.get("/visualization/{image_id}.png")
def debug_visualization(image_id: Annotated[str, PathParam(pattern="^[0-9a-f]{32}$")]):
    """debug_appraiseが作った確認用画像をブラウザで開けるように返す。"""
    path = VISUALIZATION_DIR / f"{image_id}.png"
    if not path.is_file():
        raise HTTPException(status_code=404, detail="確認用画像が見つかりません")
    return Response(content=path.read_bytes(), media_type="image/png")
