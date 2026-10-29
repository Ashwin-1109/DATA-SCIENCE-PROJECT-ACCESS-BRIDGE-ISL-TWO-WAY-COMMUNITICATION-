# System Scope, Assumptions & Limitations

## 1. Scope & Recognition Boundaries
- **Isolated Signs Only**: AccessBridge recognizes isolated words from the 50-class vocabulary of INCLUDE-50. It does not perform continuous sign language sentence segmentation or grammatical syntax parsing.
- **Vocabulary Constraint**: Gestures outside the 50 supported classes are flagged via a heuristic confidence rejection threshold (0.65). This is a heuristic filter, not a formally trained open-set out-of-distribution detector.
- **Language Variety**: Targets Indian Sign Language (ISL). Signs differ significantly from American Sign Language (ASL) or British Sign Language (BSL).

## 2. Computer Vision & Hardware Assumptions
- **Assistive Observations vs Navigation Safety**: The Environment Reader provides descriptive spatial cues (e.g., "Chair on the left. Laptop near the centre"). It is not an obstacle-avoidance, navigation, or street-crossing safety system.
- **Monocular Depth**: Single-camera bounding boxes do not provide physical metric distance in metres. Positions are reported strictly as normalized image coordinate zones.
- **Lighting & Occlusion**: Accurate landmark extraction requires adequate illumination and unobstructed visibility of the signer's upper body and hands.

## 3. Speech & OCR Capabilities
- **Speech Recognition**: Uses browser Web Speech API as an online adapter or local faster-whisper on CPU. Colloquial Tanglish (Tamil written with English alphabet) is not officially standardized in acoustic models.
- **OCR Engine**: Tesseract OCR extracts printed text from clear documents and packaging. Extreme skew, cursive handwriting, or motion blur will reduce recognition confidence.
