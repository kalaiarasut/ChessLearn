"use client";

import { useEffect, useState } from "react";

type TorchStatus = {
  ok: boolean;
  error?: string;
  torch_version?: string;
  cuda_available?: boolean;
  device?: string;
  model_present?: boolean;
  model_path?: string;
  python?: string;
};

const DEFAULT_STATUS: TorchStatus = {
  ok: false,
};

export function useTorchStatus() {
  const [status, setStatus] = useState<TorchStatus>(DEFAULT_STATUS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/torch/status", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload: TorchStatus) => {
        if (!cancelled) {
          setStatus(payload);
        }
      })
      .catch((error: Error) => {
        if (!cancelled) {
          setStatus({
            ok: false,
            error: error.message,
          });
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { status, loading };
}
