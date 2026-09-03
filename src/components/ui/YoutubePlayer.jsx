import { useEffect, useRef, useState } from "react";
import { Play, Pause, Volume2, VolumeX, Maximize2 } from "lucide-react";

// IFrame API di-load sekali per sesi.
let ytReady;
function loadYT() {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (window.YT?.Player) return Promise.resolve(window.YT);
  ytReady ||= new Promise((resolve) => {
    const done = () => resolve(window.YT);
    if (window.YT?.Player) return done();
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      done();
    };
    if (!document.getElementById("yt-iframe-api")) {
      const s = document.createElement("script");
      s.id = "yt-iframe-api";
      s.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(s);
    }
  });
  return ytReady;
}

const fmt = (sec) => {
  const s = Math.max(0, Math.floor(sec || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
};

/**
 * Player YouTube tanpa chrome-nya: controls=0 + kontrol buatan sendiri
 * (play/pause, seek, waktu, mute, fullscreen). Judul, logo, tombol share
 * "Tonton di YouTube" — nggak muncul. Overlay nangkep semua pointer jadi
 * iframe-nya nggak pernah nampilin UI-nya.
 */
export default function YoutubePlayer({ id, title }) {
  const wrapRef = useRef(null);
  const hostRef = useRef(null);
  const playerRef = useRef(null);
  const hideRef = useRef(null);

  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);
  const [scrubbing, setScrubbing] = useState(false);
  const [scrubVal, setScrubVal] = useState(0);
  const [ui, setUi] = useState(true);

  useEffect(() => {
    let dead = false;
    loadYT().then((YT) => {
      if (dead || !YT || !hostRef.current) return;
      playerRef.current = new YT.Player(hostRef.current, {
        videoId: id,
        playerVars: {
          autoplay: 1,
          controls: 0,
          rel: 0,
          modestbranding: 1,
          iv_load_policy: 3,
          playsinline: 1,
          disablekb: 1,
          fs: 0,
          origin: window.location.origin,
        },
        events: {
          onReady: (e) => {
            if (dead) return;
            setReady(true);
            setDur(e.target.getDuration() || 0);
            setMuted(e.target.isMuted?.() ?? false);
            e.target.playVideo();
          },
          onStateChange: (e) => {
            if (e.data === 1) {
              setPlaying(true);
              setDur(e.target.getDuration() || 0);
              clearTimeout(hideRef.current);
              hideRef.current = setTimeout(() => setUi(false), 2500);
            } else if (e.data === 2 || e.data === 0) {
              setPlaying(false);
              clearTimeout(hideRef.current);
              setUi(true);
            }
          },
        },
      });
    });
    return () => {
      dead = true;
      try {
        playerRef.current?.destroy?.();
      } catch {
        /* noop */
      }
      playerRef.current = null;
    };
  }, [id]);

  // Polling waktu berjalan.
  useEffect(() => {
    if (!ready) return;
    const iv = setInterval(() => {
      if (scrubbing) return;
      const t = playerRef.current?.getCurrentTime?.();
      if (typeof t === "number") setCur(t);
    }, 250);
    return () => clearInterval(iv);
  }, [ready, scrubbing]);

  // Bersihin timer auto-hide pas unmount.
  useEffect(() => () => clearTimeout(hideRef.current), []);

  const bump = () => {
    setUi(true);
    clearTimeout(hideRef.current);
    if (playing) hideRef.current = setTimeout(() => setUi(false), 2500);
  };

  const toggle = () => {
    const p = playerRef.current;
    if (!p) return;
    if (playing) p.pauseVideo();
    else p.playVideo();
    bump();
  };

  const toggleMute = () => {
    const p = playerRef.current;
    if (!p) return;
    if (p.isMuted()) {
      p.unMute();
      setMuted(false);
    } else {
      p.mute();
      setMuted(true);
    }
    bump();
  };

  const seek = (t) => {
    playerRef.current?.seekTo?.(t, true);
    setCur(t);
  };

  const fullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else wrapRef.current?.requestFullscreen?.();
  };

  const shown = scrubbing ? scrubVal : cur;

  return (
    <div
      ref={wrapRef}
      onMouseMove={bump}
      onMouseLeave={() => playing && setUi(false)}
      className="group relative aspect-video w-full overflow-hidden rounded-xl border border-zinc-200 bg-black [&:fullscreen]:aspect-auto [&:fullscreen]:h-full [&:fullscreen]:rounded-none [&:fullscreen]:border-0"
    >
      <div
        ref={hostRef}
        className="pointer-events-none absolute inset-0 [&>iframe]:h-full [&>iframe]:w-full"
      />

      {/* area klik play/pause */}
      <button
        type="button"
        aria-label={playing ? "Jeda" : "Putar"}
        onClick={toggle}
        onDoubleClick={fullscreen}
        className="absolute inset-0"
      />

      {/* Bar hitam atas nutup judul + channel YouTube yang nongol pas
          paused. Pas main, overlay udah nangkep hover jadi nggak perlu. */}
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 h-14 bg-black transition-opacity duration-200 ${
          playing ? "opacity-0" : "opacity-100"
        }`}
      />

      {!playing && ready && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-black/75">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-white/95 text-zinc-900 shadow-lg">
            <Play size={26} fill="currentColor" className="translate-x-0.5" />
          </span>
        </div>
      )}

      {!ready && (
        <div className="absolute inset-0 grid place-items-center bg-black text-xs text-zinc-500">
          Memuat…
        </div>
      )}

      {/* bar kontrol bawah — cukup tinggi & pekat buat nutup logo YouTube +
          tombol share / watch-later yang nongol di kiri-bawah pas paused. */}
      <div
        className={`absolute inset-x-0 bottom-0 flex items-center gap-2.5 bg-gradient-to-t from-black via-black/90 to-transparent px-3 pb-2.5 pt-14 text-white transition-opacity duration-200 sm:gap-3 ${
          ui || !playing ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? "Jeda" : "Putar"}
          className="shrink-0 transition-transform hover:scale-110"
        >
          {playing ? (
            <Pause size={18} fill="currentColor" />
          ) : (
            <Play size={18} fill="currentColor" />
          )}
        </button>

        <span className="shrink-0 text-[11px] tabular-nums text-white/90">
          {fmt(shown)} / {fmt(dur)}
        </span>

        <input
          type="range"
          min={0}
          max={dur || 0}
          step="any"
          value={Math.min(shown, dur || 0)}
          aria-label="Geser waktu"
          onChange={(e) => {
            setScrubVal(+e.target.value);
            setScrubbing(true);
            setUi(true);
          }}
          onPointerUp={() => {
            seek(scrubVal);
            setScrubbing(false);
          }}
          onKeyUp={(e) => seek(+e.target.value)}
          className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-white/30 accent-brand-500"
        />

        <button
          type="button"
          onClick={toggleMute}
          aria-label={muted ? "Bunyikan" : "Bisukan"}
          className="shrink-0 transition-transform hover:scale-110"
        >
          {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
        </button>

        <button
          type="button"
          onClick={fullscreen}
          aria-label="Layar penuh"
          className="shrink-0 transition-transform hover:scale-110"
        >
          <Maximize2 size={16} />
        </button>
      </div>

      <span className="sr-only">{title}</span>
    </div>
  );
}
