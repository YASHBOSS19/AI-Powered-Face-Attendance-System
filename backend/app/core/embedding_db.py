import json
from typing import List, Optional, Tuple, Union
import numpy as np
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import delete
from app.db.models import SavedEmbedding

async def add_embedding(db: AsyncSession, hr_user_id: int, name: str, emb: Union[np.ndarray, list]):
    """Store a single embedding vector in database."""
    vector_json = emb.tolist() if isinstance(emb, np.ndarray) else emb
    new_embedding = SavedEmbedding(
        hr_user_id=hr_user_id,
        embedding_name=name,
        embedding_vector=vector_json
    )
    db.add(new_embedding)
    await db.commit()

async def add_embeddings_batch(db: AsyncSession, hr_user_id: int, name: str, embs_list: List[Union[np.ndarray, list]]):
    """Store a batch of multi-angle & multi-condition embeddings for an employee."""
    for emb in embs_list:
        vector_json = emb.tolist() if isinstance(emb, np.ndarray) else emb
        new_embedding = SavedEmbedding(
            hr_user_id=hr_user_id,
            embedding_name=name,
            embedding_vector=vector_json
        )
        db.add(new_embedding)
    await db.commit()

async def clear_embeddings_for_name(db: AsyncSession, hr_user_id: int, name: str):
    """Delete all previously enrolled embeddings for a specific employee under this tenant."""
    query = delete(SavedEmbedding).where(
        SavedEmbedding.hr_user_id == hr_user_id,
        SavedEmbedding.embedding_name == name
    )
    await db.execute(query)
    await db.commit()

async def match_embedding(
    db: AsyncSession, 
    hr_user_id: int, 
    emb: np.ndarray, 
    threshold: float = 0.35, 
    is_super_admin: bool = False,
    query_embs: Optional[List[np.ndarray]] = None
) -> Tuple[str, float]:
    """
    Match query embedding(s) against stored embeddings in the database.
    If query_embs is supplied (e.g. [raw_emb, clahe_normalized_emb]), it tests all query variants
    against all enrolled multi-angle embeddings to find the global maximum cosine similarity.
    """
    best_name = "unknown"
    best_score = -1.0

    # Ensure list of query representations
    queries = []
    if query_embs:
        for q in query_embs:
            if q is not None and isinstance(q, np.ndarray) and q.size > 0:
                queries.append(q)
    if not queries and emb is not None:
        queries.append(emb)

    if not queries:
        return "unknown", 0.0

    if is_super_admin:
        query = select(SavedEmbedding)
    else:
        query = select(SavedEmbedding).where(SavedEmbedding.hr_user_id == hr_user_id)
        
    result = await db.execute(query)
    rows = result.scalars().all()
    
    for row in rows:
        name = row.embedding_name
        vector_json = row.embedding_vector
        
        if isinstance(vector_json, str):
            vector_list = json.loads(vector_json)
        else:
            vector_list = vector_json  # Some drivers auto-deserialize JSON
            
        ref_emb = np.array(vector_list, dtype=np.float32)
        
        # Test all candidate query representations against this stored vector
        for q in queries:
            sim = float(np.dot(q, ref_emb))
            if sim > best_score:
                best_score = sim
                best_name = name

    if best_score < threshold:
        return "unknown", float(best_score) if best_score != -1.0 else 0.0

    return best_name, float(best_score)

