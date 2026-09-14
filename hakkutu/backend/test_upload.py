from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
from PIL import Image

import main


class UploadTests(unittest.TestCase):
    def test_supported_photos_are_saved(self):
        with TemporaryDirectory() as directory, patch.object(main, "UPLOAD_DIR", Path(directory)), patch.object(main, "evaluate_photo", return_value={"comment": "伝説の聖遺物です"}) as evaluate:
            with TestClient(main.app) as client:
                for image_format, (content_type, extension) in main.IMAGE_TYPES.items():
                    with self.subTest(image_format=image_format):
                        data = BytesIO()
                        Image.new("RGB", (8, 12)).save(data, format=image_format)
                        response = client.post(
                            "/upload", files={"file": ("../../photo.png", data.getvalue(), content_type)},
                            headers={"Origin": "http://localhost:5173"},
                        )
                        self.assertEqual(response.status_code, 201)
                        result = response.json()
                        self.assertEqual(result["evaluation"]["comment"], "伝説の聖遺物です")
                        evaluate.assert_called_with(data.getvalue(), content_type,
                                                    main.appraise(data.getvalue()))
                        self.assertEqual((result["width"], result["height"]), (8, 12))
                        self.assertTrue(result["filename"].endswith(extension))
                        self.assertEqual((Path(directory) / result["filename"]).read_bytes(), data.getvalue())
                        self.assertEqual(response.headers["access-control-allow-origin"], "http://localhost:5173")

    def test_invalid_uploads_are_not_saved(self):
        gif = BytesIO()
        Image.new("RGB", (8, 12)).save(gif, format="GIF")
        cases = [(b"", 400), (b"not an image", 400), (gif.getvalue(), 415),
                 (b"x" * (main.MAX_FILE_SIZE + 1), 413)]
        with TemporaryDirectory() as directory, patch.object(main, "UPLOAD_DIR", Path(directory)):
            with TestClient(main.app) as client:
                for contents, expected_status in cases:
                    with self.subTest(status=expected_status, size=len(contents)):
                        response = client.post("/upload", files={"file": ("photo.png", contents, "image/png")})
                        self.assertEqual(response.status_code, expected_status)
                self.assertEqual(client.post("/upload").status_code, 422)
                self.assertEqual(list(Path(directory).iterdir()), [])


if __name__ == "__main__":
    unittest.main()
