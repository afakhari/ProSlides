from __future__ import annotations

import argparse
from http.server import BaseHTTPRequestHandler, HTTPServer
import json

QUIZ = {
    "quiz_id": 100,
    "title": "E2E Quiz",
    "background": {"color": "#111", "image": ""},
    "music_url": None,
    "access_code": "1234",
    "slides": [
        {
            "slide_id": 2001,
            "slide_type": 1,
            "order": 1,
            "show_leaderboad_after": True,
            "question": {
                "question_id": 9001,
                "title": "Q1",
                "text": "2+2?",
                "question_type": "single",
                "image_url": None,
                "partial_scoring": False,
                "time_limit": 1,
                "max_point": 100.0,
                "min_point": 10.0,
                "faster_answers_more_points": True,
                "options": [
                    {"option_id": 1, "text": "4", "is_correct": True, "votes": 0, "image_url": None},
                    {"option_id": 2, "text": "5", "is_correct": False, "votes": 0, "image_url": None},
                ],
            },
            "leaderboard": [],
        },
        {
            "slide_id": 2002,
            "slide_type": 3,
            "order": 2,
            "leaderboard": [],
        },
    ],
}


class Handler(BaseHTTPRequestHandler):
    def _write_json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        if self.path.startswith("/api/quizzes/") and self.path.endswith("/export/"):
            self._write_json(200, QUIZ)
            return
        self._write_json(404, {"detail": "not found"})

    def do_POST(self) -> None:
        if "/question/leaderboard/" in self.path or "/question/results/" in self.path:
            length = int(self.headers.get("Content-Length", "0"))
            if length:
                _ = self.rfile.read(length)
            self._write_json(200, {"ok": True})
            return
        self._write_json(404, {"detail": "not found"})


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=18000)
    args = parser.parse_args()
    HTTPServer(("127.0.0.1", args.port), Handler).serve_forever()
