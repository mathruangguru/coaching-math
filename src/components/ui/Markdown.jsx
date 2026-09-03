import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkBreaks from "remark-breaks";
import rehypeKatex from "rehype-katex";

const remarkPlugins = [remarkGfm, remarkBreaks, remarkMath];
// strict:false biar longgar kayak <MathText> lama (nggak rewel sama unicode dll).
const rehypePlugins = [[rehypeKatex, { strict: false }]];

// `$$…$$` satu baris ke-render inline (kecil) di react-markdown. Ubah jadi
// fence multi-baris + baris kosong di sekelilingnya biar remark-math anggap
// display math (gede + ke-tengah) — sama kayak <MathText> lama. Fence `$$`
// yang udah multi-baris nggak kesentuh (regex nggak lewat newline).
function blockifyDisplayMath(src) {
  return src
    .replace(
      /[^\S\n]*\$\$[^\S\n]*([^\n$]+?)[^\S\n]*\$\$[^\S\n]*/g,
      (_m, body) => `\n\n$$\n${body.trim()}\n$$\n\n`
    )
    .replace(/\n{3,}/g, "\n\n");
}

// Styling elemen hasil render (nggak pakai plugin @tailwindcss/typography).
// Warna teks body diwarisin dari `className` wrapper — biar 1 komponen bisa
// dipakai di materi (zinc-700) maupun soal (zinc-900).
const base = {
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
  p: (p) => <p className="my-3 leading-relaxed first:mt-0 last:mb-0" {...p} />,
  ul: (p) => (
    <ul
      className="my-3 list-disc space-y-1 pl-6 first:mt-0 last:mb-0"
      {...p}
    />
  ),
  ol: (p) => (
    <ol
      className="my-3 list-decimal space-y-1 pl-6 first:mt-0 last:mb-0"
      {...p}
    />
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
      className="my-4 border-l-2 border-zinc-300 pl-4 italic text-zinc-500 first:mt-0 last:mb-0"
      {...p}
    />
  ),
  pre: (p) => (
    <pre
      className="my-4 overflow-x-auto rounded-lg bg-zinc-900 p-4 font-mono text-xs leading-relaxed text-zinc-100 first:mt-0 last:mb-0"
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
    <div className="my-3 overflow-x-auto first:mt-0 last:mb-0">
      <table className="border-collapse text-[0.95em]" {...p} />
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

// Versi inline: paragraf jadi <span> biar nyatu di baris (mis. label opsi soal).
const inlineComponents = { ...base, p: (p) => <span {...p} /> };

/**
 * Render string Markdown (GFM + tabel + math $…$). HTML mentah diabaikan (aman).
 * `inline` = buat teks pendek yang nyatu di satu baris. `className` mengatur
 * warna/ukuran teks body.
 */
export default function Markdown({ children, inline = false, className = "" }) {
  const Wrapper = inline ? "span" : "div";
  const src = inline
    ? children || ""
    : blockifyDisplayMath(String(children || ""));
  return (
    <Wrapper className={className}>
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
        components={inline ? inlineComponents : base}
      >
        {src}
      </ReactMarkdown>
    </Wrapper>
  );
}
