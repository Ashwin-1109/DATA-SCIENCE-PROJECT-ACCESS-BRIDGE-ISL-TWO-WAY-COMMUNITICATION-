"""
AccessBridge - YOLO Object Detection Service
Pretrained YOLOv8 Object Detection with Spatial Awareness for Blind Users
"""

import io
import base64
import numpy as np
import cv2
from typing import List, Dict, Any, Optional
from ultralytics import YOLO

class YoloService:
    def __init__(self, model_path: str = "yolov8n.pt"):
        self.model_path = model_path
        self._model = None

    @property
    def model(self):
        if self._model is None:
            self._model = YOLO(self.model_path)
        return self._model

    def detect_objects_in_bgr(self, img_bgr: np.ndarray, conf_thresh: float = 0.30) -> Dict[str, Any]:
        """
        Runs YOLOv8 object detection on a BGR OpenCV image and determines
        spatial layout (left/center/right, near/mid/far) for assistive navigation.
        """
        h, w = img_bgr.shape[:2]
        results = self.model(img_bgr, conf=conf_thresh, verbose=False)
        
        detected_objects: List[Dict[str, Any]] = []
        annotated_img = img_bgr.copy()

        if len(results) > 0 and results[0].boxes is not None:
            boxes = results[0].boxes
            for i in range(len(boxes)):
                xyxy = boxes.xyxy[i].cpu().numpy() # [x1, y1, x2, y2]
                conf = float(boxes.conf[i].cpu().numpy())
                cls_id = int(boxes.cls[i].cpu().numpy())
                label = self.model.names.get(cls_id, f"object_{cls_id}")

                x1, y1, x2, y2 = xyxy
                box_w = x2 - x1
                box_h = y2 - y1
                area_ratio = (box_w * box_h) / (w * h)
                x_center = (x1 + x2) / 2.0 / w
                y_bottom = y2 / h

                # Determine horizontal spatial location relative to user
                if x_center < 0.33:
                    h_pos = "on your left"
                elif x_center > 0.67:
                    h_pos = "on your right"
                else:
                    h_pos = "directly in front of you"

                # Determine distance approximation
                if area_ratio > 0.20 or y_bottom > 0.85:
                    dist_cat = "close (approx. 1 meter)"
                elif area_ratio > 0.05 or y_bottom > 0.60:
                    dist_cat = "mid-range (approx. 2 to 3 meters)"
                else:
                    dist_cat = "further away (approx. 4+ meters)"

                is_obstacle = label in [
                    "chair", "couch", "table", "bed", "door", "bench", 
                    "bicycle", "motorcycle", "car", "person", "dog", "cat", 
                    "suitcase", "backpack", "potted plant"
                ]

                detected_objects.append({
                    "id": i + 1,
                    "label": label,
                    "confidence": round(conf, 2),
                    "box": [round(float(x1)), round(float(y1)), round(float(x2)), round(float(y2))],
                    "box_normalized": [round(x1/w, 3), round(y1/h, 3), round(x2/w, 3), round(y2/h, 3)],
                    "spatial_position": h_pos,
                    "distance_category": dist_cat,
                    "is_obstacle": is_obstacle
                })

                # Draw bounding box on annotated image
                color = (0, 220, 100) if not is_obstacle else (0, 140, 255) # Green or Orange
                cv2.rectangle(annotated_img, (int(x1), int(y1)), (int(x2), int(y2)), color, 2)
                caption = f"{label} {int(conf * 100)}% ({h_pos})"
                cv2.putText(annotated_img, caption, (int(x1), max(20, int(y1) - 6)),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2, cv2.LINE_AA)

        # Encode annotated image to base64
        _, buffer = cv2.imencode('.jpg', annotated_img, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
        annotated_b64 = base64.b64encode(buffer).decode('utf-8')

        # Generate concise summary for TTS / LLM prompt
        if detected_objects:
            summary_parts = [f"{o['label']} ({o['spatial_position']}, {o['distance_category']})" for o in detected_objects[:6]]
            spatial_summary = f"Detected {len(detected_objects)} items: " + "; ".join(summary_parts) + "."
        else:
            spatial_summary = "No prominent objects detected in current field of view."

        return {
            "success": True,
            "count": len(detected_objects),
            "objects": detected_objects,
            "spatial_summary": spatial_summary,
            "annotated_image_base64": f"data:image/jpeg;base64,{annotated_b64}"
        }

    def detect_from_base64(self, image_b64: str) -> Dict[str, Any]:
        """Decodes base64 string and runs YOLO detection."""
        if "," in image_b64:
            image_b64 = image_b64.split(",", 1)[1]
        
        img_bytes = base64.b64decode(image_b64)
        nparr = np.frombuffer(img_bytes, np.uint8)
        img_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img_bgr is None:
            return {"success": False, "error": "Failed to decode base64 image", "objects": [], "count": 0}
        
        return self.detect_objects_in_bgr(img_bgr)

yolo_service = YoloService()
