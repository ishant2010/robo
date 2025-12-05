import React, { useEffect, useRef } from 'react';

export const Visualizer: React.FC<{ active: boolean }> = ({ active }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let t = 0;

    const draw = () => {
      if (!active) {
         ctx.clearRect(0, 0, canvas.width, canvas.height);
         // Draw flat line
         ctx.beginPath();
         ctx.strokeStyle = '#374151'; // gray-700
         ctx.moveTo(0, canvas.height / 2);
         ctx.lineTo(canvas.width, canvas.height / 2);
         ctx.stroke();
         return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#00f3ff';
      ctx.beginPath();

      const width = canvas.width;
      const height = canvas.height;
      const amplitude = 20;
      const frequency = 0.05;

      for (let x = 0; x < width; x++) {
        // Simple sine wave simulation for visual effect
        const y = height / 2 + Math.sin(x * frequency + t) * amplitude * Math.sin(x * 0.01 + t * 0.5);
        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
      t += 0.2;
      animationId = requestAnimationFrame(draw);
    };

    draw();

    return () => cancelAnimationFrame(animationId);
  }, [active]);

  return (
    <canvas 
        ref={canvasRef} 
        width={300} 
        height={60} 
        className="w-full max-w-md h-16 opacity-80"
    />
  );
};