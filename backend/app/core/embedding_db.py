import os
import pickle
import numpy as np

EMBED_PATH = "embeddings.pkl"
embedding_db = {}  # name -> list of embeddings

def init_db():
    global embedding_db
    if os.path.exists(EMBED_PATH):
        with open(EMBED_PATH, "rb") as f:
            embedding_db = pickle.load(f)
    else:
        embedding_db = {}

def save_db():
    with open(EMBED_PATH, "wb") as f:
        pickle.dump(embedding_db, f)

def add_embedding(name, emb):
    if name not in embedding_db:
        embedding_db[name] = []
    embedding_db[name].append(emb)
    save_db()

def match_embedding(emb, threshold=0.35):
    best_name = "unknown"
    best_score = -1

    for name, vectors in embedding_db.items():
        for ref in vectors:
            sim = np.dot(emb, ref)
            if sim > best_score:
                best_score = sim
                best_name = name

    if best_score < threshold:
        return "unknown", best_score
    return best_name, best_score
