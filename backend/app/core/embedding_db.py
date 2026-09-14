import json
import numpy as np
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.db.models import SavedEmbedding

async def add_embedding(db: AsyncSession, hr_user_id: int, name: str, emb):
    vector_json = emb.tolist()
    new_embedding = SavedEmbedding(
        hr_user_id=hr_user_id,
        embedding_name=name,
        embedding_vector=vector_json
    )
    db.add(new_embedding)
    await db.commit()

async def match_embedding(db: AsyncSession, hr_user_id: int, emb, threshold=0.35):
    best_name = "unknown"
    best_score = -1

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
        
        sim = np.dot(emb, ref_emb)
        if sim > best_score:
            best_score = sim
            best_name = name

    if best_score < threshold:
        return "unknown", float(best_score)
    return best_name, float(best_score)
