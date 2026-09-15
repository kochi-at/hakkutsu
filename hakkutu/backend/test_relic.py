import json
import os
import unittest
from unittest.mock import patch

import httpx
from fastapi import HTTPException

import relic
from appraisal import AppraisalResult


LORE = {
    "name": "紅蓮の聖杯",
    "name_parts": [
        {"text": "紅蓮", "reading": "ぐれん"},
        {"text": "の", "reading": ""},
        {"text": "聖杯", "reading": "せいはい"},
    ],
    "lore": "古代の王が使った架空の聖杯。",
    "lore_parts": [
        {"text": "古代", "reading": "こだい"},
        {"text": "の", "reading": ""},
        {"text": "王", "reading": "おう"},
        {"text": "が", "reading": ""},
        {"text": "使", "reading": "つか"},
        {"text": "った", "reading": ""},
        {"text": "架空", "reading": "かくう"},
        {"text": "の", "reading": ""},
        {"text": "聖杯", "reading": "せいはい"},
        {"text": "。", "reading": ""},
    ],
}
APPRAISAL = AppraisalResult(rarity=4, element="火", luminance_ratio=1.1, saturation=0.2,
                            hue_angle=20.0, attack=60, endurance=70, magic=50,
                            edge_density=0.05, detail_loss_ratio=0.2, y=0.5, i=0.1, q=0.15)
EVALUATION = {
    **LORE,
    "rarity": 4,
    "element": "火",
    "stats": {"attack": 60, "endurance": 70, "magic": 50},
    "analysis": {"y": 0.5, "i": 0.1, "q": 0.15, "saturation": 0.2, "hueAngle": 20.0},
}


class RelicTests(unittest.TestCase):
    def test_mock_mode_does_not_call_gemini(self):
        with patch.dict(os.environ, {"MOCK_GEMINI": "true"}), patch("relic.httpx.Client") as client:
            result = relic.evaluate_photo(b"photo", "image/png", APPRAISAL)
            self.assertEqual(result["name"], "星屑の試作聖杯")
            self.assertEqual(result["name_parts"][0], {"text": "星屑", "reading": "ほしくず"})
            self.assertEqual(result["rarity"], APPRAISAL.rarity)
            client.assert_not_called()

    def test_image_and_schema_sent_and_result_validated(self):
        response = httpx.Response(200, json={"candidates": [{"finishReason": "STOP", "content": {
            "parts": [{"text": json.dumps(LORE)}]}}]})
        with patch.dict(os.environ, {"GEMINI_API_KEY": "test-key"}), patch("relic.httpx.Client") as client:
            post = client.return_value.__enter__.return_value.post
            post.return_value = response
            self.assertEqual(relic.evaluate_photo(b"photo", "image/png", APPRAISAL), EVALUATION)
            request = post.call_args.kwargs
            self.assertEqual(request["headers"]["x-goog-api-key"], "test-key")
            self.assertEqual(request["json"]["contents"][0]["parts"][1]["inlineData"],
                             {"mimeType": "image/png", "data": "cGhvdG8="})
            self.assertIn("responseJsonSchema", request["json"]["generationConfig"])
            # 計測済みのレア度と属性をLLMに伝えている。
            prompt = request["json"]["contents"][0]["parts"][0]["text"]
            self.assertIn("レア度4", prompt)
            self.assertIn("火", prompt)
            # LLMに返させるスキーマにレア度と属性を含めない。
            schema_fields = request["json"]["generationConfig"]["responseJsonSchema"]["properties"]
            self.assertNotIn("rarity", schema_fields)
            self.assertNotIn("element", schema_fields)
            self.assertIn("name_parts", schema_fields)
            self.assertIn("lore_parts", schema_fields)

    def test_llm_cannot_overwrite_rarity_and_element(self):
        response = httpx.Response(200, json={"candidates": [{"finishReason": "STOP", "content": {
            "parts": [{"text": json.dumps({**LORE, "rarity": 1, "element": "水"})}]}}]})
        with patch.dict(os.environ, {"GEMINI_API_KEY": "test-key"}), patch("relic.httpx.Client") as client:
            client.return_value.__enter__.return_value.post.return_value = response
            self.assertEqual(relic.evaluate_photo(b"photo", "image/png", APPRAISAL), EVALUATION)

    def test_kanji_without_reading_is_rejected(self):
        invalid_lore = {**LORE, "name_parts": [{"text": "紅蓮の聖杯", "reading": ""}]}
        response = httpx.Response(200, json={"candidates": [{"finishReason": "STOP", "content": {
            "parts": [{"text": json.dumps(invalid_lore)}]}}]})
        with patch.dict(os.environ, {"GEMINI_API_KEY": "test-key"}), patch("relic.httpx.Client") as client:
            client.return_value.__enter__.return_value.post.return_value = response
            with self.assertRaises(HTTPException) as error:
                relic.evaluate_photo(b"photo", "image/png", APPRAISAL)
            self.assertEqual(error.exception.status_code, 502)

    def test_missing_key(self):
        with patch.dict(os.environ, {"GEMINI_API_KEY": ""}), patch("relic.httpx.Client") as client:
            with self.assertRaises(HTTPException) as error:
                relic.evaluate_photo(b"photo", "image/png", APPRAISAL)
            self.assertEqual(error.exception.status_code, 503)
            client.assert_not_called()

    def test_api_failures(self):
        cases = [(httpx.Response(429), 429), (httpx.Response(403), 502),
                 (httpx.Response(200, json={"candidates": []}), 502),
                 (httpx.Response(200, json={"candidates": [{"finishReason": "STOP", "content": {
                     "parts": [{"text": "{}"}]}}]}), 502)]
        with patch.dict(os.environ, {"GEMINI_API_KEY": "test-key"}), patch("relic.httpx.Client") as client:
            for response, status in cases:
                with self.subTest(status=status, response=response.status_code):
                    client.return_value.__enter__.return_value.post.return_value = response
                    with self.assertRaises(HTTPException) as error:
                        relic.evaluate_photo(b"photo", "image/png", APPRAISAL)
                    self.assertEqual(error.exception.status_code, status)

    def test_timeout(self):
        with patch.dict(os.environ, {"GEMINI_API_KEY": "test-key"}), patch("relic.httpx.Client") as client:
            client.return_value.__enter__.return_value.post.side_effect = httpx.ReadTimeout("timeout")
            with self.assertRaises(HTTPException) as error:
                relic.evaluate_photo(b"photo", "image/png", APPRAISAL)
            self.assertEqual(error.exception.status_code, 504)

    def test_invalid_key_explained(self):
        response = httpx.Response(400, json={"error": {"details": [{"reason": "API_KEY_INVALID"}]}})
        with patch.dict(os.environ, {"GEMINI_API_KEY": "test-key"}), patch("relic.httpx.Client") as client:
            client.return_value.__enter__.return_value.post.return_value = response
            with self.assertRaises(HTTPException) as error:
                relic.evaluate_photo(b"photo", "image/png", APPRAISAL)
            self.assertIn("APIキーが無効", error.exception.detail)
