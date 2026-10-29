/**
 * AccessBridge - Centralized Camera Service
 * Single source of truth for WebRTC camera stream management, device enumeration,
 * front/rear facing switching, resolution negotiation, and clean track lifecycle cleanup.
 */

export interface CameraDevice {
  deviceId: string;
  label: string;
  facingMode?: 'user' | 'environment';
}

export interface CameraCapabilities {
  width: number;
  height: number;
  facingMode: string;
  deviceId: string;
}

export class CameraService {
  private activeStream: MediaStream | null = null;
  private activeVideoElement: HTMLVideoElement | null = null;
  private currentFacingMode: 'user' | 'environment' = 'user';
  private selectedDeviceId: string | null = null;
  private listeners: Set<(isActive: boolean) => void> = new Set();

  /**
   * Enumerate available video input devices
   */
  public async enumerateDevices(): Promise<CameraDevice[]> {
    if (!navigator?.mediaDevices?.enumerateDevices) {
      return [];
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices
        .filter(d => d.kind === 'videoinput')
        .map(d => ({
          deviceId: d.deviceId,
          label: d.label || `Camera ${d.deviceId.slice(0, 5)}`,
          facingMode: d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('rear')
            ? 'environment'
            : 'user'
        }));
    } catch (e) {
      console.warn('[CameraService] Device enumeration notice:', e);
      return [];
    }
  }

  /**
   * Start camera stream with resolution negotiation and proper constraints
   */
  public async startCamera(
    videoElement: HTMLVideoElement,
    options: {
      facingMode?: 'user' | 'environment';
      deviceId?: string;
      idealWidth?: number;
      idealHeight?: number;
    } = {}
  ): Promise<MediaStream> {
    // Clean up existing stream if already running
    this.stopCamera();

    const facingMode = options.facingMode || this.currentFacingMode;
    const deviceId = options.deviceId || this.selectedDeviceId;
    const idealWidth = options.idealWidth || 1280;
    const idealHeight = options.idealHeight || 720;

    const videoConstraints: MediaTrackConstraints = {
      width: { ideal: idealWidth, min: 640 },
      height: { ideal: idealHeight, min: 480 }
    };

    if (deviceId) {
      videoConstraints.deviceId = { exact: deviceId };
    } else {
      videoConstraints.facingMode = facingMode;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: false
      });

      this.activeStream = stream;
      this.activeVideoElement = videoElement;
      this.currentFacingMode = facingMode;
      if (deviceId) this.selectedDeviceId = deviceId;

      videoElement.srcObject = stream;
      videoElement.playsInline = true;
      videoElement.muted = true;
      await videoElement.play();

      this.notifyListeners(true);
      return stream;
    } catch (e: any) {
      // Graceful fallback constraint if 1280x720 fails
      console.warn('[CameraService] High-res negotiation failed, falling back to standard resolution:', e);
      const fallbackStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode },
        audio: false
      });

      this.activeStream = fallbackStream;
      this.activeVideoElement = videoElement;
      this.currentFacingMode = facingMode;

      videoElement.srcObject = fallbackStream;
      videoElement.playsInline = true;
      videoElement.muted = true;
      await videoElement.play();

      this.notifyListeners(true);
      return fallbackStream;
    }
  }

  /**
   * Stop active camera stream and release hardware tracks
   */
  public stopCamera(): void {
    if (this.activeStream) {
      this.activeStream.getTracks().forEach(track => {
        track.stop();
        track.enabled = false;
      });
      this.activeStream = null;
    }

    if (this.activeVideoElement) {
      this.activeVideoElement.srcObject = null;
      this.activeVideoElement = null;
    }

    this.notifyListeners(false);
  }

  /**
   * Switch between front and rear cameras
   */
  public async switchFacingMode(videoElement: HTMLVideoElement): Promise<MediaStream> {
    const nextMode = this.currentFacingMode === 'user' ? 'environment' : 'user';
    return this.startCamera(videoElement, { facingMode: nextMode });
  }

  /**
   * Captures the current video frame onto an HTML canvas with aspect ratio preservation
   */
  public captureFrame(options: { maxWidth?: number; maxHeight?: number } = {}): HTMLCanvasElement | null {
    if (!this.activeVideoElement || !this.isStreamActive()) {
      return null;
    }

    const video = this.activeVideoElement;
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      return null;
    }

    const canvas = document.createElement('canvas');
    let targetWidth = video.videoWidth;
    let targetHeight = video.videoHeight;

    if (options.maxWidth && targetWidth > options.maxWidth) {
      const scale = options.maxWidth / targetWidth;
      targetWidth = options.maxWidth;
      targetHeight = Math.round(targetHeight * scale);
    }

    if (options.maxHeight && targetHeight > options.maxHeight) {
      const scale = options.maxHeight / targetHeight;
      targetHeight = options.maxHeight;
      targetWidth = Math.round(targetWidth * scale);
    }

    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
    return canvas;
  }

  public isStreamActive(): boolean {
    return this.activeStream !== null && this.activeStream.active && this.activeStream.getVideoTracks().some(t => t.readyState === 'live');
  }

  public getFacingMode(): 'user' | 'environment' {
    return this.currentFacingMode;
  }

  public getActiveStream(): MediaStream | null {
    return this.activeStream;
  }

  public onStateChange(listener: (isActive: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(isActive: boolean): void {
    this.listeners.forEach(cb => {
      try {
        cb(isActive);
      } catch (e) {
        console.error(e);
      }
    });
  }
}

export const cameraService = new CameraService();
