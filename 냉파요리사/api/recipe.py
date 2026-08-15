import json
import os
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler


class handler(BaseHTTPRequestHandler):
    def send_json(self, status_code, data):
        response = json.dumps(data, ensure_ascii=False).encode("utf-8")

        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(response)))
        self.end_headers()
        self.wfile.write(response)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_POST(self):
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            request_body = self.rfile.read(content_length)
            data = json.loads(request_body.decode("utf-8"))

            ingredients = str(data.get("ingredients", "")).strip()
            style = str(data.get("style", "상관없음")).strip()

            if not ingredients:
                self.send_json(400, {"error": "요리할 재료를 먼저 입력해 주세요."})
                return

            api_key = os.environ.get("GEMINI_API_KEY")

            if not api_key:
                self.send_json(500, {"error": "AI API 키가 설정되지 않았습니다."})
                return

            prompt = f"""
당신은 요리 초보자를 위한 친절한 냉파 요리사입니다.

사용자가 가진 재료: {ingredients}
원하는 요리 스타일: {style}

위 재료를 최대한 활용하여 현실적으로 만들 수 있는 간단한 레시피를 추천하세요.
소금, 식용유, 간장, 설탕, 후추 같은 기본 양념은 사용할 수 있습니다.
추가 재료가 필요하다면 ingredients 항목에 "추가로 있으면 좋은 재료: ..." 형식으로 넣으세요.
조리 순서는 반드시 3~5단계로, 쉽고 짧은 한국어 문장으로 작성하세요.

반드시 아래 형식의 JSON만 반환하세요.
{{
  "title": "추천 요리명",
  "cooking_time": "약 10분",
  "ingredients": ["재료 1", "재료 2"],
  "steps": ["조리 단계 1", "조리 단계 2", "조리 단계 3"],
  "tip": "요리 초보자를 위한 한 줄 팁"
}}
"""

            gemini_request_data = {
                "contents": [
                    {
                        "parts": [
                            {
                                "text": prompt
                            }
                        ]
                    }
                ],
                "generationConfig": {
                    "responseMimeType": "application/json",
                    "temperature": 0.7
                }
            }

            url = (
                "https://generativelanguage.googleapis.com/v1beta/"
                f"models/gemini-2.5-flash:generateContent?key={api_key}"
            )

            request = urllib.request.Request(
                url,
                data=json.dumps(gemini_request_data).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST"
            )

            with urllib.request.urlopen(request, timeout=20) as response:
                gemini_response = json.loads(response.read().decode("utf-8"))

            recipe_text = gemini_response["candidates"][0]["content"]["parts"][0]["text"]
            recipe = json.loads(recipe_text)

            required_keys = ["title", "cooking_time", "ingredients", "steps", "tip"]

            if (
                not all(key in recipe for key in required_keys)
                or not isinstance(recipe["ingredients"], list)
                or not isinstance(recipe["steps"], list)
            ):
                raise ValueError("AI 응답 형식이 올바르지 않습니다.")

            self.send_json(200, recipe)

        except urllib.error.HTTPError as error:
            print(f"Gemini API HTTP 오류: {error.code}")
            self.send_json(502, {"error": "AI 서비스 연결 중 오류가 발생했습니다."})

        except (urllib.error.URLError, TimeoutError) as error:
            print(f"Gemini API 연결 오류: {error}")
            self.send_json(504, {"error": "AI 응답이 지연되고 있습니다."})

        except (KeyError, ValueError, json.JSONDecodeError) as error:
            print(f"AI 응답 처리 오류: {error}")
            self.send_json(502, {"error": "AI 응답을 처리하지 못했습니다."})

        except Exception as error:
            print(f"서버 오류: {error}")
            self.send_json(500, {"error": "서버에서 일시적인 오류가 발생했습니다."})

    def do_GET(self):
        self.send_json(405, {"error": "POST 요청만 사용할 수 있습니다."})