import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
  Scissors, Wand2, Sparkles, Layers, Clock, Download,
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCcw, Sliders,
  Film, Music, Type, Crop, Sun, Contrast, Palette,
  Wind, Zap, Plus, Trash2, Check, X, Send,
  Maximize2, AlignLeft, PanelRightClose, PanelRightOpen,
  Headphones, FileMusic, Shuffle, SlidersHorizontal,
  Bot, MessageSquare,
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
  type: 'video' | 'image';
  thumbUrl?: string;
  src?: string;
};

type MusicClip = { id: number; label: string };

type ChatMsg = { role: 'user' | 'ai'; text: string; action?: string };

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

export default function VideoEditor({ videoUrl, videoName, isImage = false }: VideoEditorProps) {
  const [isPlaying, setIsPlaying]       = useState(false);
  const [isMuted, setIsMuted]           = useState(false);
  const [currentTime, setCurrentTime]  = useState(0);
  const [activePanel, setActivePanel]  = useState<ActivePanel>('ai');
  const [activeTool, setActiveTool]    = useState<AITool>(null);
  const [toolProgress, setToolProgress] = useState<Record<string, number>>({});
  const [appliedTools, setAppliedTools] = useState<Set<string>>(new Set());
  const [sliders, setSliders]          = useState({ jas: 65, kontrast: 50, sytost: 72 });
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

  // AI Chat state
  const [showAIChat, setShowAIChat]     = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([
    { role: 'ai', text: 'Ahoj! Som tvoj AI asistent pre strih videa. Môžeš mi písať úplne normálne — ako kamarátovi. Napríklad „chcel by som sem pridať intro", „môžeš pridať titulky?" alebo „zrýchli to trochu". Čo by si chcel urobiť?' },
  ]);
  const [chatInput, setChatInput]       = useState('');
  const [chatThinking, setChatThinking] = useState(false);
  const chatScrollRef                  = useRef<HTMLDivElement>(null);
  const chatInputRef                   = useRef<HTMLInputElement>(null);

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
  const musicInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const musicAudioRef = useRef<HTMLInputElement>(null);
  const timelineTrackRef = useRef<HTMLDivElement>(null);

  const totalDuration = timelineClips.reduce((s, c) => s + c.duration, 0);
  const duration = totalDuration;
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Klip, ktorý je práve pod prehrávacou hlavou (určuje veľkú ukážku)
  const { activeClip, activeClipStart } = useMemo(() => {
    let cum = 0;
    for (const c of timelineClips) {
      if (currentTime >= cum && currentTime < cum + c.duration) return { activeClip: c, activeClipStart: cum };
      cum += c.duration;
    }
    const last = timelineClips[timelineClips.length - 1];
    return { activeClip: last ?? null, activeClipStart: Math.max(0, cum - (last?.duration ?? 0)) };
  }, [timelineClips, currentTime]);

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

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [chatMessages, chatThinking]);

  // Focus input when chat opens
  useEffect(() => {
    if (showAIChat) {
      const t = setTimeout(() => chatInputRef.current?.focus(), 350);
      return () => clearTimeout(t);
    }
  }, [showAIChat]);

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

    const onMove = (ev: MouseEvent) => updateFromX(ev.clientX);
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      setIsScrubbing(false);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [duration, seekTo, isPlaying]);

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
    const onMove = (ev: MouseEvent) => { if (!didDrag && Math.abs(ev.clientX - startX) > 6) didDrag = true; if (didDrag) setDragState({ clipId, startX, currentX: ev.clientX }); };
    const onUp = (ev: MouseEvent) => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
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
      const delta = (ev.clientX - startX) / (PX_PER_SEC * timelineZoom);
      setTimelineClips(prev => prev.map(c => c.id === clipId ? { ...c, duration: Math.max(1, startDur + delta) } : c));
    };
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const handleTrimStart = (clipId: number, e: React.MouseEvent) => {
    e.stopPropagation(); e.preventDefault();
    const startX = e.clientX;
    const startDur = timelineClips.find(c => c.id === clipId)!.duration;
    const onMove = (ev: MouseEvent) => {
      const delta = (ev.clientX - startX) / (PX_PER_SEC * timelineZoom);
      setTimelineClips(prev => prev.map(c => c.id === clipId ? { ...c, duration: Math.max(1, startDur - delta) } : c));
    };
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const formatTime = (s: number) => { const m = Math.floor(s / 60); const sec = Math.floor(s % 60); return `${m}:${sec.toString().padStart(2, '0')}`; };

  const videoFilter = useMemo(() => {
    const filters: string[] = [];
    if (appliedTools.has('denoise'))    filters.push('contrast(1.08) saturate(1.12)');
    if (appliedTools.has('enhance'))    filters.push('brightness(1.05) contrast(1.06)');
    if (appliedTools.has('colorgrade')) filters.push('saturate(1.3) hue-rotate(5deg)');
    return filters.join(' ') || undefined;
  }, [appliedTools]);

  // ── AI Chat: parse user command and apply ──
  const processAICommand = (cmd: string): { reply: string; action?: string } => {
    const lower = cmd.toLowerCase().trim();

    // Úvod / pozdrav
    if (/(ahoj|hello|hi|čau|cau|vitaj|cao|zdravím|dobrý deň|dobry den|servus|zdare)/i.test(lower)) {
      return { reply: 'Ahoj! Som tvoj AI asistent pre strih videa. Môžeš mi písať úplne normálne — napríklad „pridaj mi sem titulky", „chcel by som vylepšiť kvalitu", „môžeš to zrýchliť?" alebo „daj sem nejaké intro". Čo by si chcel urobiť?' };
    }

    // Ďakujem
    if (/(ďakujem|ďakujem ti|vďaka|vdaka|thanks|thx|super|paráda|parada|fakt dobr|si super|si hviezda)/i.test(lower)) {
      return { reply: 'Rád som pomohol! 😊 Ak chceš ešte niečo upraviť, kľudne mi napíš — som tu pre teba.' };
    }

    // Čo vieš / pomoc
    if (/(čo vieš|co vies|čo môžeš|co mozes|pomoc|help|čo dokážeš|co dokazes|aké máš|ake mas|funkcie|možnosti|moznosti)/i.test(lower)) {
      return { reply: 'Viem toho dosť! Môžem:\n• Pridať titulky / nadpisy\n• Vylepšiť kvalitu (jas, kontrast, ostrosť)\n• Odstrániť šum a zrno\n• Stabilizovať trasenie kamery\n• Urobiť farebnú korekciu (color grade)\n• Pridať prechody medzi klipy\n• Zrýchliť alebo spomaliť video\n• Strihnúť klip na aktuálnej pozícii\n• Pridať hudbu\n• Pridať intro / outro\n\nProsta napíš, čo chceš, napríklad „chcel by som sem pridať intro".' };
    }

    // Intro
    if (/(intro|úvod|uvod|začiatok|zaciatok|otvorenie|title card|úvodn|uvodn)/i.test(lower)) {
      const title = videoName ? videoName.replace(/\.[^.]+$/, '') : 'Moje Video';
      const tpl = INTRO_TEMPLATES[introCount % INTRO_TEMPLATES.length];
      setIntroOverlay({ title: title.toUpperCase(), subtitle: tpl.overlay.subtitle, bg: tpl.overlay.bg });
      setIntroCount(c => c + 1);
      setTimelineClips(prev => {
        const introClip: TimelineClip = {
          id: Date.now(),
          label: tpl.label,
          duration: 3,
          color: tpl.color,
          thumbUrl: undefined,
        };
        return [introClip, ...prev];
      });
      const remaining = 4 - (introCount % INTRO_TEMPLATES.length);
      return { reply: `Hotovo! Pridal som intro #${(introCount % INTRO_TEMPLATES.length) + 1} na začiatok časovej osi. Nadpis: „${title.toUpperCase()}", štýl: ${tpl.label}. ${remaining > 0 ? `Máš ešte ${remaining} ďalšie intro šablóny skúsiť — napíš znova „pridaj intro" pre iný štýl.` : 'Toto je piaty štýl — ďalšie intro bude znova prvý štýl.'} Chceš aj outro?`, action: 'intro' };
    }

    // Outro / záver
    if (/(outro|záver|zaver|koniec|záverečn|zaverecn|koncov|ďakujem za sled|dakujem za sled)/i.test(lower)) {
      setOutroOverlay({ title: 'ĎAKUJEM ZA SLEDovANIE' });
      setTimelineClips(prev => {
        const outroClip: TimelineClip = {
          id: Date.now(),
          label: 'OUTRO',
          duration: 3,
          color: 'from-accent to-accent/70',
          thumbUrl: undefined,
        };
        return [...prev, outroClip];
      });
      return { reply: 'Pridal som outro na koniec časovej osi! Zobrazí sa nápis „ĎAKUJEM ZA SLEDovANIE" a bude hrať 3 sekundy po skončení videa. Môžeš ho vidieť, keď prehráš video až do konca. Chceš aj farebnú korekciu pre filmový vzhľad?', action: 'outro' };
    }

    // Titulky
    if (/(titulk|caption|subtitle|nadpis|text|napís|napis|reč na text|rec na text)/i.test(lower)) {
      runAITool('captions');
      return { reply: 'Dobre, idem pridať titulky! Automaticky rozpoznám reč vo videu a vygenerujem titulky v slovenčine. Daj chvíľu — bude to hotové čoskoro.', action: 'captions' };
    }

    // Vylepšenie kvality
    if (/(vylepš|vyleps|enhance|kvalit|ostrosť|ostrost|sharp|jasnej|jasnejsi|lepšie|lepsie|krásnej|krajsnej|profesionál|profesional)/i.test(lower)) {
      runAITool('enhance');
      return { reply: 'Spúšťam Auto Enhance! AI vylepší jas, kontrast a ostrosť každého snímku. Video bude vyzerať oveľa lepšie — daj mi chvíľu.', action: 'enhance' };
    }

    // Denoise / šum
    if (/(šum|sum|denoise|zrno|noise|grain|šumov|sumov|odstráň šum|odstran sum|vyčist|vycist)/i.test(lower)) {
      runAITool('denoise');
      return { reply: 'Aplikujem AI Denoising — odstraňujem digitálny šum a zrno z videa. Bude to čisté a ostré.', action: 'denoise' };
    }

    // Stabilizácia
    if (/(stabil|trasen|shake|wobble|tria|chvej|chvenie|roztrep)/i.test(lower)) {
      runAITool('stabilize');
      return { reply: 'Spúšťam AI Stabilizáciu — opravujem trasenie kamery, aby bolo video plynulé. Stačí chvíľa.', action: 'stabilize' };
    }

    // Farebná korekcia
    if (/(farb|color|grade|korekci|sýtost|sytost|farebn|kino|filmový|filmovy|hollywood|tepl|studen|tonov)/i.test(lower)) {
      runAITool('colorgrade');
      return { reply: 'Aplikujem profesionálny Color Grade — filmová farebná korekcia v štýle Hollywoodu. Farby budú krásne a atmosférické.', action: 'colorgrade' };
    }

    // Prechod
    if (/(prechod|transition|fade|prepnut|prepnutie|spoj|spojenie)/i.test(lower)) {
      if (timelineClips.length >= 2) {
        setClipTransitions(prev => ({ ...prev, [1]: 'fade' }));
        return { reply: 'Pridávam prechod „Fade" medzi prvý a druhý klip. Bude to plynulé prepnutie.', action: 'transition' };
      }
      return { reply: 'Aby som mohol pridať prechod, potrebujem aspoň 2 klipy na časovej osi. Najprv pridaj ďalší klip — môžeš ho nahrať alebo vybrať z knižnice.' };
    }

    // Zrýchlenie
    if (/(zrýchli|zrychli|speed up|rýchlej|rychlej|rýchlosť|rychlost|fast|rýchlejšie|rychlejsie|dvojnásob|dvojnasob)/i.test(lower)) {
      setPlaybackRate(2);
      return { reply: 'Nastavujem rýchlosť na 2× — video bude prehrávané dvojnásobnou rýchlosťou. Ak chceš inú rýchlosť, daj vedieť.', action: 'speed' };
    }

    // Spomalenie
    if (/(spomal|slow|pomal|slowmo|slow-mo|slow motion|spomalšie|spomalsie)/i.test(lower)) {
      setPlaybackRate(0.5);
      return { reply: 'Spomaľujem video na 0.5× — pre plynulý slow-motion efekt. Bude to vyzerať kinematograficky.', action: 'speed' };
    }

    // Normálna rýchlosť / reset
    if (/(normáln|normal|reset|vynul|normálne|normalne|pôvodn|povodn|späť|spat|naspäť|naspat)/i.test(lower)) {
      setPlaybackRate(1);
      seekTo(0);
      return { reply: 'Vraciam všetko do normálu — rýchlosť na 1× a čas na 0:00. Čisto na začiatku.', action: 'reset' };
    }

    // Skok na začiatok
    if (/(vynul|nula|začiatok|zaciatok|start|begin|skok na začiat|skok na zaciat|na začiatok|na zaciatok|späť na začiatok|spat na zaciatok)/i.test(lower)) {
      seekTo(0);
      return { reply: 'Vynulujem čas na 0:00. Playhead je na začiatku — môžeš hrať odznova.', action: 'seek' };
    }

    // Strih
    if (/(strih|cut|rozrez|split|rozdel|rozrež|rozrez|vystrih|vystrihn|usekn)/i.test(lower)) {
      handleCut();
      return { reply: 'Strihám klip na aktuálnej pozícii prehrávania (čas ' + formatTime(currentTime) + '). Klip je rozdelený na dva diely.', action: 'cut' };
    }

    // Hudba
    if (/(hudba|music|audio|pieseň|piessen|song|skladba|stopa|soundtrack|podkres|podkreslen)/i.test(lower)) {
      setShowMusicModal(true);
      return { reply: 'Otváram okno pre pridanie hudby. Vyber MP3, WAV alebo AAC súbor a ja ho pridám do projektu.', action: 'music' };
    }

    // Nerozumie / fallback — konverzačná odpoveď
    if (/(nepamätám|nepamata|zabudol|zabudla|ako sa to robí|ako sa to robi|nevím|neviem|nechápem|nechapem|čo znamená|co znamena)/i.test(lower)) {
      return { reply: 'To nevadí! Skús mi povedať, čo chceš s videom urobiť — normálne, ako by si povedal kamarátovi. Napríklad „chcem sem dať titulky" alebo „urob to krajšie". Ja si už poradím.' };
    }

    // Všeobecný fallback — konverzačný
    return { reply: 'Rozumiem, čo hovoríš. Skús mi to povedať trochu inak — napríklad „chcem pridať titulky", „vylepši kvalitu", „zrýchli to", „daj sem intro", „stabilizuj video", „pridaj hudbu". Alebo sa ma opýtaj „čo vieš?" a ukážem ti všetky možnosti.' };
  };

  const sendChatMessage = () => {
    const text = chatInput.trim();
    if (!text || chatThinking) return;
    setChatMessages(prev => [...prev, { role: 'user', text }]);
    setChatInput('');
    setChatThinking(true);
    setTimeout(() => {
      const result = processAICommand(text);
      setChatMessages(prev => [...prev, { role: 'ai', text: result.reply, action: result.action }]);
      setChatThinking(false);
    }, 800 + Math.random() * 700);
  };

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
          <button onClick={() => { if (videoUrl) { const a = document.createElement('a'); a.href = videoUrl; a.download = videoName || 'export.mp4'; a.click(); } else alert('Najprv nahraj video'); }}
            className="flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold px-3 py-2 rounded-xl transition-all hover:scale-105 shadow-[0_0_20px_-5px_rgba(124,58,237,0.6)]">
            <Download className="w-3.5 h-3.5" /><span>Exportovať</span>
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

          {/* AI Chat button — prominent */}
          <div className="my-1 w-full flex justify-center">
            <div className="w-px h-4 bg-primary/15" />
          </div>
          <div className="relative group/tip">
            <button onClick={() => setShowAIChat(true)} title="AI Asistent"
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-all bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-[0_0_15px_-3px_rgba(124,58,237,0.7)] hover:scale-110">
              <Bot className="w-4 h-4" />
            </button>
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-400 border-2 border-card animate-pulse" />
            <AnimatePresence>
              {tooltipTool === 'ai-chat' && (
                <motion.div initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50 pointer-events-none">
                  <div className="bg-card border border-primary/20 rounded-lg px-2.5 py-1.5 shadow-xl whitespace-nowrap">
                    <p className="text-xs font-semibold text-foreground">AI Asistent</p>
                    <p className="text-[10px] text-muted-foreground">Napíš AI čo má urobiť s videom</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

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
              className="absolute left-11 top-0 z-30 w-56 bg-card border border-primary/20 rounded-r-xl rounded-b-xl shadow-2xl p-3 overflow-y-auto max-h-[70vh]">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Prechody</p>
                <button onClick={() => setLeftTool('select')} className="text-muted-foreground hover:text-foreground p-0.5"><X className="w-3.5 h-3.5" /></button>
              </div>
              {selectedGap === null ? (
                <p className="text-[9px] text-primary/70 bg-primary/5 border border-primary/15 rounded-lg px-2 py-1.5 mb-2">Klikni na <span className="font-bold">∿</span> medzi klipmi v časovej osi</p>
              ) : (
                <p className="text-[9px] text-green-400/80 bg-green-400/5 border border-green-400/15 rounded-lg px-2 py-1.5 mb-2">Prechod pred klipom <span className="font-bold">{selectedGap + 1}</span></p>
              )}
              <div className="grid grid-cols-4 gap-1">
                {TRANSITIONS.map(t => {
                  const isActive = selectedGap !== null && clipTransitions[selectedGap] === t.id;
                  return (
                    <button key={t.id} onClick={() => { if (selectedGap !== null) { setClipTransitions(prev => prev[selectedGap] === t.id ? Object.fromEntries(Object.entries(prev).filter(([k]) => Number(k) !== selectedGap)) : { ...prev, [selectedGap]: t.id }); } }}
                      className={`flex flex-col items-center gap-0.5 p-1.5 rounded-lg border text-center transition-all ${isActive ? 'border-primary bg-primary/20 text-primary shadow-[0_0_8px_-2px_rgba(124,58,237,0.5)]' : 'border-primary/10 bg-card/60 hover:border-primary/40 hover:bg-primary/5 text-muted-foreground'}`} title={t.label}>
                      <span className="text-sm leading-none">{t.emoji}</span>
                      <span className="text-[7px] leading-tight mt-0.5 w-full truncate">{t.label}</span>
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
              previewClip.type === 'image'
              ? <img key={previewClip.id} src={previewClip.src} className="w-full h-full object-contain" style={{ filter: videoFilter }} alt={previewClip.label} />
              : <video key={previewClip.id} ref={videoRef} src={previewClip.src} className="w-full h-full object-contain" style={{ filter: videoFilter }} onTimeUpdate={handleTimeUpdate} onEnded={() => setIsPlaying(false)} muted={isMuted} />
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
                      <p className="text-[10px] text-muted-foreground -mt-2 mb-3 leading-relaxed">Klikni na nástroj — AI ho aplikuje automaticky. Alebo klikni na <Bot className="inline w-3 h-3 text-primary" /> v ľavom paneli a napíš AI priamo.</p>
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

          <div className="flex-1 overflow-x-auto overflow-y-hidden">
            {(() => {
              const totalClipW = timelineClips.reduce((s, c) => s + Math.round(c.duration * PX_PER_SEC * timelineZoom), 0);
              const numGaps = Math.max(0, timelineClips.length - 1);
              const contentW = totalClipW + numGaps * GAP_W + 16;
              const totalDur = timelineClips.reduce((s, c) => s + c.duration, 0);
              const rulerStep = timelineZoom >= 2 ? 2 : timelineZoom >= 1 ? 5 : 10;
              const numTicks = Math.ceil(totalDur / rulerStep) + 2;
              const playheadX = (progress / 100) * totalClipW;

              return (
                <div style={{ width: Math.max(contentW, 100) }} className="relative">
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

          <div className="w-8 shrink-0 flex flex-col border-l border-primary/5">
            <div className="h-4" />
            <input ref={musicInputRef} type="file" accept="video/*,image/*" className="hidden"
              onChange={e => { const file = e.target.files?.[0]; if (!file) return; const img = file.type.startsWith('image/'); const url = URL.createObjectURL(file); setTimelineClips(prev => [...prev, { id: Date.now(), label: img ? `Foto ${prev.filter(c => c.type === 'image').length + 1}` : `Klip ${prev.length + 2}`, color: CLIP_COLORS[prev.length % CLIP_COLORS.length], duration: 30, type: img ? 'image' : 'video', thumbUrl: img ? url : undefined }]); e.target.value = ''; }} />
            <button onClick={() => mediaInputRef.current?.click()} title="Pridať klip" className="h-16 w-full flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"><Plus className="w-3.5 h-3.5" /></button>
            {appliedTools.has('captions') && <div className="h-7" />}
            <button onClick={() => setShowMusicModal(true)} title="Pridať hudbu" className="h-10 w-full flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"><Plus className="w-3.5 h-3.5" /></button>
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

      {/* ── AI Chat Panel ── */}
      <AnimatePresence>
        {showAIChat && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" onClick={() => setShowAIChat(false)} />
            <motion.div
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed left-0 top-0 bottom-0 w-[85vw] max-w-sm z-50 bg-card border-r border-primary/20 flex flex-col shadow-[12px_0_60px_-10px_rgba(0,0,0,0.7)]"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-3 border-b border-primary/10 shrink-0 bg-gradient-to-r from-violet-600/20 to-fuchsia-600/20">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center shadow-[0_0_15px_-3px_rgba(124,58,237,0.7)]">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">AI Asistent</p>
                    <p className="text-[10px] text-green-400 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />Online</p>
                  </div>
                </div>
                <button onClick={() => setShowAIChat(false)} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-primary/10 rounded-lg transition-all"><X className="w-4 h-4" /></button>
              </div>

              {/* Messages */}
              <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-3 space-y-2.5">
                {chatMessages.map((msg, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-xs leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-br-sm'
                        : 'bg-card border border-primary/15 text-foreground rounded-bl-sm'
                    }`}>
                      {msg.role === 'ai' && <Bot className="inline w-3 h-3 text-primary mr-1 mb-0.5" />}
                      {msg.text}
                      {msg.action && <span className="block mt-1 text-[9px] text-primary/60 italic">✓ Akcia aplikovaná</span>}
                    </div>
                  </motion.div>
                ))}
                {chatThinking && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                    <div className="bg-card border border-primary/15 px-3 py-2 rounded-2xl rounded-bl-sm flex items-center gap-1.5">
                      <Bot className="w-3 h-3 text-primary" />
                      {[0,1,2].map(i => <motion.div key={i} animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }} className="w-1 h-1 bg-primary rounded-full" />)}
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Quick suggestions */}
              <div className="px-3 pb-1.5 flex gap-1.5 flex-wrap shrink-0">
                {['Pridaj titulky', 'Vylepši kvalitu', 'Zrýchli', 'Vynuluj čas'].map(s => (
                  <button key={s} onClick={() => { setChatInput(s); }} className="text-[9px] px-2 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-all whitespace-nowrap">{s}</button>
                ))}
              </div>

              {/* Input */}
              <form onSubmit={(e) => { e.preventDefault(); sendChatMessage(); }} className="p-3 border-t border-primary/10 shrink-0 flex items-center gap-2">
                <input
                  ref={chatInputRef}
                  type="text"
                  inputMode="text"
                  autoCapitalize="sentences"
                  autoComplete="off"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); } }}
                  placeholder="Napíš mi, čo chceš urobiť…"
                  className="flex-1 bg-background border border-primary/20 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-primary/60 placeholder:text-muted-foreground/50 text-foreground"
                />
                <button type="submit" disabled={!chatInput.trim() || chatThinking}
                  className="w-9 h-9 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground flex items-center justify-center transition-all hover:scale-105 disabled:opacity-40 disabled:hover:scale-100 shrink-0">
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
