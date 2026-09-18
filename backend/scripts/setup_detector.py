"""Download the standard YOLO11 nano weights once, before starting detection."""
from pathlib import Path
import os
from ultralytics import YOLO

models = Path(__file__).resolve().parent.parent / 'models'
models.mkdir(exist_ok=True)
os.chdir(models)
YOLO('yolo11n.pt')
print(f'YOLO person detector ready: {models / "yolo11n.pt"}')
