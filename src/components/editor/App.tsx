import { useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Film, Upload, Sparkles, Type, Scissors, Palette } from 'lucide-react';
import VideoEditor from './VideoEditor';

type Media = { url: string; name: string; isImage: boolean };

export default function App() {
  const [media, setMedia] = useState<Media | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

 const handleFile = useCallback((file: File) => {
    const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(file.name);
    const isVideo = file.type.startsWith('video/') || /\.(mp4|mov|webm|mkv)$/i.test(file.name);

    if (!isImage && !isVideo) {
      alert('Nepodporovaný formát. Použi video alebo fotku.');
      return;
    }

    const url = URL.createObjectURL(file);
    setMedia({ url, name: file.name, isImage });
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  if (media) {
    return <VideoEditor videoUrl={media.url} videoName={media.name} isImage={media.isImage} />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-primary/15 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-fuchsia-600/10 blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-2xl"
      >
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center shadow-[0_0_30px_-5px_rgba(124,58,237,0.6)]">
            <Film className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">AI Video Editor</h1>
        </div>
        <p className="text-center text-muted-foreground text-sm mb-8">
          Nahraj video alebo fotku a začni strihať s pomocou AI
        </p>

        <motion.div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          whileHover={{ scale: 1.01 }}
          className={`cursor-pointer rounded-3xl border-2 border-dashed p-10 text-center transition-all ${
            dragOver
              ? 'border-primary bg-primary/10 scale-[1.02]'
              : 'border-primary/20 bg-card/40 hover:border-primary/50 hover:bg-card/60'
          }`}
        >
          {/* accept="" means all files — we filter manually so mobile browsers show everything */}
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*,image/*,.mp4,.mov,.webm,.avi,.mkv,.m4v"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = '';
            }}
          />
          <motion.div
            animate={{ y: dragOver ? -4 : 0 }}
            className="w-16 h-16 rounded-2xl bg-primary/15 flex items-center justify-center mx-auto mb-4"
          >
            <Upload className="w-7 h-7 text-primary" />
          </motion.div>
          <p className="text-sm font-semibold mb-1">
            {dragOver ? 'Pusti súbor tu' : 'Pretiahni video alebo fotku'}
          </p>
          <p className="text-xs text-muted-foreground">alebo klikni pre výber zo zariadenia</p>
          <p className="text-[10px] text-muted-foreground/60 mt-3">MP4, MOV, WebM, MKV, JPG, PNG</p>
        </motion.div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-6">
          {[
            { icon: Sparkles, label: 'Auto Enhance' },
            { icon: Type,     label: 'AI Titulky'  },
            { icon: Scissors, label: 'Strih'        },
            { icon: Palette,  label: 'Color Grade'  },
          ].map((f, i) => (
            <motion.div
              key={f.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.08 }}
              className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-card/40 border border-primary/10"
            >
              <f.icon className="w-4 h-4 text-primary" />
              <span className="text-[10px] text-muted-foreground font-medium">{f.label}</span>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
