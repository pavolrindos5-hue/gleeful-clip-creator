import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence, type TargetAndTransition } from 'framer-motion';
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
  Scissors, Wand2, Sparkles, Layers, Clock, Download,
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCcw, Sliders,
  Film, Music, Type, Crop, Sun, Contrast, Palette,
  Wind, Zap, Plus, Trash2, Check, X,
  Maximize2, AlignLeft, PanelRightClose, PanelRightOpen,
  Headphones, FileMusic, Shuffle, SlidersHorizontal,
} from 'lucide-react';


interface VideoEditorProps {
  videoUrl: string | null;
  videoName: string | null;
  isImage?: boolean;
}

type AITool = 'enhance' | 'denoise' | 'stabilize' | 'colorgrade' | 'captions' | null;
type ActivePanel = 'clips' | 'effects' | 'audio' | 'text' | 'ai';
type LeftTool = 'select' | 'cut' | 'crop' | 'layers' | 'speed' | 'presets' | 'transitions' | 'effects';

type TimelineClip = {
  id: number;
  label: string;
  color: string;
  duration: number;
  type?: 'video' | 'image';
  thumbUrl?: string;
  src?: string;
};

type MusicClip = { id: number; label: string };


const AI_TOOLS = [
  { id: 'enhance',    label: 'Auto Enhance',    icon: Sparkles, desc: 'AI analyzuje každý snímok a automaticky vylepší jas, kontrast a ostrosť', detail: 'Využíva neurónové siete trénované na 10 miliónoch videí' },
  { id: 'denoise',    label: 'AI Denoising',    icon: Wind,     desc: 'Odstraňuje digitálny šum a zrno pomocou hlbokého učenia', detail: 'Rozlišuje skutočný obsah od šumu s presnosťou 98.7%' },
  { id: 'stabilize',  label: 'AI Stabilizácia',  icon: Zap,     desc: 'Opravuje trasenie kamery v reálnom čase bez čiernych okrajov', detail: 'Predpovedá pohyb 5 snímkov dopredu pre plynulý výsledok' },
  { id: 'colorgrade', label: 'Color Grade',     icon: Palette, desc: 'Profesionálna farebná korekcia štýlom filmových štúdií', detail: 'Trénované na filmoch z Hollywoodu, Bollywoodu a Kórey' },
  { id: 'captions',   label: 'AI Titulky',       icon: Type,     desc: 'Automatické rozpoznávanie reči a generovanie titulkov', detail: 'Podporuje 50+ jazykov vrátane slovenčiny s 95% presnosťou' },
] as const;

const SUBTITLE_LINES = [
  'Vitajte v AI Video Editore',
  'Naše AI automaticky rozpoznáva reč',
  'a pridáva titulky v reálnom čase.',
  'Podporuje slovenčinu a 50 ďalších jazykov.',
  'Presnosť rozpoznávania: 95 %',
];

const CLIP_COLORS = [
  'from-violet-600 to-purple-500',
  'from-fuchsia-600 to-pink-500',
  'from-indigo-600 to-violet-500',
  'from-cyan-600 to-blue-500',
];

const TRANSITIONS = [
  { id: 'fade', label: 'Fade', emoji: '◐' },
  { id: 'wipe-l', label: 'Stieranie ←', emoji: '◁' },
  { id: 'wipe-r', label: 'Stieranie →', emoji: '▷' },
  { id: 'zoom-in', label: 'Zoom In', emoji: '⊕' },
  { id: 'zoom-out', label: 'Zoom Out', emoji: '⊖' },
  { id: 'slide-l', label: 'Posun ←', emoji: '⇐' },
  { id: 'slide-r', label: 'Posun →', emoji: '⇒' },
  { id: 'rotate', label: 'Otočenie', emoji: '↺' },
  { id: 'dissolve', label: 'Rozpustenie', emoji: '⋯' },
  { id: 'flash', label: 'Záblesk', emoji: '⚡' },
  { id: 'blur', label: 'Rozostrenie', emoji: '◌' },
  { id: 'glitch', label: 'Glitch', emoji: '▒' },
] as const;

const LEFT_TOOLS: { id: LeftTool; icon: React.ElementType; label: string; desc: string }[] = [
  { id: 'select',      icon: Wand2,             label: 'Výber',      desc: 'Vyber a presuň klipy' },
  { id: 'cut',         icon: Scissors,          label: 'Strih',      desc: 'Rozrezaj klip na mieste prehrávania' },
  { id: 'crop',        icon: Crop,              label: 'Orez',       desc: 'Orezaj okraje videa' },
  { id: 'layers',      icon: Layers,            label: 'Vrstvy',     desc: 'Spravuj vrstvy a priehľadnosť' },
  { id: 'speed',       icon: Clock,             label: 'Rýchlosť',   desc: 'Zrýchli alebo spomaľ video' },
  { id: 'presets',     icon: Sparkles,          label: 'Predvoľby',  desc: 'Rýchle štýlové predvoľby' },
  { id: 'transitions', icon: Shuffle,           label: 'Prechody',   desc: 'Pridaj prechody medzi klipy' },
  { id: 'effects',     icon: SlidersHorizontal, label: 'Efekty',     desc: 'Farby a vizuálne efekty' },
];

const WAVEFORM = Array.from({ length: 50 }, () => Math.random() * 70 + 20);

const PX_PER_SEC = 8;
const GAP_W = 20;

const INTRO_TEMPLATES = [
  { label: 'INTRO', color: 'from-primary to-primary/70', overlay: { subtitle: 'Predstavuje', bg: 'from-black via-primary/30 to-black' } },
  { label: 'INTRO', color: 'from-cyan-600 to-blue-500', overlay: { subtitle: 'Predstavuje', bg: 'from-black via-cyan-500/30 to-black' } },
  { label: 'INTRO', color: 'from-amber-500 to-orange-500', overlay: { subtitle: 'Predstavuje', bg: 'from-black via-amber-500/30 to-black' } },
  { label: 'INTRO', color: 'from-emerald-500 to-green-600', overlay: { subtitle: 'Predstavuje', bg: 'from-black via-emerald-500/30 to-black' } },
  { label: 'INTRO', color: 'from-rose-500 to-pink-600', overlay: { subtitle: 'Predstavuje', bg: 'from-black via-rose-500/30 to-black' } },
];

// ── Živá ukážka prechodu (ako v PowerDirectore) ──
const TRANSITION_ANIM: Record<string, { initial: TargetAndTransition; animate: TargetAndTransition }> = {
  'fade':      { initial: { opacity: 0 },                          animate: { opacity: 1 } },
  'wipe-l':    { initial: { clipPath: 'inset(0 0 0 100%)' },       animate: { clipPath: 'inset(0 0 0 0%)' } },
  'wipe-r':    { initial: { clipPath: 'inset(0 100% 0 0)' },       animate: { clipPath: 'inset(0 0% 0 0)' } },
  'zoom-in':   { initial: { scale: 0.3, opacity: 0 },              animate: { scale: 1, opacity: 1 } },
  'zoom-out':  { initial: { scale: 1.8, opacity: 0 },              animate: { scale: 1, opacity: 1 } },
  'slide-l':   { initial: { x: '100%' },                           animate: { x: '0%' } },
  'slide-r':   { initial: { x: '-100%' },                          animate: { x: '0%' } },
  'rotate':    { initial: { rotate: -120, scale: 0.4, opacity: 0 }, animate: { rotate: 0, scale: 1, opacity: 1 } },
  'dissolve':  { initial: { opacity: 0, filter: 'blur(6px)' },     animate: { opacity: 1, filter: 'blur(0px)' } },
  'flash':     { initial: { opacity: 0, filter: 'brightness(6)' }, animate: { opacity: 1, filter: 'brightness(1)' } },
  'blur':      { initial: { opacity: 0, filter: 'blur(10px)' },    animate: { opacity: 1, filter: 'blur(0px)' } },
  'glitch':    { initial: { opacity: 0, x: '12%', skewX: 18 },     animate: { opacity: 1, x: '0%', skewX: 0 } },
};

