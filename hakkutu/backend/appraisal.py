"""写真の画素から聖遺物のレア度と属性を算出する。LLMには依存しない。"""

from io import BytesIO
from typing import NamedTuple

import numpy as np
import numpy.typing as npt
from PIL import Image, UnidentifiedImageError
from pydantic import BaseModel, Field

# --- 調整用の定数 ---------------------------------------------------------

# リサイズ後の長辺(px)。写真の解像度が違っても同じ基準で鑑定するために揃える。
RESIZE_LONG_EDGE: int = 768

# 画像中央を対象領域とみなす円の半径。短辺に対する割合。
SUBJECT_RADIUS_RATIO: float = 0.40

# DCTで劣化させるブロックの一辺(px)。JPEGと同じ8を採用。
DCT_BLOCK_SIZE: int = 8

# 1ブロック(DCT_BLOCK_SIZE**2個)の係数のうち、低周波側から残す個数。
# 少ないほど高周波成分(細かい模様)を大きく間引き、劣化が強くなる。
DCT_KEEP_COEFFS: int = 10

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

# 色相の角度(度)と属性の対応。上限値の昇順に並べ、最後が360度で一周する。
# フロントエンドのResultCardが扱う4属性(火・水・木・雷)に合わせて90度ずつ均等に分割する。
ELEMENT_SECTORS: tuple[tuple[float, str], ...] = (
    (90.0, "火"),
    (180.0, "水"),
    (270.0, "木"),
    (360.0, "雷"),
)

# --- 属性判定(色相クラスタリング)用の定数 -----------------------------
# 対象領域の画素をI・Q平面上でk-meansにかけ、最も「彩度の合計」が大きい
# クラスタの色相を属性判定に使う。単純平均だと多色の物体で彩度が打ち消し
# 合って色相が不安定になるため、支配的な色のクラスタだけを見る。
ELEMENT_KMEANS_CLUSTERS: int = 3

# k-means++初期化に使う乱数シード。決定的な鑑定結果にするため固定する。
ELEMENT_KMEANS_SEED: int = 0

ELEMENT_KMEANS_MAX_ITER: int = 20

# 全クラスタの彩度合計がこの値未満(≒対象領域がほぼ無彩色)の場合は、
# クラスタ結果を信頼せず対象領域全画素の平均色相にフォールバックする。
ELEMENT_KMEANS_MIN_WEIGHT: float = 1e-6

# --- ステータス算出用の定数 -------------------------------------------
# 攻撃力(エッジ密度)・魔力(彩度)は、生の特徴量をこれらの値で割って0〜1に正規化
# してから100倍する。SAT_MAXはbackend/uploadsの実写真をp90基準で調整した値。
# EDGE_MAXだけはp90に合わせると、実際の写真のエッジ密度分布が(背景のノイズや
# JPEG劣化により)他の特徴量よりも中央値からp90までの幅が狭く、
# 「平均的な写真でも攻撃力の基礎値が70〜80に達する」→レア度補正(0.62〜1.10倍)後も
# 常に攻撃力だけが耐久・魔力より頭一つ高くなる、という偏りが生じていた。
# そのためEDGE_MAXだけは中央値が基礎値50付近になるよう(中央値÷0.5)で再調整している。
#
# LOSS_MAXは耐久(DCTの損失率)用。損失率は比なので数学的には0〜1に収まるが、
# 自然画像はエネルギーが低周波に極端に偏る(まさにJPEGが成立する理由)ため、
# 実写真40枚では0.013〜0.051しか動かず、そのまま使うと基礎値が常に95〜99に
# 張り付いてレア度補正だけが値を決める状態になった。実測の中央値0.0372が
# 基礎値50になるよう、EDGE_MAXと同じ考え方で調整している。
EDGE_MAX: float = 0.27
LOSS_MAX: float = 0.074
SAT_MAX: float = 0.062

# エッジ密度の平均を取る際、マスク境界(輝度が急変し偽のエッジが出る場所)を
# 避けるために円を内側へ収縮させるピクセル数。
EDGE_MASK_EROSION_PX: float = 6.0

