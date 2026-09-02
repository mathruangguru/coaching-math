import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

// Styling elemen hasil render (nggak pakai plugin @tailwindcss/typography).
const components = {
  h1: (p) => (
    <h1
      className="mb-3 mt-6 text-2xl font-bold tracking-tight text-zinc-900 first:mt-0"
      {...p}
    />
  ),
  h2: (p) => (
    <h2
      className="mb-2 mt-6 text-xl font-bold tracking-tight text-zinc-900 first:mt-0"
      {...p}
    />
  ),
  h3: (p) => (
    <h3
      className="mb-2 mt-5 text-base font-bold text-zinc-900 first:mt-0"
      {...p}
    />
  ),
  p: (p) => <p className="my-3 leading-relaxed text-zinc-700" {...p} />,
  ul: (p) => (
    <ul className="my-3 list-disc space-y-1 pl-6 text-zinc-700" {...p} />
  ),
  ol: (p) => (
    <ol className="my-3 list-decimal space-y-1 pl-6 text-zinc-700" {...p} />
  ),
  li: (p) => <li className="leading-relaxed" {...p} />,
  a: ({ href, ...p }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-brand-600 underline underline-offset-2 hover:text-brand-700"
      {...p}
    />
  ),
  blockquote: (p) => (
    <blockquote
      className="my-4 border-l-2 border-zinc-300 pl-4 italic text-zinc-500"
      {...p}
    />
  ),
  pre: (p) => (
    <pre
      className="my-4 overflow-x-auto rounded-lg bg-zinc-900 p-4 font-mono text-xs leading-relaxed text-zinc-100"
      {...p}
    />
  ),
  code: ({ className, children, ...props }) => {
    const block =
      /language-/.test(className || "") || String(children).includes("\n");
    return block ? (
      <code className={className} {...props}>
        {children}
      </code>
    ) : (
      <code
        className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-[0.85em] text-zinc-800"
        {...props}
      >
        {children}
      </code>
    );
  },
  table: (p) => (
    <div className="my-4 overflow-x-auto">
      <table className="w-full border-collapse text-sm" {...p} />
    </div>
  ),
  th: (p) => (
    <th
      className="border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-left font-semibold text-zinc-600"
      {...p}
    />
  ),
  td: (p) => (
    <td
      className="border border-zinc-200 px-3 py-1.5 align-top text-zinc-700"
      {...p}
    />
  ),
  hr: () => <hr className="my-6 border-zinc-200" />,
  img: ({ alt, ...p }) => (
    <img
      alt={alt ?? ""}
      className="my-4 max-w-full rounded-lg border border-zinc-200"
      {...p}
    />
  ),
  strong: (p) => <strong className="font-semibold text-zinc-900" {...p} />,
};

/** Render string Markdown (GFM + math $…$). HTML mentah diabaikan (aman). */
export default function Markdown({ children }) {
  return (
    <div className="text-sm">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={components}
      >
        {children || ""}
      </ReactMarkdown>
    </div>
  );
}
