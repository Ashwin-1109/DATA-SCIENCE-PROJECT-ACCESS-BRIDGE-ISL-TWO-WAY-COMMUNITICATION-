/**
 * AccessBridge - Resilient API Client Helper
 * Wraps all HTTP calls with timeout, retry backoff, and graceful fallbacks.
 * NEVER throws raw errors to the UI.
 * Technical details are piped to console.warn and the Diagnostics system log.
 */

export interface ApiFetchConfig<T> {
  timeoutMs?: number;
  retries?: number;
  fallback?: T;
  retryDelayMs?: number;
}

export interface ApiResult<T> {
  ok: boolean;
  data: T;
  status: number;
  error?: string;
  isFallback: boolean;
  latencyMs: number;
}

export interface NetworkDiagnosticLog {
  timestamp: string;
  url: string;
  method: string;
  status: number;
  ok: boolean;
  latencyMs: number;
  errorMessage?: string;
}

class ApiClient {
  private diagnosticLogs: NetworkDiagnosticLog[] = [];
  private readonly maxLogs = 50;

  /**
   * Resilient HTTP fetcher with timeout and fallbacks
   */
  public async apiFetch<T>(
    url: string,
    opts: RequestInit = {},
    config: ApiFetchConfig<T> = {}
  ): Promise<ApiResult<T>> {
    const {
      timeoutMs = 8000,
      retries = 1,
      fallback = null as unknown as T,
      retryDelayMs = 400
    } = config;

    let attemptsLeft = Math.max(0, retries) + 1;
    let lastError = 'Unknown error';
    let lastStatus = 0;
    const method = opts.method || 'GET';

    while (attemptsLeft > 0) {
      attemptsLeft--;
      const start = performance.now();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(url, {
          ...opts,
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        const latencyMs = Math.round(performance.now() - start);
        lastStatus = response.status;

        if (response.ok) {
          const contentType = response.headers.get('content-type') || '';
          let data: T;
          if (contentType.includes('application/json')) {
            data = await response.json();
          } else {
            data = (await response.text()) as unknown as T;
          }

          this.recordDiagnostic({
            timestamp: new Date().toISOString(),
            url,
            method,
            status: response.status,
            ok: true,
            latencyMs
          });

          return {
            ok: true,
            data,
            status: response.status,
            isFallback: false,
            latencyMs
          };
        } else {
          lastError = `HTTP ${response.status} ${response.statusText}`;
          console.warn(`[apiClient] Request to ${url} returned ${lastError}`);
        }
      } catch (err: unknown) {
        clearTimeout(timeoutId);
        const latencyMs = Math.round(performance.now() - start);
        if (err instanceof DOMException && err.name === 'AbortError') {
          lastError = `Request timed out after ${timeoutMs}ms`;
        } else if (err instanceof Error) {
          lastError = err.message || 'Network failure';
        } else {
          lastError = String(err);
        }
        console.warn(`[apiClient] Fetch error for ${url}:`, lastError);
      }

      // If attempts left, wait before retrying
      if (attemptsLeft > 0) {
        await new Promise(r => setTimeout(r, retryDelayMs));
      }
    }

    // Log diagnostic failure
    this.recordDiagnostic({
      timestamp: new Date().toISOString(),
      url,
      method,
      status: lastStatus,
      ok: false,
      latencyMs: timeoutMs,
      errorMessage: lastError
    });

    return {
      ok: false,
      data: fallback,
      status: lastStatus,
      error: lastError,
      isFallback: true,
      latencyMs: timeoutMs
    };
  }

  private recordDiagnostic(log: NetworkDiagnosticLog): void {
    this.diagnosticLogs.unshift(log);
    if (this.diagnosticLogs.length > this.maxLogs) {
      this.diagnosticLogs.pop();
    }
  }

  public getDiagnosticLogs(): NetworkDiagnosticLog[] {
    return [...this.diagnosticLogs];
  }

  public clearDiagnosticLogs(): void {
    this.diagnosticLogs = [];
  }
}

export const apiClient = new ApiClient();
export const apiFetch = <T>(url: string, opts?: RequestInit, config?: ApiFetchConfig<T>) =>
  apiClient.apiFetch<T>(url, opts, config);
