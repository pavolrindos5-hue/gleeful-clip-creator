// Reálny export časovej osi do video súboru (canvas + MediaRecorder).
// Prehrá klipy za sebou do <canvas>, aplikuje farebné filtre a nahrá výstup.

export type ExportClip = {
  src?: string;
  type?: 'video' | 'image';
  duration: number; // sekundy
  /** priehľadnosť klipu 0..1 (vrstvy) */
  opacity?: number;
  /** rýchlosť prehrávania videa */
  speed?: number;
};

export type ExportOptions = {
  clips: ExportClip[];
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
  /** samostatná hudobná stopa pridaná v editore (nezávislá od zvuku vo videoklipoch) */
  music?: { src: string; start: number; duration: number; volume?: number } | undefined;
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
  if (!clips.length) throw new Error('Na časovej osi nie sú žiadne médiá.');
  if (typeof MediaRecorder === 'undefined') throw new Error('Tento prehliadač nepodporuje export videa.');

  // DÔLEŽITÉ: AudioContext musí vzniknúť HNEĎ TERAZ, kým ešte platí užívateľské gesto
  // (klik na tlačidlo Export). Ak by sme ho vytvorili až po await-och nižšie (načítanie
  // videí/obrázkov), prehliadač by ho vytvoril v stave "suspended" a zvuk by bol ticho
  // nahraný ako samé nuly – video by sa stiahlo, ale bez počuteľného zvuku.
  let audioCtx: AudioContext | null = null;
  let audioDest: MediaStreamAudioDestinationNode | null = null;
  try {
    const AC: typeof AudioContext | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AC) {
      audioCtx = new AC();
      audioDest = audioCtx.createMediaStreamDestination();
      // Explicitne "prebudiť" kontext, kým je gesto ešte čerstvé
      if (audioCtx.state === 'suspended') await audioCtx.resume().catch(() => undefined);
    }
  } catch {
    audioCtx = null;
    audioDest = null;
  }

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
  if (opts.aspectRatio) {
    // orez na cieľový pomer strán (zachovaj plochu podľa šírky)
    height = Math.round(width / opts.aspectRatio);
  }
  // Párne rozmery kvôli kodekom
  width = Math.max(2, Math.round(width / 2) * 2);
  height = Math.max(2, Math.round(height / 2) * 2);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas nie je dostupný.');

  // 1. Pripojenie AudioContextu pre export
  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  if (audioCtx.state === 'suspended') {
    await audioCtx.resume();
  }
  const audioDest = audioCtx.createMediaStreamDestination();

  // 2. Dekódovanie a pripojenie hudby z editora
  if (opts.music?.src) {
    try {
      const response = await fetch(opts.music.src);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

      const sourceNode = audioCtx.createBufferSource();
      sourceNode.buffer = audioBuffer;

      const gainNode = audioCtx.createGain();
      gainNode.gain.value = opts.music.volume ?? 1;

      sourceNode.connect(gainNode);
      gainNode.connect(audioDest);

      sourceNode.start(0, opts.music.start ?? 0);
    } catch (e) {
      console.error("Chyba načítania hudby pri exporte:", e);
    }
  }

  // 3. Spojenie obrazu a zvuku do jedného spoločné streamu
  const canvasStream = canvas.captureStream(fps);
  const combinedStream = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...audioDest.stream.getAudioTracks()
  ]);

  // 4. MediaRecorder nahrá obraz aj zvuk naraz
  const recorder = new MediaRecorder(combinedStream, {
    mimeType: 'video/webm;codecs=vp9,opus'
  });s
  const recorder = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 8_000_000 } : undefined);
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

  const stopped = new Promise<void>((resolve) => { recorder.onstop = () => resolve(); });
  recorder.start(200);

  // Hudba beží v reálnom čase súbežne s vykresľovaním klipov (rovnako ako klipy samotné),
  // preto ju naplánujeme cez wall-clock časovače zodpovedajúce jej pozícii na časovej osi.
  const musicTimers: ReturnType<typeof setTimeout>[] = [];
  if (musicEl && opts.music) {
    const startMs = Math.max(0, opts.music.start * 1000);
    const stopMs = Math.max(startMs, (opts.music.start + opts.music.duration) * 1000);
    musicTimers.push(setTimeout(() => { musicEl?.play().catch(() => undefined); }, startMs));
    musicTimers.push(setTimeout(() => { musicEl?.pause(); }, stopMs));
  }

  const totalDuration = prepared.reduce((s, p) => s + p.duration, 0);
  let elapsedBefore = 0;

  const cssFilter = opts.filter ?? 'none';
  const transitions = opts.transitions ?? {};
  const zoom = opts.zoom ?? 1;
  const captions = opts.captions ?? [];
  const coverMode = opts.cover ?? false;
  const TR_DUR = 0.7;

  // snímka predchádzajúceho klipu (pre prechody)
  const prevCanvas = document.createElement('canvas');
  prevCanvas.width = width;
  prevCanvas.height = height;
  const prevCtx = prevCanvas.getContext('2d');
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
    ctx.filter = 'none';
    const fontSize = Math.max(18, Math.round(height * 0.045));
    ctx.font = `600 ${fontSize}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const metrics = ctx.measureText(line);
    const padX = fontSize * 0.7;
    const boxW = metrics.width + padX * 2;
    const boxH = fontSize * 1.9;
    const cx = width / 2;
    const cy = height - boxH * 1.1;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(cx - boxW / 2, cy - boxH / 2, boxW, boxH);
    ctx.fillStyle = '#fff';
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
      ctx.filter = 'none';
      ctx.drawImage(prevCanvas, 0, 0, width, height);
      ctx.restore();
    }
    ctx.save();
    let filter = cssFilter;
    switch (id) {
      case 'wipe-l':
        ctx.beginPath();
        ctx.rect(width * (1 - p), 0, width * p, height);
        ctx.clip();
        break;
      case 'wipe-r':
        ctx.beginPath();
        ctx.rect(0, 0, width * p, height);
        ctx.clip();
        break;
      case 'zoom-in': {
        ctx.globalAlpha = p;
        const s = 0.3 + 0.7 * p;
        ctx.translate(width / 2, height / 2); ctx.scale(s, s); ctx.translate(-width / 2, -height / 2);
        break;
      }
      case 'zoom-out': {
        ctx.globalAlpha = p;
        const s = 1.8 - 0.8 * p;
        ctx.translate(width / 2, height / 2); ctx.scale(s, s); ctx.translate(-width / 2, -height / 2);
        break;
      }
      case 'slide-l':
        ctx.translate(width * (1 - p), 0);
        break;
      case 'slide-r':
        ctx.translate(-width * (1 - p), 0);
        break;
      case 'rotate': {
        ctx.globalAlpha = p;
        const s = 0.4 + 0.6 * p;
        ctx.translate(width / 2, height / 2);
        ctx.rotate((-120 * (1 - p) * Math.PI) / 180);
        ctx.scale(s, s);
        ctx.translate(-width / 2, -height / 2);
        break;
      }
      case 'dissolve':
        ctx.globalAlpha = p;
        filter = `${cssFilter === 'none' ? '' : cssFilter} blur(${(6 * (1 - p)).toFixed(2)}px)`.trim();
        break;
      case 'flash':
        ctx.globalAlpha = p;
        filter = `${cssFilter === 'none' ? '' : cssFilter} brightness(${(1 + 5 * (1 - p)).toFixed(2)})`.trim();
        break;
      case 'blur':
        ctx.globalAlpha = p;
        filter = `${cssFilter === 'none' ? '' : cssFilter} blur(${(10 * (1 - p)).toFixed(2)}px)`.trim();
        break;
      case 'glitch':
        ctx.globalAlpha = p;
        ctx.transform(1, 0, Math.tan((18 * (1 - p) * Math.PI) / 180), 1, width * 0.12 * (1 - p), 0);
        break;
      case 'fade':
      default:
        ctx.globalAlpha = p;
        break;
    }
    ctx.filter = filter || 'none';
    if (zoom !== 1) {
      ctx.translate(width / 2, height / 2); ctx.scale(zoom, zoom); ctx.translate(-width / 2, -height / 2);
    }
    drawCover(ctx, media, width, height, coverMode);
    ctx.restore();
  };

  for (let i = 0; i < prepared.length; i++) {
    const item = prepared[i];
    const transitionId = i > 0 ? transitions[i] : undefined;
    const startWall = performance.now();
    const clipOpacity = clips[i]?.opacity ?? 1;
    if (item.kind === 'video') {
      const v = item.el;
      try { v.currentTime = 0; } catch { /* ignore */ }
      v.playbackRate = clips[i]?.speed ?? 1;
      await v.play().catch(() => undefined);
    }

    await new Promise<void>((resolve) => {
      const step = () => {
        const t = (performance.now() - startWall) / 1000;
        ctx.globalAlpha = 1;
        ctx.filter = 'none';
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, width, height);

        if (transitionId && t < TR_DUR) {
          const raw = Math.min(1, t / TR_DUR);
          const p = raw < 0.5 ? 2 * raw * raw : 1 - Math.pow(-2 * raw + 2, 2) / 2; // easeInOut
          drawTransition(transitionId, p, item.el);
        } else {
          drawMedia(item.el, cssFilter, clipOpacity);
        }
        drawCaption(elapsedBefore + t);

        opts.onProgress?.(Math.min(99, Math.round(((elapsedBefore + t) / totalDuration) * 100)));

        const finished = item.kind === 'video' ? (t >= item.duration || item.el.ended) : t >= item.duration;
        if (finished) { resolve(); return; }
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });

    if (item.kind === 'video') item.el.pause();
    if (prevCtx) {
      prevCtx.clearRect(0, 0, width, height);
      prevCtx.drawImage(canvas, 0, 0);
      hasPrev = true;
    }
    elapsedBefore += item.duration;
  }


  recorder.stop();
  await stopped;
  stream.getTracks().forEach((t) => t.stop());
  musicTimers.forEach((id) => clearTimeout(id));
  if (musicEl) { musicEl.pause(); musicEl.src = ''; }
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
