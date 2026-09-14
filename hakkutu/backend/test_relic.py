import json
import os
import unittest
from unittest.mock import patch

import httpx
from fastapi import HTTPException

import relic


EVALUATION = {"recognized_subject": "赤いコップ", "relic_name": "紅蓮の聖杯",
              "rarity": "SS", "score": 92, "legend": "古代の王が使った架空の聖杯。",
              "comment": "赤い輝きは炎の魔力を秘めているに違いない。"}


class RelicTests(unittest.TestCase):
    def test_image_and_schema_sent_and_result_validated(self):
        response = httpx.Response(200, json={"candidates": [{"finishReason": "STOP", "content": {
            "parts": [{"text": json.dumps(EVALUATION)}]}}]})
        with patch.dict(os.environ, {"GEMINI_API_KEY": "test-key"}), patch("relic.httpx.Client") as client:
            post = client.return_value.__enter__.return_value.post
            post.return_value = response
            self.assertEqual(relic.evaluate_photo(b"photo", "image/png"), EVALUATION)
            request = post.call_args.kwargs
            self.assertEqual(request["headers"]["x-goog-api-key"], "test-key")
            self.assertEqual(request["json"]["contents"][0]["parts"][1]["inlineData"],
                             {"mimeType": "image/png", "data": "cGhvdG8="})
            self.assertIn("responseJsonSchema", request["json"]["generationConfig"])

    def test_missing_key(self):
        with patch.dict(os.environ, {"GEMINI_API_KEY": ""}), patch("relic.httpx.Client") as client:
            with self.assertRaises(HTTPException) as error:
                relic.evaluate_photo(b"photo", "image/png")
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
                        relic.evaluate_photo(b"photo", "image/png")
                    self.assertEqual(error.exception.status_code, status)

    def test_timeout(self):
        with patch.dict(os.environ, {"GEMINI_API_KEY": "test-key"}), patch("relic.httpx.Client") as client:
            client.return_value.__enter__.return_value.post.side_effect = httpx.ReadTimeout("timeout")
            with self.assertRaises(HTTPException) as error:
                relic.evaluate_photo(b"photo", "image/png")
            self.assertEqual(error.exception.status_code, 504)

    def test_invalid_key_explained(self):
        response = httpx.Response(400, json={"error": {"details": [{"reason": "API_KEY_INVALID"}]}})
        with patch.dict(os.environ, {"GEMINI_API_KEY": "test-key"}), patch("relic.httpx.Client") as client:
            client.return_value.__enter__.return_value.post.return_value = response
            with self.assertRaises(HTTPException) as error:
                relic.evaluate_photo(b"photo", "image/png")
            self.assertIn("APIキーが無効", error.exception.detail)
