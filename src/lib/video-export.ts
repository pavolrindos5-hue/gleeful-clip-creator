import fixWebmDuration from "fix-webm-duration";

// Reálny export časovej osi do video súboru (canvas + MediaRecorder).
// Prehrá klipy za sebou do <canvas>, aplikuje farebné filtre a nahrá výstup.

export type ExportClip = {
  src?: string;
  type?: "video" | "image";
  duration: number; // sekundy
  /** priehľadnosť klipu 0..1 (vrstvy) */
  opacity?: number;
  /** rýchlosť prehrávania videa */
  speed?: number;
};

export type ExportMusic = {
  src: string;
  /** začiatok na časovej osi v sekundách */
  start?: number;
  /** dĺžka na časovej osi v sekundách */
  duration?: number;
  /** hlasitosť 0..1 */
  volume?: number;
};

export type ExportOptions = {
  clips: ExportClip[];
  /** hudobné stopy primixované do exportu */
  music?: ExportMusic[] | undefined;
  filter?: string | undefined; // CSS filter reťazec (jas/kontrast/sýtosť…)
  fps?: number;
  width?: number;
  height?: number;
  onProgress?: (pct: number) => void;
  /** prechod pre klip s daným indexom (aplikuje sa na jeho začiatku) */
  transitions?: Record<number, string> | undefined;
  /** priblíženie (AI stabilizácia) */
  zoom?: number | undefined;
  /** titulky vypálené do videa */
  captions?: string[] | undefined;
  /** cieľový pomer strán (orez) */
  aspectRatio?: number | undefined;
  /** vyplniť celý rám namiesto vloženia (orez) */
  cover?: boolean | undefined;
};

function pickMime(): { mime: string; ext: string } {
  const candidates: { mime: string; ext: string }[] = [
    // WebM je pri MediaRecorder najspoľahlivejší. Chýbajúcu dĺžku doplníme nižšie.
    { mime: "video/webm;codecs=vp9,opus", ext: "webm" },
    { mime: "video/webm;codecs=vp8,opus", ext: "webm" },
    { mime: "video/webm", ext: "webm" },
    // MP4 ostáva záloha pre prehliadače, ktoré WebM nenahrávajú.
    { mime: "video/mp4;codecs=avc1.42E01E,mp4a.40.2", ext: "mp4" },
    { mime: "video/mp4", ext: "mp4" },
  ];
  for (const c of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c.mime)) return c;
  }
  return { mime: "", ext: "webm" };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Obrázok sa nepodarilo načítať"));
    img.src = src;
  });
}

function loadVideo(src: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.crossOrigin = "anonymous";
    v.preload = "auto";
    v.playsInline = true;
    v.muted = false;
    v.onloadeddata = () => resolve(v);
    v.onerror = () => reject(new Error("Video sa nepodarilo načítať"));
    v.src = src;
  });
}

