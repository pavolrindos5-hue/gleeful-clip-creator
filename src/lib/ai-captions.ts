// Reálne AI titulky – rozpoznávanie reči priamo v prehliadači (Whisper cez
// transformers.js). Žiadny server, žiadny API kľúč, žiadne Lovable AI credity.
// Model sa stiahne raz (~40-80MB) a prehliadač si ho odteraz cachuje.

import { pipeline } from "@huggingface/transformers";

export type CaptionSegment = { text: string; start: number; end: number };

type AsrPipeline = (
  audio: Float32Array,
  options: Record<string, unknown>,
) => Promise<{ text: string; chunks?: { text: string; timestamp: [number, number] }[] }>;

let pipelinePromise: Promise<AsrPipeline> | null = null;

function getPipeline(onProgress?: (pct: number) => void): Promise<AsrPipeline> {
  if (!pipelinePromise) {
    pipelinePromise = pipeline("automatic-speech-recognition", "onnx-community/whisper-base", {
      // WASM funguje všade; ak je k dispozícii WebGPU, transformers.js si ho vyberie sám.
      progress_callback: (p: { status: string; progress?: number }) => {
        if (typeof p.progress === "number") onProgress?.(Math.round(p.progress * 0.6)); // stiahnutie modelu = 0-60 %
      },
    }) as unknown as Promise<AsrPipeline>;
  }
  return pipelinePromise;
}

// Načíta zvuk zo zdroja (video alebo audio súbor / blob URL) a prevzorkuje
// ho na mono 16kHz Float32Array, presne to, čo Whisper očakáva na vstupe.
async function decodeToMono16k(src: string): Promise<Float32Array> {
  const res = await fetch(src);
  const arrayBuf = await res.arrayBuffer();

  const AC: typeof AudioContext =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const probeCtx = new AC();
  let decoded: AudioBuffer;
  try {
    decoded = await probeCtx.decodeAudioData(arrayBuf.slice(0));
  } finally {
    await probeCtx.close().catch(() => undefined);
  }

  const OfflineCtx: typeof OfflineAudioContext =
    window.OfflineAudioContext ??
    (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext })
      .webkitOfflineAudioContext;
  const targetLength = Math.max(1, Math.ceil(decoded.duration * 16000));
  const offline = new OfflineCtx(1, targetLength, 16000);
  const srcNode = offline.createBufferSource();
  srcNode.buffer = decoded;
  srcNode.connect(offline.destination);
  srcNode.start();
  const rendered = await offline.startRendering();
  return rendered.getChannelData(0);
}

/**
 * Prepíše zvuk z daného zdroja (klip na časovej osi) na titulky s presným
 * časovaním. `language` je kód jazyka pre Whisper ("slovak", "czech", "english"...).
 */
export async function transcribeClip(
  src: string,
  options?: { language?: string; onProgress?: (pct: number) => void },
): Promise<CaptionSegment[]> {
  const onProgress = options?.onProgress;
  onProgress?.(1);
  const asr = await getPipeline(onProgress);
  onProgress?.(65);
  const audio = await decodeToMono16k(src);
  onProgress?.(75);

  const result = await asr(audio, {
    language: options?.language ?? "slovak",
    task: "transcribe",
    return_timestamps: true,
    chunk_length_s: 30,
    stride_length_s: 5,
  });
  onProgress?.(98);

  const chunks = result.chunks ?? [];
  const segments: CaptionSegment[] = chunks
    .map((c) => ({
      text: (c.text ?? "").trim(),
      start: Array.isArray(c.timestamp) ? Number(c.timestamp[0] ?? 0) : 0,
      end: Array.isArray(c.timestamp) ? Number(c.timestamp[1] ?? 0) : 0,
    }))
    .filter((s) => s.text.length > 0);

  onProgress?.(100);
  return segments;
}
