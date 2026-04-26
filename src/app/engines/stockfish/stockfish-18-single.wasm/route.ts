import { NextResponse } from "next/server";

export const runtime = "nodejs";

const DEFAULT_CACHE_CONTROL = "public, max-age=3600, s-maxage=3600";

function getRemoteWasmUrl() {
  const value = process.env.STOCKFISH18_FULL_WASM_URL?.trim();
  return value && value.length > 0 ? value : null;
}

function buildProxyHeaders(upstream: Response) {
  const headers = new Headers();
  const upstreamType = upstream.headers.get("content-type")?.toLowerCase() ?? "";
  const upstreamLength = upstream.headers.get("content-length");

  // Force wasm-compatible content type when upstream serves generic octet-stream.
  headers.set("Content-Type", upstreamType.includes("wasm") ? upstreamType : "application/wasm");
  headers.set("Cache-Control", upstream.headers.get("cache-control") ?? DEFAULT_CACHE_CONTROL);
  headers.set("Access-Control-Allow-Origin", "*");

  if (upstreamLength) {
    headers.set("Content-Length", upstreamLength);
  }

  return headers;
}

export async function GET() {
  const remoteWasmUrl = getRemoteWasmUrl();

  if (!remoteWasmUrl) {
    return new NextResponse("Full Stockfish WASM URL is not configured.", {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }

  let upstream: Response;
  try {
    upstream = await fetch(remoteWasmUrl, {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
    });
  } catch {
    return new NextResponse("Failed to fetch full Stockfish WASM from upstream.", {
      status: 502,
      headers: { "Cache-Control": "no-store" },
    });
  }

  if (!upstream.ok || !upstream.body) {
    return new NextResponse(`Upstream responded with ${upstream.status}.`, {
      status: 502,
      headers: { "Cache-Control": "no-store" },
    });
  }

  return new NextResponse(upstream.body, {
    status: 200,
    headers: buildProxyHeaders(upstream),
  });
}

export async function HEAD() {
  const remoteWasmUrl = getRemoteWasmUrl();

  if (!remoteWasmUrl) {
    return new NextResponse(null, {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }

  let upstream: Response;
  try {
    upstream = await fetch(remoteWasmUrl, {
      method: "HEAD",
      redirect: "follow",
      cache: "no-store",
    });
  } catch {
    return new NextResponse(null, {
      status: 502,
      headers: { "Cache-Control": "no-store" },
    });
  }

  if (!upstream.ok) {
    return new NextResponse(null, {
      status: 502,
      headers: { "Cache-Control": "no-store" },
    });
  }

  return new NextResponse(null, {
    status: 200,
    headers: buildProxyHeaders(upstream),
  });
}
