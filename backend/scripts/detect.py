"""YOLO person detection with normalized rectangular zone filtering."""
import contextlib
import json
import os
from pathlib import Path
import sys
import cv2


def filter_people(rows, shape, zone=None, confidence=0.5):
    height, width = shape[:2]
    zone = zone or {'x': 0, 'y': 0, 'width': 1, 'height': 1}
    results = []
    for x1, y1, x2, y2, score, class_id in rows:
        if int(class_id) != 0 or score < confidence:
            continue
        x1, x2 = max(0, min(width, x1)), max(0, min(width, x2))
        y1, y2 = max(0, min(height, y1)), max(0, min(height, y2))
        if x2 <= x1 or y2 <= y1:
            continue
        anchor_x, anchor_y = (x1 + x2) / (2 * width), y2 / height
        if not (zone['x'] <= anchor_x <= zone['x'] + zone['width'] and
                zone['y'] <= anchor_y <= zone['y'] + zone['height']):
            continue
        results.append({'label': 'person', 'confidence': float(score),
                        'box': {'x': float(x1), 'y': float(y1), 'width': float(x2-x1), 'height': float(y2-y1)},
                        'attributes': {'zone': zone, 'zoneAnchor': 'bottom-center', 'model': 'yolo'}})
    return results


def detect(image_path, zone=None):
    from ultralytics import YOLO
    model_path = Path(os.environ.get('DETECTION_MODEL', Path(__file__).resolve().parent.parent / 'models/yolo11n.pt'))
    if not model_path.is_file():
        raise RuntimeError('YOLO weights missing. Run scripts/setup_detector.py or set DETECTION_MODEL.')
    image = cv2.imread(image_path)
    if image is None:
        raise ValueError('Cannot decode input frame')
    confidence = float(os.environ.get('DETECTION_CONFIDENCE', '0.5'))
    if not 0 < confidence <= 1:
        raise ValueError('DETECTION_CONFIDENCE must be between 0 and 1')
    model = YOLO(str(model_path))
    if model.names.get(0) != 'person':
        raise ValueError('Use COCO detection weights with person class 0')
    result = model.predict(image, classes=[0], conf=confidence, imgsz=640,
                           device=os.environ.get('DETECTION_DEVICE', 'cpu'), verbose=False)[0]
    return filter_people(result.boxes.data.cpu().tolist(), image.shape, zone, confidence)


if __name__ == '__main__':
    # Keep stdout machine-readable even when libraries print startup information.
    with contextlib.redirect_stdout(sys.stderr):
        result = detect(sys.argv[1], json.loads(sys.argv[2]) if len(sys.argv) > 2 else None)
    print(json.dumps(result))
