import unittest

import numpy as np

from appraisal import DCT_BLOCK_SIZE, dct_degrade


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
