import React, { useState } from 'react';
import { Download, X, Share2, PlusSquare } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running as an installed PWA, hide the button
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium text-neutral-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition shadow-2xs group"
        title="Install Verbum as Desktop / Mobile App"
      >
        <Download size={13} className="text-neutral-400 group-hover:text-white transition" />
        <span className="text-[11px] font-mono">Install</span>
      </button>
    );
  }

  // iOS Safari flow (beforeinstallprompt is not supported by WebKit)
  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium text-neutral-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition shadow-2xs group"
          title="Install Verbum on iOS"
        >
          <Download size={13} className="text-neutral-400 group-hover:text-white transition" />
          <span className="text-[11px] font-mono">Install</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
            <div className="bg-[#18181b] border border-white/15 rounded-2xl p-6 max-w-sm w-full text-xs text-neutral-200 shadow-2xl">
              <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
                <div className="flex items-center gap-2">
                  <img src="/pwa-192x192.png" alt="Verbum" className="w-6 h-6 rounded-md" />
                  <h3 className="font-semibold text-white text-sm">Install Verbum on iOS</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 rounded text-neutral-400 hover:text-white hover:bg-white/10 transition"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="space-y-3.5 text-neutral-300 leading-relaxed text-[12px]">
                <div className="flex items-start gap-2.5">
                  <div className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-neutral-200 mt-0.5">
                    <Share2 size={14} />
                  </div>
                  <div>
                    <span className="font-semibold text-white">1. Tap Share</span>
                    <p className="text-neutral-400 text-[11px] mt-0.5">
                      Tap the Share button at the bottom of Safari.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-neutral-200 mt-0.5">
                    <PlusSquare size={14} />
                  </div>
                  <div>
                    <span className="font-semibold text-white">2. Add to Home Screen</span>
                    <p className="text-neutral-400 text-[11px] mt-0.5">
                      Scroll down in the share sheet and tap <strong>"Add to Home Screen"</strong>.
                    </p>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full py-2 rounded-lg bg-white text-neutral-900 font-semibold text-xs hover:bg-neutral-200 transition shadow-xs"
              >
                Got It
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
