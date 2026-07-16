/** Звукови сигнали за admin чат — изискват unlock след потребителско действие (browser policy). */

let _audioCtx: AudioContext | null = null;
let _unlocked = false;

function getAudioCtx(): AudioContext | null {
  try {
    const Ctor =
      (typeof AudioContext !== "undefined"
        ? AudioContext
        : (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) ?? null;
    if (!Ctor) return null;
    if (!_audioCtx || _audioCtx.state === "closed") _audioCtx = new Ctor();
    return _audioCtx;
  } catch {
    return null;
  }
}

/** Извикай при user gesture — иначе браузърът блокира звука. */
export function unlockAdminChatAudio(): void {
  const ctx = getAudioCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume().then(() => { _unlocked = true; });
  else _unlocked = true;
}

function playTone(
  freq: number,
  start: number,
  duration: number,
  volume = 0.22,
  type: OscillatorType = "sine",
) {
  const ctx = getAudioCtx();
  if (!ctx) return false;
  if (ctx.state === "suspended") void ctx.resume();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  osc.start(start);
  osc.stop(start + duration);
  return true;
}

/** Нов разговор — силен, дълъг, отчетлив сигнал (4 тона). */
export function playNewChatSound() {
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    if (ctx.state === "suspended") void ctx.resume();
    const t = ctx.currentTime;
    playTone(523.25, t, 0.42, 0.42, "triangle");
    playTone(659.25, t + 0.48, 0.42, 0.44, "triangle");
    playTone(783.99, t + 0.96, 0.52, 0.46, "triangle");
    playTone(987.77, t + 1.52, 0.75, 0.48, "sine");
    playTone(783.99, t + 2.35, 0.55, 0.38, "triangle");
  } catch {
    /* ignore */
  }
}

/** Ново съобщение — кратък двоен сигнал (когато чатът не е отворен). */
export function playNewMessageSound() {
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    if (ctx.state === "suspended") void ctx.resume();
    const t = ctx.currentTime;
    playTone(740, t, 0.16, 0.35);
    playTone(880, t + 0.22, 0.22, 0.35);
  } catch {
    /* ignore */
  }
}

export function requestChatBrowserNotification(title: string, body: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  // Само ако вече е разрешено — без requestPermission (конфликт с PWA Web Push).
  if (Notification.permission === "granted") {
    try {
      new Notification(title, { body, icon: "/icon-192.png" });
    } catch {
      /* ignore */
    }
  }
}

/** Регистрирай unlock при всяко действие в admin (не само веднъж). */
export function installAdminChatAudioUnlock(): () => void {
  if (typeof window === "undefined") return () => {};
  const unlock = () => unlockAdminChatAudio();
  window.addEventListener("click", unlock, { capture: true });
  window.addEventListener("keydown", unlock, { capture: true });
  window.addEventListener("touchstart", unlock, { capture: true });
  return () => {
    window.removeEventListener("click", unlock, { capture: true });
    window.removeEventListener("keydown", unlock, { capture: true });
    window.removeEventListener("touchstart", unlock, { capture: true });
  };
}
