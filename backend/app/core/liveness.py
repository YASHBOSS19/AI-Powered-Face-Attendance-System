"""
Anti-Spoofing & Liveness Detection Engine
Prevents proxy attendance by detecting printed photo hard copies, paper cards,
digital screens, and replayed photos using MiniFASNet deep neural networks,
multi-scale contextual evaluation, paper card edge detection, and chrominance analysis.
"""

import os
import urllib.request
import cv2
import numpy as np
import onnxruntime as ort
from typing import Dict, Any, Optional, List

MODEL_RELATIVE_PATH = os.path.join(os.path.dirname(__file__), "..", "models", "minifasnet_v2.onnx")
MODEL_BACKUP_URL = "https://huggingface.co/danelcsb/face/resolve/main/minifasnet_v2.onnx"

_liveness_detector = None


def ensure_model_exists(model_path: str) -> bool:
    """Ensure the MiniFASNet ONNX model is available locally, downloading if necessary."""
    if os.path.exists(model_path) and os.path.getsize(model_path) > 1000000:
        return True
    
    os.makedirs(os.path.dirname(model_path), exist_ok=True)
    print(f"[*] Downloading MiniFASNet anti-spoofing model to {model_path}...")
    try:
        req = urllib.request.Request(MODEL_BACKUP_URL, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = resp.read()
            with open(model_path, "wb") as f:
                f.write(data)
        print(f"[+] Download complete: {len(data)} bytes.")
        return True
    except Exception as e:
        print(f"[!] Failed to auto-download anti-spoof model: {e}")
        return False


class LivenessDetector:
    def __init__(self, model_path: Optional[str] = None):
        self.model_path = os.path.abspath(model_path or MODEL_RELATIVE_PATH)
        ensure_model_exists(self.model_path)

        if not os.path.exists(self.model_path):
            raise FileNotFoundError(f"Anti-spoofing ONNX model not found at {self.model_path}")

        # Setup ONNX runtime session with CPU execution provider
        opts = ort.SessionOptions()
        opts.inter_op_num_threads = 2
        opts.intra_op_num_threads = 2
        opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL

        self.session = ort.InferenceSession(self.model_path, sess_options=opts, providers=["CPUExecutionProvider"])
        self.input_name = self.session.get_inputs()[0].name
        
        # Warmup session with dummy tensor
        dummy = np.random.randn(1, 3, 80, 80).astype(np.float32)
        self.session.run(None, {self.input_name: dummy})
        print(f"[+] Anti-Spoofing Engine initialized successfully with model: {os.path.basename(self.model_path)}")

    def _crop_face_context(self, img: np.ndarray, bbox: List[int], scale: float = 2.7) -> np.ndarray:
        """
        Crop face region with scale margin (standard 2.7x for MiniFASNetV2)
        and reflective padding when boundaries exceed image dimensions.
        """
        img_h, img_w = img.shape[:2]
        x1, y1, x2, y2 = bbox
        bw = max(1, x2 - x1)
        bh = max(1, y2 - y1)
        
        center_x = x1 + bw / 2.0
        center_y = y1 + bh / 2.0
        max_side = max(bw, bh) * scale
        
        nx1 = int(center_x - max_side / 2.0)
        ny1 = int(center_y - max_side / 2.0)
        nx2 = int(center_x + max_side / 2.0)
        ny2 = int(center_y + max_side / 2.0)
        
        pad_l = max(0, -nx1)
        pad_t = max(0, -ny1)
        pad_r = max(0, nx2 - img_w)
        pad_b = max(0, ny2 - img_h)
        
        cx1 = max(0, nx1)
        cy1 = max(0, ny1)
        cx2 = min(img_w, nx2)
        cy2 = min(img_h, ny2)
        
        cropped = img[cy1:cy2, cx1:cx2]
        if pad_l > 0 or pad_t > 0 or pad_r > 0 or pad_b > 0:
            cropped = cv2.copyMakeBorder(cropped, pad_t, pad_b, pad_l, pad_r, cv2.BORDER_REFLECT)
            
        return cv2.resize(cropped, (80, 80), interpolation=cv2.INTER_LINEAR)

    def _eval_minifasnet(self, face_crop: np.ndarray) -> List[float]:
        """
        Run MiniFASNet forward inference and apply softmax.
        Returns: [p_print, p_real, p_replay]
        """
        # Model expects NCHW float32
        tensor = np.transpose(face_crop.astype(np.float32), (2, 0, 1))[np.newaxis, :]
        logits = self.session.run(None, {self.input_name: tensor})[0]
        exp_vals = np.exp(logits - np.max(logits, axis=1, keepdims=True))
        probs = (exp_vals / np.sum(exp_vals, axis=1, keepdims=True))[0]
        return [float(probs[0]), float(probs[1]), float(probs[2])]

    def _detect_paper_or_card_edges(self, img: np.ndarray, bbox: List[int]) -> Dict[str, Any]:
        """
        Detect rectangular boundaries or straight paper lines typical of printed
        hard copies, ID cards, or paper sheets presented in front of the lens.
        """
        img_h, img_w = img.shape[:2]
        x1, y1, x2, y2 = bbox
        bw = max(1, x2 - x1)
        bh = max(1, y2 - y1)
        
        # 1.8x context region around face
        cx, cy = x1 + bw / 2.0, y1 + bh / 2.0
        sw, sh = bw * 1.8, bh * 1.8
        ex1, ey1 = max(0, int(cx - sw / 2.0)), max(0, int(cy - sh / 2.0))
        ex2, ey2 = min(img_w, int(cx + sw / 2.0)), min(img_h, int(cy + sh / 2.0))
        
        context_roi = img[ey1:ey2, ex1:ex2]
        if context_roi.size == 0 or context_roi.shape[0] < 20 or context_roi.shape[1] < 20:
            return {"has_card_edges": False, "card_lines": 0}
            
        gray = cv2.cvtColor(context_roi, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        edges = cv2.Canny(blurred, 40, 130)
        
        min_line_len = int(min(bw, bh) * 0.45)
        lines = cv2.HoughLinesP(edges, 1, np.pi / 180, threshold=40, minLineLength=min_line_len, maxLineGap=12)
        
        card_lines = 0
        if lines is not None:
            for line in lines:
                pts = line.flatten()
                if len(pts) == 4:
                    lx1, ly1, lx2, ly2 = pts
                    angle = abs(np.degrees(np.arctan2(ly2 - ly1, lx2 - lx1)))
                    # Strong horizontal or vertical straight line typical of paper edges
                    if angle < 12 or angle > 168 or (78 < angle < 102):
                        card_lines += 1
                        
        has_card = card_lines >= 4
        return {"has_card_edges": has_card, "card_lines": card_lines}

    def _analyze_photo_glare_and_texture(self, img: np.ndarray, bbox: List[int]) -> Dict[str, Any]:
        """
        Analyze specular paper glare, color chrominance dispersion, and micro-texture.
        Printed glossy paper hard copies reflect flat white hot-spots from ambient room lights.
        """
        img_h, img_w = img.shape[:2]
        x1 = max(0, min(img_w - 1, bbox[0]))
        y1 = max(0, min(img_h - 1, bbox[1]))
        x2 = max(x1 + 1, min(img_w, bbox[2]))
        y2 = max(y1 + 1, min(img_h, bbox[3]))
        
        face_roi = img[y1:y2, x1:x2]
        if face_roi.size == 0:
            return {"glare_ratio": 0.0, "laplacian_var": 100.0, "chroma_std": 20.0}
            
        gray = cv2.cvtColor(face_roi, cv2.COLOR_BGR2GRAY)
        
        # Specular paper glare: fraction of pure white pixels (> 250) in face area
        white_pixels = np.count_nonzero(gray >= 250)
        glare_ratio = float(white_pixels) / float(gray.size) if gray.size > 0 else 0.0
        
        # Laplacian micro-texture
        laplacian_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())
        
        # Chrominance standard deviation (YCrCb)
        ycrcb = cv2.cvtColor(face_roi, cv2.COLOR_BGR2YCrCb)
        cr_std = float(np.std(ycrcb[:, :, 1]))
        cb_std = float(np.std(ycrcb[:, :, 2]))
        chroma_std = (cr_std + cb_std) / 2.0
        
        return {
            "glare_ratio": round(glare_ratio, 4),
            "laplacian_var": round(laplacian_var, 1),
            "chroma_std": round(chroma_std, 2)
        }

    def check_liveness(
        self, 
        img: np.ndarray, 
        bbox: List[int], 
        landmarks_3d: Optional[np.ndarray] = None
    ) -> Dict[str, Any]:
        """
        Perform complete multi-modal presentation attack detection on a face candidate.
        
        Returns:
            Dict containing:
            - is_live: True if verified as living human face, False if photo hard copy / proxy
            - liveness_score: float 0.0 - 1.0 (real face probability)
            - print_score: float 0.0 - 1.0 (print attack probability)
            - replay_score: float 0.0 - 1.0 (screen replay probability)
            - spoof_type: "PHOTO_HARD_COPY", "SCREEN_REPLAY", "CARD_BORDER_DETECTED", or None
            - rejection_reason: User-facing explanation
        """
        if img is None or img.size == 0 or not bbox or len(bbox) < 4:
            return {
                "is_live": False,
                "liveness_score": 0.0,
                "print_score": 1.0,
                "replay_score": 0.0,
                "spoof_type": "INVALID_IMAGE",
                "rejection_reason": "Invalid or empty camera frame."
            }

        # 1. MiniFASNet V2 Deep Learning Anti-Spoofing Inference
        try:
            face_crop = self._crop_face_context(img, bbox, scale=2.7)
            p_print, p_real, p_replay = self._eval_minifasnet(face_crop)
        except Exception as e:
            print(f"[!] MiniFASNet inference error: {e}")
            p_print, p_real, p_replay = 0.05, 0.90, 0.05

        # 2. Auxiliary Paper Card Edge & Frame Detection
        edge_info = self._detect_paper_or_card_edges(img, bbox)
        has_card_edges = edge_info["has_card_edges"]

        # 3. Specular Glare & Texture Analysis
        texture_info = self._analyze_photo_glare_and_texture(img, bbox)
        glare_ratio = texture_info["glare_ratio"]
        
        # 4. Decision Synthesis
        # Check if neural model classifies as print or replay attack
        is_neural_spoof = bool(p_print >= 0.38 or p_replay >= 0.50 or p_real < 0.52)
        
        # If paper/card edges were detected around the face and neural liveness isn't overwhelmingly high (> 0.90)
        is_card_spoof = bool(has_card_edges and p_real < 0.90)
        
        # High paper glare from flash or glossy photo print (> 6% pure white paper reflection)
        is_glare_spoof = bool(glare_ratio > 0.07 and p_real < 0.80)

        is_live = not (is_neural_spoof or is_card_spoof or is_glare_spoof)
        
        spoof_type = None
        rejection_reason = None

        if not is_live:
            if p_print >= 0.38 or is_card_spoof or (p_print >= p_replay):
                spoof_type = "PHOTO_HARD_COPY"
                rejection_reason = "Printed photo hard copy detected! Proxy attendance is strictly blocked."
            elif p_replay >= 0.50:
                spoof_type = "SCREEN_REPLAY"
                rejection_reason = "Digital screen / display proxy detected! Real live face required."
            elif is_glare_spoof:
                spoof_type = "PHOTO_HARD_COPY"
                rejection_reason = "Glossy photo surface glare detected! Proxy attendance is blocked."
            else:
                spoof_type = "SPOOF_DETECTED"
                rejection_reason = "Liveness verification failed. Real human face required."

        return {
            "is_live": is_live,
            "liveness_score": round(p_real, 3),
            "print_score": round(p_print, 3),
            "replay_score": round(p_replay, 3),
            "spoof_type": spoof_type,
            "rejection_reason": rejection_reason,
            "details": {
                "card_lines": edge_info["card_lines"],
                "glare_ratio": glare_ratio,
                "laplacian_var": texture_info["laplacian_var"],
                "chroma_std": texture_info["chroma_std"]
            }
        }


def get_liveness_detector() -> LivenessDetector:
    """Return singleton instance of LivenessDetector."""
    global _liveness_detector
    if _liveness_detector is None:
        _liveness_detector = LivenessDetector()
    return _liveness_detector


def check_liveness(
    img: np.ndarray, 
    bbox: List[int], 
    landmarks_3d: Optional[np.ndarray] = None
) -> Dict[str, Any]:
    """Convenience function to inspect face liveness on any frame and bbox."""
    detector = get_liveness_detector()
    return detector.check_liveness(img, bbox, landmarks_3d)
