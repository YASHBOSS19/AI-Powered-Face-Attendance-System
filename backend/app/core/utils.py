import base64
import cv2
import numpy as np

def decode_base64_image(b64_str):
    try:
        header, encoded = b64_str.split(",", 1) if "," in b64_str else ("", b64_str)
        img_bytes = base64.b64decode(encoded)
        img_np = np.frombuffer(img_bytes, dtype=np.uint8)
        img_bgr = cv2.imdecode(img_np, cv2.IMREAD_COLOR)
        if img_bgr is None:
            raise ValueError("Failed to decode image")
        return img_bgr
    except Exception as e:
        raise ValueError("Invalid base64 image string") from e

def cosine_similarity(vec1, vec2):
    dot = np.dot(vec1, vec2)
    return dot  # Already L2-normalized in face_engine
