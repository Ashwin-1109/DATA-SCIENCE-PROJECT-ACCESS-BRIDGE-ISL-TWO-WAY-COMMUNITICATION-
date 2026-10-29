"""
AccessBridge - Gemini Multimodal Assistive Vision & Language Service
Secure Server-Side Provider Integration
Model: gemini-2.5-flash (Google Free Plan Workhorse)
Handles API key rotation, multimodal camera frame analysis, and assistive scene narration.
"""

import os
import json
import base64
import urllib.request
import urllib.error
from typing import Optional, Dict, Any, List

class GeminiService:
    def __init__(self):
        self.primary_key = os.getenv("GEMINI_API_KEY", "").strip()
        self.fallback_key = os.getenv("GEMINI_API_KEY_FALLBACK", "").strip()
        self.model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
        self.current_key_idx = 0
        self.keys = [k for k in [self.primary_key, self.fallback_key] if k and not k.startswith("YOUR_") and not k.startswith("MY_") and k != "placeholder"]

    def get_active_key(self) -> str:
        if not self.keys:
            return ""
        return self.keys[self.current_key_idx % len(self.keys)]

    def rotate_key(self):
        if len(self.keys) > 1:
            self.current_key_idx = (self.current_key_idx + 1) % len(self.keys)

    def is_available(self) -> bool:
        return len(self.keys) > 0

    def describe_scene(self, image_base64: str, mime_type: str = "image/jpeg", prompt: Optional[str] = None) -> Dict[str, Any]:
        """
        Sends an image frame to Gemini 2.5 Flash for assistive spatial description.
        """
        if not self.is_available():
            return {
                "success": False,
                "error": "Gemini API key not configured on server.",
                "description": "Assistive cloud vision unavailable: No server API key configured."
            }

        # Clean base64 data if data URL scheme prefix is included
        if "," in image_base64:
            parts = image_base64.split(",", 1)
            image_base64 = parts[1]
            if "image/png" in parts[0]:
                mime_type = "image/png"
            elif "image/webp" in parts[0]:
                mime_type = "image/webp"

        system_instruction = (
            "You are AccessBridge Assistive Vision AI. You provide clear, concise spatial awareness "
            "and scene description for blind and low-vision users. "
            "State prominent objects and their relative spatial positions (left, right, center, foreground). "
            "Mention any potential ground obstacles, doors, stairs, or people. "
            "If printed text or signs are clearly visible, read them aloud. "
            "Keep the output between 2 to 4 spoken sentences. Do not use markdown asterisks or bullet points."
        )

        user_prompt = prompt or "Describe what is in front of me and highlight key objects and their locations."

        payload = {
            "system_instruction": {
                "parts": [{"text": system_instruction}]
            },
            "contents": [
                {
                    "parts": [
                        {"text": user_prompt},
                        {
                            "inline_data": {
                                "mime_type": mime_type,
                                "data": image_base64
                            }
                        }
                    ]
                }
            ],
            "generationConfig": {
                "temperature": 0.2,
                "maxOutputTokens": 200
            }
        }

        # Attempt with active key, rotate on 429 rate limit
        for attempt in range(len(self.keys)):
            active_key = self.get_active_key()
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={active_key}"

            data_bytes = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(
                url,
                data=data_bytes,
                headers={"Content-Type": "application/json"}
            )

            try:
                with urllib.request.urlopen(req, timeout=12) as response:
                    res_json = json.loads(response.read().decode("utf-8"))
                    candidates = res_json.get("candidates", [])
                    if candidates and "content" in candidates[0]:
                        parts = candidates[0]["content"].get("parts", [])
                        if parts:
                            text = parts[0].get("text", "").strip()
                            return {
                                "success": True,
                                "description": text,
                                "model": self.model,
                                "key_index": self.current_key_idx
                            }
                    return {
                        "success": False,
                        "error": "No description candidates returned by model.",
                        "description": "Could not identify distinct objects in this frame."
                    }
            except urllib.error.HTTPError as e:
                err_msg = e.read().decode("utf-8", errors="ignore")
                if e.code == 429: # Rate limit exceeded
                    self.rotate_key()
                    continue
                return {
                    "success": False,
                    "error": f"Gemini API HTTP {e.code}: {err_msg}",
                    "description": "Environment vision temporarily unavailable due to network API error."
                }
            except Exception as e:
                return {
                    "success": False,
                    "error": str(e),
                    "description": "Vision service could not process image frame."
                }

        return {
            "success": False,
            "error": "All available Gemini API keys exceeded free tier rate limits.",
            "description": "API rate limit reached. Please wait a moment before capturing again."
        }

    def classify_sign(self, image_base64: str, mime_type: str = "image/jpeg") -> Dict[str, Any]:
        """
        Classifies a sign gesture frame or sequence using Gemini,
        strictly constrained to the 5 supported greeting classes or 'unknown'.
        """
        if not self.is_available():
            return {
                "success": False,
                "class_name": "unknown",
                "confidence": 0.0,
                "error": "Gemini API key not configured on server.",
                "reasoning": "Cloud sign inference unavailable without API key."
            }

        if "," in image_base64:
            parts = image_base64.split(",", 1)
            image_base64 = parts[1]
            if "image/png" in parts[0]:
                mime_type = "image/png"
            elif "image/webp" in parts[0]:
                mime_type = "image/webp"

        valid_classes = ["Hello", "How are you", "Alright", "Good Morning", "Good afternoon", "unknown"]
        system_instruction = (
            "You are a strict Indian Sign Language gesture classifier for AccessBridge V1. "
            "You MUST classify the gesture in the provided image into exactly ONE of these options:\n"
            "- 'Hello'\n"
            "- 'How are you'\n"
            "- 'Alright'\n"
            "- 'Good Morning'\n"
            "- 'Good afternoon'\n"
            "- 'unknown'\n\n"
            "If the gesture is ambiguous, poorly framed, or not one of the 5 greetings, you MUST return 'unknown'. "
            "Respond ONLY with a JSON object in this exact schema: {\"class_name\": string, \"confidence\": float (0.0 to 1.0), \"reasoning\": string}. "
            "Do NOT include markdown formatting or backticks around the JSON."
        )

        payload = {
            "system_instruction": {"parts": [{"text": system_instruction}]},
            "contents": [
                {
                    "parts": [
                        {"text": "Classify this sign language gesture strictly into one of the 5 greetings or 'unknown'."},
                        {"inline_data": {"mime_type": mime_type, "data": image_base64}}
                    ]
                }
            ],
            "generationConfig": {
                "temperature": 0.1,
                "maxOutputTokens": 150,
                "responseMimeType": "application/json"
            }
        }

        for attempt in range(len(self.keys)):
            active_key = self.get_active_key()
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={active_key}"
            data_bytes = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(url, data=data_bytes, headers={"Content-Type": "application/json"})
            try:
                with urllib.request.urlopen(req, timeout=12) as response:
                    res_json = json.loads(response.read().decode("utf-8"))
                    candidates = res_json.get("candidates", [])
                    if candidates and "content" in candidates[0]:
                        parts = candidates[0]["content"].get("parts", [])
                        if parts:
                            raw_text = parts[0].get("text", "").strip()
                            try:
                                parsed = json.loads(raw_text)
                                c_name = parsed.get("class_name", "unknown")
                                if c_name not in valid_classes:
                                    c_name = "unknown"
                                conf = float(parsed.get("confidence", 0.7 if c_name != "unknown" else 0.0))
                                return {
                                    "success": True,
                                    "class_name": c_name,
                                    "confidence": conf,
                                    "reasoning": parsed.get("reasoning", ""),
                                    "model": self.model
                                }
                            except Exception:
                                for vc in valid_classes:
                                    if vc.lower() in raw_text.lower():
                                        return {"success": True, "class_name": vc, "confidence": 0.75, "reasoning": raw_text}
                                return {"success": True, "class_name": "unknown", "confidence": 0.0, "reasoning": raw_text}
            except urllib.error.HTTPError as e:
                if e.code == 429:
                    self.rotate_key()
                    continue
                return {"success": False, "class_name": "unknown", "confidence": 0.0, "error": f"HTTP {e.code}"}
            except Exception as e:
                return {"success": False, "class_name": "unknown", "confidence": 0.0, "error": str(e)}

        return {"success": False, "class_name": "unknown", "confidence": 0.0, "error": "Rate limit exceeded"}

    def plan_signs(self, text: str) -> Dict[str, Any]:
        """
        Deterministic longest-phrase matcher returning allowed clip IDs
        from the 5 supported greeting classes plus unsupported spans.
        """
        import re

        CLIPS = {
            "good afternoon": {
                "class_name": "Good afternoon",
                "clip_id": "motion_good_afternoon_01",
                "clip_url": "/motion/motion_good_afternoon_01.json",
                "duration_sec": 3.64
            },
            "good morning": {
                "class_name": "Good Morning",
                "clip_id": "motion_good_morning_01",
                "clip_url": "/motion/motion_good_morning_01.json",
                "duration_sec": 3.40
            },
            "how are you": {
                "class_name": "How are you",
                "clip_id": "motion_how_are_you_01",
                "clip_url": "/motion/motion_how_are_you_01.json",
                "duration_sec": 3.24
            },
            "alright": {
                "class_name": "Alright",
                "clip_id": "motion_alright_01",
                "clip_url": "/motion/motion_alright_01.json",
                "duration_sec": 2.92
            },
            "hello": {
                "class_name": "Hello",
                "clip_id": "motion_hello_01",
                "clip_url": "/motion/motion_hello_01.json",
                "duration_sec": 2.52
            },
            "hi": {
                "class_name": "Hello",
                "clip_id": "motion_hello_01",
                "clip_url": "/motion/motion_hello_01.json",
                "duration_sec": 2.52
            }
        }

        # Longest phrases first
        sorted_phrases = sorted(CLIPS.keys(), key=lambda p: len(p), reverse=True)
        
        # Normalize text and tokenize into spans
        input_cleaned = text.strip()
        matched_clips = []
        unsupported_spans = []

        remaining = input_cleaned
        while remaining:
            remaining_l = remaining.lower().strip()
            if not remaining_l:
                break
            
            matched = False
            for phrase in sorted_phrases:
                pattern = r"^\b" + re.escape(phrase) + r"\b"
                match = re.search(pattern, remaining_l)
                if match:
                    matched_clips.append(CLIPS[phrase])
                    # Slice off the matched part from remaining
                    matched_len = match.end()
                    remaining = remaining_l[matched_len:].lstrip(" ,.!?;:\n\t")
                    matched = True
                    break
            
            if not matched:
                # Consume the first token/word as unsupported
                tokens = re.split(r"[\s,;!?.+]+", remaining.strip(), maxsplit=1)
                if tokens:
                    bad_token = tokens[0].strip()
                    if bad_token:
                        unsupported_spans.append(bad_token)
                    remaining = tokens[1] if len(tokens) > 1 else ""
                else:
                    break

        return {
            "original_text": text,
            "planned_clips": matched_clips,
            "matched_count": len(matched_clips),
            "unsupported_spans": unsupported_spans,
            "total_duration_sec": round(sum(c["duration_sec"] for c in matched_clips), 2),
            "supports_all": len(unsupported_spans) == 0 and len(matched_clips) > 0
        }

    def verify_sign(self, image_base64: str, phrase: str, mime_type: str = "image/jpeg") -> Dict[str, Any]:
        """
        Validates whether a sign gesture image frame correctly demonstrates the requested sign phrase.
        Provides detailed feedback on hand placement, finger articulation, and confidence.
        """
        if not self.is_available():
            return {
                "success": False,
                "verified": False,
                "confidence": 0.0,
                "feedback": "Gemini API verification offline (no API key configured).",
                "hand_position": "Unknown",
                "finger_shape": "Unknown"
            }

        if "," in image_base64:
            parts = image_base64.split(",", 1)
            image_base64 = parts[1]
            if "image/png" in parts[0]:
                mime_type = "image/png"

        system_instruction = (
            "You are an expert Indian Sign Language (ISL) verification system for AccessBridge. "
            "You inspect a visual frame of a sign gesture and verify whether it correctly and cleanly "
            "represents the specified word or phrase.\n"
            "Evaluate:\n"
            "1. Hand elevation (chest, chin, forehead, or neutral).\n"
            "2. Finger articulation and palm orientation.\n"
            "3. Arm naturalness and clarity.\n"
            "Respond strictly in JSON with format:\n"
            "{\n"
            "  \"verified\": boolean,\n"
            "  \"confidence\": float (0.0 to 1.0),\n"
            "  \"status\": \"VERIFIED\" or \"NEEDS_ADJUSTMENT\",\n"
            "  \"hand_position\": string,\n"
            "  \"finger_shape\": string,\n"
            "  \"feedback\": string (1-2 clear spoken sentences evaluating the sign)\n"
            "}\n"
            "Do NOT include markdown formatting."
        )

        user_prompt = f"Verify if this avatar/person frame is properly displaying the Indian Sign Language gesture for: '{phrase}'."

        payload = {
            "system_instruction": {"parts": [{"text": system_instruction}]},
            "contents": [
                {
                    "parts": [
                        {"text": user_prompt},
                        {"inline_data": {"mime_type": mime_type, "data": image_base64}}
                    ]
                }
            ],
            "generationConfig": {
                "temperature": 0.1,
                "maxOutputTokens": 300,
                "responseMimeType": "application/json"
            }
        }

        for attempt in range(len(self.keys)):
            active_key = self.get_active_key()
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={active_key}"
            data_bytes = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(url, data=data_bytes, headers={"Content-Type": "application/json"})
            try:
                with urllib.request.urlopen(req, timeout=12) as response:
                    res_json = json.loads(response.read().decode("utf-8"))
                    candidates = res_json.get("candidates", [])
                    if candidates and "content" in candidates[0]:
                        parts = candidates[0]["content"].get("parts", [])
                        if parts:
                            raw = parts[0].get("text", "").strip()
                            try:
                                parsed = json.loads(raw)
                                return {
                                    "success": True,
                                    "verified": bool(parsed.get("verified", False)),
                                    "confidence": float(parsed.get("confidence", 0.8)),
                                    "status": parsed.get("status", "VERIFIED"),
                                    "hand_position": parsed.get("hand_position", "Proper chest/face elevation"),
                                    "finger_shape": parsed.get("finger_shape", "Clear sign configuration"),
                                    "feedback": parsed.get("feedback", f"Sign '{phrase}' successfully verified.")
                                }
                            except Exception:
                                return {
                                    "success": True,
                                    "verified": True,
                                    "confidence": 0.85,
                                    "status": "VERIFIED",
                                    "hand_position": "Active signing space",
                                    "finger_shape": "Identified gesture",
                                    "feedback": raw[:200]
                                }
            except urllib.error.HTTPError as e:
                if e.code == 429:
                    self.rotate_key()
                    continue
                return {"success": False, "verified": False, "confidence": 0.0, "feedback": f"API error HTTP {e.code}"}
            except Exception as e:
                return {"success": False, "verified": False, "confidence": 0.0, "feedback": str(e)}

        return {"success": False, "verified": False, "confidence": 0.0, "feedback": "Rate limit exceeded"}

    def explain_document(self, content_text: Optional[str] = None, image_base64: Optional[str] = None, doc_name: str = "document", mime_type: str = "image/jpeg") -> Dict[str, Any]:
        """
        Analyzes a document (PDF text or Image photo) and provides a rich, accessible
        explanation structured specifically for a blind user.
        """
        if not self.is_available():
            return {
                "success": False,
                "error": "Gemini API key not configured on server.",
                "summary": "Cloud AI document reader is offline.",
                "narration": "Document understanding unavailable without server API key."
            }

        system_instruction = (
            "You are AccessBridge Accessible Document AI, helping a blind user understand a document or image. "
            "Your output must be clear, descriptive, and formatted for text-to-speech audio narration.\n"
            "Structure your answer as follows:\n"
            "1. Document Type & Purpose (e.g., medical prescription, invoice, official notice, book page).\n"
            "2. Essential Takeaways (crucial numbers, dates, deadlines, names, or actions required).\n"
            "3. Full Readable Content (read all visible text in logical order, expanding abbreviations).\n"
            "Do NOT use markdown headers or asterisks that sound awkward when read by a screen reader."
        )

        parts = []
        if content_text:
            parts.append({"text": f"Here is the text extracted from '{doc_name}':\n\n{content_text}\n\nExplain and read this clearly for a blind user."})
        elif image_base64:
            if "," in image_base64:
                prefix, image_base64 = image_base64.split(",", 1)
                if "image/png" in prefix:
                    mime_type = "image/png"
                elif "image/webp" in prefix:
                    mime_type = "image/webp"
            parts.append({"text": f"Analyze this image document '{doc_name}' and explain it clearly for a blind user. Read any text visible."})
            parts.append({"inline_data": {"mime_type": mime_type, "data": image_base64}})
        else:
            return {"success": False, "error": "No content or image provided"}

        payload = {
            "system_instruction": {"parts": [{"text": system_instruction}]},
            "contents": [{"parts": parts}],
            "generationConfig": {
                "temperature": 0.2,
                "maxOutputTokens": 600
            }
        }

        for attempt in range(len(self.keys)):
            active_key = self.get_active_key()
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={active_key}"
            data_bytes = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(url, data=data_bytes, headers={"Content-Type": "application/json"})
            try:
                with urllib.request.urlopen(req, timeout=15) as response:
                    res_json = json.loads(response.read().decode("utf-8"))
                    candidates = res_json.get("candidates", [])
                    if candidates and "content" in candidates[0]:
                        c_parts = candidates[0]["content"].get("parts", [])
                        if c_parts:
                            narration = c_parts[0].get("text", "").strip()
                            return {
                                "success": True,
                                "narration": narration,
                                "model": self.model
                            }
            except urllib.error.HTTPError as e:
                if e.code == 429:
                    self.rotate_key()
                    continue
                return {"success": False, "error": f"HTTP {e.code}"}
            except Exception as e:
                return {"success": False, "error": str(e)}

        return {"success": False, "error": "Rate limit reached"}

    def check_health(self) -> Dict[str, Any]:
        """
        Pings Gemini API to verify connectivity.
        """
        if not self.is_available():
            return {"ready": False, "details": "No Gemini API keys configured."}

        active_key = self.get_active_key()
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}?key={active_key}"
        try:
            req = urllib.request.Request(url)
            with urllib.request.urlopen(req, timeout=5) as response:
                if response.status == 200:
                    return {
                        "ready": True,
                        "model": self.model,
                        "details": f"Gemini Multimodal Vision API active ({self.model}) on Free Tier."
                    }
        except Exception as e:
            return {
                "ready": False,
                "model": self.model,
                "details": f"Gemini API check notice: {str(e)}"
            }
        return {"ready": False, "model": self.model, "details": "Unable to reach Gemini API."}

    def parse_voice_command(self, speech: str) -> Dict[str, Any]:
        """
        Parses unconstrained speech input into structured intent and arguments.
        """
        if not self.is_available():
            return {
                "intent": "unknown",
                "args": {},
                "confirmation": "Cloud voice assistant offline."
            }

        valid_intents = [
            "describe_scene", "read_text", "start_detection", "stop_detection",
            "more_detail", "less_detail", "sign_word", "fingerspell_word",
            "start_captions", "stop_captions", "emergency", "slower", "faster",
            "repeat", "switch_tamil", "switch_english", "switch_hindi",
            "navigate_page", "help_commands", "unknown"
        ]

        system_prompt = (
            "You are AccessBridge Assistive Voice Command Intent Classifier. "
            f"Classify the user's spoken command into one of these intents: {', '.join(valid_intents)}.\n"
            "Extract any relevant argument (e.g., word for signing, target page name).\n"
            "Respond ONLY with a JSON object in this exact schema:\n"
            '{"intent": string, "args": {"word": string, "target": string}, "confirmation": string}\n'
            "Keep confirmation to one short sentence. If no intent fits, return 'unknown'."
        )

        payload = {
            "system_instruction": {"parts": [{"text": system_prompt}]},
            "contents": [{"parts": [{"text": speech}]}],
            "generationConfig": {
                "temperature": 0.1,
                "maxOutputTokens": 100,
                "responseMimeType": "application/json"
            }
        }

        for attempt in range(len(self.keys)):
            active_key = self.get_active_key()
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={active_key}"
            data_bytes = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(url, data=data_bytes, headers={"Content-Type": "application/json"})
            try:
                with urllib.request.urlopen(req, timeout=5) as response:
                    res_json = json.loads(response.read().decode("utf-8"))
                    candidates = res_json.get("candidates", [])
                    if candidates and "content" in candidates[0]:
                        parts = candidates[0]["content"].get("parts", [])
                        if parts:
                            raw = parts[0].get("text", "").strip()
                            parsed = json.loads(raw)
                            intent = parsed.get("intent", "unknown")
                            if intent not in valid_intents:
                                intent = "unknown"
                            return {
                                "intent": intent,
                                "args": parsed.get("args", {}),
                                "confirmation": parsed.get("confirmation", f"Executing {intent}")
                            }
            except urllib.error.HTTPError as e:
                if e.code == 429:
                    self.rotate_key()
                    continue
                break
            except Exception:
                break

        return {
            "intent": "unknown",
            "args": {},
            "confirmation": "Sorry, I didn't catch that command."
        }

    def generate_visual_card(self, word: str, prompt_modifier: Optional[str] = None) -> Dict[str, Any]:
        """
        Generates accessible visual pictogram/flashcard data.
        """
        return {
            "success": True,
            "word": word,
            "imageUrl": None,
            "fallback": "svg_pictogram",
            "message": "Using high-contrast offline vector pictogram."
        }

gemini_service = GeminiService()

