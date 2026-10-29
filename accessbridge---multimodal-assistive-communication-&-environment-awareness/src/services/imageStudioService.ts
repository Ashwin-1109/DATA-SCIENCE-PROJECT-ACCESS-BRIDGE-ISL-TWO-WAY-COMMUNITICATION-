/**
 * AccessBridge - Assistive Visual Flashcard & Image Studio Service
 * Generates accessible visual cards and pictograms for non-verbal and deaf users.
 * All cloud requests are securely routed through backend endpoints (no client API keys).
 * Falls back to high-contrast accessible vector pictograms when offline.
 */

export interface VisualFlashcard {
  id: string;
  word: string;
  prompt: string;
  imageUrl: string;
  timestamp: string;
}

class ImageStudioService {
  /**
   * Generates an assistive visual communication card from text prompt.
   * Securely requests server-side Gemini service, with client-side SVG fallback.
   */
  public async generateVisualCard(word: string, promptModifier?: string): Promise<string> {
    try {
      const res = await fetch('/api/gemini/visual-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word, prompt_modifier: promptModifier })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.imageUrl) {
          return data.imageUrl;
        }
      }
    } catch {
      // Backend unavailable or offline mode
    }

    // High-contrast accessible pictogram fallback (100% offline & zero secret exposure)
    return this.createAccessibleSvgCard(word);
  }

  /**
   * Edits or modifies an existing visual card instruction
   */
  public async editVisualCard(base64Image: string, editInstruction: string): Promise<string> {
    try {
      const res = await fetch('/api/gemini/visual-card/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_base64: base64Image, instruction: editInstruction })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.imageUrl) return data.imageUrl;
      }
    } catch {
      // Fallback
    }
    return base64Image;
  }

  private createAccessibleSvgCard(word: string): string {
    const cleanWord = word.trim().toUpperCase();
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
        <rect width="400" height="400" rx="32" fill="#0f172a" stroke="#38bdf8" stroke-width="4"/>
        <circle cx="200" cy="170" r="80" fill="#1e293b" stroke="#0ea5e9" stroke-width="3"/>
        <text x="200" y="180" font-family="system-ui, sans-serif" font-size="44" font-weight="bold" fill="#38bdf8" text-anchor="middle" dominant-baseline="middle">
          ${cleanWord.slice(0, 3)}
        </text>
        <rect x="40" y="290" width="320" height="70" rx="16" fill="#0284c7"/>
        <text x="200" y="335" font-family="system-ui, sans-serif" font-size="28" font-weight="bold" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">
          ${cleanWord}
        </text>
      </svg>
    `.trim();
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }
}

export const imageStudioService = new ImageStudioService();
