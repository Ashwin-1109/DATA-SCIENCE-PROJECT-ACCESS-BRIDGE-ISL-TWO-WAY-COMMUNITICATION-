/**
 * AccessBridge - Environment Perception & Obstacle Narrator Engine
 * Phase 4 Architecture:
 * - Tier 1: Local MediaPipe ObjectDetector (~8 FPS throttled rAF / requestVideoFrameCallback)
 * - Tier 2: Rule-Based Spatial Narrator with direction, distance estimation & priority ranking
 *   Priority: (person/vehicle > door/dog > furniture). Speak only changes with cooldown.
 *   Safety Standard: Says "No obstacles detected in view", NEVER "Path is clear".
 * - Tier 3: Gemini 2.5 Flash Scene Description on request or large scene change (max once per 8s, 640px JPEG quality 0.6)
 * - Auto-pauses when browser tab is hidden (document.hidden)
 * - Fallback Chain: Gemini -> Local Detector Summary -> OCR Text -> Camera check message
 */

import { DetectedObject } from '../types';
import { visionService } from './visionService';
import { ttsService } from './ttsService';

export type ObstaclePriority = 'urgent' | 'medium' | 'normal';

export interface SpatialObstacle {
  id: string;
  label: string;
  priority: ObstaclePriority;
  direction: 'left' | 'ahead' | 'right';
  roughDistance: string; // e.g. "about 1 meter (approx)", "about 2 meters (approx)"
  confidence: number;
  bbox: [number, number, number, number];
  timestamp: number;
}

export interface NarratorState {
  tier: 1 | 2 | 3;
  isActive: boolean;
  isPausedDueToVisibility: boolean;
  lastNarratedText: string;
  detectedObstacles: SpatialObstacle[];
  geminiCachedDescription?: string;
  statusMessage: string;
}

// Priority Categories
const URGENT_CLASSES = new Set([
  'person', 'car', 'bus', 'truck', 'motorcycle', 'bicycle', 'train', 'vehicle'
]);

const MEDIUM_CLASSES = new Set([
  'door', 'stairs', 'dog', 'cat', 'traffic light', 'stop sign', 'fire hydrant'
]);

export class EnvironmentNarrator {
  private isActive: boolean = false;
  private isPausedDueToVisibility: boolean = false;
  private lastAnnounceTimestamp: Record<string, number> = {};
  private lastNarratedText: string = '';
  private lastGeminiCallTime: number = 0;
  private geminiCachedText: string = '';
  private currentObstacles: SpatialObstacle[] = [];
  private lastSceneSignature: string = '';

  // Throttled processing loop
  private animFrameId: number | null = null;
  private lastFrameTimestamp: number = 0;
  private readonly targetFrameIntervalMs = 125; // ~8 FPS detection rate

  // Listeners
  private stateListeners: Set<(state: NarratorState) => void> = new Set();
  private obstacleListeners: Set<(obstacles: SpatialObstacle[]) => void> = new Set();

