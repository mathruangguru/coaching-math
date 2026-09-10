import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";

export const LOGICAL_W = 1600;
export const LOGICAL_H = 1000;
const GRID = 40;

// Jarak titik ke titik terdekat sebuah coretan (buat "hapus coretan").
function nearStroke(stroke, x, y, dist) {
  const pts = stroke.points ?? [];
  for (let i = 0; i < pts.length; i++) {
    const dx = pts[i][0] - x;
    const dy = pts[i][1] - y;
    if (dx * dx + dy * dy <= dist * dist) return true;
  }
  return false;
}

/**
 * Kanvas whiteboard vektor. `board` = { bg, strokes } jadi sumber kebenaran;
 * tiap coretan selesai / hapus -> onCommit(boardBerikutnya). readOnly = cuma
 * nampilin (buat tampilan murid nanti).
 */
const WhiteboardCanvas = forwardRef(function WhiteboardCanvas(
  {
    board,
    onCommit,
    tool = "pen",
    color = "#18181b",
    width = 4,
    readOnly = false,
  },
  ref,
) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(null); // coretan yang lagi ditarik
  const erasedRef = useRef(null); // Set index coretan yang kehapus di drag ini
  const boardRef = useRef(board);
  boardRef.current = board;

  const draw = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    const dpr = cv.width / LOGICAL_W;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, LOGICAL_W, LOGICAL_H);

    // Latar
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    if (board.bg === "grid") {
      ctx.strokeStyle = "#e4e4e7";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = GRID; x < LOGICAL_W; x += GRID) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, LOGICAL_H);
      }
      for (let y = GRID; y < LOGICAL_H; y += GRID) {
        ctx.moveTo(0, y);
        ctx.lineTo(LOGICAL_W, y);
      }
      ctx.stroke();
    }

    // Coretan
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    const erased = erasedRef.current;
    const all = drawingRef.current
      ? [...board.strokes, drawingRef.current]
      : board.strokes;
    all.forEach((s, i) => {
      if (erased && erased.has(i)) return;
      const pts = s.points ?? [];
      if (pts.length === 0) return;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      if (pts.length === 1) ctx.lineTo(pts[0][0] + 0.01, pts[0][1]);
      else for (let j = 1; j < pts.length; j++) ctx.lineTo(pts[j][0], pts[j][1]);
      ctx.stroke();
    });
  }, [board]);

  // Set ukuran kanvas sekali (ikut devicePixelRatio biar tajam).
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = LOGICAL_W * dpr;
    cv.height = LOGICAL_H * dpr;
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    draw();
  }, [draw]);

  useImperativeHandle(ref, () => ({
    exportPng: (name = "whiteboard") => {
      const cv = canvasRef.current;
      if (!cv) return;
      const a = document.createElement("a");
      a.href = cv.toDataURL("image/png");
      a.download = `${name.replace(/[^\w.-]+/g, "_") || "whiteboard"}.png`;
      a.click();
    },
  }));

  const toLogical = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    return [
      ((e.clientX - r.left) / r.width) * LOGICAL_W,
      ((e.clientY - r.top) / r.height) * LOGICAL_H,
    ];
  };

  const onPointerDown = (e) => {
    if (readOnly) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const [x, y] = toLogical(e);
    if (tool === "eraser") {
      erasedRef.current = new Set();
      eraseAt(x, y);
      return;
    }
    drawingRef.current = { mode: "pen", color, width, points: [[x, y]] };
    draw();
  };

  const eraseAt = (x, y) => {
    const b = boardRef.current;
    const hit = Math.max(14, width * 3);
    let changed = false;
    b.strokes.forEach((s, i) => {
      if (!erasedRef.current.has(i) && nearStroke(s, x, y, hit)) {
        erasedRef.current.add(i);
        changed = true;
      }
    });
    if (changed) draw();
  };

  const onPointerMove = (e) => {
    if (readOnly) return;
    if (tool === "eraser") {
      if (!erasedRef.current) return;
      const [x, y] = toLogical(e);
      eraseAt(x, y);
      return;
    }
    if (!drawingRef.current) return;
    const [x, y] = toLogical(e);
    drawingRef.current.points.push([x, y]);
    draw();
  };

  const finish = () => {
    if (readOnly) return;
    if (tool === "eraser") {
      const erased = erasedRef.current;
      erasedRef.current = null;
      if (erased && erased.size) {
        onCommit?.({
          ...boardRef.current,
          strokes: boardRef.current.strokes.filter((_, i) => !erased.has(i)),
        });
      } else {
        draw();
      }
      return;
    }
    const s = drawingRef.current;
    drawingRef.current = null;
    if (s && s.points.length) {
      onCommit?.({
        ...boardRef.current,
        strokes: [...boardRef.current.strokes, s],
      });
    } else {
      draw();
    }
  };

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finish}
      onPointerLeave={finish}
      onPointerCancel={finish}
      className="block w-full rounded-xl border border-zinc-200 bg-white shadow-sm"
      style={{
        aspectRatio: `${LOGICAL_W} / ${LOGICAL_H}`,
        touchAction: "none",
        cursor: readOnly ? "default" : tool === "eraser" ? "cell" : "crosshair",
      }}
    />
  );
});

export default WhiteboardCanvas;