# ブロックあたりの平均AC成分エネルギーがこの値未満なら、対象領域はほぼ平坦
# とみなして損失率を0(=最もなめらか)として扱う。
# 平坦な面はAC成分自体がほぼ消えるため、割り算の分母が潰れて損失率がセンサー
# ノイズに支配される(ノイズは全周波数に均等に散るので損失率が跳ね上がり、
# 「一番ツルツルな写真が一番ザラザラ」と判定される)。実写真40枚では平坦な
# 1枚が0.0014、残りは最小でも0.14と100倍離れていたため、その間に閾値を置く。
MIN_AC_ENERGY_PER_BLOCK: float = 0.01

# レア度によるステータス補正: 基礎値(0〜100) × (RARITY_BASE_MULTIPLIER + rarity × RARITY_STEP_MULTIPLIER)。
RARITY_BASE_MULTIPLIER: float = 0.5
RARITY_STEP_MULTIPLIER: float = 0.12

# ステータスの上限値(補正後にこの値でクランプする)。
# フロントエンドのステータスバーは0〜100%の前提で描画しており、これを100より
# 大きくするとバーは100%止まりなのに数値表示だけ100を超えて表示され、
# 「攻撃力が高すぎる」ように見えるバグになる。
STAT_MAX_VALUE: int = 100

# Sobelフィルタのカーネル。x方向・y方向それぞれの勾配を求める。
_SOBEL_X: npt.NDArray[np.float64] = np.array(
    [[-1.0, 0.0, 1.0], [-2.0, 0.0, 2.0], [-1.0, 0.0, 1.0]]
)
_SOBEL_Y: npt.NDArray[np.float64] = np.array(
    [[-1.0, -2.0, -1.0], [0.0, 0.0, 0.0], [1.0, 2.0, 1.0]]
)


class AppraisalResult(BaseModel):
    rarity: int = Field(ge=1, le=5)
    element: str
    luminance_ratio: float
    saturation: float
    # 属性を決めた色相の角度(度)。k-meansで求めた支配的クラスタの色相。
    hue_angle: float
    attack: int = Field(ge=0, le=STAT_MAX_VALUE)
    endurance: int = Field(ge=0, le=STAT_MAX_VALUE)
    magic: int = Field(ge=0, le=STAT_MAX_VALUE)
    # 正規化前の生の特徴量。EDGE_MAXの調整に使う(SAT_MAXの調整にはsaturationを使う)。
    edge_density: float
    # DCTの間引きで失われた高周波成分が、対象領域のAC成分全体に占める割合。
    # LOSS_MAXの調整に使う。
    detail_loss_ratio: float
    # 対象領域のYIQの平均値。フロントエンドの解析値表示にそのまま使う。
    y: float
    i: float
    q: float


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


def _dct_basis_matrix(size: int) -> npt.NDArray[np.float64]:
    """直交なDCT-II基底行列(size×size)を作る。
    この行列を C とすると、ブロックへ C @ block @ C.T を掛けると空間領域→周波数領域、
    逆に C.T @ freq @ C を掛けると周波数領域→空間領域に戻る(順方向・逆方向で同じ行列を使い回せる)。"""
    n = np.arange(size)
    k = n.reshape(-1, 1)
    basis = np.cos(np.pi / size * (n + 0.5) * k)
    basis[0, :] /= np.sqrt(2)  # 周波数0(DC成分)の行だけ正規化の係数が異なる。
    return basis * np.sqrt(2.0 / size)


def _low_frequency_mask(size: int, keep: int) -> npt.NDArray[np.bool_]:
    """(行+列)の和が小さい、つまり低周波側からkeep個の係数だけがTrueになる
    (size, size)の真偽値配列を作る(JPEGのジグザグ順の簡易版)。"""
    total_freq = np.add.outer(np.arange(size), np.arange(size))
    # 「昇順に並べ替えた位置」をもう一度argsortすると、各要素の順位が得られる。
    rank = np.argsort(total_freq, axis=None, kind="stable").argsort().reshape(size, size)
    return rank < keep


