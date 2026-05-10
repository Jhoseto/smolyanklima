"use client";

import { useCallback, useEffect, useState } from "react";
import { Smartphone, Download, X, Share2, PlusSquare } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const IOS_DISMISS_KEY = "login-pwa-ios-dismiss";

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIOSLike(): boolean {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

export function LoginPWAInstall() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [chromiumOk, setChromiumOk] = useState(false);
  const [iosVisible, setIosVisible] = useState(false);
  const [iosGuide, setIosGuide] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || isStandalone()) return;

    try {
      if (sessionStorage.getItem(IOS_DISMISS_KEY) === "1") return;
    } catch {
      /* ignore */
    }

    if (isIOSLike()) setIosVisible(true);

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setChromiumOk(true);
    };
    window.addEventListener("beforeinstallprompt", onBip);
    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "accepted") {
      setDeferred(null);
      setChromiumOk(false);
    }
  }, [deferred]);

  const dismissIos = useCallback(() => {
    try {
      sessionStorage.setItem(IOS_DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setIosVisible(false);
    setIosGuide(false);
  }, []);

  if (isStandalone()) return null;

  const showAndroid = chromiumOk;
  const showIos = iosVisible && !chromiumOk;

  if (!showAndroid && !showIos) return null;

  return (
    <div className="login-pwa-install mb-5 space-y-3">
      {showAndroid && (
        <button
          type="button"
          onClick={promptInstall}
          className="login-pwa-install-btn w-full flex items-center gap-3 px-4 py-3 rounded-2xl border border-sky-200 bg-gradient-to-r from-sky-50 to-white text-left shadow-sm hover:border-sky-300 transition-colors"
        >
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-sky-500 to-sky-600 flex items-center justify-center shrink-0">
            <Smartphone className="w-5 h-5 text-white" strokeWidth={1.75} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold text-sky-600 uppercase tracking-widest leading-none mb-0.5">
              Админ приложение
            </p>
            <p className="text-sm font-bold text-slate-900 leading-tight">Инсталирай за по-бърз достъп</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Отделно от публичния сайт · само за служители</p>
          </div>
          <Download className="w-4 h-4 text-sky-600 shrink-0" />
        </button>
      )}

      {showIos && (
        <div className="relative rounded-2xl border border-orange-200 bg-gradient-to-r from-orange-50/90 to-white px-4 py-3 shadow-sm">
          <button
            type="button"
            onClick={dismissIos}
            className="absolute top-2 right-2 p-1.5 rounded-full text-slate-400 hover:bg-white/80 hover:text-slate-600"
            aria-label="Затвори"
          >
            <X className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setIosGuide(true)}
            className="w-full flex items-center gap-3 text-left pr-8"
          >
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shrink-0">
              <Smartphone className="w-5 h-5 text-white" strokeWidth={1.75} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-orange-600 uppercase tracking-widest leading-none mb-0.5">
                Админ приложение (iPhone)
              </p>
              <p className="text-sm font-bold text-slate-900 leading-tight">Добави към началния екран</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Докосни за стъпки · отделно от сайта за клиенти</p>
            </div>
            <Download className="w-4 h-4 text-orange-600 shrink-0" />
          </button>
        </div>
      )}

      {iosGuide && (
        <div
          className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4 bg-black/45"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start gap-2 p-4 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900">Добавяне към началния екран</h2>
                <p className="text-xs text-slate-500 mt-1">След това админът се отваря като приложение.</p>
              </div>
              <button
                type="button"
                onClick={() => setIosGuide(false)}
                className="p-2 rounded-xl text-slate-400 hover:bg-slate-100"
                aria-label="Затвори"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <ol className="p-4 space-y-3 text-sm text-slate-700">
              <li className="flex gap-2">
                <span className="font-bold text-orange-600 shrink-0">1.</span>
                <span>
                  Докоснете <strong className="inline-flex items-center gap-1"><Share2 className="w-3.5 h-3.5 inline" /> Споделяне</strong> в Safari (долу).
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-orange-600 shrink-0">2.</span>
                <span>
                  Изберете <strong className="inline-flex items-center gap-1"><PlusSquare className="w-3.5 h-3.5 inline" /> Добавяне към началния екран</strong>.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-orange-600 shrink-0">3.</span>
                <span>Потвърдете „Добавяне“. Отваряйте от иконата за вход в админ панела.</span>
              </li>
            </ol>
            <div className="p-4 pt-0">
              <button
                type="button"
                onClick={() => setIosGuide(false)}
                className="w-full py-3 rounded-2xl bg-sky-600 text-white font-semibold text-sm hover:bg-sky-700"
              >
                Разбрах
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
