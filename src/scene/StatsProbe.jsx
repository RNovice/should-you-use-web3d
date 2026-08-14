import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import { reportStats } from '../deck/useDeck';

/**
 * 把渲染統計送到 DOM 層的 HUD。
 *
 * 節流到每 250ms 一次 —— 每一格都寫 store 會讓整份簡報跟著重繪，
 * 反而把要量的東西弄壞。
 */
export const StatsProbe = () => {
  const gl = useThree((s) => s.gl);
  const acc = useRef({ frames: 0, elapsed: 0 });

  useFrame((_, delta) => {
    const a = acc.current;
    a.frames += 1;
    a.elapsed += delta;

    if (a.elapsed >= 0.25) {
      reportStats({
        fps: Math.round(a.frames / a.elapsed),
        drawCalls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
      });
      a.frames = 0;
      a.elapsed = 0;
    }
  });

  return null;
};