_DCT_BASIS: npt.NDArray[np.float64] = _dct_basis_matrix(DCT_BLOCK_SIZE)
_DCT_KEEP_MASK: npt.NDArray[np.bool_] = _low_frequency_mask(DCT_BLOCK_SIZE, DCT_KEEP_COEFFS)


class DctResult(NamedTuple):
    """dct_degrade()の戻り値。

    image             劣化させた画像(高さ, 幅, 3)。
    discarded_energy  間引きで捨てた高周波成分のエネルギー(ブロック行, ブロック列)。
    ac_energy         DC成分を除く全AC成分のエネルギー(ブロック行, ブロック列)。

    エネルギーは係数の二乗和。DCTが直交変換なので、パーセバルの定理により
    画素側のエネルギーと一致する。特にAC成分のエネルギーはそのブロックの
    輝度の分散(×画素数)と厳密に等しい。
    """

    image: npt.NDArray[np.float64]
    discarded_energy: npt.NDArray[np.float64]
    ac_energy: npt.NDArray[np.float64]


def dct_degrade(rgb: npt.NDArray[np.float64]) -> DctResult:
    """DCTブロックごとに高周波成分を間引いてから逆DCTで復元し、劣化させた画像を返す。
    JPEGの非可逆圧縮と同じ原理。あわせて、間引きで捨てた成分のエネルギーも返す。
    捨てた成分は復元画像には一切含まれないため、復元画像から計算する他の特徴量
    (エッジ密度など)とは独立した情報になる。"""
    height, width = rgb.shape[:2]
    block = DCT_BLOCK_SIZE

    # ブロックの境界に揃うよう、端の画素を延長してパディングする。
    pad_height = (-height) % block
    pad_width = (-width) % block
    padded = np.pad(rgb, ((0, pad_height), (0, pad_width), (0, 0)), mode="edge")

    blocks_h, blocks_w = padded.shape[0] // block, padded.shape[1] // block
    # (ブロック行, ブロック列, チャンネル, ブロック内の行, ブロック内の列)に並べ替え、
    # 全ブロック・全チャンネルをまとめて処理できるようにする(ループは書かない)。
    blocks = padded.reshape(blocks_h, block, blocks_w, block, 3).transpose(0, 2, 4, 1, 3)

    # 順方向DCT: 周波数領域 = 基底行列 @ ブロック @ 基底行列の転置。
    freq = np.einsum("ij,...jk,lk->...il", _DCT_BASIS, blocks, _DCT_BASIS)

    # 間引きで消える成分のエネルギーを、消す前に測っておく。チャンネルは合算する
    # (細部の情報はほぼ輝度側にあり、RGBを足しても輝度の細かさとほぼ同じになる)。
    energy = freq**2
    # 保持マスクの外側はすべて高周波。DC成分(0, 0)は必ず保持されるので混ざらない。
    discarded_energy = (energy * ~_DCT_KEEP_MASK).sum(axis=(2, 3, 4))
    ac_energy = energy.sum(axis=(2, 3, 4)) - energy[:, :, :, 0, 0].sum(axis=2)

    freq *= _DCT_KEEP_MASK  # 低周波側だけ残し、高周波成分を0にする(ここが圧縮)。

    # 逆DCT: 空間領域 = 基底行列の転置 @ 周波数領域 @ 基底行列。
    restored = np.einsum("ji,...jk,kl->...il", _DCT_BASIS, freq, _DCT_BASIS)

    # (ブロック行, ブロック内の行, ブロック列, ブロック内の列, チャンネル)に戻してから結合する。
    restored = restored.transpose(0, 3, 1, 4, 2).reshape(padded.shape)
    # 間引きで元の0〜1の範囲をわずかにはみ出すことがあるためクリップする。
    return DctResult(
        np.clip(restored[:height, :width], 0.0, 1.0), discarded_energy, ac_energy
    )


def _circle_mask(height: int, width: int, radius: float) -> npt.NDArray[np.bool_]:
    """画像中央から半径radius以内だけがTrueになる真偽値の配列を作る。"""
    # 各画素の座標を縦ベクトル・横ベクトルとして用意し、中心からの距離を一度に計算する。
    rows, cols = np.ogrid[:height, :width]
    center_row = (height - 1) / 2.0
    center_col = (width - 1) / 2.0

    # 平方根を取らずに距離の2乗同士で比べる(結果は同じで計算が軽い)。
    return (rows - center_row) ** 2 + (cols - center_col) ** 2 <= radius**2


