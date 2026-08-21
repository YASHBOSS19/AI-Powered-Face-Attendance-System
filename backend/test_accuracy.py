import cv2
import os
import glob
from app.core.face_engine import get_faces
from app.core.embedding_db import init_db, match_embedding

# Initialize the embedding database
init_db()

def test_model_accuracy(test_images_dir):
    """
    Test the model's accuracy on a folder of test images.
    The folder structure should be:
    test_images/
      Employee_Name_1/
         img1.jpg
         img2.jpg
      Employee_Name_2/
         img1.jpg
    """
    if not os.path.exists(test_images_dir):
        print(f"Directory {test_images_dir} not found. Please create it and add test images.")
        return

    total_images = 0
    correct_matches = 0
    false_positives = 0  # Recognized as someone else
    false_negatives = 0  # Not recognized at all (Unknown)

    for employee_name in os.listdir(test_images_dir):
        emp_dir = os.path.join(test_images_dir, employee_name)
        if not os.path.isdir(emp_dir):
            continue
            
        for img_path in glob.glob(os.path.join(emp_dir, "*.*")):
            img = cv2.imread(img_path)
            if img is None:
                continue
                
            total_images += 1
            faces = get_faces(img)
            
            if not faces:
                print(f"[{img_path}] No face detected.")
                false_negatives += 1
                continue
            
            # Assuming 1 face per image for testing
            emb, _ = faces[0]
            matched_name, score = match_embedding(emb, threshold=0.35)
            
            if matched_name == employee_name:
                correct_matches += 1
                print(f"[OK] [{employee_name}] correctly identified with score: {score:.2f}")
            elif matched_name == "unknown":
                false_negatives += 1
                print(f"[FAIL] [{employee_name}] recognized as UNKNOWN (score: {score:.2f})")
            else:
                false_positives += 1
                print(f"[FAIL] [{employee_name}] falsely recognized as {matched_name} (score: {score:.2f})")

    print("\n--- Test Results ---")
    if total_images == 0:
        print("No images found to test.")
        return
        
    accuracy = (correct_matches / total_images) * 100
    print(f"Total Test Images: {total_images}")
    print(f"Correctly Identified: {correct_matches}")
    print(f"False Positives (Wrong Person): {false_positives}")
    print(f"False Negatives (Unknown): {false_negatives}")
    print(f"Overall Accuracy: {accuracy:.2f}%")

if __name__ == "__main__":
    # Create a test_images folder inside the backend directory to run this test
    TEST_DIR = "test_images"
    test_model_accuracy(TEST_DIR)
