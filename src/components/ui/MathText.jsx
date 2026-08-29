import { useMemo } from "react";
import katex from "katex";

// Pisahkan teks biasa dan blok math: $$...$$ (display) atau $...$ (inline).
const SPLIT = /(\$\$[^$]*\$\$|\$[^$]+\$)/g;

function toHtml(src, displayMode) {
  try {
    return katex.renderToString(src, {
      displayMode,
      throwOnError: false,
      strict: false,
    });
  } catch {
    return src;
  }
}

/**
 * Render string yang bisa mengandung LaTeX di antara $...$ / $$...$$.
 * Teks biasa tetap di-escape (React text node); output KaTeX dari lib
 * yang tepercaya.
 */
export default function MathText({ children, className = "" }) {
  const text = String(children ?? "");

  const nodes = useMemo(
    () =>
      text.split(SPLIT).map((seg, i) => {
        if (seg.startsWith("$$") && seg.endsWith("$$") && seg.length >= 4) {
          return (
            <span
              key={i}
              dangerouslySetInnerHTML={{ __html: toHtml(seg.slice(2, -2), true) }}
            />
          );
        }
        if (seg.startsWith("$") && seg.endsWith("$") && seg.length >= 3) {
          return (
            <span
              key={i}
              dangerouslySetInnerHTML={{ __html: toHtml(seg.slice(1, -1), false) }}
            />
          );
        }
        return <span key={i}>{seg}</span>;
      }),
    [text]
  );

  return <span className={`whitespace-pre-wrap ${className}`}>{nodes}</span>;
}
