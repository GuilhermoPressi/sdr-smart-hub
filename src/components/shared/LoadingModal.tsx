import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Sparkles } from "lucide-react";

interface Props {
  open: boolean;
  phrases: string[];
  durationMs?: number;
  onComplete: () => void;
  title?: string;
}

export function LoadingModal({ open, phrases, durationMs = 3500, onComplete, title = "Processando" }: Props) {
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!open) {
      setIndex(0);
      setProgress(0);
      return;
    }
    const phraseInterval = durationMs / phrases.length;
    const phraseTimer = setInterval(() => {
      setIndex((i) => Math.min(i + 1, phrases.length - 1));
    }, phraseInterval);

    const start = Date.now();
    const progressTimer = setInterval(() => {
      const pct = Math.min(100, ((Date.now() - start) / durationMs) * 100);
      setProgress(pct);
      if (pct >= 100) {
        clearInterval(progressTimer);
        clearInterval(phraseTimer);
        setTimeout(onComplete, 200);
      }
    }, 50);

    return () => {
      clearInterval(phraseTimer);
      clearInterval(progressTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog open={open}>
      <DialogContent className="glass-card border-border-subtle max-w-md p-8 [&>button]:hidden">
        <div className="flex flex-col items-center text-center space-y-6">
          <div className="relative">
            <div className="absolute inset-0 rounded-2xl bg-gradient-primary blur-2xl opacity-50 animate-pulse" />
            <div className="relative h-16 w-16 rounded-2xl bg-gradient-primary grid place-items-center shadow-glow">
              <Sparkles className="h-7 w-7 text-primary-foreground animate-spin" style={{ animationDuration: "3s" }} />
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">{title}</p>
            <p key={index} className="text-base font-display font-medium text-foreground animate-fade-in min-h-[1.5rem]">
              {phrases[index]}
            </p>
          </div>
          <div className="w-full">
            <div className="h-1.5 w-full bg-surface rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-primary rounded-full transition-all duration-100"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{Math.round(progress)}%</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