function TransitionPreview({ id }: { id: string }) {
  const anim = TRANSITION_ANIM[id] ?? TRANSITION_ANIM.fade;
  return (
    <div className="relative w-full aspect-video rounded-md overflow-hidden bg-gradient-to-br from-violet-700 to-indigo-600">
      <div className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-white/70">A</div>
      <motion.div
        className="absolute inset-0 bg-gradient-to-br from-fuchsia-500 to-amber-400 flex items-center justify-center text-[8px] font-bold text-black/60"
        initial={anim.initial}
        animate={anim.animate}
        transition={{ duration: 0.9, ease: 'easeInOut', repeat: Infinity, repeatType: 'reverse', repeatDelay: 0.35 }}
      >
        B
      </motion.div>
    </div>
  );
}

export default function VideoEditor({ videoUrl, videoName, isImage = false }: VideoEditorProps) {
  const [isPlaying, setIsPlaying]       = useState(false);
  const [isMuted, setIsMuted]           = useState(false);
  const [currentTime, setCurrentTime]  = useState(0);
  const [activePanel, setActivePanel]  = useState<ActivePanel>('ai');
  const [activeTool, setActiveTool]    = useState<AITool>(null);
  const [toolProgress, setToolProgress] = useState<Record<string, number>>({});
  const [appliedTools, setAppliedTools] = useState<Set<string>>(new Set());
  const [sliders, setSliders]          = useState({ jas: 50, kontrast: 50, sytost: 50 });
  const [timelineZoom, setTimelineZoom] = useState(1);
  const [leftTool, setLeftTool]         = useState<LeftTool>('select');
  const [subtitleIdx, setSubtitleIdx]   = useState(0);
  const [showCropOverlay, setShowCropOverlay] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [volume, setVolume]             = useState(80);
  const [tooltipTool, setTooltipTool]   = useState<LeftTool | null>(null);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [showMusicModal, setShowMusicModal] = useState(false);
  const [clipTransitions, setClipTransitions] = useState<Record<number, string>>({});
  const [selectedGap, setSelectedGap]   = useState<number | null>(null);
  const [selectedClipId, setSelectedClipId] = useState<number | null>(null);
  const [selectedMusicId, setSelectedMusicId] = useState<number | null>(null);
  const [musicClips, setMusicClips]     = useState<MusicClip[]>([]);
  const [dragState, setDragState]       = useState<{ clipId: number; startX: number; currentX: number } | null>(null);
  const [isScrubbing, setIsScrubbing]   = useState(false);
  const [introOverlay, setIntroOverlay] = useState<{ title: string; subtitle: string; bg: string } | null>(null);
  const [outroOverlay, setOutroOverlay] = useState<{ title: string } | null>(null);
  const [introCount, setIntroCount] = useState(0);

  // Prehrávaný prechod v náhľade
  const [playingTransition, setPlayingTransition] = useState<{ id: string; key: number } | null>(null);
  const playTransitionPreview = useCallback((id: string) => {
    setPlayingTransition({ id, key: Date.now() });
  }, []);


  const [timelineClips, setTimelineClips] = useState<TimelineClip[]>(() => [{
    id: 1,
    label: videoName ?? 'Klip 1',
    color: 'from-violet-600 to-purple-500',
    duration: 60,
    type: isImage ? 'image' : 'video',
    thumbUrl: isImage ? (videoUrl ?? undefined) : undefined,
    src: videoUrl ?? undefined,
  }]);

  const videoRef      = useRef<HTMLVideoElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const musicAudioRef = useRef<HTMLInputElement>(null);
  const timelineTrackRef = useRef<HTMLDivElement>(null);
  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const prevClipCountRef = useRef(0);


  const totalDuration = timelineClips.reduce((s, c) => s + c.duration, 0);
  const duration = totalDuration;
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Klip, ktorý je práve pod prehrávacou hlavou (určuje veľkú ukážku)
  const { activeClip, activeClipStart, activeClipIndex } = useMemo(() => {
    let cum = 0;
    for (let i = 0; i < timelineClips.length; i++) {
      const c = timelineClips[i];
      if (currentTime >= cum && currentTime < cum + c.duration) return { activeClip: c, activeClipStart: cum, activeClipIndex: i };
      cum += c.duration;
    }
    const last = timelineClips[timelineClips.length - 1];
    return { activeClip: last ?? null, activeClipStart: Math.max(0, cum - (last?.duration ?? 0)), activeClipIndex: Math.max(0, timelineClips.length - 1) };
  }, [timelineClips, currentTime]);
  const prevClipIndexRef = useRef(activeClipIndex);


  const previewClip = activeClip && activeClip.src ? activeClip : (timelineClips.find(c => c.src) ?? null);

  const addMediaFile = useCallback((file: File) => {
    const isImg = file.type.startsWith('image/');
    const isVid = file.type.startsWith('video/') || /\.(mp4|mov|webm|avi|mkv|m4v|wmv|flv|3gp)$/i.test(file.name);
    if (!isImg && !isVid) { alert('Nepodporovaný formát. Použi video alebo obrázok.'); return; }
    const url = URL.createObjectURL(file);
    const color = CLIP_COLORS[Math.floor(Math.random() * CLIP_COLORS.length)];
    const push = (dur: number) => setTimelineClips(prev => [...prev, {
      id: Date.now() + Math.floor(Math.random() * 1000),
      label: file.name.replace(/\.[^/.]+$/, ''),
      color,
      duration: dur,
      type: isImg ? 'image' : 'video',
      thumbUrl: isImg ? url : undefined,
      src: url,
    }]);
    if (isImg) { push(5); return; }
    const probe = document.createElement('video');
    probe.preload = 'metadata';
    probe.onloadedmetadata = () => push(Math.max(1, Math.round(probe.duration || 10)));
    probe.onerror = () => push(10);
    probe.src = url;
  }, []);

  // Spusti prechod v náhľade, keď playhead prejde na ďalší klip s prechodom
  useEffect(() => {
    if (prevClipIndexRef.current === activeClipIndex) return;
    prevClipIndexRef.current = activeClipIndex;
    const t = clipTransitions[activeClipIndex];
    if (t) setPlayingTransition({ id: t, key: Date.now() });
  }, [activeClipIndex, clipTransitions]);

  // Po dobehnutí animácie prechod ukonči
  useEffect(() => {
    if (!playingTransition) return;
    const t = setTimeout(() => setPlayingTransition(null), 800);
    return () => clearTimeout(t);
  }, [playingTransition]);


  useEffect(() => {
    if (!isPlaying || previewClip?.type === 'video') return;
    const id = setInterval(() => {
      setCurrentTime(t => {
        if (t + 0.1 >= totalDuration) { setIsPlaying(false); return 0; }
        return t + 0.1;
      });
    }, 100);
    return () => clearInterval(id);
  }, [isPlaying, totalDuration, previewClip]);

  useEffect(() => {
    if (!appliedTools.has('captions')) return;
    const id = setInterval(() => setSubtitleIdx(i => (i + 1) % SUBTITLE_LINES.length), 3000);
    return () => clearInterval(id);
  }, [appliedTools]);

  useEffect(() => { setShowCropOverlay(leftTool === 'crop'); }, [leftTool]);
  useEffect(() => { if (videoRef.current) videoRef.current.volume = volume / 100; }, [volume]);
  useEffect(() => { if (videoRef.current) videoRef.current.playbackRate = playbackRate; }, [playbackRate]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (selectedClipId !== null) {
        setTimelineClips(prev => prev.filter(c => c.id !== selectedClipId));
        setSelectedClipId(null);
      } else if (selectedMusicId !== null) {
        setMusicClips(prev => prev.filter(c => c.id !== selectedMusicId));
        setSelectedMusicId(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedClipId, selectedMusicId]);

  const togglePlay = () => {
    if (isImage) { setIsPlaying(p => !p); return; }
    if (!videoRef.current) { setIsPlaying(p => !p); return; }
    if (isPlaying) videoRef.current.pause();
    else videoRef.current.play();
    setIsPlaying(p => !p);
  };

  const handleTimeUpdate = () => { if (videoRef.current && !isScrubbing) setCurrentTime(activeClipStart + videoRef.current.currentTime); };

  useEffect(() => {
    if (introOverlay && currentTime > 3) setIntroOverlay(null);
    if (outroOverlay && duration > 0 && currentTime < duration - 3) setOutroOverlay(null);
  }, [currentTime, introOverlay, outroOverlay, duration]);

  const seekTo = useCallback((time: number) => {
    const clamped = Math.max(0, Math.min(time, duration));
    setCurrentTime(clamped);
    if (videoRef.current) {
      let cum = 0;
      for (const c of timelineClips) {
        if (clamped >= cum && clamped < cum + c.duration) break;
        cum += c.duration;
      }
      videoRef.current.currentTime = Math.max(0, clamped - cum);
    }
  }, [duration, timelineClips]);

  // ── Automatické posúvanie časovej osi pri ťahaní k okraju ──
  const autoScrollRaf = useRef<number | null>(null);
  const autoScrollX = useRef(0);
  const autoScrollTick = useRef<((clientX: number) => void) | null>(null);

  const stopEdgeAutoScroll = useCallback(() => {
    if (autoScrollRaf.current !== null) { cancelAnimationFrame(autoScrollRaf.current); autoScrollRaf.current = null; }
    autoScrollTick.current = null;
  }, []);

  const edgeAutoScroll = useCallback((clientX: number, onTick?: (clientX: number) => void) => {
    autoScrollX.current = clientX;
    if (onTick) autoScrollTick.current = onTick;
    if (autoScrollRaf.current !== null) return;
    const EDGE = 70, MAX_SPEED = 22;
    const step = () => {
      const el = timelineScrollRef.current;
      if (!el) { autoScrollRaf.current = null; return; }
      const rect = el.getBoundingClientRect();
      const x = autoScrollX.current;
      let dx = 0;
      if (x < rect.left + EDGE) dx = -MAX_SPEED * Math.min(1, (rect.left + EDGE - x) / EDGE);
      else if (x > rect.right - EDGE) dx = MAX_SPEED * Math.min(1, (x - (rect.right - EDGE)) / EDGE);
      if (dx !== 0) {
        const before = el.scrollLeft;
        el.scrollLeft = Math.max(0, Math.min(el.scrollWidth - el.clientWidth, before + dx));
        // aj keď myš stojí na okraji, pokračujeme v úprave (playhead / trim / drag)
        if (el.scrollLeft !== before) autoScrollTick.current?.(x);
      }
      autoScrollRaf.current = requestAnimationFrame(step);
    };
    autoScrollRaf.current = requestAnimationFrame(step);
  }, []);

  useEffect(() => stopEdgeAutoScroll, [stopEdgeAutoScroll]);


  // ── Draggable playhead ──

  const handlePlayheadMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsScrubbing(true);
    if (isPlaying) { setIsPlaying(false); if (videoRef.current) videoRef.current.pause(); }

    const track = timelineTrackRef.current;
    if (!track) return;

    const updateFromX = (clientX: number) => {
      const rect = track.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      seekTo(pct * duration);
    };

    updateFromX(e.clientX);

    const onMove = (ev: MouseEvent) => { updateFromX(ev.clientX); edgeAutoScroll(ev.clientX, updateFromX); };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      stopEdgeAutoScroll();
      setIsScrubbing(false);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [duration, seekTo, isPlaying, edgeAutoScroll, stopEdgeAutoScroll]);

  const handleTimelineTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    seekTo(pct * duration);
  };

  const runAITool = (toolId: string) => {
    if (appliedTools.has(toolId) || activeTool === toolId) return;
    setActiveTool(toolId as AITool);
    setToolProgress(p => ({ ...p, [toolId]: 0 }));
    const start = Date.now();
    const tick = () => {
      const pct = Math.min((Date.now() - start) / 2500, 1);
      setToolProgress(p => ({ ...p, [toolId]: Math.round(pct * 100) }));
      if (pct < 1) requestAnimationFrame(tick);
      else {
        setAppliedTools(s => new Set(s).add(toolId));
        setActiveTool(null);
        if (toolId === 'captions') setSubtitleIdx(0);
      }
    };
    requestAnimationFrame(tick);
  };

  const handleCut = () => {
    let cumDur = 0, targetIdx = -1, splitOffset = 0;
    for (let i = 0; i < timelineClips.length; i++) {
      const c = timelineClips[i];
      if (currentTime >= cumDur && currentTime < cumDur + c.duration) { targetIdx = i; splitOffset = currentTime - cumDur; break; }
      cumDur += c.duration;
    }
    if (targetIdx === -1 || splitOffset < 0.5 || splitOffset > timelineClips[targetIdx].duration - 0.5) return;
    const src = timelineClips[targetIdx];
    const partA: TimelineClip = { ...src, duration: splitOffset };
    const partB: TimelineClip = { ...src, id: Date.now(), label: src.label + ' B', duration: src.duration - splitOffset };
    setTimelineClips(prev => { const n = [...prev]; n.splice(targetIdx, 1, partA, partB); return n; });
  };

  const handleClipMouseDown = (clipId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const startX = e.clientX;
    let didDrag = false;
    const onMove = (ev: MouseEvent) => { if (!didDrag && Math.abs(ev.clientX - startX) > 6) didDrag = true; if (didDrag) { const upd = (x: number) => setDragState({ clipId, startX, currentX: x }); upd(ev.clientX); edgeAutoScroll(ev.clientX, upd); } };
    const onUp = (ev: MouseEvent) => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      stopEdgeAutoScroll();
      if (didDrag) {
        const track = timelineTrackRef.current;
        if (track) {
          const rect = track.getBoundingClientRect();
          const relX = ev.clientX - rect.left;
          let cum = 0, insertIdx = timelineClips.length;
          for (let i = 0; i < timelineClips.length; i++) {
            const cw = Math.round(timelineClips[i].duration * PX_PER_SEC * timelineZoom);
            if (relX < cum + cw / 2) { insertIdx = i; break; }
            cum += cw + (i < timelineClips.length - 1 ? GAP_W : 0);
          }
          setTimelineClips(prev => {
            const fromIdx = prev.findIndex(c => c.id === clipId);
            if (fromIdx === -1) return prev;
            const adj = insertIdx > fromIdx ? insertIdx - 1 : insertIdx;
            const n = [...prev]; const [rem] = n.splice(fromIdx, 1); n.splice(adj, 0, rem); return n;
          });
        }
        setDragState(null);
      } else {
        setSelectedClipId(prev => (prev === clipId ? null : clipId));
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const handleTrimEnd = (clipId: number, e: React.MouseEvent) => {
    e.stopPropagation(); e.preventDefault();
    const startX = e.clientX;
    const startDur = timelineClips.find(c => c.id === clipId)!.duration;
    const onMove = (ev: MouseEvent) => {
      const upd = (x: number) => {
        const delta = (x - startX) / (PX_PER_SEC * timelineZoom);
        setTimelineClips(prev => prev.map(c => c.id === clipId ? { ...c, duration: Math.max(1, startDur + delta) } : c));
      };
      upd(ev.clientX);
      edgeAutoScroll(ev.clientX, upd);
    };
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); stopEdgeAutoScroll(); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const handleTrimStart = (clipId: number, e: React.MouseEvent) => {
    e.stopPropagation(); e.preventDefault();
    const startX = e.clientX;
    const startDur = timelineClips.find(c => c.id === clipId)!.duration;
    const onMove = (ev: MouseEvent) => {
      const upd = (x: number) => {
        const delta = (x - startX) / (PX_PER_SEC * timelineZoom);
        setTimelineClips(prev => prev.map(c => c.id === clipId ? { ...c, duration: Math.max(1, startDur - delta) } : c));
      };
      upd(ev.clientX);
      edgeAutoScroll(ev.clientX, upd);
    };
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); stopEdgeAutoScroll(); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };


  const formatTime = (s: number) => { const m = Math.floor(s / 60); const sec = Math.floor(s % 60); return `${m}:${sec.toString().padStart(2, '0')}`; };

  // Po pridaní nového klipu posunieme časovú os na koniec, aby bol viditeľný
  useEffect(() => {
    const el = timelineScrollRef.current;
    if (el && timelineClips.length > prevClipCountRef.current) {
      requestAnimationFrame(() => { el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' }); });
    }
    prevClipCountRef.current = timelineClips.length;
  }, [timelineClips.length]);

  const videoFilter = useMemo(() => {

    const filters: string[] = [];
    // Manuálne posuvníky (50 = neutrálna hodnota)
    if (sliders.jas !== 50)      filters.push(`brightness(${(sliders.jas / 50).toFixed(2)})`);
    if (sliders.kontrast !== 50) filters.push(`contrast(${(sliders.kontrast / 50).toFixed(2)})`);
    if (sliders.sytost !== 50)   filters.push(`saturate(${(sliders.sytost / 50).toFixed(2)})`);
    if (appliedTools.has('denoise'))    filters.push('contrast(1.08) saturate(1.12)');
    if (appliedTools.has('enhance'))    filters.push('brightness(1.05) contrast(1.06)');
    if (appliedTools.has('colorgrade')) filters.push('saturate(1.3) hue-rotate(5deg)');
    return filters.join(' ') || undefined;
  }, [appliedTools, sliders]);

  // ── Reálny export videa (canvas + MediaRecorder) ──
  const [exporting, setExporting] = useState(false);
  const [exportPct, setExportPct] = useState(0);

  const handleExport = useCallback(async () => {
    if (exporting) return;
    const clips = timelineClips.filter(c => c.src);
    if (!clips.length) { alert('Najprv nahraj video alebo obrázok.'); return; }
    setExporting(true);
    setExportPct(0);
    try {
      setIsPlaying(false);
      const { exportTimeline, downloadBlob } = await import('@/lib/video-export');
      const { blob, ext } = await exportTimeline({
        clips: clips.map(c => ({ src: c.src, type: c.type, duration: c.duration })),
        filter: videoFilter,
        onProgress: setExportPct,
      });
      const base = (videoName || 'export').replace(/\.[^/.]+$/, '');
      downloadBlob(blob, `${base}-export.${ext}`);
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'Export zlyhal.');
    } finally {
      setExporting(false);
      setExportPct(0);
    }
  }, [exporting, timelineClips, videoFilter, videoName]);







  const panelTabs: { id: ActivePanel; label: string; icon: React.ElementType }[] = [
    { id: 'ai',      label: 'AI',      icon: Sparkles },
    { id: 'clips',   label: 'Klipy',   icon: Film },
    { id: 'effects', label: 'Efekty',  icon: Sliders },
    { id: 'audio',   label: 'Zvuk',    icon: Music },
    { id: 'text',    label: 'Text',    icon: Type },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }} className="flex flex-col h-[100dvh] bg-background text-foreground font-sans overflow-hidden">

      {/* Top Bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-primary/10 bg-card/60 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-2">
          <button onClick={() => window.location.reload()} className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-primary/10">
            <ChevronLeft className="w-4 h-4" /><span className="text-xs hidden sm:inline">Späť</span>
          </button>
          <div className="w-px h-4 bg-border hidden sm:block" />
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px] shadow-primary/80 animate-pulse" />
            <span className="text-sm font-semibold truncate max-w-[140px] sm:max-w-[220px]">{videoName ?? 'Bez názvu'}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex gap-1">
            {[...appliedTools].map(t => { const tool = AI_TOOLS.find(x => x.id === t); return tool ? (
              <span key={t} className="text-[10px] font-bold bg-primary/15 text-primary px-2 py-0.5 rounded-full border border-primary/20 flex items-center gap-1">
                <Check className="w-2.5 h-2.5" /> {tool.label}
              </span>
            ) : null; })}
          </div>
          <button onClick={handleExport} disabled={exporting}
            className="flex items-center gap-1.5 bg-primary hover:bg-primary/90 disabled:opacity-70 text-primary-foreground text-xs font-bold px-3 py-2 rounded-xl transition-all hover:scale-105 shadow-[0_0_20px_-5px_rgba(124,58,237,0.6)]">
            <Download className={`w-3.5 h-3.5 ${exporting ? 'animate-pulse' : ''}`} />
            <span>{exporting ? `Exportujem ${exportPct}%` : 'Exportovať'}</span>
          </button>

        </div>
      </div>

      {/* Main Area */}
      <div className="flex flex-1 overflow-hidden min-h-0 relative">

        {/* Left Tool Sidebar */}
        <div className="w-11 sm:w-13 flex flex-col items-center gap-1 py-2 border-r border-primary/10 bg-card/40 backdrop-blur-md shrink-0 relative">
          {LEFT_TOOLS.map(({ id, icon: Icon, label, desc }) => (
            <div key={id} className="relative group/tip">
              <button onClick={() => { setLeftTool(id); if (id === 'cut') handleCut(); }} onMouseEnter={() => setTooltipTool(id)} onMouseLeave={() => setTooltipTool(null)} title={label}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${leftTool === id ? 'bg-primary/20 text-primary shadow-[0_0_10px_-2px_rgba(124,58,237,0.5)]' : 'text-muted-foreground hover:text-primary hover:bg-primary/10'}`}>
                <Icon className="w-4 h-4" />
              </button>
              <AnimatePresence>
                {tooltipTool === id && (
                  <motion.div initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50 pointer-events-none">
                    <div className="bg-card border border-primary/20 rounded-lg px-2.5 py-1.5 shadow-xl whitespace-nowrap">
                      <p className="text-xs font-semibold text-foreground">{label}</p>
                      <p className="text-[10px] text-muted-foreground max-w-[160px] whitespace-normal">{desc}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}




          <div className="mt-auto mb-1 relative group/tip">
            <button onClick={() => setShowMusicModal(true)} title="Pridať hudbu"
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-all text-muted-foreground hover:text-primary hover:bg-primary/10">
              <Headphones className="w-4 h-4" />
            </button>
          </div>

          <AnimatePresence>
            {leftTool === 'speed' && (
              <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="absolute bottom-12 left-1 right-1">
                <div className="bg-card border border-primary/30 rounded-lg p-1 text-center">
                  <p className="text-[8px] text-muted-foreground mb-1">Rýchlosť</p>
                  {[0.5, 1, 1.5, 2].map(r => (
                    <button key={r} onClick={() => setPlaybackRate(r)} className={`w-full text-[9px] py-0.5 rounded mb-0.5 font-bold transition-all ${playbackRate === r ? 'bg-primary text-white' : 'text-muted-foreground hover:text-primary'}`}>{r}×</button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Transitions panel */}
        <AnimatePresence>
          {leftTool === 'transitions' && (
            <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.18 }}
              className="absolute left-11 top-0 z-30 w-64 bg-card border border-primary/20 rounded-r-xl rounded-b-xl shadow-2xl p-3 overflow-y-auto max-h-[75vh]">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Prechody</p>
                <button onClick={() => setLeftTool('select')} className="text-muted-foreground hover:text-foreground p-0.5"><X className="w-3.5 h-3.5" /></button>
              </div>
              {selectedGap === null ? (
                <p className="text-[9px] text-primary/70 bg-primary/5 border border-primary/15 rounded-lg px-2 py-1.5 mb-2">Klikni na <span className="font-bold">∿</span> medzi klipmi v časovej osi</p>
              ) : (
                <p className="text-[9px] text-green-400/80 bg-green-400/5 border border-green-400/15 rounded-lg px-2 py-1.5 mb-2">Prechod pred klipom <span className="font-bold">{selectedGap + 1}</span></p>
              )}
              <div className="grid grid-cols-3 gap-1.5">
                {TRANSITIONS.map(t => {
                  const isActive = selectedGap !== null && clipTransitions[selectedGap] === t.id;
                  return (
                    <button key={t.id} onClick={() => { playTransitionPreview(t.id); if (selectedGap !== null) { setClipTransitions(prev => prev[selectedGap] === t.id ? Object.fromEntries(Object.entries(prev).filter(([k]) => Number(k) !== selectedGap)) : { ...prev, [selectedGap]: t.id }); } }}
                      className={`flex flex-col items-center gap-1 p-1 rounded-lg border text-center transition-all ${isActive ? 'border-primary bg-primary/20 text-primary shadow-[0_0_8px_-2px_rgba(124,58,237,0.5)]' : 'border-primary/10 bg-card/60 hover:border-primary/40 hover:bg-primary/5 text-muted-foreground'}`} title={t.label}>
                      <TransitionPreview id={t.id} />
                      <span className="text-[7px] leading-tight w-full truncate">{t.label}</span>
                    </button>
                  );
                })}
              </div>

            </motion.div>
          )}
        </AnimatePresence>

        {/* Effects panel */}
        <AnimatePresence>
          {leftTool === 'effects' && (
            <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.18 }}
              className="absolute left-11 top-0 z-30 w-52 bg-card border border-primary/20 rounded-r-xl rounded-b-xl shadow-2xl p-3 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Efekty</p>
                <button onClick={() => setLeftTool('select')} className="text-muted-foreground hover:text-foreground p-0.5"><X className="w-3.5 h-3.5" /></button>
              </div>
              {(['jas', 'kontrast', 'sytost'] as const).map(key => {
                const labels: Record<string, string> = { jas: 'Jas', kontrast: 'Kontrast', sytost: 'Sýtosť' };
                const icons: Record<string, React.ElementType> = { jas: Sun, kontrast: Contrast, sytost: Palette };
                const Icon = icons[key];
                return (
                  <div key={key} className="space-y-1.5">
                    <div className="flex items-center justify-between"><div className="flex items-center gap-1.5 text-xs font-medium"><Icon className="w-3 h-3 text-primary" />{labels[key]}</div><span className="text-[10px] font-mono text-primary">{sliders[key]}</span></div>
                    <input type="range" min={0} max={100} value={sliders[key]} onChange={e => setSliders(s => ({ ...s, [key]: Number(e.target.value) }))} className="w-full accent-violet-500 cursor-pointer" />
                  </div>
                );
              })}
              <div className="pt-1 border-t border-primary/10 space-y-1.5">
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider">AI filtre</p>
                {AI_TOOLS.filter(t => ['enhance','denoise','colorgrade'].includes(t.id)).map(({ id, label, icon: Icon }) => {
                  const isApplied = appliedTools.has(id);
                  return (
                    <button key={id} onClick={() => runAITool(id)} className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all ${isApplied ? 'border-green-500/40 bg-green-500/10 text-green-400' : 'border-primary/15 bg-card/60 hover:border-primary/40 text-muted-foreground hover:text-primary'}`}>
                      {isApplied ? <Check className="w-3 h-3" /> : <Icon className="w-3 h-3" />}{label}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Center: Video Preview */}
        <div className="flex-1 flex flex-col bg-black relative overflow-hidden min-w-0" onClick={leftTool === 'cut' ? handleCut : undefined} style={{ cursor: leftTool === 'cut' ? 'crosshair' : leftTool === 'crop' ? 'nwse-resize' : 'default' }}>
          <div className="flex-1 relative overflow-hidden min-h-0">
            {previewClip?.src ? (
              <motion.div
                key={playingTransition ? `tr-${playingTransition.key}` : 'media'}
                className="absolute inset-0"
                initial={playingTransition ? (TRANSITION_ANIM[playingTransition.id] ?? TRANSITION_ANIM.fade).initial : false}
                animate={playingTransition ? (TRANSITION_ANIM[playingTransition.id] ?? TRANSITION_ANIM.fade).animate : { opacity: 1 }}
                transition={{ duration: 0.7, ease: 'easeInOut' }}
              >
                {previewClip.type === 'image'
                  ? <img key={previewClip.id} src={previewClip.src} className="w-full h-full object-contain" style={{ filter: videoFilter }} alt={previewClip.label} />
                  : <video key={previewClip.id} ref={videoRef} src={previewClip.src} className="w-full h-full object-contain" style={{ filter: videoFilter }} onTimeUpdate={handleTimeUpdate} onEnded={() => setIsPlaying(false)} muted={isMuted} />}
              </motion.div>
            ) : (
              <div className="w-full h-full flex items-center justify-center"><div className="text-center space-y-3 opacity-40"><Film className="w-20 h-20 mx-auto text-primary/40" /><p className="text-muted-foreground text-sm">Žiadne video nevybrané</p></div></div>
            )}


            <AnimatePresence>
              {appliedTools.has('captions') && (
                <motion.div key={subtitleIdx} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.3 }}
                  className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-black/70 backdrop-blur-sm rounded-xl border border-white/10 max-w-[85%]">
                  <p className="text-white text-sm sm:text-base font-semibold text-center drop-shadow-md">{SUBTITLE_LINES[subtitleIdx]}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Intro overlay */}
            <AnimatePresence>
              {introOverlay && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}
                  className={`absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br ${introOverlay.bg} pointer-events-none`}
                >
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 20 }}
                    className="text-center"
                  >
                    <div className="w-16 h-1 bg-primary rounded-full mx-auto mb-4" />
                    <p className="text-white/60 text-xs uppercase tracking-[0.3em] mb-2">{introOverlay.subtitle}</p>
                    <h2 className="text-white text-3xl sm:text-5xl font-bold tracking-tight drop-shadow-2xl">{introOverlay.title}</h2>
                    <div className="w-16 h-1 bg-primary rounded-full mx-auto mt-4" />
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Outro overlay */}
            <AnimatePresence>
              {outroOverlay && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}
                  className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-black via-accent/30 to-black pointer-events-none"
                >
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 20 }}
                    className="text-center"
                  >
                    <div className="w-16 h-1 bg-accent rounded-full mx-auto mb-4" />
                    <h2 className="text-white text-3xl sm:text-5xl font-bold tracking-tight drop-shadow-2xl">{outroOverlay.title}</h2>
                    <p className="text-white/50 text-sm mt-3">Zostaň pri ďalšom videu</p>
                    <div className="w-16 h-1 bg-accent rounded-full mx-auto mt-4" />
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {showCropOverlay && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 pointer-events-none">
                  <div className="absolute inset-0 bg-black/40" />
                  <div className="absolute inset-[10%] border-2 border-white/70 rounded-sm shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
                    <p className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white/60 text-xs font-semibold">Orez aktívny</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {activeTool && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0.7, 1] }} className="absolute top-3 right-3 flex items-center gap-1.5 bg-violet-900/80 border border-violet-400/40 rounded-full px-3 py-1 text-xs text-violet-200 font-semibold">
                  <Sparkles className="w-3 h-3 animate-pulse" /> AI spracováva…
                </motion.div>
              )}
            </AnimatePresence>

            {appliedTools.size > 0 && (
              <div className="absolute top-2 left-2 flex gap-1 flex-wrap">
                {[...appliedTools].map(t => { const tool = AI_TOOLS.find(x => x.id === t); const Icon = tool?.icon; return tool && Icon ? (
                  <span key={t} className="text-[10px] font-bold bg-black/60 border border-primary/40 text-primary px-2 py-0.5 rounded-full flex items-center gap-1 backdrop-blur-sm">
                    <Icon className="w-2.5 h-2.5" /> {tool.label}
                  </span>
                ) : null; })}
              </div>
            )}
          </div>

          {/* Playback Controls */}
          <div className="shrink-0 px-3 py-2 bg-black/60 backdrop-blur-md border-t border-white/5">
            <div className="w-full h-1.5 bg-white/10 rounded-full cursor-pointer relative group mb-2" onClick={(e) => { const rect = e.currentTarget.getBoundingClientRect(); const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)); seekTo(pct * duration); }}>
              <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500" style={{ width: `${progress}%` }}>
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity -translate-x-1/2" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <button onClick={() => seekTo(0)} className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-all"><SkipBack className="w-3.5 h-3.5" /></button>
                <button onClick={togglePlay} className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white shadow-[0_0_15px_-3px_rgba(124,58,237,0.8)] hover:scale-110 transition-all">
                  {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 translate-x-0.5" />}
                </button>
                <button onClick={() => seekTo(duration)} className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-all"><SkipForward className="w-3.5 h-3.5" /></button>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setIsMuted(m => !m)} className="p-1.5 text-white/50 hover:text-white transition-all">{isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}</button>
                <input type="range" min={0} max={100} value={isMuted ? 0 : volume} onChange={e => { setVolume(Number(e.target.value)); setIsMuted(false); }} className="w-16 accent-violet-500 cursor-pointer hidden sm:block" />
              </div>
              {playbackRate !== 1 && <span className="text-[10px] font-bold text-fuchsia-400 bg-fuchsia-400/10 border border-fuchsia-400/30 px-1.5 py-0.5 rounded-full">{playbackRate}×</span>}
              <span className="ml-auto text-xs text-white/40 font-mono">{formatTime(currentTime)} / {formatTime(duration)}</span>
              <button onClick={() => videoRef.current?.requestFullscreen?.()} className="p-1.5 text-white/30 hover:text-white transition-all"><Maximize2 className="w-3.5 h-3.5" /></button>
              <AnimatePresence>
                {!rightPanelOpen && (
                  <motion.button initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} onClick={() => setRightPanelOpen(true)} title="Zobraziť nástroje"
                    className="flex items-center gap-1.5 text-[11px] font-semibold text-primary bg-primary/15 border border-primary/30 hover:bg-primary/25 px-2.5 py-1.5 rounded-xl transition-all shadow-[0_0_12px_-3px_rgba(124,58,237,0.5)]">
                    <PanelRightOpen className="w-3.5 h-3.5" /><span className="hidden sm:inline">Nástroje</span>
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Right Panel */}
        <AnimatePresence initial={false}>
          {rightPanelOpen && (
            <motion.div key="right-panel" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="absolute right-0 top-0 bottom-0 w-64 z-20 flex flex-col border-l border-primary/10 bg-card overflow-hidden shadow-[-12px_0_40px_-5px_rgba(0,0,0,0.6)]">
              <div className="flex items-stretch border-b border-primary/10 shrink-0">
                {panelTabs.map(({ id, label, icon: Icon }) => (
                  <button key={id} onClick={() => setActivePanel(id)} className={`flex items-center gap-1 px-2.5 py-2.5 text-[11px] font-semibold whitespace-nowrap transition-all border-b-2 flex-1 justify-center ${activePanel === id ? 'text-primary border-primary' : 'text-muted-foreground border-transparent hover:text-foreground'}`}>
                    <Icon className="w-3.5 h-3.5" /><span className="hidden sm:inline">{label}</span>
                  </button>
                ))}
                <button onClick={() => setRightPanelOpen(false)} title="Skryť panel" className="px-2.5 flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 border-b-2 border-transparent transition-all shrink-0"><PanelRightClose className="w-3.5 h-3.5" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                <AnimatePresence mode="wait">
                  {activePanel === 'ai' && (
                    <motion.div key="ai" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-2">
                      <div className="flex items-center gap-2 mb-3"><Sparkles className="w-4 h-4 text-primary" /><p className="text-xs font-bold text-foreground">AI Nástroje</p></div>
                      <p className="text-[10px] text-muted-foreground -mt-2 mb-3 leading-relaxed">Klikni na nástroj — AI ho aplikuje automaticky.</p>
                      {AI_TOOLS.map(({ id, label, icon: Icon, desc, detail }) => {
                        const isApplied = appliedTools.has(id); const isRunning = activeTool === id; const pct = toolProgress[id] ?? 0;
                        return (
                          <button key={id} onClick={() => runAITool(id)} disabled={isRunning || (!!activeTool && !isApplied)}
                            className={`w-full text-left p-2.5 rounded-xl border transition-all ${isApplied ? 'border-green-500/50 bg-green-500/10' : isRunning ? 'border-primary/60 bg-primary/10' : 'border-primary/10 bg-card hover:border-primary/40 hover:bg-primary/5'}`}>
                            <div className="flex items-center gap-2 mb-0.5">
                              <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${isApplied ? 'bg-green-500/20' : 'bg-primary/10'}`}>{isApplied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Icon className="w-3.5 h-3.5 text-primary" />}</div>
                              <span className="text-xs font-semibold">{label}</span>
                              {isApplied && <span className="ml-auto text-[9px] font-bold text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded-full">HOTOVO</span>}
                            </div>
                            <p className="text-[10px] text-muted-foreground leading-relaxed">{desc}</p>
                            {isRunning && (<div className="mt-2 space-y-1"><div className="h-1 bg-primary/10 rounded-full overflow-hidden"><motion.div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500" style={{ width: `${pct}%` }} /></div><p className="text-[9px] text-muted-foreground">{pct}% — spracovávam…</p></div>)}
                          </button>
                        );
                      })}
                    </motion.div>
                  )}
                  {activePanel === 'effects' && (
                    <motion.div key="effects" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-4">
                      <p className="text-xs text-muted-foreground">Upravuj farby a vzhľad videa</p>
                      {(['jas', 'kontrast', 'sytost'] as const).map(key => {
                        const labels: Record<string, string> = { jas: 'Jas', kontrast: 'Kontrast', sytost: 'Sýtosť' };
                        const icons: Record<string, React.ElementType> = { jas: Sun, kontrast: Contrast, sytost: Palette };
                        const Icon = icons[key];
                        return (
                          <div key={key} className="space-y-2">
                            <div className="flex items-center justify-between"><div className="flex items-center gap-2 text-sm font-medium"><Icon className="w-3.5 h-3.5 text-primary" />{labels[key]}</div><span className="text-xs font-mono text-primary">{sliders[key]}</span></div>
                            <input type="range" min={0} max={100} value={sliders[key]} onChange={e => setSliders(s => ({ ...s, [key]: Number(e.target.value) }))} className="w-full accent-violet-500 cursor-pointer" />
                          </div>
                        );
                      })}
                    </motion.div>
                  )}
                  {activePanel === 'clips' && (
                    <motion.div key="clips" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-2">
                      <p className="text-xs text-muted-foreground">Spravuj klipy na časovej osi</p>
                      {timelineClips.map(clip => (
                        <div key={clip.id} className="flex items-center gap-2 p-2.5 rounded-xl border border-primary/10 bg-card hover:border-primary/30 transition-all group">
                          <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${clip.color} flex items-center justify-center shrink-0`}><Film className="w-3.5 h-3.5 text-white" /></div>
                          <div className="flex-1 min-w-0"><p className="text-xs font-medium truncate">{clip.label}</p><p className="text-[10px] text-muted-foreground">{Math.round(clip.duration)}s</p></div>
                        </div>
                      ))}
                      <button onClick={() => mediaInputRef.current?.click()} className="w-full p-2 rounded-xl border border-dashed border-primary/20 text-muted-foreground hover:border-primary/50 hover:text-primary transition-all text-xs flex items-center justify-center gap-2"><Plus className="w-3.5 h-3.5" /> Pridať klip</button>
                    </motion.div>
                  )}
                  {activePanel === 'audio' && (
                    <motion.div key="audio" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-3">
                      <p className="text-xs text-muted-foreground">Nastavenia zvuku</p>
                      <div className="space-y-1.5"><div className="flex justify-between text-xs"><span>Hlasitosť</span><span className="text-primary font-mono">{volume}%</span></div><input type="range" min={0} max={100} value={volume} onChange={e => setVolume(Number(e.target.value))} className="w-full accent-violet-500 cursor-pointer" /></div>
                    </motion.div>
                  )}
                  {activePanel === 'text' && (
                    <motion.div key="text" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-3">
                      <p className="text-xs text-muted-foreground">Pridaj titulky a texty</p>
                      <button onClick={() => { setAppliedTools(s => new Set(s).add('captions')); setSubtitleIdx(0); }} className="w-full py-2 rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs font-semibold hover:bg-primary/20 transition-all flex items-center justify-center gap-2"><AlignLeft className="w-3.5 h-3.5" /> Pridať titulky na video</button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Timeline */}
      <div className="border-t border-primary/10 bg-background shrink-0 select-none">
        <div className="flex items-center justify-between px-3 py-1 border-b border-primary/5">
          <span className="text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-wider">Časová os</span>
          <div className="flex items-center gap-0.5">
            <button onClick={() => setTimelineZoom(z => Math.max(0.5, z - 0.25))} className="p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-foreground transition-all"><ZoomOut className="w-3 h-3" /></button>
            <span className="text-[9px] text-muted-foreground w-8 text-center">{Math.round(timelineZoom * 100)}%</span>
            <button onClick={() => setTimelineZoom(z => Math.min(4, z + 0.25))} className="p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-foreground transition-all"><ZoomIn className="w-3 h-3" /></button>
            <button onClick={() => setTimelineZoom(1)} className="p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-foreground transition-all ml-0.5"><RotateCcw className="w-3 h-3" /></button>
          </div>
        </div>

        <div className="flex items-stretch">
          <div className="w-8 shrink-0 flex flex-col border-r border-primary/5">
            <div className="h-4" />
            <div className="h-16 flex flex-col items-center justify-center gap-0.5"><Film className="w-3 h-3 text-muted-foreground/40" /><span className="text-[7px] text-muted-foreground/40 uppercase">V1</span></div>
            {appliedTools.has('captions') && <div className="h-7 flex flex-col items-center justify-center gap-0.5"><Type className="w-2.5 h-2.5 text-cyan-400/50" /></div>}
            <div className="h-10" />
          </div>

          <div ref={timelineScrollRef} className="flex-1 overflow-x-auto overflow-y-hidden">
            {(() => {
              const totalClipW = timelineClips.reduce((s, c) => s + Math.round(c.duration * PX_PER_SEC * timelineZoom), 0);
              const numGaps = Math.max(0, timelineClips.length - 1);
              const contentW = totalClipW + numGaps * GAP_W + 56 + 24;
              const totalDur = timelineClips.reduce((s, c) => s + c.duration, 0);
              const rulerStep = timelineZoom >= 2 ? 2 : timelineZoom >= 1 ? 5 : 10;
              const numTicks = Math.ceil(totalDur / rulerStep) + 2;
              const playheadX = (progress / 100) * totalClipW;

              return (
                <div style={{ width: Math.max(contentW, 100), minWidth: '100%' }} className="relative">

                  {/* Draggable playhead — spans full height */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-white/90 shadow-[0_0_10px_rgba(255,255,255,0.8)] z-40 cursor-ew-resize group/ph"
                    style={{ left: playheadX }}
                    onMouseDown={handlePlayheadMouseDown}
                  >
                    {/* Grab handle at top — always visible */}
                    <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-4 h-4 bg-white rounded-full shadow-lg flex items-center justify-center cursor-ew-resize transition-transform group-hover/ph:scale-125">
                      <div className="w-2 h-2 bg-primary rounded-full" />
                    </div>
                    {/* Wider invisible hit area for easier grabbing */}
                    <div className="absolute -left-2 top-0 bottom-0 w-5 cursor-ew-resize" />
                  </div>

                  {/* Ruler */}
                  <div className="h-4 relative border-b border-primary/5 bg-background">
                    {Array.from({ length: numTicks }).map((_, i) => (
                      <div key={i} className="absolute flex flex-col items-center" style={{ left: i * rulerStep * PX_PER_SEC * timelineZoom - 1 }}>
                        <div className="w-px h-2 bg-primary/20" />
                        <span className="text-[7px] text-muted-foreground/40 ml-1">{i * rulerStep}s</span>
                      </div>
                    ))}
                  </div>

                  {/* Track — click to seek */}
                  <div
                    id="timeline-track"
                    ref={timelineTrackRef}
                    className="h-16 bg-black/20 border-b border-primary/5 flex items-stretch cursor-text"
                    onClick={(e) => { if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('timeline-clickzone')) handleTimelineTrackClick(e); else setSelectedClipId(null); }}
                  >
                    {timelineClips.flatMap((clip, idx) => {
                      const parts: React.ReactNode[] = [];
                      if (idx > 0) {
                        const tId = clipTransitions[idx];
                        const tDef = tId ? TRANSITIONS.find(t => t.id === tId) : null;
                        parts.push(
                          <button key={`tr-${idx}`} onClick={e => { e.stopPropagation(); setLeftTool('transitions'); setSelectedGap(idx); }} title={tDef ? tDef.label : 'Pridať prechod'}
                            className={`shrink-0 h-full flex items-center justify-center text-[10px] transition-all z-10 ${tDef ? 'bg-fuchsia-500/40 text-white border-x border-fuchsia-400/40' : 'bg-black/30 text-white/20 hover:bg-primary/20 hover:text-primary border-x border-dashed border-white/10 hover:border-primary/40'}`}
                            style={{ width: GAP_W }}>
                            {tDef ? tDef.emoji : '∿'}
                          </button>
                        );
                      }
                      const isSel = selectedClipId === clip.id;
                      const isDrag = dragState?.clipId === clip.id;
                      const clipPx = Math.round(clip.duration * PX_PER_SEC * timelineZoom);
                      parts.push(
                        <div key={clip.id} onMouseDown={e => { if (!(e.target as HTMLElement).dataset.handle) handleClipMouseDown(clip.id, e); }} onClick={e => e.stopPropagation()}
                          className={`relative shrink-0 h-full cursor-grab active:cursor-grabbing transition-all ${isDrag ? 'opacity-60 ring-2 ring-primary ring-inset' : isSel ? 'ring-2 ring-amber-400 ring-inset brightness-110' : 'hover:brightness-110'}`}
                          style={{ width: clipPx }}>
                          {clip.thumbUrl ? <img src={clip.thumbUrl} className="w-full h-full object-cover pointer-events-none" alt="" />
                          : <div className={`w-full h-full bg-gradient-to-r ${clip.color} flex items-center justify-center`}><Film className="w-5 h-5 text-white/20 pointer-events-none" /></div>}
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-1.5 pb-1 pointer-events-none"><span className="text-[8px] text-white font-semibold truncate block">{clip.label}</span></div>
                          <div className="absolute top-1 right-1 bg-black/50 rounded px-1 pointer-events-none"><span className="text-[7px] text-white/60">{Math.round(clip.duration)}s</span></div>
                          {isSel && <div className="absolute inset-0 border-2 border-amber-400 pointer-events-none z-10 rounded-sm" />}
                          {isSel && (
                            <button
                              onMouseDown={e => { e.stopPropagation(); e.preventDefault(); }}
                              onClick={e => { e.stopPropagation(); setTimelineClips(prev => prev.filter(c => c.id !== clip.id)); setSelectedClipId(null); }}
                              className="absolute -top-2 -right-2 z-40 w-6 h-6 flex items-center justify-center rounded-full bg-red-500 hover:bg-red-600 text-white shadow-[0_2px_8px_rgba(0,0,0,0.4)] hover:scale-110 transition-all"
                              title="Odstrániť klip"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                          <div data-handle="trim-start" onMouseDown={e => { e.stopPropagation(); handleTrimStart(clip.id, e); }} className={`absolute left-0 top-0 bottom-0 w-4 cursor-ew-resize z-20 flex items-center justify-center group/trim transition-all ${isSel ? 'bg-amber-400/90' : 'bg-amber-400/0 hover:bg-amber-400/40'}`}>
                            <div className={`w-0.5 h-8 rounded-full pointer-events-none transition-all ${isSel ? 'bg-black/60' : 'bg-amber-400/0 group-hover/trim:bg-amber-400'}`} />
                          </div>
                          <div data-handle="trim-end" onMouseDown={e => { e.stopPropagation(); handleTrimEnd(clip.id, e); }} className={`absolute right-0 top-0 bottom-0 w-4 cursor-ew-resize z-20 flex items-center justify-center group/trim transition-all ${isSel ? 'bg-amber-400/90' : 'bg-amber-400/0 hover:bg-amber-400/40'}`}>
                            <div className={`w-0.5 h-8 rounded-full pointer-events-none transition-all ${isSel ? 'bg-black/60' : 'bg-amber-400/0 group-hover/trim:bg-amber-400'}`} />
                          </div>
                        </div>
                      );
                      return parts;
                    })}
                    {/* Pridať fotku alebo video na koniec časovej osi */}
                    <button
                      onMouseDown={e => e.stopPropagation()}
                      onClick={e => { e.stopPropagation(); mediaInputRef.current?.click(); }}
                      title="Pridať fotku alebo video"
                      className="shrink-0 h-full w-14 flex flex-col items-center justify-center gap-0.5 border border-dashed border-primary/30 text-muted-foreground hover:text-primary hover:bg-primary/10 hover:border-primary/60 transition-all"
                    >
                      <Plus className="w-4 h-4" />
                      <span className="text-[8px] font-semibold">Médium</span>
                    </button>
                    {/* Click zone filler */}
                    <div className="timeline-clickzone flex-1 h-full" />
                  </div>

                  <AnimatePresence>
                    {appliedTools.has('captions') && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 28 }} exit={{ opacity: 0, height: 0 }} className="h-7 bg-cyan-500/5 border-b border-primary/5 flex items-center px-2 gap-1.5" style={{ minWidth: contentW }}>
                        <Type className="w-2.5 h-2.5 text-cyan-400 shrink-0" />
                        <div className="flex-1 h-3 bg-cyan-500/20 rounded-full overflow-hidden"><div className="h-full w-3/4 bg-cyan-400/40 rounded-full" /></div>
                        <span className="text-[8px] text-cyan-400/60 shrink-0">{SUBTITLE_LINES.length} seg.</span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="h-10 flex items-stretch" style={{ minWidth: contentW }}>
                    <div className="flex-1 relative flex items-stretch" onClick={() => setSelectedMusicId(null)}>
                      {musicClips.length === 0 ? (
                        <button onClick={e => { e.stopPropagation(); setShowMusicModal(true); }} className="flex-1 border-b border-dashed border-primary/15 text-muted-foreground/40 hover:text-primary hover:border-primary/40 transition-all text-xs flex items-center justify-center gap-1.5">
                          <Plus className="w-3 h-3" /><span className="text-[9px]">Pridať hudbu</span>
                        </button>
                      ) : musicClips.map(mc => {
                        const mSel = selectedMusicId === mc.id;
                        return (
                          <div key={mc.id} onMouseDown={e => { e.stopPropagation(); const startX = e.clientX; let didDrag = false; const onMove = (ev: MouseEvent) => { if (Math.abs(ev.clientX - startX) > 6) didDrag = true; }; const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); if (!didDrag) setSelectedMusicId(prev => prev === mc.id ? null : mc.id); }; window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp); }}
                            className="relative flex-1 h-full bg-gradient-to-r from-indigo-700/50 to-violet-600/50 flex items-center px-2 cursor-grab active:cursor-grabbing transition-all hover:brightness-110">
                            <div className="flex gap-px w-full items-end pointer-events-none" style={{ height: 20 }}>{WAVEFORM.slice(0, 50).map((h, i) => <div key={i} className="flex-1 bg-white/30 rounded-full" style={{ height: `${h}%` }} />)}</div>
                            <span className="absolute bottom-0.5 left-2 text-[7px] text-white/50 font-medium truncate max-w-[80%] pointer-events-none">{mc.label}</span>
                            {mSel && <div className="absolute inset-0 border-2 border-white pointer-events-none" />}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

        </div>

        <AnimatePresence>
          {(selectedClipId !== null || selectedMusicId !== null) && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="flex items-center gap-1 px-3 py-1.5 border-t border-primary/10 overflow-hidden">
              {selectedClipId !== null && (
                <>
                  <button onClick={handleCut} className="flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-foreground transition-all"><Scissors className="w-3.5 h-3.5" /><span className="text-[9px]">Strih</span></button>
                  <button onClick={() => setLeftTool('speed')} className="flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-foreground transition-all"><Clock className="w-3.5 h-3.5" /><span className="text-[9px]">Rýchlosť</span></button>
                </>
              )}
              <div className="flex-1" />
              <button onClick={() => { if (selectedClipId !== null) { setTimelineClips(prev => prev.filter(c => c.id !== selectedClipId)); setSelectedClipId(null); } else if (selectedMusicId !== null) { setMusicClips(prev => prev.filter(c => c.id !== selectedMusicId)); setSelectedMusicId(null); } }} className="flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-all"><Trash2 className="w-3.5 h-3.5" /><span className="text-[9px]">Odstrániť</span></button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Music Modal */}
      <input ref={mediaInputRef} type="file" accept="video/*,image/*,.mp4,.mov,.webm,.avi,.mkv,.m4v" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) addMediaFile(f); e.target.value = ''; }} />
      <input ref={musicAudioRef} type="file" accept="audio/*" className="hidden"
        onChange={e => { const file = e.target.files?.[0]; if (file) setMusicClips(prev => [...prev, { id: Date.now(), label: file.name.replace(/\.[^/.]+$/, '') }]); e.target.value = ''; setShowMusicModal(false); }} />
      <AnimatePresence>
        {showMusicModal && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={() => setShowMusicModal(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.92, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92, y: 20 }} transition={{ type: 'spring', stiffness: 340, damping: 28 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-72 bg-card border border-primary/20 rounded-2xl shadow-[0_0_60px_-10px_rgba(124,58,237,0.5)] p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2"><div className="w-7 h-7 rounded-xl bg-primary/15 flex items-center justify-center"><Headphones className="w-4 h-4 text-primary" /></div><span className="text-sm font-bold">Pridať hudbu</span></div>
                <button onClick={() => setShowMusicModal(false)} className="p-1 text-muted-foreground hover:text-foreground hover:bg-primary/10 rounded-lg transition-all"><X className="w-4 h-4" /></button>
              </div>
              <p className="text-[11px] text-muted-foreground mb-4">Vyber zdroj hudby pre tvoje video</p>
              <button onClick={() => musicAudioRef.current?.click()} className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-primary/15 bg-card hover:border-primary/50 hover:bg-primary/5 transition-all group">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-all"><FileMusic className="w-4 h-4 text-primary" /></div>
                <div className="text-left"><p className="text-xs font-semibold">Zo súboru</p><p className="text-[10px] text-muted-foreground">MP3, WAV, AAC, FLAC…</p></div>
                <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto group-hover:text-primary transition-all" />
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>



    </motion.div>
  );
}
