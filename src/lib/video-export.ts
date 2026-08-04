// Reálny export časovej osi do video súboru (canvas + MediaRecorder).
// Prehrá klipy za sebou do <canvas>, aplikuje farebné filtre a nahrá výstup.

export type ExportClip = {
  src?: string;
  type?: 'video' | 'image';
  duration: number; // sekundy
};

export type ExportOptions = {
  clips: ExportClip[];
  filter?: string | undefined; // CSS filter reťazec (jas/kontrast/sýtosť…)
  fps?: number;
  width?: number;
  height?: number;
  onProgress?: (pct: number) => void;
};

function pickMime(): { mime: string; ext: string } {
  const candidates: { mime: string; ext: string }[] = [
    { mime: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', ext: 'mp4' },
    { mime: 'video/mp4', ext: 'mp4' },
    { mime: 'video/webm;codecs=vp9,opus', ext: 'webm' },
    { mime: 'video/webm;codecs=vp8,opus', ext: 'webm' },
    { mime: 'video/webm', ext: 'webm' },
  ];
  for (const c of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c.mime)) return c;
  }
  return { mime: '', ext: 'webm' };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Obrázok sa nepodarilo načítať'));
    img.src = src;
  });
}

function loadVideo(src: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    v.crossOrigin = 'anonymous';
    v.preload = 'auto';
    v.playsInline = true;
    v.muted = false;
    v.onloadeddata = () => resolve(v);
    v.onerror = () => reject(new Error('Video sa nepodarilo načítať'));
    v.src = src;
  });
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  media: HTMLVideoElement | HTMLImageElement,
  w: number,
  h: number,
) {
  const mw = media instanceof HTMLVideoElement ? media.videoWidth : media.naturalWidth;
  const mh = media instanceof HTMLVideoElement ? media.videoHeight : media.naturalHeight;
  if (!mw || !mh) return;
  const scale = Math.min(w / mw, h / mh);
  const dw = mw * scale;
  const dh = mh * scale;
  ctx.drawImage(media, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

export async function exportTimeline(opts: ExportOptions): Promise<{ blob: Blob; ext: string }> {
  const fps = opts.fps ?? 30;
  const clips = opts.clips.filter((c) => c.src && c.duration > 0);
  if (!clips.length) throw new Error('Na časovej osi nie sú žiadne médiá.');
  if (typeof MediaRecorder === 'undefined') throw new Error('Tento prehliadač nepodporuje export videa.');

  // Rozmery podľa prvého videa/obrázka
  let width = opts.width ?? 0;
  let height = opts.height ?? 0;

  // Predpripravíme médiá
  type Prepared = { kind: 'video'; el: HTMLVideoElement; duration: number } | { kind: 'image'; el: HTMLImageElement; duration: number };
  const prepared: Prepared[] = [];
  for (const c of clips) {
    if (c.type === 'image') {
      prepared.push({ kind: 'image', el: await loadImage(c.src as string), duration: c.duration });
    } else {
      prepared.push({ kind: 'video', el: await loadVideo(c.src as string), duration: c.duration });
    }
  }

  if (!width || !height) {
    const first = prepared[0];
    const w = first.kind === 'video' ? first.el.videoWidth : first.el.naturalWidth;
    const h = first.kind === 'video' ? first.el.videoHeight : first.el.naturalHeight;
    width = w || 1280;
    height = h || 720;
  }
  // Párne rozmery kvôli kodekom
  width = Math.max(2, Math.round(width / 2) * 2);
  height = Math.max(2, Math.round(height / 2) * 2);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas nie je dostupný.');

  const stream = canvas.captureStream(fps);

  // Audio z video klipov (ak sa dá)
  let audioCtx: AudioContext | null = null;
  try {
    const AC: typeof AudioContext | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    const videoEls = prepared.filter((p): p is Extract<Prepared, { kind: 'video' }> => p.kind === 'video');
    if (AC && videoEls.length) {
      audioCtx = new AC();
      const dest = audioCtx.createMediaStreamDestination();
      for (const v of videoEls) {
        const srcNode = audioCtx.createMediaElementSource(v.el);
        srcNode.connect(dest);
      }
      dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
    }
  } catch {
    // audio je voliteľné – pokračujeme bez neho
  }

  const { mime, ext } = pickMime();
  const recorder = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 8_000_000 } : undefined);
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

  const stopped = new Promise<void>((resolve) => { recorder.onstop = () => resolve(); });
  recorder.start(200);

  const totalDuration = prepared.reduce((s, p) => s + p.duration, 0);
  let elapsedBefore = 0;

  const cssFilter = opts.filter ?? 'none';

  for (const item of prepared) {
    const startWall = performance.now();
    if (item.kind === 'video') {
      const v = item.el;
      try { v.currentTime = 0; } catch { /* ignore */ }
      await v.play().catch(() => undefined);
    }

    await new Promise<void>((resolve) => {
      const step = () => {
        const t = (performance.now() - startWall) / 1000;
        ctx.filter = cssFilter;
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = '#000';
        // pozadie kreslíme bez filtra
        ctx.filter = 'none';
        ctx.fillRect(0, 0, width, height);
        ctx.filter = cssFilter;
        drawCover(ctx, item.el, width, height);

        opts.onProgress?.(Math.min(99, Math.round(((elapsedBefore + t) / totalDuration) * 100)));

        const finished = item.kind === 'video' ? (t >= item.duration || item.el.ended) : t >= item.duration;
        if (finished) { resolve(); return; }
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });

    if (item.kind === 'video') item.el.pause();
    elapsedBefore += item.duration;
  }

  recorder.stop();
  await stopped;
  stream.getTracks().forEach((t) => t.stop());
  if (audioCtx) await audioCtx.close().catch(() => undefined);
  opts.onProgress?.(100);

  return { blob: new Blob(chunks, { type: mime || 'video/webm' }), ext };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
