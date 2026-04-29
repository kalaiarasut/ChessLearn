"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import confetti from "canvas-confetti";

export type ConfettiRef = {
  fire: (options?: confetti.Options) => void;
};

type ConfettiProps = {
  className?: string;
};

export const Confetti = forwardRef<ConfettiRef, ConfettiProps>(function Confetti(
  { className },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const instanceRef = useRef<confetti.CreateTypes | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    instanceRef.current = confetti.create(canvas, {
      resize: true,
      useWorker: true,
    });

    return () => {
      instanceRef.current?.reset();
      instanceRef.current = null;
    };
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      fire: (options) => {
        instanceRef.current?.({
          particleCount: 180,
          spread: 120,
          startVelocity: 42,
          origin: { y: 0.7 },
          ...options,
        });
      },
    }),
    [],
  );

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
});
