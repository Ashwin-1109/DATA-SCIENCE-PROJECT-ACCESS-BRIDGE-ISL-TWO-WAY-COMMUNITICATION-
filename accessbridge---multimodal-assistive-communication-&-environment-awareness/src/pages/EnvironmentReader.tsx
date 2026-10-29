import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Camera, 
  CameraOff, 
  Scan, 
  FileText, 
  Upload, 
  Volume2, 
  RotateCw, 
  Sliders, 
  AlertTriangle, 
  CheckCircle2, 
  Copy, 
  Eye,
  RefreshCw,
  Info,
  Wifi,
  Globe,
  BrainCircuit,
  Loader2,
  Play,
  Square,
  Sparkles,
  FileUp,
  Check,
  ArrowRight
} from 'lucide-react';
import { DetectedObject, OcrResult, NavigationTab } from '../types';
import { visionService } from '../services/visionService';
import { ttsService } from '../services/ttsService';
import { cameraService } from '../services/cameraService';

interface EnvironmentReaderProps {
  onNavigate: (tab: NavigationTab) => void;
}

export const EnvironmentReader: React.FC<EnvironmentReaderProps> = ({ onNavigate }) => {
  const [activeSubMode, setActiveSubMode] = useState<'objects' | 'ip_webcam' | 'document_reader' | 'ocr'>('objects');

  // Camera states
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [streamActive, setStreamActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Object awareness states
  const [detectedObjects, setDetectedObjects] = useState<DetectedObject[]>([]);
  const [sceneDescription, setSceneDescription] = useState<string>('');
  const [continuousScan, setContinuousScan] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const scanIntervalRef = useRef<any>(null);

  // IP Webcam & YOLO States
  const [ipWebcamUrl, setIpWebcamUrl] = useState<string>('http://192.168.1.100:8080/shot.jpg');
  const [ipWebcamConnected, setIpWebcamConnected] = useState<boolean>(false);
  const [ipWebcamImage, setIpWebcamImage] = useState<string | null>(null);
  const [ipWebcamAnnotatedImage, setIpWebcamAnnotatedImage] = useState<string | null>(null);
  const [ipWebcamObjects, setIpWebcamObjects] = useState<any[]>([]);
  const [ipWebcamSpatialSummary, setIpWebcamSpatialSummary] = useState<string>('');
  const [ipWebcamGeminiDesc, setIpWebcamGeminiDesc] = useState<string>('');
  const [ipWebcamLoading, setIpWebcamLoading] = useState<boolean>(false);
  const [ipWebcamAutoScan, setIpWebcamAutoScan] = useState<boolean>(false);
  const [ipWebcamError, setIpWebcamError] = useState<string | null>(null);
  const ipWebcamIntervalRef = useRef<any>(null);

  // Document & Image Reader States (Blind Assist)
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docLoading, setDocLoading] = useState<boolean>(false);
  const [docResult, setDocResult] = useState<{
    filename: string;
    docType: string;
    pageCount: number;
    extractedText: string;
    accessibleExplanation: string;
  } | null>(null);
  const [docError, setDocError] = useState<string | null>(null);
  const [isDocSpeaking, setIsDocSpeaking] = useState<boolean>(false);
  const docFileInputRef = useRef<HTMLInputElement | null>(null);

  // OCR printed text states
  const [ocrLanguage, setOcrLanguage] = useState<'eng' | 'tam'>('eng');
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrStatusText, setOcrStatusText] = useState('');
  const [rotationDegrees, setRotationDegrees] = useState<number>(0);
  const [contrastEnhanced, setContrastEnhanced] = useState(true);
  const [uploadedImageSrc, setUploadedImageSrc] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Start Camera via CameraService
  const startCamera = async () => {
    setCameraError(null);
    if (!videoRef.current) return;
    try {
      await cameraService.startCamera(videoRef.current, { facingMode: 'environment' });
      setStreamActive(true);
    } catch (err: any) {
      setCameraError(err.message || 'Unable to access camera.');
      setStreamActive(false);
    }
  };

  const stopCamera = () => {
    cameraService.stopCamera();
    setStreamActive(false);
    setContinuousScan(false);
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
    }
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Perform single object detection scan
  const performObjectScan = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !streamActive) return;
    setIsScanning(true);

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        // Check Gemini multimodal scene description first
        const geminiRes = await visionService.describeSceneWithGemini(canvas);
        if (geminiRes.success && geminiRes.description) {
          setSceneDescription(geminiRes.description);
          if (visionService.shouldAnnounce(geminiRes.description)) {
            ttsService.speak(geminiRes.description);
          }
          return;
        }

        const objects = await visionService.detectObjectsInCanvas(canvas);
        setDetectedObjects(objects);

        const description = visionService.generateSpatialDescription(objects);
        setSceneDescription(description);

        if (visionService.shouldAnnounce(description)) {
          ttsService.speak(description);
        }
      }
    } finally {
      setIsScanning(false);
    }
  }, [streamActive]);

  // Handle continuous scan toggle
  useEffect(() => {
    if (continuousScan && streamActive) {
      performObjectScan();
      scanIntervalRef.current = setInterval(() => {
        performObjectScan();
      }, 3000);
    } else {
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
      }
    }

    return () => {
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
      }
    };
  }, [continuousScan, streamActive, performObjectScan]);

  // Capture snapshot for OCR
  const captureSnapshotForOcr = async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      setUploadedImageSrc(canvas.toDataURL('image/jpeg'));
      runOcrOnCanvas(canvas);
    }
  };

  // Upload image for OCR
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload a valid image file (PNG, JPG, JPEG, WEBP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const src = event.target?.result as string;
      setUploadedImageSrc(src);

      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          runOcrOnCanvas(canvas);
        }
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  };

  // Run OCR with current preprocessing settings
  const runOcrOnCanvas = async (sourceCanvas: HTMLCanvasElement) => {
    setOcrLoading(true);
    setOcrStatusText('Preprocessing image for high text contrast...');
    try {
      const preprocessed = visionService.preprocessImageForOcr(
        sourceCanvas,
        rotationDegrees,
        contrastEnhanced
      );

      const result = await visionService.extractText(
        preprocessed,
        ocrLanguage,
        (progress, status) => setOcrStatusText(`${status} (${progress}%)`)
      );

      result.rotationAppliedDegrees = rotationDegrees;
      setOcrResult(result);

      // Speak text if available
      if (result.cleanedText) {
        ttsService.speak(result.cleanedText);
      }
    } finally {
      setOcrLoading(false);
      setOcrStatusText('');
    }
  };

  // Re-run OCR when rotation or contrast is changed on uploaded image
  const rerunOcrWithCurrentSettings = () => {
    if (!uploadedImageSrc) return;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        runOcrOnCanvas(canvas);
      }
    };
    img.src = uploadedImageSrc;
  };

  // --- IP Webcam & YOLO Handlers ---
  const handleFetchIpWebcamFrame = async () => {
    setIpWebcamError(null);
    setIpWebcamLoading(true);
    try {
      const res = await visionService.fetchWebcamFrame(ipWebcamUrl);
      if (res.success && res.imageBase64) {
        setIpWebcamImage(res.imageBase64);
        setIpWebcamConnected(true);
      } else {
        setIpWebcamError(res.error || 'Failed to reach IP Webcam. Check your Wi-Fi and IP address.');
      }
    } catch (e: any) {
      setIpWebcamError(e.message || 'Connection error.');
    } finally {
      setIpWebcamLoading(false);
    }
  };

  const handleAnalyzeIpWebcam = async () => {
    setIpWebcamError(null);
    setIpWebcamLoading(true);
    try {
      const res = await visionService.analyzeWebcamEnvironment({
        webcamUrl: ipWebcamUrl,
        imageBase64: ipWebcamImage || undefined
      });
      if (res.success) {
        setIpWebcamObjects(res.objects);
        setIpWebcamSpatialSummary(res.spatialSummary);
        setIpWebcamGeminiDesc(res.geminiDescription);
        if (res.annotatedImageBase64) {
          setIpWebcamAnnotatedImage(res.annotatedImageBase64);
        }
        if (res.frameBase64) {
          setIpWebcamImage(res.frameBase64);
          setIpWebcamConnected(true);
        }
        // Speak description aloud for blind user
        if (res.geminiDescription) {
          ttsService.speak(res.geminiDescription);
        }
      } else {
        setIpWebcamError(res.error || 'Environmental analysis failed.');
      }
    } catch (e: any) {
      setIpWebcamError(e.message || 'Analysis error');
    } finally {
      setIpWebcamLoading(false);
    }
  };

  const toggleIpWebcamAutoScan = () => {
    if (ipWebcamAutoScan) {
      setIpWebcamAutoScan(false);
      if (ipWebcamIntervalRef.current) {
        clearInterval(ipWebcamIntervalRef.current);
        ipWebcamIntervalRef.current = null;
      }
    } else {
      setIpWebcamAutoScan(true);
      handleAnalyzeIpWebcam();
      ipWebcamIntervalRef.current = setInterval(() => {
        handleAnalyzeIpWebcam();
      }, 7000);
    }
  };

  useEffect(() => {
    return () => {
      if (ipWebcamIntervalRef.current) {
        clearInterval(ipWebcamIntervalRef.current);
      }
    };
  }, []);

  // --- Accessible Document & Image Reader Handlers ---
  const handleDocFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDocFile(file);
    setDocError(null);
    setDocLoading(true);
    try {
      const res = await visionService.analyzeDocument(file);
      if (res.success) {
        setDocResult({
          filename: res.filename,
          docType: res.docType,
          pageCount: res.pageCount,
          extractedText: res.extractedText,
          accessibleExplanation: res.accessibleExplanation
        });
        // Speak summary out loud for blind user
        if (res.accessibleExplanation) {
          ttsService.speak(res.accessibleExplanation);
          setIsDocSpeaking(true);
        }
      } else {
        setDocError(res.error || 'Failed to analyze document.');
      }
    } catch (err: any) {
      setDocError(err.message || 'Document processing error.');
    } finally {
      setDocLoading(false);
    }
  };

  const toggleDocAudio = () => {
    if (isDocSpeaking) {
      ttsService.stop();
      setIsDocSpeaking(false);
    } else if (docResult?.accessibleExplanation) {
      ttsService.speak(docResult.accessibleExplanation);
      setIsDocSpeaking(true);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Title & Scope Note */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-sky-400 font-semibold tracking-wider uppercase">
            <span>Workflow 3</span>
            <span aria-hidden="true">·</span>
            <span>Camera → Objects & Printed Text</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Environment & Printed Text Reader
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            Pretrained spatial object detection and local Tesseract OCR with speech feedback.
          </p>
        </div>

        {/* Sub-mode Segmented Control */}
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl">
          <button
            onClick={() => setActiveSubMode('objects')}
            className={`min-h-[40px] px-3.5 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
              activeSubMode === 'objects'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>A. Local Camera</span>
          </button>
          <button
            onClick={() => setActiveSubMode('ip_webcam')}
            className={`min-h-[40px] px-3.5 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
              activeSubMode === 'ip_webcam'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Wifi className="w-3.5 h-3.5" />
            <span>B. IP Webcam + YOLO</span>
          </button>
          <button
            onClick={() => setActiveSubMode('document_reader')}
            className={`min-h-[40px] px-3.5 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
              activeSubMode === 'document_reader'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileUp className="w-3.5 h-3.5" />
            <span>C. PDF & Image Reader</span>
          </button>
          <button
            onClick={() => setActiveSubMode('ocr')}
            className={`min-h-[40px] px-3.5 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
              activeSubMode === 'ocr'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>D. Printed Text (OCR)</span>
          </button>
        </div>
      </div>

      {/* Critical Accessibility Limitation Disclaimer */}
      <div className="p-3.5 bg-amber-950/40 border border-amber-800/60 rounded-xl flex items-start gap-3 text-xs text-amber-200/90">
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
        <div>
          <strong className="font-semibold text-white">Critical Safety Notice: </strong>
          This tool provides assistive observations of visible objects and printed text. It is not an obstacle-avoidance, navigation, or street-crossing safety system. Monocular camera bounding boxes provide normalized relative coordinates (left, centre, right), not physical metric distance in metres.
        </div>
      </div>

      {/* Mode A: Object Awareness View */}
      {activeSubMode === 'objects' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Camera Viewport (7 Cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="relative bg-slate-950 border border-slate-800 rounded-xl overflow-hidden aspect-[4/3] flex items-center justify-center shadow-inner">
              <video
                ref={videoRef}
                playsInline
                muted
                className={`w-full h-full object-cover ${!streamActive ? 'hidden' : ''}`}
              />
              <canvas
                ref={canvasRef}
                className={`absolute inset-0 w-full h-full pointer-events-none ${!streamActive ? 'hidden' : ''}`}
              />

              {!streamActive && (
                <div className="text-center p-6 space-y-3">
                  <div className="w-14 h-14 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-500">
                    <Eye className="w-7 h-7" aria-hidden="true" />
                  </div>
                  <div className="text-sm font-medium text-slate-300">
                    Environment camera inactive
                  </div>
                  <p className="text-xs text-slate-500 max-w-sm">
                    Start camera to detect everyday objects (chairs, laptops, bottles, people) and produce directional audio cues.
                  </p>
                  <button
                    onClick={startCamera}
                    className="min-h-[44px] px-5 py-2.5 bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold rounded-lg inline-flex items-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                  >
                    <Camera className="w-4 h-4" aria-hidden="true" />
                    <span>Start Environment Camera</span>
                  </button>
                </div>
              )}
            </div>

            {/* Controls Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 p-3 rounded-xl border border-slate-800">
              <div className="flex items-center gap-2">
                {streamActive ? (
                  <button
                    onClick={stopCamera}
                    className="min-h-[40px] px-3.5 py-1.5 bg-rose-600/90 hover:bg-rose-500 text-white text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                  >
                    <CameraOff className="w-4 h-4" aria-hidden="true" />
                    <span>Stop Camera</span>
                  </button>
                ) : (
                  <button
                    onClick={startCamera}
                    className="min-h-[40px] px-3.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                  >
                    <Camera className="w-4 h-4" aria-hidden="true" />
                    <span>Start Camera</span>
                  </button>
                )}

                <button
                  onClick={performObjectScan}
                  disabled={!streamActive || isScanning}
                  className="min-h-[40px] px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                >
                  <Scan className="w-4 h-4 text-sky-400" aria-hidden="true" />
                  <span>{isScanning ? 'Scanning...' : 'Scan Now'}</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setContinuousScan(!continuousScan)}
                  disabled={!streamActive}
                  className={`min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors border ${
                    continuousScan 
                      ? 'bg-sky-950/60 border-sky-600 text-sky-300 font-semibold' 
                      : 'bg-slate-800 border-slate-700 text-slate-300'
                  }`}
                  aria-pressed={continuousScan}
                >
                  <span className={`w-2 h-2 rounded-full ${continuousScan ? 'bg-sky-400 animate-ping' : 'bg-slate-500'}`} />
                  <span>Continuous Scan (3s)</span>
                </button>
              </div>
            </div>
          </div>

          {/* Observations and Spoken Output (5 Cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-white">Spatial Scene Description</h2>
                <button
                  onClick={() => {
                    if (sceneDescription) ttsService.speak(sceneDescription);
                  }}
                  disabled={!sceneDescription}
                  className="min-h-[36px] px-3 py-1 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 disabled:text-slate-600 text-white text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors"
                >
                  <Volume2 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Speak</span>
                </button>
              </div>

              <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg min-h-[90px] flex items-center">
                <p className="text-sm font-semibold text-slate-100 leading-relaxed">
                  {sceneDescription || 'No objects scanned yet. Press "Scan Now" to analyze the view.'}
                </p>
              </div>

              {/* Detected Items Breakdown */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Detected Objects ({detectedObjects.length})
                </div>
                {detectedObjects.length === 0 ? (
                  <div className="text-xs text-slate-500 italic py-2">
                    No active detections in current frame.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {detectedObjects.map(obj => (
                      <div key={obj.id} className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white capitalize">{obj.label}</span>
                          <span className="text-slate-500">·</span>
                          <span className="text-sky-400 font-medium">Position: {obj.spatialLocation}</span>
                        </div>
                        <span className="font-mono text-emerald-400 text-[11px]">
                          {(obj.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-400 space-y-2">
              <div className="font-semibold text-slate-300">Spatial Directional Heuristic:</div>
              <p className="text-slate-400 leading-relaxed">
                Horizontal bounding box centre coordinates are mapped to normalized zones: Left (0.0 to 0.33), Centre (0.33 to 0.66), and Right (0.66 to 1.0). Repetitive announcements are suppressed automatically.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Mode B: IP Webcam + YOLO Object Detection & Gemini Environment Awareness */}
      {activeSubMode === 'ip_webcam' && (
        <div className="space-y-6">
          {/* IP Webcam Connection Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-white text-base">Remote IP Webcam Stream</h3>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    YOLOv8 + Gemini 2.5 Flash
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Connect any Android/iOS phone IP Webcam (e.g. Android IP Webcam app) or RTSP/HTTP camera.
                </p>
              </div>

              {/* Status Indicator */}
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${ipWebcamConnected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                <span className="text-xs font-semibold text-slate-300">
                  {ipWebcamConnected ? 'Camera Connected' : 'Camera Disconnected'}
                </span>
              </div>
            </div>

            {/* URL Input & Connect Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-2">
              <div className="relative flex-1 w-full">
                <Globe className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={ipWebcamUrl}
                  onChange={(e) => setIpWebcamUrl(e.target.value)}
                  placeholder="Enter IP Webcam address: e.g. http://192.168.1.100:8080/shot.jpg"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={handleFetchIpWebcamFrame}
                  disabled={ipWebcamLoading || !ipWebcamUrl.trim()}
                  className="flex-1 sm:flex-none px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${ipWebcamLoading ? 'animate-spin' : ''}`} />
                  <span>Fetch Frame</span>
                </button>
                <button
                  onClick={handleAnalyzeIpWebcam}
                  disabled={ipWebcamLoading || !ipWebcamUrl.trim()}
                  className="flex-1 sm:flex-none px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-emerald-500/20 flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                >
                  {ipWebcamLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <BrainCircuit className="w-3.5 h-3.5" />
                  )}
                  <span>YOLO + Gemini Scan</span>
                </button>
                <button
                  onClick={toggleIpWebcamAutoScan}
                  disabled={!ipWebcamConnected}
                  className={`px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                    ipWebcamAutoScan
                      ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                  }`}
                >
                  Auto-Scan: {ipWebcamAutoScan ? 'On' : 'Off'}
                </button>
              </div>
            </div>

            {/* Quick URL Presets */}
            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-slate-400">
              <span className="font-semibold text-slate-500">Presets:</span>
              <button
                onClick={() => setIpWebcamUrl('http://192.168.1.100:8080/shot.jpg')}
                className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 font-mono text-[11px]"
              >
                Android IP Webcam (:8080/shot.jpg)
              </button>
              <button
                onClick={() => setIpWebcamUrl('http://192.168.1.50:8080/shot.jpg')}
                className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 font-mono text-[11px]"
              >
                192.168.1.50:8080
              </button>
              <button
                onClick={() => setIpWebcamUrl('http://192.168.0.101:8080/shot.jpg')}
                className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 font-mono text-[11px]"
              >
                192.168.0.101:8080
              </button>
            </div>

            {/* Error Message */}
            {ipWebcamError && (
              <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{ipWebcamError}</span>
              </div>
            )}
          </div>

          {/* Main Content Grid: Viewport (7 Cols) + Spatial Description (5 Cols) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Viewport */}
            <div className="lg:col-span-7 space-y-3">
              <div className="relative bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden aspect-[4/3] flex items-center justify-center shadow-2xl">
                {ipWebcamAnnotatedImage || ipWebcamImage ? (
                  <img
                    src={ipWebcamAnnotatedImage || ipWebcamImage || ''}
                    alt="IP Webcam Capture"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="text-center p-8 space-y-3 max-w-sm">
                    <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-sky-400 shadow-inner">
                      <Wifi className="w-7 h-7" />
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-sm">No IP Webcam Feed Active</h4>
                      <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                        1. Start <strong>IP Webcam</strong> on your Android phone.<br />
                        2. Tap <strong>'Start Server'</strong> at the bottom of the app.<br />
                        3. Enter the IP URL shown on your phone screen above and click <strong>Fetch Frame</strong>.
                      </p>
                    </div>
                  </div>
                )}

                {/* Overlaid Badges */}
                {ipWebcamConnected && (
                  <div className="absolute top-3 left-3 flex items-center gap-2 px-2.5 py-1 bg-slate-900/80 backdrop-blur-md rounded-lg border border-slate-700/50 text-[11px] text-slate-200">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Live IP Stream</span>
                  </div>
                )}

                {ipWebcamObjects.length > 0 && (
                  <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 bg-emerald-950/80 backdrop-blur-md rounded-lg border border-emerald-500/40 text-[11px] text-emerald-300 font-semibold shadow-lg">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>YOLO: {ipWebcamObjects.length} Objects Detected</span>
                  </div>
                )}
              </div>
            </div>

            {/* Analysis & Blind Audio Output (5 Cols) */}
            <div className="lg:col-span-5 space-y-4">
              {/* Gemini Environment Narration Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2 text-sky-400">
                    <Sparkles className="w-4 h-4" />
                    <h3 className="font-bold text-white text-sm">Environment Description (Gemini AI)</h3>
                  </div>
                  {ipWebcamGeminiDesc && (
                    <button
                      onClick={() => ttsService.speak(ipWebcamGeminiDesc)}
                      className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 border border-sky-500/30 transition-colors"
                      title="Speak description aloud"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {ipWebcamGeminiDesc ? (
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 text-xs text-slate-200 leading-relaxed max-h-48 overflow-y-auto">
                    {ipWebcamGeminiDesc}
                  </div>
                ) : (
                  <div className="p-6 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
                    Click "YOLO + Gemini Scan" to describe the complete surroundings for a blind user.
                  </div>
                )}
              </div>

              {/* YOLO Detected Objects & Spatial Breakdown */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2 text-emerald-400">
                    <Scan className="w-4 h-4" />
                    <h3 className="font-bold text-white text-sm">YOLO Spatial Objects</h3>
                  </div>
                  <span className="text-xs font-mono text-slate-400">
                    {ipWebcamObjects.length} items
                  </span>
                </div>

                {ipWebcamObjects.length > 0 ? (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {ipWebcamObjects.map((obj, i) => (
                      <div
                        key={i}
                        className={`p-2.5 rounded-xl border text-xs flex items-center justify-between transition-all ${
                          obj.is_obstacle
                            ? 'bg-amber-950/20 border-amber-800/40 text-amber-200'
                            : 'bg-slate-950 border-slate-800 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${obj.is_obstacle ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                          <span className="font-bold capitalize text-white">{obj.label}</span>
                          <span className="text-[11px] text-slate-400 font-normal">
                            ({obj.spatial_position})
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-500 font-mono">
                            {obj.distance_category}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-slate-300">
                            {Math.round(obj.confidence * 100)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
                    No objects detected yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mode C: Accessible PDF & Image Document Reader (Blind Assist) */}
      {activeSubMode === 'document_reader' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-white text-base">Accessible Document & Image Reader</h3>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                    PDF Text Extraction + Gemini Multimodal Vision
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Upload PDF documents, medical prescriptions, receipts, labels, or images. AccessBridge extracts the content and explains it clearly aloud to a blind user.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Upload Area (5 Cols) */}
            <div className="lg:col-span-5 space-y-4">
              <div 
                onClick={() => docFileInputRef.current?.click()}
                className="bg-slate-950 border-2 border-dashed border-slate-800 hover:border-sky-500 rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:bg-slate-900/40 space-y-3"
              >
                <input
                  type="file"
                  ref={docFileInputRef}
                  accept=".pdf,image/png,image/jpeg,image/webp"
                  onChange={handleDocFileSelect}
                  className="hidden"
                />
                <div className="w-14 h-14 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 shadow-inner">
                  {docLoading ? <Loader2 className="w-7 h-7 animate-spin" /> : <FileUp className="w-7 h-7" />}
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">
                    {docLoading ? 'Analyzing Document with AI...' : 'Click or Drag PDF / Image'}
                  </h4>
                  <p className="text-xs text-slate-400 mt-1">
                    Supports .PDF documents and .JPG, .PNG, .WEBP images
                  </p>
                </div>
                <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-medium text-slate-300">
                  Select File from Device
                </div>
              </div>

              {/* Uploaded File Info Card */}
              {docResult && (
                <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">File Name:</span>
                    <span className="font-bold text-white truncate max-w-[200px]">{docResult.filename}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Format:</span>
                    <span className="font-mono text-sky-400 uppercase">{docResult.docType}</span>
                  </div>
                  {docResult.docType === 'pdf' && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Pages:</span>
                      <span className="font-semibold text-slate-200">{docResult.pageCount}</span>
                    </div>
                  )}
                  <div className="pt-2 border-t border-slate-800 flex justify-end">
                    <button
                      onClick={() => docFileInputRef.current?.click()}
                      className="text-xs font-semibold text-sky-400 hover:text-sky-300"
                    >
                      Upload Different File
                    </button>
                  </div>
                </div>
              )}

              {docError && (
                <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{docError}</span>
                </div>
              )}
            </div>

            {/* Accessible Audio Explanation & Extracted Text (7 Cols) */}
            <div className="lg:col-span-7 space-y-4">
              {/* Gemini Voice Narration Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2 text-emerald-400">
                    <Volume2 className="w-4 h-4" />
                    <h3 className="font-bold text-white text-sm">Spoken Explanation for Blind User</h3>
                  </div>
                  {docResult && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={toggleDocAudio}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                          isDocSpeaking
                            ? 'bg-rose-500 text-white shadow-md'
                            : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md'
                        }`}
                      >
                        {isDocSpeaking ? (
                          <>
                            <Square className="w-3.5 h-3.5 fill-current" />
                            <span>Stop Audio</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>Read Out Loud</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {docResult?.accessibleExplanation ? (
                  <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 font-medium leading-relaxed max-h-60 overflow-y-auto whitespace-pre-line">
                    {docResult.accessibleExplanation}
                  </div>
                ) : (
                  <div className="p-8 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
                    Upload a PDF or image to generate a full spoken explanation for a blind user.
                  </div>
                )}
              </div>

              {/* Extracted Verbatim Content */}
              {docResult?.extractedText && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-2">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs">
                    <span className="font-bold text-slate-300 uppercase tracking-wider text-[11px]">
                      Extracted Text Content
                    </span>
                    <button
                      onClick={() => navigator.clipboard.writeText(docResult.extractedText)}
                      className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </button>
                  </div>
                  <pre className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl text-xs font-mono text-slate-300 max-h-48 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                    {docResult.extractedText}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mode D: Printed Text Reader (OCR) */}
      {activeSubMode === 'ocr' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Source Image & Preprocessing (6 Cols) */}
          <div className="lg:col-span-6 space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-white">Document / Packaging Capture</h2>
                <div className="flex items-center gap-1.5 p-1 bg-slate-950 border border-slate-800 rounded-md">
                  <button
                    onClick={() => setOcrLanguage('eng')}
                    className={`px-2 py-0.5 text-xs font-semibold rounded ${
                      ocrLanguage === 'eng' ? 'bg-sky-600 text-white' : 'text-slate-400'
                    }`}
                  >
                    English
                  </button>
                  <button
                    onClick={() => setOcrLanguage('tam')}
                    className={`px-2 py-0.5 text-xs font-semibold rounded ${
                      ocrLanguage === 'tam' ? 'bg-sky-600 text-white' : 'text-slate-400'
                    }`}
                  >
                    Tamil (தமிழ்)
                  </button>
                </div>
              </div>

              {/* Image Preview Box */}
              <div className="relative bg-slate-950 border border-slate-800 rounded-lg overflow-hidden aspect-[4/3] flex items-center justify-center">
                {uploadedImageSrc ? (
                  <img
                    src={uploadedImageSrc}
                    alt="Document preview for OCR"
                    className="w-full h-full object-contain transition-transform"
                    style={{ transform: `rotate(${rotationDegrees}deg)` }}
                  />
                ) : (
                  <div className="text-center p-6 space-y-3">
                    <FileText className="w-10 h-10 text-slate-600 mx-auto" aria-hidden="true" />
                    <div className="text-xs text-slate-400">No document captured yet</div>
                    <p className="text-[11px] text-slate-500 max-w-xs">
                      Take a snapshot with your camera or upload an image file of signs, medicine boxes, or books.
                    </p>
                  </div>
                )}

                {ocrLoading && (
                  <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex flex-col items-center justify-center p-4 text-center space-y-2">
                    <RefreshCw className="w-6 h-6 text-sky-400 animate-spin" />
                    <div className="text-xs font-semibold text-white">{ocrStatusText || 'Extracting text...'}</div>
                  </div>
                )}
              </div>

              {/* Action Buttons: Camera Snap or Upload */}
              <div className="flex flex-wrap items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="min-h-[40px] px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                >
                  <Upload className="w-4 h-4 text-sky-400" aria-hidden="true" />
                  <span>Upload Image</span>
                </button>

                {streamActive ? (
                  <button
                    onClick={captureSnapshotForOcr}
                    className="min-h-[40px] px-3.5 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                  >
                    <Camera className="w-4 h-4" aria-hidden="true" />
                    <span>Capture Snapshot</span>
                  </button>
                ) : (
                  <button
                    onClick={startCamera}
                    className="min-h-[40px] px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors"
                  >
                    <Camera className="w-4 h-4" aria-hidden="true" />
                    <span>Open Camera Snap</span>
                  </button>
                )}
              </div>

              {/* Image Preprocessing Controls (Rotation, Contrast) */}
              {uploadedImageSrc && (
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setRotationDegrees(prev => (prev + 90) % 360);
                      }}
                      className="min-h-[36px] px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded flex items-center gap-1"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      <span>Rotate ({rotationDegrees}°)</span>
                    </button>

                    <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                      <input
                        type="checkbox"
                        checked={contrastEnhanced}
                        onChange={(e) => setContrastEnhanced(e.target.checked)}
                        className="rounded bg-slate-800 text-sky-600 focus:ring-sky-500"
                      />
                      <span>Enhance Contrast</span>
                    </label>
                  </div>

                  <button
                    onClick={rerunOcrWithCurrentSettings}
                    disabled={ocrLoading}
                    className="min-h-[36px] px-3 py-1 bg-sky-600 hover:bg-sky-500 text-white font-medium rounded transition-colors"
                  >
                    Re-extract
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* OCR Extracted Text Output (6 Cols) */}
          <div className="lg:col-span-6 space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-white">Recognized Text Output</h2>
                {ocrResult && (
                  <button
                    onClick={() => {
                      if (ocrResult.cleanedText) ttsService.speak(ocrResult.cleanedText);
                    }}
                    className="min-h-[36px] px-3 py-1 bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors"
                  >
                    <Volume2 className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Read Aloud</span>
                  </button>
                )}
              </div>

              {ocrResult ? (
                <div className="space-y-4">
                  {/* Cleaned Display Text */}
                  <div className="space-y-1">
                    <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
                      Cleaned Speech Text
                    </div>
                    <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 font-medium leading-relaxed max-h-48 overflow-y-auto">
                      {ocrResult.cleanedText || 'No text recognized.'}
                    </div>
                  </div>

                  {/* Raw OCR Text preservation */}
                  <div className="space-y-1">
                    <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
                      Original Extracted Lines ({ocrResult.linesCount} lines)
                    </div>
                    <pre className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-lg text-xs font-mono text-slate-300 max-h-36 overflow-y-auto whitespace-pre-wrap">
                      {ocrResult.rawText}
                    </pre>
                  </div>

                  {/* Metadata and Stats */}
                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                    <span>Lang: {ocrResult.language}</span>
                    <span>·</span>
                    <span>Conf: {(ocrResult.confidence * 100).toFixed(0)}%</span>
                    <span>·</span>
                    <span>Latency: {ocrResult.processingTimeMs} ms</span>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-slate-500 text-xs italic border border-dashed border-slate-800 rounded-lg">
                  Capture or upload an image to see recognized text lines here.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
