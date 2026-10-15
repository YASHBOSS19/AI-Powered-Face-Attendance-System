"""Face detection & embedding extraction powered by InsightFace (ArcFace).
Enhanced with multi-condition (CLAHE illumination normalization, low-light gamma)
and multi-angle (geometric pose estimation, tilt rotation fallback, bilateral angle symmetry).
"""

from insightface.app import FaceAnalysis
import numpy as np
import cv2
from typing import List, Tuple, Dict, Any, Optional

__all__ = [
    "get_faces", 
    "extract_multi_condition_embeddings", 
    "enhance_clahe", 
    "adjust_gamma", 
    "estimate_pose_from_kps",
    "analyze_lighting"
]

_face_app = None


class FaceResult(tuple):
    """
    Backwards-compatible tuple subclass returning (emb, bbox) on unpack,
    while also providing .meta attribute for pose, lighting, and multi-condition details.
    """
    def __new__(cls, emb: np.ndarray, bbox: List[int], meta: Optional[Dict[str, Any]] = None):
        return super(FaceResult, cls).__new__(cls, (emb, bbox))

    def __init__(self, emb: np.ndarray, bbox: List[int], meta: Optional[Dict[str, Any]] = None):
        self.emb = emb
        self.bbox = bbox
        self.meta = meta or {}


def _init_face_app():
    global _face_app
    if _face_app is None:
        # Prepare FaceAnalysis with lowered det_thresh (0.35) so angled (yaw 20°-45°)
        # and shadowed/low-contrast faces are reliably detected.
        _face_app = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
        _face_app.prepare(ctx_id=0, det_size=(640, 640), det_thresh=0.35)


def enhance_clahe(img: np.ndarray) -> np.ndarray:
    """Apply Contrast Limited Adaptive Histogram Equalization on Luminance (LAB space)."""
    try:
        lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
        cl = clahe.apply(l)
        limg = cv2.merge((cl, a, b))
        return cv2.cvtColor(limg, cv2.COLOR_LAB2BGR)
    except Exception:
        return img


def adjust_gamma(img: np.ndarray, gamma: float = 0.65) -> np.ndarray:
    """Enhance low-light / underexposed images using non-linear gamma curve."""
    try:
        inv_gamma = 1.0 / max(gamma, 0.1)
        table = np.array([((i / 255.0) ** inv_gamma) * 255 for i in np.arange(0, 256)]).astype("uint8")
        return cv2.LUT(img, table)
    except Exception:
        return img


def analyze_lighting(img: np.ndarray) -> Dict[str, Any]:
    """Analyze scene luminance, contrast, and classify ambient lighting condition."""
    try:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        mean_lum = float(np.mean(gray))
        std_lum = float(np.std(gray))
        if mean_lum < 75:
            cond = "Low Light (Dim / Shadow)"
        elif mean_lum > 200:
            cond = "High Exposure / Washed"
        elif std_lum < 35:
            cond = "Flat / Low Contrast"
        else:
            cond = "Optimal Lighting"
        return {"luminance": round(mean_lum, 1), "contrast": round(std_lum, 1), "condition": cond}
    except Exception:
        return {"luminance": 128.0, "contrast": 50.0, "condition": "Optimal Lighting"}


def estimate_pose_from_kps(kps: np.ndarray) -> Dict[str, Any]:
    """
    Estimate head pose angles (yaw, pitch, roll in degrees) from 5 facial keypoints:
    [left_eye, right_eye, nose, left_mouth, right_mouth].
    """
    try:
        le, re, nose, lm, rm = kps
        eye_dist = np.linalg.norm(re - le)
        if eye_dist < 1e-4:
            return {"yaw": 0.0, "pitch": 0.0, "roll": 0.0, "angle_desc": "Frontal"}

        # Roll: Head tilt sideways
        roll = float(np.degrees(np.arctan2(re[1] - le[1], re[0] - le[0])))

        # Yaw: Head turn left/right (ratio of nose x relative to eye span)
        eye_dx = re[0] - le[0]
        if abs(eye_dx) > 1e-4:
            r = (nose[0] - le[0]) / eye_dx
            yaw = float((r - 0.5) * 90.0)
        else:
            yaw = 0.0

        # Pitch: Head tilt up/down (ratio of nose y relative to vertical eye-mouth span)
        eye_mid_y = (le[1] + re[1]) / 2.0
        mouth_mid_y = (lm[1] + rm[1]) / 2.0
        face_h = mouth_mid_y - eye_mid_y
        if abs(face_h) > 1e-4:
            pr = (nose[1] - eye_mid_y) / face_h
            pitch = float((pr - 0.5) * 60.0)
        else:
            pitch = 0.0

        # Descriptive classification
        if abs(yaw) < 12 and abs(pitch) < 12 and abs(roll) < 10:
            desc = "Frontal"
        elif yaw < -12:
            desc = f"Turned Left ({abs(yaw):.0f}°)"
        elif yaw > 12:
            desc = f"Turned Right ({abs(yaw):.0f}°)"
        elif pitch > 12:
            desc = f"Tilted Down ({abs(pitch):.0f}°)"
        elif pitch < -12:
            desc = f"Tilted Up ({abs(pitch):.0f}°)"
        else:
            desc = f"Tilted ({abs(roll):.0f}°)"

        return {
            "yaw": round(yaw, 1),
            "pitch": round(pitch, 1),
            "roll": round(roll, 1),
            "angle_desc": desc
        }
    except Exception:
        return {"yaw": 0.0, "pitch": 0.0, "roll": 0.0, "angle_desc": "Frontal"}


