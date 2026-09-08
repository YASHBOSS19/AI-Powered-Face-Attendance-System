import os
import pickle
import numpy as np

EMBED_PATH = "embeddings.pkl"
embedding_db = {}  # hr_user_id (int) -> name (str) -> list of embeddings

def init_db():
    global embedding_db
    if os.path.exists(EMBED_PATH):
        with open(EMBED_PATH, "rb") as f:
            data = pickle.load(f)
            # Migration check: if old data (keys are strings like names), nest it under hr_user_id=1
            if data and isinstance(list(data.keys())[0], str):
                embedding_db = {1: data}
                save_db()
            else:
                embedding_db = data
    else:
        embedding_db = {}

def save_db():
    with open(EMBED_PATH, "wb") as f:
        pickle.dump(embedding_db, f)

def add_embedding(hr_user_id, name, emb):
    if hr_user_id not in embedding_db:
        embedding_db[hr_user_id] = {}
    if name not in embedding_db[hr_user_id]:
        embedding_db[hr_user_id][name] = []
    embedding_db[hr_user_id][name].append(emb)
    save_db()

def match_embedding(hr_user_id, emb, threshold=0.35):
    best_name = "unknown"
    best_score = -1

    if hr_user_id not in embedding_db:
        return "unknown", -1

    for name, vectors in embedding_db[hr_user_id].items():
        for ref in vectors:
            sim = np.dot(emb, ref)
            if sim > best_score:
                best_score = sim
                best_name = name

    if best_score < threshold:
        return "unknown", best_score
    return best_name, best_score
