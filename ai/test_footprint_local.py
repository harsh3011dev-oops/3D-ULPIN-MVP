import cv2
import numpy as np
import os
from footprint_detection import detect_building_footprint

def create_dummy_image(path):
    # Create a blank black image
    img = np.zeros((500, 500, 3), dtype=np.uint8)
    # Draw a white rectangle to simulate a building footprint
    # (top_left_x, top_left_y) to (bottom_right_x, bottom_right_y)
    cv2.rectangle(img, (150, 150), (350, 350), (255, 255, 255), -1)
    
    os.makedirs(os.path.dirname(path), exist_ok=True)
    cv2.imwrite(path, img)
    print(f"Created dummy image at {path}")

if __name__ == "__main__":
    test_img_path = "sample_data/test_building.jpg"
    create_dummy_image(test_img_path)
    
    print("\nRunning footprint detection...")
    try:
        # Run footprint detection with debug=True to save the contour image
        footprint = detect_building_footprint(
            image_path=test_img_path,
            parcel_boundary={}, # Not used strictly in MVP implementation
            debug=True
        )
        print("\nSuccess! Detected Footprint GeoJSON:")
        print(footprint)
        print("\nDebug image saved as 'debug_footprint.jpg' in the ai folder.")
    except Exception as e:
        print(f"\nError: {e}")
