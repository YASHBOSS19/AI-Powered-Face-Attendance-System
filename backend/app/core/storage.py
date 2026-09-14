import os
from dotenv import load_dotenv
import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
import uuid

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), '.env'))

R2_ACCOUNT_ID = os.environ.get("R2_ACCOUNT_ID")
R2_ACCESS_KEY_ID = os.environ.get("R2_ACCESS_KEY_ID")
R2_SECRET_ACCESS_KEY = os.environ.get("R2_SECRET_ACCESS_KEY")
R2_BUCKET_NAME = os.environ.get("R2_BUCKET_NAME")
R2_PUBLIC_URL = os.environ.get("R2_PUBLIC_URL")

def get_s3_client():
    if all([R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME]):
        return boto3.client(
            's3',
            endpoint_url=f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
            aws_access_key_id=R2_ACCESS_KEY_ID,
            aws_secret_access_key=R2_SECRET_ACCESS_KEY,
            config=Config(signature_version='s3v4'),
        )
    return None

def upload_image(image_bytes: bytes, filename: str, hr_user_id: int, person_name: str) -> str:
    """
    Uploads an image to Cloudflare R2 if configured, otherwise falls back to local storage.
    Returns the URL or path of the saved image.
    """
    s3_client = get_s3_client()
    
    if s3_client:
        # Generate a unique key for R2
        ext = os.path.splitext(filename)[1] or '.jpg'
        unique_filename = f"{uuid.uuid4().hex}{ext}"
        s3_key = f"dataset/{hr_user_id}/{person_name}/{unique_filename}"
        
        try:
            s3_client.put_object(
                Bucket=R2_BUCKET_NAME,
                Key=s3_key,
                Body=image_bytes,
                ContentType='image/jpeg'
            )
            if R2_PUBLIC_URL:
                return f"{R2_PUBLIC_URL.rstrip('/')}/{s3_key}"
            else:
                return f"s3://{R2_BUCKET_NAME}/{s3_key}"
        except ClientError as e:
            print(f"Failed to upload to R2: {e}. Falling back to local storage.")
            # Fall through to local storage logic
    
    # Local Storage Fallback
    base_dir = "dataset"
    person_dir = os.path.join(base_dir, str(hr_user_id), person_name)
    os.makedirs(person_dir, exist_ok=True)
    
    save_path = os.path.join(person_dir, filename)
    with open(save_path, "wb") as f:
        f.write(image_bytes)
        
    return save_path
