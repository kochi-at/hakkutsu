import math
import unittest
from io import BytesIO

import numpy as np
from PIL import Image

from appraisal import COLOR_MAP_POINT_COUNT, DCT_BLOCK_SIZE, ELEMENT_SECTORS, appraise, dct_degrade


def _png_bytes(pixels: np.ndarray) -> bytes:
    buffer = BytesIO()
    Image.fromarray(pixels).save(buffer, format="PNG")
    return buffer.getvalue()


def _two_color_photo() -> bytes:
    # 赤が6割・青が4割の写真。単純平均だと色が打ち消し合う多色の物体の代わり。
    rng = np.random.default_rng(0)
    pixels = np.empty((96, 96, 3), dtype=np.float64)
    pixels[:, :58] = (220, 60, 40)
    pixels[:, 58:] = (40, 90, 220)
    pixels += rng.normal(0.0, 6.0, pixels.shape)
    return _png_bytes(np.clip(pixels, 0, 255).astype(np.uint8))


class ColorMapTests(unittest.TestCase):
    def test_same_photo_gives_same_color_map(self):
        photo = _two_color_photo()
        self.assertEqual(appraise(photo).color_map, appraise(photo).color_map)

    def test_points_are_sampled_with_display_colors(self):
        points = appraise(_two_color_photo()).color_map.points
        self.assertEqual(len(points), COLOR_MAP_POINT_COUNT)
        for _, _, color in points:
            self.assertRegex(color, r"^#[0-9a-f]{6}$")

    def test_exactly_one_dominant_cluster_and_shares_sum_to_one(self):
        clusters = appraise(_two_color_photo()).color_map.clusters
        self.assertEqual(sum(cluster.dominant for cluster in clusters), 1)
        self.assertAlmostEqual(sum(cluster.share for cluster in clusters), 1.0, places=3)

    def test_dominant_cluster_points_to_the_element(self):
        # 図に描く支配クラスタの向きと、カード表面の属性が食い違わないこと。
        result = appraise(_two_color_photo())
        dominant = next(cluster for cluster in result.color_map.clusters if cluster.dominant)
        cluster_angle = math.degrees(math.atan2(dominant.q, dominant.i)) % 360.0
        self.assertAlmostEqual(cluster_angle, result.hue_angle, delta=1.0)
        sector = next(element for upper, element in ELEMENT_SECTORS if cluster_angle < upper)
        self.assertEqual(sector, result.element)


class DctDegradeTests(unittest.TestCase):
    def test_shape_is_preserved_even_when_not_a_multiple_of_block_size(self):
        rgb = np.random.default_rng(0).random((37, 53, 3))
        result = dct_degrade(rgb).image
        self.assertEqual(result.shape, rgb.shape)

    def test_result_stays_within_valid_range(self):
        rgb = np.random.default_rng(1).random((DCT_BLOCK_SIZE * 4, DCT_BLOCK_SIZE * 4, 3))
        result = dct_degrade(rgb).image
        self.assertGreaterEqual(result.min(), 0.0)
        self.assertLessEqual(result.max(), 1.0)

    def test_flat_block_is_unaffected_by_degrading(self):
        # 無地(ベタ塗り)は低周波成分しか持たないため、間引いても変化しないはず。
        rgb = np.full((DCT_BLOCK_SIZE, DCT_BLOCK_SIZE, 3), 0.5)
        result = dct_degrade(rgb).image
        np.testing.assert_allclose(result, rgb, atol=1e-9)

    def test_degrading_smooths_a_sharp_edge(self):
        # 左半分が黒・右半分が白のくっきりした境目は高周波成分を多く含むので、
        # 間引くと境目がなだらかになる(両端の画素の差が縮む)はず。
        block = np.zeros((DCT_BLOCK_SIZE, DCT_BLOCK_SIZE, 3))
        block[:, DCT_BLOCK_SIZE // 2:, :] = 1.0
        result = dct_degrade(block).image
        original_edge_gap = abs(block[0, 0, 0] - block[0, -1, 0])
        degraded_edge_gap = abs(result[0, 0, 0] - result[0, -1, 0])
        self.assertLess(degraded_edge_gap, original_edge_gap)


if __name__ == "__main__":
    unittest.main()
