"""Face detection & embedding extraction powered by InsightFace (ArcFace)."""

from insightface.app import FaceAnalysis
import numpy as np
import cv2
__all__ = ["get_faces"]

_face_app = None


def _init_face_app():
    global _face_app
    _face_app = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
    _face_app.prepare(ctx_id=0, det_size=(640, 640))


def get_faces(img):
    """Return list of (embedding[np.ndarray], bbox[list[int]]) for each face in BGR image."""
    global _face_app
    if _face_app is None:
        _init_face_app()
    # added here bro check
    cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

    faces = _face_app.get(img)
    results = []
    for face in faces:
        emb = face.embedding.astype(np.float32)
        emb /= np.linalg.norm(emb)  # L2‑normalise
        bbox = face.bbox.astype(int).tolist()  # [x0, y0, x1, y1]
        results.append((emb, bbox))
    return results
