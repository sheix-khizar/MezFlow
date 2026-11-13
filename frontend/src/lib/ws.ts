/**
 * Resolves the appropriate WebSocket Base URL (ws:// or wss://)
 * ensuring local development connects to :8000 while production cloud
 * deployments (Vercel, Render, Railway) derive clean WebSocket hosts
 * without invalid ports.
 */
export function getWebSocketBaseUrl(): string {
  // 1. Explicit override via environment variable
  if (process.env.NEXT_PUBLIC_WS_URL) {
    return process.env.NEXT_PUBLIC_WS_URL.replace(/\/$/, "");
  }

  // 2. Server-side rendering guard
  if (typeof window === "undefined") {
    return "ws://127.0.0.1:8000";
  }

  const hostname = window.location.hostname;
  const isLocal =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.startsWith("192.168.") ||
    hostname.startsWith("10.") ||
    hostname.startsWith("172.");

  // 3. Local machine & Wi-Fi LAN testing
  if (isLocal) {
    const host = hostname === "localhost" ? "127.0.0.1" : hostname;
    return `ws://${host}:8000`;
  }

  // 4. Production or cloud deployments (derive host from NEXT_PUBLIC_API_URL or origin)
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://mezflow.vercel.app/api/v1";
  try {
    const url = new URL(apiUrl);
    const wsProto = url.protocol === "https:" ? "wss:" : "ws:";
    return `${wsProto}//${url.host}`;
  } catch {
    const wsProto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${wsProto}//${window.location.host}`;
  }
}

