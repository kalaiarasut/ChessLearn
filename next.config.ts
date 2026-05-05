import type { NextConfig } from "next";

const STOCKFISH_18_FULL_WASM_RELEASE_URL =
  process.env.STOCKFISH18_FULL_WASM_URL ??
  "https://github.com/kalaiarasut/ChessLearn/releases/download/v1.0.0/stockfish-18-single.wasm";

const nextConfig: NextConfig = {
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
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/engines/stockfish/stockfish-18-single.wasm",
          destination: STOCKFISH_18_FULL_WASM_RELEASE_URL,
        },
      ],
    };
  },
};

export default nextConfig;
