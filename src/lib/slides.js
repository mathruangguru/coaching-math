// Ubah link Google Slides (edit / share / "publish to web") jadi URL embed
// yang bisa dipasang di <iframe>. Balikin null kalau bukan link Slides yang
// dikenali.
//
//   .../presentation/d/<ID>/edit...            -> .../d/<ID>/embed?...
//   .../presentation/d/e/<PUBID>/pub...        -> .../d/e/<PUBID>/embed?...
export function googleSlidesEmbed(url) {
  if (!url) return null;
  const m = String(url)
    .trim()
    .match(/docs\.google\.com\/presentation\/d\/(e\/)?([a-zA-Z0-9_-]+)/);
  if (!m) return null;
  const prefix = m[1] ? "e/" : "";
  return `https://docs.google.com/presentation/d/${prefix}${m[2]}/embed?start=false&loop=false&delayms=5000`;
}
