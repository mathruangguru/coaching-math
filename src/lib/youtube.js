// Ambil video id dari macam-macam bentuk URL YouTube.
// Balikin null kalau bukan URL YouTube yang dikenali.
export function youtubeId(url) {
  if (!url) return null;
  try {
    const u = new URL(url.trim());
    const host = u.hostname.replace(/^www\./, "");

    if (host === "youtu.be") return u.pathname.slice(1) || null;

    if (host === "youtube.com" || host === "youtube-nocookie.com") {
      if (u.pathname === "/watch") return u.searchParams.get("v");
      const m = u.pathname.match(/^\/(embed|shorts|live|v)\/([^/?#]+)/);
      if (m) return m[2];
    }
  } catch {
    // bukan URL valid
  }
  return null;
}
