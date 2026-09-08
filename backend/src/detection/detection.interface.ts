export type DetectedObjectLabel =
  'person' | 'vehicle' | 'animal' | 'package' | 'object';

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DetectionResult {
  label: DetectedObjectLabel;
  confidence: number;
  box: BoundingBox;
  attributes?: Record<string, any>;
}

export interface DetectionEventPayload {
  source: 'live_frame' | 'recording_clip';
  sourceId: string;
  detections: DetectionResult[];
  primaryDetection?: DetectionResult;
  analyzedAt: string;
  frameCount?: number;
}
