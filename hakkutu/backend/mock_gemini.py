"""Gemini APIを使わず画面を確認するための固定レスポンス。"""


def create_mock_lore() -> dict:
    return {
        "name": "星屑の試作聖杯",
        "name_parts": [
            {"text": "星屑", "reading": "ほしくず"},
            {"text": "の", "reading": ""},
            {"text": "試作", "reading": "しさく"},
            {"text": "聖杯", "reading": "せいはい"},
        ],
        "lore": "古代の職人が作った聖杯。肝心な場面では少しだけ光る。",
        "lore_parts": [
            {"text": "古代", "reading": "こだい"},
            {"text": "の", "reading": ""},
            {"text": "職人", "reading": "しょくにん"},
            {"text": "が", "reading": ""},
            {"text": "作", "reading": "つく"},
            {"text": "った", "reading": ""},
            {"text": "聖杯", "reading": "せいはい"},
            {"text": "。", "reading": ""},
            {"text": "肝心", "reading": "かんじん"},
            {"text": "な", "reading": ""},
            {"text": "場面", "reading": "ばめん"},
            {"text": "では", "reading": ""},
            {"text": "少", "reading": "すこ"},
            {"text": "しだけ", "reading": ""},
            {"text": "光", "reading": "ひか"},
            {"text": "る。", "reading": ""},
        ],
    }