function loadAudio(src: string): Promise<HTMLAudioElement> {
  return new Promise((resolve, reject) => {
    const a = new Audio();
    a.crossOrigin = "anonymous";
    a.preload = "auto";
    let settled = false;
    const ready = () => {
      if (settled) return;
      settled = true;
      resolve(a);
    };
    a.oncanplaythrough = ready;
    a.onloadeddata = ready;
    a.onloadedmetadata = ready;
    a.onerror = () => reject(new Error("Hudbu sa nepodarilo načítať"));
    a.src = src;
  });
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  media: HTMLVideoElement | HTMLImageElement,
  w: number,
  h: number,
  cover = false,
) {
  const mw = media instanceof HTMLVideoElement ? media.videoWidth : media.naturalWidth;
  const mh = media instanceof HTMLVideoElement ? media.videoHeight : media.naturalHeight;
  if (!mw || !mh) return;
  const scale = cover ? Math.max(w / mw, h / mh) : Math.min(w / mw, h / mh);
  const dw = mw * scale;
  const dh = mh * scale;
  ctx.drawImage(media, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

export async function exportTimeline(opts: ExportOptions): Promise<{ blob: Blob; ext: string }> {
  const fps = opts.fps ?? 30;
  const clips = opts.clips.filter((c) => c.src && c.duration > 0);
  if (!clips.length) throw new Error("Na časovej osi nie sú žiadne médiá.");
  if (typeof MediaRecorder === "undefined")
    throw new Error("Tento prehliadač nepodporuje export videa.");
  if (typeof HTMLCanvasElement.prototype.captureStream !== "function")
    throw new Error("Tento prehliadač nepodporuje export obrazu. Použi Chrome alebo Edge.");

  // DÔLEŽITÉ: AudioContext musí vzniknúť HNEĎ TERAZ, kým ešte platí užívateľské gesto
  // (klik na tlačidlo Export). Ak by sme ho vytvorili až po await-och nižšie (načítanie
  // videí/obrázkov), prehliadač by ho vytvoril v stave "suspended" a zvuk by bol ticho
  // nahraný ako samé nuly – video by sa stiahlo, ale bez počuteľného zvuku.
  let audioCtx: AudioContext | null = null;
  let audioDest: MediaStreamAudioDestinationNode | null = null;
  try {
    const AC: typeof AudioContext | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AC) {
      audioCtx = new AC();
      audioDest = audioCtx.createMediaStreamDestination();
      // Explicitne "prebudiť" kontext, kým je gesto ešte čerstvé
      if (audioCtx.state === "suspended") await audioCtx.resume().catch(() => undefined);
    }
  } catch {
    audioCtx = null;
    audioDest = null;
  }

  // Rozmery podľa prvého videa/obrázka
  let width = opts.width ?? 0;
  let height = opts.height ?? 0;

  // Predpripravíme médiá
  type Prepared =
    | { kind: "video"; el: HTMLVideoElement; duration: number }
    | { kind: "image"; el: HTMLImageElement; duration: number };
  const prepared: Prepared[] = [];
  try {
    for (const c of clips) {
      const src = c.src;
      if (!src) continue;
      if (c.type === "image") {
        prepared.push({ kind: "image", el: await loadImage(src), duration: c.duration });
      } else {
        prepared.push({ kind: "video", el: await loadVideo(src), duration: c.duration });
      }
    }
  } catch (error) {
    if (audioCtx) await audioCtx.close().catch(() => undefined);
    throw error;
  }
  const first = prepared[0];
  if (!first) {
    if (audioCtx) await audioCtx.close().catch(() => undefined);
    throw new Error("Médiá pre export sa nepodarilo pripraviť.");
  }

  if (!width || !height) {
    const w = first.kind === "video" ? first.el.videoWidth : first.el.naturalWidth;
    const h = first.kind === "video" ? first.el.videoHeight : first.el.naturalHeight;
    width = w || 1280;
    height = h || 720;
  }
  if (opts.aspectRatio) {
    // orez na cieľový pomer strán (zachovaj plochu podľa šírky)
    height = Math.round(width / opts.aspectRatio);
  }
  // Párne rozmery kvôli kodekom
  width = Math.max(2, Math.round(width / 2) * 2);
  height = Math.max(2, Math.round(height / 2) * 2);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    if (audioCtx) await audioCtx.close().catch(() => undefined);
    throw new Error("Obraz pre export nie je dostupný.");
  }

  const stream = canvas.captureStream(fps);

  // Hudobné stopy – načítame a primixujeme
  type PreparedMusic = { el: HTMLAudioElement; start: number; end: number; volume: number };
  const music: PreparedMusic[] = [];
  for (const m of opts.music ?? []) {
    if (!m.src) continue;
    try {
      const el = await loadAudio(m.src);
      const volume = Math.max(0, Math.min(1, m.volume ?? 1));
      el.volume = 1;
      const start = m.start ?? 0;
      const sourceDuration = Number.isFinite(el.duration) ? el.duration : 0;
      const requestedDuration = m.duration ?? sourceDuration;
      const duration = Number.isFinite(requestedDuration) ? Math.max(0, requestedDuration) : 0;
      if (duration > 0) music.push({ el, start, end: start + duration, volume });
    } catch {
      /* hudba je voliteľná */
    }
  }

  // Audio z video klipov + hudby – pripojíme na AudioContext vytvorený na začiatku funkcie
  try {
    const videoEls = prepared.filter(
      (p): p is Extract<Prepared, { kind: "video" }> => p.kind === "video",
    );
    if (audioCtx && audioDest && (videoEls.length || music.length)) {
      // Pre istotu ešte raz - ak medzitým (počas loadImage/loadVideo) kontext opäť "zaspal"
      if (audioCtx.state === "suspended") await audioCtx.resume().catch(() => undefined);
      for (const v of videoEls) {
        const srcNode = audioCtx.createMediaElementSource(v.el);
        srcNode.connect(audioDest);
      }
      for (const m of music) {
        const gain = audioCtx.createGain();
        gain.gain.value = m.volume;
        const srcNode = audioCtx.createMediaElementSource(m.el);
        srcNode.connect(gain);
        gain.connect(audioDest);
      }
      audioDest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
    }
  } catch {
    // audio je voliteľné – pokračujeme bez neho
  }

  // synchronizácia hudby s globálnym časom exportu
  const syncMusic = (globalT: number) => {
    for (const m of music) {
      const inRange = globalT >= m.start && globalT < m.end;
      if (inRange) {
        const local = globalT - m.start;
        const dur = m.el.duration || 0;
        const target = dur > 0 ? local % dur : local;
        if (m.el.paused) {
          try {
            m.el.currentTime = target;
          } catch {
            /* ignore */
          }
          void m.el.play().catch(() => undefined);
        } else if (Math.abs(m.el.currentTime - target) > 0.35) {
          try {
            m.el.currentTime = target;
          } catch {
            /* ignore */
          }
        }
      } else if (!m.el.paused) {
        m.el.pause();
      }
    }
  };

  const picked = pickMime();
  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(
      stream,
      picked.mime ? { mimeType: picked.mime, videoBitsPerSecond: 8_000_000 } : undefined,
    );
  } catch {
    recorder = new MediaRecorder(stream);
  }
  const actualMime = recorder.mimeType || picked.mime;
  const ext = actualMime.toLowerCase().includes("mp4") ? "mp4" : "webm";
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  let recorderError: Error | null = null;
  const stopped = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
    recorder.onerror = (event) => {
      recorderError = new Error(
        (event as Event & { error?: DOMException }).error?.message || "Nahrávanie exportu zlyhalo.",
      );
      resolve();
    };
  });
  recorder.start(250);

  const totalDuration = prepared.reduce((s, p) => s + p.duration, 0);
  let elapsedBefore = 0;

  const cssFilter = opts.filter ?? "none";
  const transitions = opts.transitions ?? {};
  const zoom = opts.zoom ?? 1;
  const captions = opts.captions ?? [];
  const coverMode = opts.cover ?? false;
  const TR_DUR = 0.7;

  // snímka predchádzajúceho klipu (pre prechody)
  const prevCanvas = document.createElement("canvas");
  prevCanvas.width = width;
  prevCanvas.height = height;
  const prevCtx = prevCanvas.getContext("2d");
  let hasPrev = false;

  const drawMedia = (media: HTMLVideoElement | HTMLImageElement, filter: string, alpha = 1) => {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.filter = filter;
    if (zoom !== 1) {
      ctx.translate(width / 2, height / 2);
      ctx.scale(zoom, zoom);
      ctx.translate(-width / 2, -height / 2);
    }
    drawCover(ctx, media, width, height, coverMode);
    ctx.restore();
  };

  const drawCaption = (globalT: number) => {
    if (!captions.length) return;
    const line = captions[Math.floor(globalT / 3) % captions.length];
    if (!line) return;
    ctx.save();
    ctx.filter = "none";
    const fontSize = Math.max(18, Math.round(height * 0.045));
    ctx.font = `600 ${fontSize}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const metrics = ctx.measureText(line);
    const padX = fontSize * 0.7;
    const boxW = metrics.width + padX * 2;
    const boxH = fontSize * 1.9;
    const cx = width / 2;
    const cy = height - boxH * 1.1;
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.fillRect(cx - boxW / 2, cy - boxH / 2, boxW, boxH);
    ctx.fillStyle = "#fff";
    ctx.fillText(line, cx, cy);
    ctx.restore();
  };

  // aplikuje prechod na kreslenie nového klipu ponad predchádzajúcu snímku
  const drawTransition = (
    id: string,
    p: number, // 0..1
    media: HTMLVideoElement | HTMLImageElement,
  ) => {
    // spodná vrstva = posledná snímka predchádzajúceho klipu
    if (hasPrev) {
      ctx.save();
      ctx.filter = "none";
      ctx.drawImage(prevCanvas, 0, 0, width, height);
      ctx.restore();
    }
    ctx.save();
    let filter = cssFilter;
    switch (id) {
      case "wipe-l":
        ctx.beginPath();
        ctx.rect(width * (1 - p), 0, width * p, height);
        ctx.clip();
        break;
      case "wipe-r":
        ctx.beginPath();
        ctx.rect(0, 0, width * p, height);
        ctx.clip();
        break;
      case "zoom-in": {
        ctx.globalAlpha = p;
        const s = 0.3 + 0.7 * p;
        ctx.translate(width / 2, height / 2);
        ctx.scale(s, s);
        ctx.translate(-width / 2, -height / 2);
        break;
      }
      case "zoom-out": {
        ctx.globalAlpha = p;
        const s = 1.8 - 0.8 * p;
        ctx.translate(width / 2, height / 2);
        ctx.scale(s, s);
        ctx.translate(-width / 2, -height / 2);
        break;
      }
      case "slide-l":
        ctx.translate(width * (1 - p), 0);
        break;
      case "slide-r":
        ctx.translate(-width * (1 - p), 0);
        break;
      case "rotate": {
        ctx.globalAlpha = p;
        const s = 0.4 + 0.6 * p;
        ctx.translate(width / 2, height / 2);
        ctx.rotate((-120 * (1 - p) * Math.PI) / 180);
        ctx.scale(s, s);
        ctx.translate(-width / 2, -height / 2);
        break;
      }
      case "dissolve":
        ctx.globalAlpha = p;
        filter =
          `${cssFilter === "none" ? "" : cssFilter} blur(${(6 * (1 - p)).toFixed(2)}px)`.trim();
        break;
      case "flash":
        ctx.globalAlpha = p;
        filter =
          `${cssFilter === "none" ? "" : cssFilter} brightness(${(1 + 5 * (1 - p)).toFixed(2)})`.trim();
        break;
      case "blur":
        ctx.globalAlpha = p;
        filter =
          `${cssFilter === "none" ? "" : cssFilter} blur(${(10 * (1 - p)).toFixed(2)}px)`.trim();
        break;
      case "glitch":
        ctx.globalAlpha = p;
        ctx.transform(1, 0, Math.tan((18 * (1 - p) * Math.PI) / 180), 1, width * 0.12 * (1 - p), 0);
        break;
      case "fade":
      default:
        ctx.globalAlpha = p;
        break;
    }
    ctx.filter = filter || "none";
    if (zoom !== 1) {
      ctx.translate(width / 2, height / 2);
      ctx.scale(zoom, zoom);
      ctx.translate(-width / 2, -height / 2);
    }
    drawCover(ctx, media, width, height, coverMode);
    ctx.restore();
  };

  try {
    for (let i = 0; i < prepared.length; i++) {
      const item = prepared[i];
      const transitionId = i > 0 ? transitions[i] : undefined;
      const startWall = performance.now();
      const clipOpacity = clips[i]?.opacity ?? 1;
      if (item.kind === "video") {
        const v = item.el;
        try {
          v.currentTime = 0;
        } catch {
          /* ignore */
        }
        v.playbackRate = clips[i]?.speed ?? 1;
        await v.play().catch(() => undefined);
      }

      await new Promise<void>((resolve) => {
        const step = () => {
          const t = (performance.now() - startWall) / 1000;
          ctx.globalAlpha = 1;
          ctx.filter = "none";
          ctx.clearRect(0, 0, width, height);
          ctx.fillStyle = "#000";
          ctx.fillRect(0, 0, width, height);

          if (transitionId && t < TR_DUR) {
            const raw = Math.min(1, t / TR_DUR);
            const p = raw < 0.5 ? 2 * raw * raw : 1 - Math.pow(-2 * raw + 2, 2) / 2;
            drawTransition(transitionId, p, item.el);
          } else {
            drawMedia(item.el, cssFilter, clipOpacity);
          }
          drawCaption(elapsedBefore + t);
          syncMusic(elapsedBefore + t);

          opts.onProgress?.(Math.min(99, Math.round(((elapsedBefore + t) / totalDuration) * 100)));

          const finished =
            item.kind === "video" ? t >= item.duration || item.el.ended : t >= item.duration;
          if (finished) {
            resolve();
            return;
          }
          requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });

      if (item.kind === "video") item.el.pause();
      if (prevCtx) {
        prevCtx.clearRect(0, 0, width, height);
        prevCtx.drawImage(canvas, 0, 0);
        hasPrev = true;
      }
      elapsedBefore += item.duration;
    }
  } catch (error) {
    if (recorder.state !== "inactive") recorder.stop();
    await stopped;
    stream.getTracks().forEach((track) => track.stop());
    if (audioCtx) await audioCtx.close().catch(() => undefined);
    throw error;
  } finally {
    for (const item of prepared) if (item.kind === "video") item.el.pause();
    for (const m of music) m.el.pause();
  }

  // Vynútime odovzdanie posledných dát ešte pred zastavením rekordéra.
  if (recorder.state === "recording") recorder.requestData();
  await new Promise((resolve) => setTimeout(resolve, 100));
  if (recorder.state !== "inactive") recorder.stop();
  await stopped;
  stream.getTracks().forEach((t) => t.stop());
  if (audioCtx) await audioCtx.close().catch(() => undefined);
  if (recorderError) throw recorderError;
  opts.onProgress?.(100);

  const baseMime = ext === "mp4" ? "video/mp4" : "video/webm";
  const rawBlob = new Blob(chunks, { type: baseMime });
  if (rawBlob.size < 1024) {
    throw new Error("Export nevytvoril platné video. Skús použiť prehliadač Chrome alebo Edge.");
  }

  // MediaRecorder v prehliadačoch často vynechá WebM Duration, preto prehrávač ukáže 0 sekúnd.
  const blob =
    ext === "webm"
      ? await fixWebmDuration(rawBlob, Math.max(1, Math.round(totalDuration * 1000)), {
          logger: false,
        })
      : rawBlob;
  if (blob.size < 1024) throw new Error("Výsledné video je prázdne. Export sa neuložil.");
  return { blob, ext };
}

export function downloadBlob(blob: Blob, filename: string) {
  // očistíme názov od znakov, kvôli ktorým prehliadač uloží súbor ako ".tmp"
  const safe = filename.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "_");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = safe;
  a.rel = "noopener";
  a.target = "_self";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
