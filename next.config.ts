import type { NextConfig } from "next";

const fullEngineWasmUrl = process.env.STOCKFISH18_FULL_WASM_URL?.trim();

const nextConfig: NextConfig = {
  async rewrites() {
    if (!fullEngineWasmUrl) {
      return [];
    }

    return [
      {
        source: "/engines/stockfish/stockfish-18-single.wasm",
        destination: fullEngineWasmUrl,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/engines/stockfish/:path*.wasm",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