def _rotate_image(image: np.ndarray, angle: float) -> Tuple[np.ndarray, np.ndarray]:
    """Rotate image around its center and return rotated image and transformation matrix."""
    h, w = image.shape[:2]
    center = (w // 2, h // 2)
    M = cv2.getRotationMatrix2D(center, angle, 1.0)
    cos = np.abs(M[0, 0])
    sin = np.abs(M[0, 1])
    new_w = int((h * sin) + (w * cos))
    new_h = int((h * cos) + (w * sin))
    M[0, 2] += (new_w / 2) - center[0]
    M[1, 2] += (new_h / 2) - center[1]
    rotated = cv2.warpAffine(image, M, (new_w, new_h), borderMode=cv2.BORDER_REFLECT)
    return rotated, M


def _map_bbox_back(bbox: List[int], M: np.ndarray, orig_shape: Tuple[int, int]) -> List[int]:
    """Transform bounding box from rotated coordinate space back to original image space."""
    try:
        M_inv = cv2.invertAffineTransform(M)
        x1, y1, x2, y2 = bbox
        pts = np.array([[x1, y1], [x2, y1], [x2, y2], [x1, y2]], dtype=np.float32)
        orig_pts = cv2.transform(pts.reshape(1, -1, 2), M_inv).reshape(-1, 2)
        h, w = orig_shape
        ox1 = max(0, min(w - 1, int(np.min(orig_pts[:, 0]))))
        oy1 = max(0, min(h - 1, int(np.min(orig_pts[:, 1]))))
        ox2 = max(0, min(w - 1, int(np.max(orig_pts[:, 0]))))
        oy2 = max(0, min(h - 1, int(np.max(orig_pts[:, 1]))))
        return [ox1, oy1, ox2, oy2]
    except Exception:
        return bbox


def get_faces(img: np.ndarray, multi_condition: bool = True, multi_angle: bool = True) -> List[FaceResult]:
    """
    Return list of FaceResult (unpacks as (emb, bbox)) for each face in BGR image.
    Robustly handles:
    1. Standard camera frames.
    2. Challenging multi-condition lighting (backlit, dim, harsh shadows) via CLAHE & gamma fallback.
    3. Multi-angle head positions (yaw turns, pitch, and roll tilts up to ±30°).
    """
    global _face_app
    if _face_app is None:
        _init_face_app()

    if img is None or img.size == 0:
        return []

    lighting_info = analyze_lighting(img)

    # Pass 1: Standard detection on original frame
    faces = _face_app.get(img)

    # Pass 2: Multi-condition lighting fallback if no face detected
    if not faces and multi_condition:
        # If low light, try gamma boost first
        if lighting_info["luminance"] < 80:
            gamma_img = adjust_gamma(img, gamma=0.6)
            faces = _face_app.get(gamma_img)

        # If still no face, try CLAHE local contrast equalization
        if not faces:
            clahe_img = enhance_clahe(img)
            faces = _face_app.get(clahe_img)

    # Pass 3: Multi-angle tilt fallback if face was rotated sideways (e.g. ±15°, ±30°)
    if not faces and multi_angle:
        for angle in [-15, 15, -30, 30]:
            rot_img, M = _rotate_image(img, angle)
            rot_faces = _face_app.get(rot_img)
            if rot_faces:
                orig_shape = img.shape[:2]
                for rf in rot_faces:
                    rf.bbox = np.array(_map_bbox_back(rf.bbox.astype(int).tolist(), M, orig_shape))
                faces = rot_faces
                break

    results = []
    # Compute CLAHE-enhanced image once to extract illumination-normalized embedding if needed
    clahe_frame = None

    for face in faces:
        emb = face.embedding.astype(np.float32)
        norm = np.linalg.norm(emb)
        if norm > 0:
            emb /= norm

        bbox = face.bbox.astype(int).tolist()

        # Compute pose & condition metadata
        kps = getattr(face, "kps", None)
        pose_info = estimate_pose_from_kps(kps) if kps is not None else {"yaw": 0.0, "pitch": 0.0, "roll": 0.0, "angle_desc": "Frontal"}

        # Extract CLAHE normalized embedding for dual-condition query matching
        clahe_emb = None
        if multi_condition:
            try:
                if clahe_frame is None:
                    clahe_frame = enhance_clahe(img)
                # Attempt to extract embedding from the enhanced frame for the face region
                clahe_faces = _face_app.get(clahe_frame)
                if clahe_faces:
                    c_emb = clahe_faces[0].embedding.astype(np.float32)
                    c_norm = np.linalg.norm(c_emb)
                    if c_norm > 0:
                        clahe_emb = c_emb / c_norm
            except Exception:
                clahe_emb = None

        meta = {
            "pose": pose_info,
            "yaw": pose_info["yaw"],
            "pitch": pose_info["pitch"],
            "roll": pose_info["roll"],
            "angle_desc": pose_info["angle_desc"],
            "lighting": lighting_info,
            "det_score": float(getattr(face, "det_score", 1.0)),
            "clahe_emb": clahe_emb,
            "landmark_3d_68": getattr(face, "landmark_3d_68", None),
            "landmark_2d_106": getattr(face, "landmark_2d_106", None),
            "kps": getattr(face, "kps", None)
        }

        results.append(FaceResult(emb, bbox, meta))

    # Sort faces by bounding box area descending so the primary foreground person is always index 0
    results.sort(key=lambda f: (f[1][2] - f[1][0]) * (f[1][3] - f[1][1]), reverse=True)
    return results


def _pick_primary_face(face_list: List[FaceResult]) -> Optional[FaceResult]:
    if not face_list:
        return None
    return max(face_list, key=lambda f: (f[1][2] - f[1][0]) * (f[1][3] - f[1][1]))


def extract_multi_condition_embeddings(bgr_img: np.ndarray) -> List[np.ndarray]:
    """
    Extract diverse multi-angle & multi-condition embeddings from a single face image during enrollment:
    1. Base original face embedding (largest/primary face in frame).
    2. Horizontally flipped embedding (bilateral mirror symmetry: left angle produces right angle!).
    3. Illumination-normalized (CLAHE) embedding (robust to low light and harsh shadows).
    Returns list of 512-dim normalized numpy vectors.
    """
    global _face_app
    if _face_app is None:
        _init_face_app()

    if bgr_img is None or bgr_img.size == 0:
        return []

    embeddings = []

    # 1. Base embedding (primary foreground face)
    base_faces = get_faces(bgr_img, multi_condition=True, multi_angle=True)
    primary = _pick_primary_face(base_faces)
    if primary:
        embeddings.append(primary[0])

    # 2. Symmetric angle via horizontal flip
    try:
        flipped_img = cv2.flip(bgr_img, 1)
        flipped_faces = get_faces(flipped_img, multi_condition=True, multi_angle=True)
        primary_flip = _pick_primary_face(flipped_faces)
        if primary_flip:
            embeddings.append(primary_flip[0])
    except Exception:
        pass

    # 3. Illumination-equalized (CLAHE) embedding
    try:
        clahe_img = enhance_clahe(bgr_img)
        clahe_faces = get_faces(clahe_img, multi_condition=False, multi_angle=False)
        primary_clahe = _pick_primary_face(clahe_faces)
        if primary_clahe:
            embeddings.append(primary_clahe[0])
    except Exception:
        pass

    # Deduplicate / filter near-identical embeddings
    unique_embs = []
    for emb in embeddings:
        is_dup = False
        for u in unique_embs:
            # If cosine similarity > 0.99, it's effectively identical
            if float(np.dot(emb, u)) > 0.99:
                is_dup = True
                break
        if not is_dup:
            unique_embs.append(emb)

    return unique_embs

