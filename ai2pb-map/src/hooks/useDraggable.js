import { useState, useRef, useCallback } from "react";

export function useDraggable(initialPos) {
  const [pos, setPos] = useState(initialPos);
  const posRef = useRef(pos);
  posRef.current = pos;

  const onMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    if (e.target.closest("button")) return;
    e.preventDefault();
    const startX = e.clientX - posRef.current.x;
    const startY = e.clientY - posRef.current.y;

    const onMove = (me) => {
      setPos({
        x: Math.max(0, me.clientX - startX),
        y: Math.max(0, me.clientY - startY),
      });
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, []);

  return { pos, onMouseDown };
}
