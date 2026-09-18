import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { RecordingsList } from './RecordingsList';

export function RecordingsDrawer({ cameraId, cameraName, onClose }: {
  cameraId: string; cameraName: string; onClose: () => void;
}) {
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButton.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      previousFocus?.focus();
    };
  }, []);
  return <div className="recordings-drawer-backdrop" onClick={onClose}>
    <aside id="recordings-drawer" role="dialog" aria-modal="true" aria-labelledby="recordings-drawer-title"
      className="recordings-drawer" onClick={e => e.stopPropagation()} onKeyDown={e => {
        if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
        if (e.key === 'Tab') {
          const nodes = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], video[controls]'));
          const first = nodes[0], last = nodes[nodes.length - 1];
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
        }
      }}>
      <header className="section-heading"><div><span className="eyebrow">YOUR ARCHIVE</span><h2 id="recordings-drawer-title">Recorded videos</h2><p>{cameraName}</p></div>
        <button ref={closeButton} className="icon-button" aria-label="Close recorded videos" onClick={onClose}><X size={18} /></button>
      </header>
      <div className="recordings-drawer-content"><RecordingsList cameraId={cameraId} inlinePlayback /></div>
    </aside>
  </div>;
}