def center_circle_mask(height: int, width: int) -> npt.NDArray[np.bool_]:
    """画像中央の円(対象領域)だけがTrueになる真偽値の配列を作る。"""
    radius = min(height, width) * SUBJECT_RADIUS_RATIO
    return _circle_mask(height, width, radius)


def eroded_center_circle_mask(height: int, width: int, erosion_px: float) -> npt.NDArray[np.bool_]:
    """center_circle_maskと同じ円を、指定ピクセル数だけ内側に収縮させた版。
    マスクの境界は輝度が急変して偽のエッジになるため、エッジ密度を求める際はこちらを使う。"""
    radius = min(height, width) * SUBJECT_RADIUS_RATIO - erosion_px
    return _circle_mask(height, width, max(radius, 0.0))


def block_center_circle_mask(height: int, width: int, block_size: int) -> npt.NDArray[np.bool_]:
    """center_circle_maskと同じ円を、DCTブロック単位に落とした版。
    ブロックの中心が円の内側にあるブロックだけTrueにする。DCT係数はブロック単位
    でしか得られないため、係数から求める特徴量にはこちらのマスクを使う。"""
    blocks_h = -(-height // block_size)
    blocks_w = -(-width // block_size)

    # 各ブロックの中心を、元画像の画素座標で表す。
    block_center_rows = np.arange(blocks_h) * block_size + (block_size - 1) / 2.0
    block_center_cols = np.arange(blocks_w) * block_size + (block_size - 1) / 2.0

    center_row = (height - 1) / 2.0
    center_col = (width - 1) / 2.0
    radius = min(height, width) * SUBJECT_RADIUS_RATIO

    distance_sq = (block_center_rows[:, np.newaxis] - center_row) ** 2 + (
        block_center_cols[np.newaxis, :] - center_col
    ) ** 2
    return distance_sq <= radius**2


def _convolve3x3(field: npt.NDArray[np.float64], kernel: npt.NDArray[np.float64]) -> npt.NDArray[np.float64]:
    """2次元配列に3x3カーネルを畳み込む。端は同じ画素を延長して埋める。
    ループはカーネルの9マス分だけで、画素単位のループは書かない。"""
    padded = np.pad(field, 1, mode="edge")
    height, width = field.shape
    result = np.zeros_like(field)
    for i in range(3):
        for j in range(3):
            weight = kernel[i, j]
            if weight == 0.0:
                continue
            result += weight * padded[i : i + height, j : j + width]
    return result


def _sobel_gradient_magnitude(field: npt.NDArray[np.float64]) -> npt.NDArray[np.float64]:
    """Sobelフィルタでx方向・y方向の勾配を求め、勾配強度sqrt(gx^2+gy^2)を返す。"""
    gx = _convolve3x3(field, _SOBEL_X)
    gy = _convolve3x3(field, _SOBEL_Y)
    return np.hypot(gx, gy)


def _normalize_to_100(raw_value: float, max_value: float) -> float:
    """生の特徴量をmax_valueで割って0〜1にクランプし、100倍する。"""
    return float(np.clip(raw_value / max_value, 0.0, 1.0)) * 100.0


def _apply_rarity(base_value: float, rarity: int) -> int:
    """0〜100に正規化した基礎値にレア度補正を掛け、STAT_MAX_VALUEでクランプする。
    正規化前に補正を掛けると値が破綻するため、必ずこの順番で呼び出すこと。"""
    corrected = base_value * (RARITY_BASE_MULTIPLIER + rarity * RARITY_STEP_MULTIPLIER)
    return int(min(round(corrected), STAT_MAX_VALUE))


def normalize_stats(
    edge_density: float, detail_loss_ratio: float, saturation: float
) -> tuple[float, float, float]:
    """生の特徴量(edge_density, detail_loss_ratio, saturation)を、レア度補正前の
    0〜100の値(attack, endurance, magic)に正規化する。EDGE_MAX・LOSS_MAX・SAT_MAXの
    調整結果を確認するデバッグ用途と、appraise()本体の両方から呼ばれる。"""
    attack = _normalize_to_100(edge_density, EDGE_MAX)
    # 細部の損失が小さい(表面がなめらかで高周波成分が少ない)ほど頑丈とみなす。
    endurance = 100.0 - _normalize_to_100(detail_loss_ratio, LOSS_MAX)
    magic = _normalize_to_100(saturation, SAT_MAX)
    return attack, endurance, magic


def _to_rarity(luminance_ratio: float) -> int:
    """明るさの比からレア度(1〜5)を決める。"""
    # 閾値をいくつ超えたかがそのまま段階になる。
    return int(np.searchsorted(RARITY_THRESHOLDS, luminance_ratio, side="right")) + 1


def _kmeans_2d(
    points: npt.NDArray[np.float64], k: int, seed: int, max_iter: int
) -> tuple[npt.NDArray[np.float64], npt.NDArray[np.intp]]:
    """2次元の点群(n, 2)をk個のクラスタに分ける。k-means++で初期化し、
    重心の移動が止まる(またはmax_iterに達する)まで繰り返す。
    戻り値は(クラスタ中心(k, 2), 各点の所属クラスタ番号(n,))。"""
    rng = np.random.default_rng(seed)
    n = points.shape[0]

    # k-means++: 既存の中心から遠い点ほど次の中心に選ばれやすくする。
    centers = np.empty((k, 2), dtype=np.float64)
    centers[0] = points[rng.integers(n)]
    closest_dist_sq = np.sum((points - centers[0]) ** 2, axis=1)
    for i in range(1, k):
        total = closest_dist_sq.sum()
        # 全点が既存の中心と同じ位置(距離0)ならランダムに選ぶ。
        probabilities = closest_dist_sq / total if total > 0.0 else None
        centers[i] = points[rng.choice(n, p=probabilities)]
        closest_dist_sq = np.minimum(closest_dist_sq, np.sum((points - centers[i]) ** 2, axis=1))

    labels = np.full(n, -1, dtype=np.intp)
    for _ in range(max_iter):
        distances = np.linalg.norm(points[:, np.newaxis, :] - centers[np.newaxis, :, :], axis=2)
        new_labels = np.argmin(distances, axis=1)
        if np.array_equal(new_labels, labels):
            break
        labels = new_labels
        for cluster in range(k):
            members = labels == cluster
            if members.any():
                centers[cluster] = points[members].mean(axis=0)

    return centers, labels


def _dominant_hue_angle(in_phase: npt.NDArray[np.float64], quadrature: npt.NDArray[np.float64]) -> float:
    """対象領域のI・Q画素群をk-meansでクラスタリングし、最も彩度の合計が
    大きいクラスタの色相角度(度)を返す。単純平均と違い、多色の物体でも
    「一番目立つ色」を色相判定に使えるようにするための処理。"""
    points = np.stack([in_phase, quadrature], axis=1)
    fallback_mean = points.mean(axis=0)

    k = min(ELEMENT_KMEANS_CLUSTERS, points.shape[0])
    if k < 2:
        return float(np.degrees(np.arctan2(fallback_mean[1], fallback_mean[0]))) % 360.0

    centers, labels = _kmeans_2d(points, k, ELEMENT_KMEANS_SEED, ELEMENT_KMEANS_MAX_ITER)

    saturations = np.hypot(points[:, 0], points[:, 1])
    cluster_weights = np.array([saturations[labels == cluster].sum() for cluster in range(k)])
    dominant_cluster = int(np.argmax(cluster_weights))

    if cluster_weights[dominant_cluster] < ELEMENT_KMEANS_MIN_WEIGHT:
        # 対象領域全体がほぼ無彩色で、どのクラスタの色相も当てにならない場合。
        center_i, center_q = fallback_mean
    else:
        center_i, center_q = centers[dominant_cluster]

    return float(np.degrees(np.arctan2(center_q, center_i))) % 360.0


def _to_element(hue_angle: float) -> str:
    """色相の角度から属性を決める。hue_angleは%360.0されているため必ずいずれかの区間に入る。"""
    for upper_bound, element in ELEMENT_SECTORS:
        if hue_angle < upper_bound:
            return element
    raise AssertionError("hue_angle must be in [0, 360)")


def appraise(image_bytes: bytes) -> AppraisalResult:
    """写真のバイト列から、レア度・属性と、その根拠となる数値を求める。"""
    rgb = load_rgb_array(image_bytes)
    # 高周波の細部をあらかじめ間引いた画像を鑑定対象にする(JPEG相当の劣化)。
    # 間引きで捨てた成分のエネルギーは耐久の算出に使う。
    rgb, discarded_energy, ac_energy = dct_degrade(rgb)
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

    # 対象領域のY・I・Qを平均する。(I, Q)平面上での原点からの距離を彩度とする。
    mean_luminance = float(luminance[subject_mask].mean())
    mean_in_phase = float(in_phase[subject_mask].mean())
    mean_quadrature = float(quadrature[subject_mask].mean())
    saturation = float(np.hypot(mean_in_phase, mean_quadrature))

    # 属性判定用の色相は、単純平均ではなく対象領域の画素をk-meansでクラスタ
    # リングし、最も彩度の合計が大きい(=一番目立つ色の)クラスタから求める。
    # 単純平均だと多色の物体で色同士が打ち消し合い、色相が不安定になるため。
    hue_angle = _dominant_hue_angle(in_phase[subject_mask], quadrature[subject_mask])

    rarity = _to_rarity(luminance_ratio)

    # NTSCのYIQでは、色の細部(輪郭・模様・質感)の情報はほぼ輝度(Y)成分に
    # 集約されており、I・Qは色味を薄く塗るだけの情報しか持たない。そのため
    # 攻撃力(エッジ密度)・耐久(表面の均一さ)はいずれもY成分から求める。

    # ❶ 攻撃力: Y成分のエッジ密度。
    edge_magnitude = _sobel_gradient_magnitude(luminance)
    # マスク境界の偽エッジを避けるため、内側に収縮させた領域だけを対象にする。
    edge_mask = eroded_center_circle_mask(height, width, EDGE_MASK_EROSION_PX)
    edge_density = float(edge_magnitude[edge_mask].mean())

    # ❷ 耐久: DCTで捨てた高周波成分の割合の低さ。表面が均一なほど頑丈とみなす。
    # 領域全体の分散を使うと、影や照明のむらのような大きなスケールの明暗差まで
    # 拾ってしまい「影があるだけで脆い」という判定になっていた。ブロック単位の
    # DCT係数なら、そうした緩やかな明暗差は各ブロックのDC成分に吸収されるため、
    # 表面そのもののざらつきだけを見られる。
    block_mask = block_center_circle_mask(height, width, DCT_BLOCK_SIZE)
    subject_ac_energy = float(ac_energy[block_mask].sum())
    if subject_ac_energy / max(int(block_mask.sum()), 1) < MIN_AC_ENERGY_PER_BLOCK:
        # ほぼ平坦な領域は比が当てにならないため、最もなめらかとみなす。
        detail_loss_ratio = 0.0
    else:
        detail_loss_ratio = float(discarded_energy[block_mask].sum()) / subject_ac_energy

    # ❸ 魔力: 彩度。属性判定で求めたsaturationをそのまま再利用する。
    attack_base, endurance_base, magic_base = normalize_stats(
        edge_density, detail_loss_ratio, saturation
    )

    return AppraisalResult(
        rarity=rarity,
        element=_to_element(hue_angle),
        luminance_ratio=luminance_ratio,
        saturation=saturation,
        hue_angle=hue_angle,
        # レア度による補正は、必ず0〜100に正規化した後に掛ける。
        attack=_apply_rarity(attack_base, rarity),
        endurance=_apply_rarity(endurance_base, rarity),
        magic=_apply_rarity(magic_base, rarity),
        edge_density=edge_density,
        detail_loss_ratio=detail_loss_ratio,
        y=mean_luminance,
        i=mean_in_phase,
        q=mean_quadrature,
    )