  constructor() {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          this.isPausedDueToVisibility = true;
          this.notifyState();
        } else {
          this.isPausedDueToVisibility = false;
          this.notifyState();
        }
      });
    }
  }

  public addStateListener(cb: (state: NarratorState) => void): () => void {
    this.stateListeners.add(cb);
    return () => this.stateListeners.delete(cb);
  }

  public addObstacleListener(cb: (obstacles: SpatialObstacle[]) => void): () => void {
    this.obstacleListeners.add(cb);
    return () => this.obstacleListeners.delete(cb);
  }

  private notifyState(statusMsg?: string) {
    const state: NarratorState = {
      tier: this.geminiCachedText ? 3 : (this.currentObstacles.length > 0 ? 2 : 1),
      isActive: this.isActive,
      isPausedDueToVisibility: this.isPausedDueToVisibility,
      lastNarratedText: this.lastNarratedText,
      detectedObstacles: [...this.currentObstacles],
      geminiCachedDescription: this.geminiCachedText,
      statusMessage: statusMsg || (this.isActive ? 'Active and scanning' : 'Standby')
    };
    this.stateListeners.forEach(cb => cb(state));
    this.obstacleListeners.forEach(cb => cb(this.currentObstacles));
  }

  /**
   * Classifies object label into priority ranking
   */
  public classifyPriority(label: string): ObstaclePriority {
    const l = label.toLowerCase();
    if (URGENT_CLASSES.has(l)) return 'urgent';
    if (MEDIUM_CLASSES.has(l)) return 'medium';
    return 'normal';
  }

  /**
   * Estimates rough approximate distance based on normalized bounding box height & area
   */
  public estimateDistance(bbox: [number, number, number, number]): string {
    const [, , w, h] = bbox;
    const area = w * h;

    if (h > 0.65 || area > 0.30) {
      return 'about 1 meter (approx)';
    } else if (h > 0.40 || area > 0.12) {
      return 'about 2 meters (approx)';
    } else if (h > 0.22 || area > 0.05) {
      return 'about 3 meters (approx)';
    } else {
      return 'about 4 or more meters (approx)';
    }
  }

  /**
   * Maps horizontal bounding box center into 3 clear directions
   */
  public estimateDirection(bbox: [number, number, number, number]): 'left' | 'ahead' | 'right' {
    const [x, , w] = bbox;
    const centerX = x + w / 2;

    if (centerX < 0.36) return 'left';
    if (centerX > 0.64) return 'right';
    return 'ahead';
  }

  /**
   * Transforms raw MediaPipe detections into priority-ranked SpatialObstacles
   */
  public parseDetections(raw: DetectedObject[]): SpatialObstacle[] {
    const now = performance.now();
    const parsed: SpatialObstacle[] = raw.map(obj => {
      const priority = this.classifyPriority(obj.label);
      const direction = this.estimateDirection(obj.bbox);
      const roughDistance = this.estimateDistance(obj.bbox);

      return {
        id: `${obj.label}_${direction}_${Math.round(obj.bbox[0] * 10)}`,
        label: obj.label,
        priority,
        direction,
        roughDistance,
        confidence: obj.confidence,
        bbox: obj.bbox,
        timestamp: now
      };
    });

    // Priority sort: urgent first, then medium, then normal
    const priorityWeight: Record<ObstaclePriority, number> = {
      urgent: 3,
      medium: 2,
      normal: 1
    };

    return parsed.sort((a, b) => priorityWeight[b.priority] - priorityWeight[a.priority]);
  }

  /**
   * Evaluates obstacle changes and enforces per-object cooldowns
   */
  public generateNarrationText(obstacles: SpatialObstacle[]): { text: string; shouldSpeak: boolean } {
    if (obstacles.length === 0) {
      // SAFETY RULE: Never say "path is clear", say "no obstacles detected in view"
      const text = 'No obstacles detected in view.';
      const shouldSpeak = this.lastSceneSignature !== 'empty' && (performance.now() - (this.lastAnnounceTimestamp['empty'] || 0) > 10000);
      if (shouldSpeak) {
        this.lastAnnounceTimestamp['empty'] = performance.now();
        this.lastSceneSignature = 'empty';
      }
      return { text, shouldSpeak };
    }

    const now = performance.now();
    const narratableItems: string[] = [];
    let hasNewUrgent = false;

    for (const obs of obstacles.slice(0, 3)) { // Announce top 3 prioritized obstacles
      const key = `${obs.label}_${obs.direction}`;
      const isFirst = this.lastAnnounceTimestamp[key] === undefined;
      const lastTime = this.lastAnnounceTimestamp[key] || 0;
      // Cooldown: urgent = 3.5s, medium = 5.5s, normal = 8.5s
      const cooldownMs = obs.priority === 'urgent' ? 3500 : (obs.priority === 'medium' ? 5500 : 8500);

      if (isFirst || now - lastTime > cooldownMs) {
        this.lastAnnounceTimestamp[key] = now;
        narratableItems.push(`${obs.label} ${obs.direction}, ${obs.roughDistance}`);
        if (obs.priority === 'urgent') hasNewUrgent = true;
      }
    }

    if (narratableItems.length === 0) {
      return { text: this.lastNarratedText || 'Surroundings steady.', shouldSpeak: false };
    }

    const text = narratableItems.join('. ') + '.';
    this.lastSceneSignature = obstacles.map(o => `${o.label}_${o.direction}`).join('|');
    return { text, shouldSpeak: true };
  }

  /**
   * Tier 3: Requests Gemini Multimodal Scene Narration with rate-limiting and 640px JPEG compression
   */
  public async requestGeminiSceneNarration(canvas: HTMLCanvasElement): Promise<string> {
    const now = Date.now();
    // Cache for 8 seconds to prevent quota exhaustion
    if (this.geminiCachedText && (now - this.lastGeminiCallTime < 8000)) {
      return this.geminiCachedText;
    }

    // Downscale canvas to max 640px to reduce payload and latency
    const maxDim = 640;
    let targetW = canvas.width || 640;
    let targetH = canvas.height || 480;

    if (targetW > maxDim || targetH > maxDim) {
      const scale = Math.min(maxDim / targetW, maxDim / targetH);
      targetW = Math.round(targetW * scale);
      targetH = Math.round(targetH * scale);
    }

    const smallCanvas = document.createElement('canvas');
    smallCanvas.width = targetW;
    smallCanvas.height = targetH;
    const sCtx = smallCanvas.getContext('2d');
    if (sCtx) {
      sCtx.drawImage(canvas, 0, 0, targetW, targetH);
    }

    const res = await visionService.describeSceneWithGemini(smallCanvas);
    if (res.success && res.description) {
      this.lastGeminiCallTime = now;
      this.geminiCachedText = res.description;
      this.lastNarratedText = res.description;
      this.notifyState('Cloud scene description updated');
      ttsService.speak(res.description);
      return res.description;
    }

    // Fallback: Use local detector summary
    const localFallback = this.currentObstacles.length > 0
      ? `Local detection: ${this.currentObstacles.map(o => `${o.label} ${o.direction}`).join(', ')}.`
      : 'Cloud vision offline. No obstacles detected in view by local sensor.';

    this.lastNarratedText = localFallback;
    this.notifyState('Using local obstacle detection');
    ttsService.speak(localFallback);
    return localFallback;
  }

  /**
   * Processes a video frame through Tier 1 (Detector) and Tier 2 (Narrator) at ~8 FPS
   */
  public async processVideoFrame(
    video: HTMLVideoElement,
    canvasOverlay: HTMLCanvasElement | null,
    autoSpeak: boolean = true
  ): Promise<SpatialObstacle[]> {
    if (!this.isActive || this.isPausedDueToVisibility || video.readyState < 2) {
      return this.currentObstacles;
    }

    const now = performance.now();
    if (now - this.lastFrameTimestamp < this.targetFrameIntervalMs) {
      return this.currentObstacles; // Throttled to ~8 FPS
    }
    this.lastFrameTimestamp = now;

    // Detect objects locally via MediaPipe EfficientDet Lite0
    const rawObjects = await visionService.detectObjectsInCanvas(video as any);
    const obstacles = this.parseDetections(rawObjects);
    this.currentObstacles = obstacles;

    // Draw visual boxes on overlay canvas ref if available
    if (canvasOverlay) {
      this.drawObstacleOverlay(canvasOverlay, video, obstacles);
    }

    // Tier 2 Narration
    const narration = this.generateNarrationText(obstacles);
    this.lastNarratedText = narration.text;

    if (narration.shouldSpeak && autoSpeak) {
      ttsService.speak(narration.text);
    }

    this.notifyState();
    return obstacles;
  }

  /**
   * Draws accessibility bounding boxes on canvas ref without React state thrashing
   */
  private drawObstacleOverlay(
    canvas: HTMLCanvasElement, 
    video: HTMLVideoElement, 
    obstacles: SpatialObstacle[]
  ) {
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const w = canvas.width;
    const h = canvas.height;

    for (const obs of obstacles) {
      const [nx, ny, nw, nh] = obs.bbox;
      const x = nx * w;
      const y = ny * h;
      const boxW = nw * w;
      const boxH = nh * h;

      // Color coding: Red for urgent, Amber for medium, Sky for normal
      const color = obs.priority === 'urgent' 
        ? '#ef4444' 
        : (obs.priority === 'medium' ? '#f59e0b' : '#38bdf8');

      ctx.strokeStyle = color;
      ctx.lineWidth = obs.priority === 'urgent' ? 3 : 2;
      ctx.strokeRect(x, y, boxW, boxH);

      // Label badge
      ctx.fillStyle = color;
      const labelText = `${obs.label.toUpperCase()} (${obs.roughDistance.replace(' (approx)', '')})`;
      ctx.font = 'bold 12px sans-serif';
      const textWidth = ctx.measureText(labelText).width;
      ctx.fillRect(x, Math.max(0, y - 20), textWidth + 8, 20);

      ctx.fillStyle = '#000000';
      ctx.fillText(labelText, x + 4, Math.max(14, y - 6));
    }
  }

  public start() {
    this.isActive = true;
    this.isPausedDueToVisibility = false;
    this.notifyState('Environment narrator active');
    ttsService.speak('Environment narrator started.');
  }

  public stop() {
    this.isActive = false;
    this.currentObstacles = [];
    this.notifyState('Environment narrator stopped');
    ttsService.speak('Environment narrator stopped.');
  }

  public getIsActive(): boolean {
    return this.isActive && !this.isPausedDueToVisibility;
  }

  public getObstacles(): SpatialObstacle[] {
    return this.currentObstacles;
  }
}

export const environmentNarrator = new EnvironmentNarrator();
