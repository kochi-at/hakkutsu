"""写真の画素から聖遺物のレア度と属性を算出する。LLMには依存しない。"""

from io import BytesIO

import numpy as np
import numpy.typing as npt
from PIL import Image, UnidentifiedImageError
from pydantic import BaseModel, Field

# --- 調整用の定数 ---------------------------------------------------------

# リサイズ後の長辺(px)。写真の解像度が違っても同じ基準で鑑定するために揃える。
RESIZE_LONG_EDGE: int = 768

# 画像中央を対象領域とみなす円の半径。短辺に対する割合。
SUBJECT_RADIUS_RATIO: float = 0.40

# RGB(0〜1)をYIQへ変換するNTSC標準の行列。
# YIQは色を「明るさ1つ + 色味2つ」に分解する表現で、
#   Y = 明るさ(輝度)
#   I = 橙〜水色の軸(+が橙寄り、-が水色寄り)
#   Q = 紫〜黄緑の軸(+が紫寄り、-が黄緑寄り)
# (I, Q)を平面上の点として見ると、原点からの距離が「色の鮮やかさ」、
# 原点まわりの角度が「色相(何色か)」に対応する。この性質を属性判定に使う。
RGB_TO_YIQ: npt.NDArray[np.float64] = np.array(
    [
        [0.299, 0.587, 0.114],
        [0.595716, -0.274453, -0.321263],
        [0.211456, -0.522591, 0.311135],
    ]
)

# 真っ暗な写真でのゼロ除算を避けるための輝度の下限値。
MIN_MEAN_LUMINANCE: float = 1e-6

# レア度の境界。luminance_ratioがこの値を超えるごとにレア度が1段階上がる(1〜5)。
RARITY_THRESHOLDS: tuple[float, ...] = (0.85, 0.95, 1.05, 1.20)

# この彩度を下回る対象は無彩色とみなし、属性を「無」にする。
ACHROMATIC_SATURATION: float = 0.04

# 色相の角度(度)と属性の対応。上限値の昇順に並べ、最後が360度で一周する。
ELEMENT_SECTORS: tuple[tuple[float, str], ...] = (
    (72.0, "炎"),
    (144.0, "闇"),
    (216.0, "水"),
    (288.0, "風"),
    (360.0, "雷"),
)


class AppraisalResult(BaseModel):
    rarity: int = Field(ge=1, le=5)
    element: str
    luminance_ratio: float
    saturation: float
    # 属性を決めた色相の角度(度)。閾値調整のために残す。
    hue_angle: float


class AppraisalError(Exception):
    """画像を読み込めず鑑定できないときに送出する。"""


def load_rgb_array(image_bytes: bytes) -> npt.NDArray[np.float64]:
    """画像をリサイズし、0〜1に正規化したRGB配列(高さ, 幅, 3)にする。"""
    try:
        with Image.open(BytesIO(image_bytes)) as image:
            # パレット画像やRGBA画像が混ざっても同じ3チャンネルとして扱えるようにする。
            rgb_image = image.convert("RGB")

            # 長辺がRESIZE_LONG_EDGEになる倍率で拡大・縮小する。
            width, height = rgb_image.size
            scale = RESIZE_LONG_EDGE / max(width, height)
            resized = rgb_image.resize(
                (max(1, round(width * scale)), max(1, round(height * scale))),
                Image.LANCZOS,
            )

            # 0〜255の整数を0〜1の小数に直す。YIQの変換行列がこの範囲を前提にしている。
            return np.asarray(resized, dtype=np.float64) / 255.0
    except (
        UnidentifiedImageError,
        OSError,
        ValueError,
        Image.DecompressionBombError,
    ) as exc:
        raise AppraisalError("画像を読み込めませんでした") from exc


def center_circle_mask(height: int, width: int) -> npt.NDArray[np.bool_]:
    """画像中央の円(対象領域)だけがTrueになる真偽値の配列を作る。"""
    # 各画素の座標を縦ベクトル・横ベクトルとして用意し、中心からの距離を一度に計算する。
    rows, cols = np.ogrid[:height, :width]
    center_row = (height - 1) / 2.0
    center_col = (width - 1) / 2.0
    radius = min(height, width) * SUBJECT_RADIUS_RATIO

    # 平方根を取らずに距離の2乗同士で比べる(結果は同じで計算が軽い)。
    return (rows - center_row) ** 2 + (cols - center_col) ** 2 <= radius**2


def _to_rarity(luminance_ratio: float) -> int:
    """明るさの比からレア度(1〜5)を決める。"""
    # 閾値をいくつ超えたかがそのまま段階になる。
    return int(np.searchsorted(RARITY_THRESHOLDS, luminance_ratio, side="right")) + 1


def _to_element(hue_angle: float, saturation: float) -> str:
    """色相の角度と彩度から属性を決める。"""
    # 灰色に近い対象は、わずかなノイズで色相が大きく振れてしまうため属性を持たせない。
    if saturation < ACHROMATIC_SATURATION:
        return "無"

    for upper_bound, element in ELEMENT_SECTORS:
        if hue_angle < upper_bound:
            return element
    return ELEMENT_SECTORS[-1][1]


def appraise(image_bytes: bytes) -> AppraisalResult:
    """写真のバイト列から、レア度・属性と、その根拠となる数値を求める。"""
    rgb = load_rgb_array(image_bytes)
    height, width = rgb.shape[:2]

    # 全画素をまとめてYIQへ変換する(画素ごとのループは書かず、行列積で一括処理する)。
    yiq = rgb @ RGB_TO_YIQ.T
    luminance = yiq[..., 0]
    in_phase = yiq[..., 1]
    quadrature = yiq[..., 2]

    # 中央の円を対象領域、それ以外を背景領域とする。
    subject_mask = center_circle_mask(height, width)

    # 対象の明るさを画像全体の明るさで割る。暗い場所で撮っても明るい場所で撮っても
    # 全体が一緒に暗く/明るくなるため、比を取ると「まわりと比べて対象が光っているか」だけが残る。
    overall_mean_luminance = max(float(luminance.mean()), MIN_MEAN_LUMINANCE)
    luminance_ratio = float(luminance[subject_mask].mean()) / overall_mean_luminance

    # 対象領域のI・Qを平均し、(I, Q)平面上での原点からの距離を彩度とする。
    mean_in_phase = float(in_phase[subject_mask].mean())
    mean_quadrature = float(quadrature[subject_mask].mean())
    saturation = float(np.hypot(mean_in_phase, mean_quadrature))

    # atan2は-180〜180度を返すので、0〜360度に直してから区間に割り当てる。
    hue_angle = float(np.degrees(np.arctan2(mean_quadrature, mean_in_phase))) % 360.0

    return AppraisalResult(
        rarity=_to_rarity(luminance_ratio),
        element=_to_element(hue_angle, saturation),
        luminance_ratio=luminance_ratio,
        saturation=saturation,
        hue_angle=hue_angle,
    )
