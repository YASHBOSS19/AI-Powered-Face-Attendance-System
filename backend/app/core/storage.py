import os
from dotenv import load_dotenv
import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from pathlib import Path
from typing import Tuple, Optional
import uuid

# Load .env file from backend folder or project root
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), '.env'))

def get_r2_client() -> Tuple[Optional[boto3.client], Optional[str]]:
    """
    Returns (s3_client, bucket_name) if R2 is properly configured, or (None, None).
    """
    r2_endpoint = os.environ.get("R2_ENDPOINT_URL")
    account_id = os.environ.get("R2_ACCOUNT_ID")
    access_key = os.environ.get("R2_ACCESS_KEY_ID")
    secret_key = os.environ.get("R2_SECRET_ACCESS_KEY")
    bucket = os.environ.get("R2_BUCKET_NAME")
    
    if not (access_key and secret_key and bucket):
        return None, None
        
    # Check if dummy values are configured
    if "dummy" in access_key.lower() or "dummy" in secret_key.lower() or "dummy" in bucket.lower():
        return None, None
        
    if not r2_endpoint and account_id and "dummy" not in str(account_id).lower():
        r2_endpoint = f"https://{account_id}.r2.cloudflarestorage.com"
        
    if not r2_endpoint:
        return None, None

    try:
        s3 = boto3.client(
            's3',
            endpoint_url=r2_endpoint,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            config=Config(signature_version='s3v4'),
            region_name='auto'
        )
        return s3, bucket
    except Exception as e:
        print(f"Warning: Failed to initialize Cloudflare R2 client: {e}")
        return None, None

def save_to_r2_or_local(
    file_bytes: bytes,
    filename: str,
    subfolder: str = "profiles",
    content_type: str = "image/jpeg"
) -> str:
    """
    Uploads an image/file to Cloudflare R2 if configured, otherwise falls back to local storage.
    Returns the public/accessible URL of the saved asset.
    """
    s3, bucket = get_r2_client()
    
    if s3 and bucket:
        s3_key = f"{subfolder}/{filename}".lstrip('/')
        try:
            s3.put_object(
                Bucket=bucket,
                Key=s3_key,
                Body=file_bytes,
                ContentType=content_type
            )
            public_url = os.environ.get("R2_PUBLIC_URL", "").strip()
            if public_url:
                return f"{public_url.rstrip('/')}/{s3_key}"
            else:
                return f"r2://{bucket}/{s3_key}"
        except Exception as e:
            print(f"Warning: Cloudflare R2 upload to key '{s3_key}' failed: {e}. Falling back to local storage.")
    
    # Fallback to local storage
    local_dir = Path("static") / subfolder
    local_dir.mkdir(parents=True, exist_ok=True)
    local_path = local_dir / filename
    with open(local_path, "wb") as buffer:
        buffer.write(file_bytes)
        
    return f"/api/static/{subfolder}/{filename}"

def upload_image(image_bytes: bytes, filename: str, hr_user_id: int, person_name: str) -> str:
    """
    Legacy helper for dataset uploads: attempts R2 upload and falls back to local dataset storage.
    """
    s3, bucket = get_r2_client()
    
    if s3 and bucket:
        ext = os.path.splitext(filename)[1] or '.jpg'
        unique_filename = f"{uuid.uuid4().hex}{ext}"
        s3_key = f"dataset/{hr_user_id}/{person_name}/{unique_filename}"
        try:
            s3.put_object(
                Bucket=bucket,
                Key=s3_key,
                Body=image_bytes,
                ContentType='image/jpeg'
            )
            public_url = os.environ.get("R2_PUBLIC_URL", "").strip()
            if public_url:
                return f"{public_url.rstrip('/')}/{s3_key}"
            else:
                return f"s3://{bucket}/{s3_key}"
        except Exception as e:
            print(f"Warning: Failed to upload face dataset to R2: {e}. Falling back to local storage.")
            
    # Local Storage Fallback
    base_dir = "dataset"
    person_dir = os.path.join(base_dir, str(hr_user_id), person_name)
    os.makedirs(person_dir, exist_ok=True)
    
    save_path = os.path.join(person_dir, filename)
    with open(save_path, "wb") as f:
        f.write(image_bytes)
        
    return save_path
