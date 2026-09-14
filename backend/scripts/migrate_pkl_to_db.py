import os
import pickle
import sys
import json

# Add backend directory to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.attendance_db import init_db
from app.db.database import get_db_context

EMBED_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "embeddings.pkl")

def migrate():
    print("Initializing database to ensure 'saved_embeddings' table exists...")
    init_db()
    
    if not os.path.exists(EMBED_PATH):
        print(f"No {EMBED_PATH} found. Nothing to migrate.")
        return
        
    print(f"Reading {EMBED_PATH}...")
    try:
        with open(EMBED_PATH, "rb") as f:
            data = pickle.load(f)
    except Exception as e:
        print(f"Failed to read pickle file: {e}")
        return
        
    if not data:
        print("Pickle file is empty.")
        return
        
    # Migrate data
    total_migrated = 0
    
    try:
        with get_db_context() as conn:
            cursor = conn.cursor()
            
            # Check if there are already records to avoid duplicates
            cursor.execute("SELECT COUNT(*) as count FROM saved_embeddings")
            count = cursor.fetchone()[0]
            if count > 0:
                print(f"Notice: 'saved_embeddings' table already has {count} records. We will append.")
            
            for hr_user_id, users_dict in data.items():
                for name, embeddings_list in users_dict.items():
                    for emb in embeddings_list:
                        vector_json = json.dumps(emb.tolist())
                        
                        cursor.execute("""
                            INSERT INTO saved_embeddings (hr_user_id, embedding_name, embedding_vector)
                            VALUES (%s, %s, %s)
                        """, (hr_user_id, name, vector_json))
                        total_migrated += 1
                        
            conn.commit()
            print(f"Successfully migrated {total_migrated} embeddings to the MySQL database.")
    except Exception as e:
        print(f"Database error: {e}")

if __name__ == "__main__":
    migrate()
