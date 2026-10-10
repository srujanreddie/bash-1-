/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ApiResponse<T = any> {
  ok: boolean;
  status: number;
  data: T;
  message?: string;
}

/**
 * Robust API fetch helper that safely handles:
 * - Proper JSON responses
 * - Non-JSON error pages (e.g. proxy warmups, 502/503/504 HTML, Vite fallbacks)
 * - Network timeouts or disconnections
 * Preventing "Unexpected token 'T' / '<' ... is not valid JSON" errors in the UI.
 */
export async function safeFetchJson<T = any>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<ApiResponse<T>> {
  try {
    const fetchInit: RequestInit = {
      credentials: 'include',
      ...init,
      headers: {
        Accept: 'application/json, text/plain, */*',
        ...(init?.headers || {}),
      },
    };

    const response = await fetch(input, fetchInit);
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      try {
        const data = await response.json();
        return {
          ok: response.ok && data?.success !== false,
          status: response.status,
          data,
          message: data?.message || (response.ok ? undefined : `Request status ${response.status}`),
        };
      } catch (jsonErr: any) {
        // Fallback below
      }
    }

    // Response might be non-JSON (HTML warmup, proxy redirect, or plain text)
    let text = '';
    try {
      text = await response.text();
    } catch {
      // ignore
    }

    // Try parsing text as JSON if content-type was mislabeled
    if (text.startsWith('{') || text.startsWith('[')) {
      try {
        const parsed = JSON.parse(text);
        return {
          ok: response.ok && parsed?.success !== false,
          status: response.status,
          data: parsed,
          message: parsed?.message || (response.ok ? undefined : `Request status ${response.status}`),
        };
      } catch {
        // ignore
      }
    }

    // Clean graceful message (never leak raw communication error to UI)
    let friendlyMessage = 'Request processed in local session.';
    if (response.status === 401 || response.status === 403) {
      friendlyMessage = 'Authentication required.';
    } else if (response.status === 404) {
      friendlyMessage = 'Resource endpoint not found.';
    }

    return {
      ok: false,
      status: response.status,
      data: { success: false, message: friendlyMessage } as any,
      message: friendlyMessage,
    };
  } catch (netErr: any) {
    return {
      ok: false,
      status: 0,
      data: { success: false, message: 'Local offline session active.' } as any,
      message: 'Local offline session active.',
    };
  }
}
