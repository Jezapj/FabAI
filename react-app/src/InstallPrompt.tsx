import React, { useCallback, useEffect, useState } from 'react';

const DISMISS_KEY = 'fabai-install-dismissed-at';
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000;
const SHOW_DELAY_MS = 2500;

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches
    || (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function wasDismissedRecently(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const dismissedAt = Number(raw);
    if (Number.isNaN(dismissedAt)) return false;
    return Date.now() - dismissedAt < DISMISS_MS;
  } catch {
    return false;
  }
}

function markDismissed(): void {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

export function InstallPrompt() {
  const [visible, setVisible] = useState(false);
  const [iosHint, setIosHint] = useState(false);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installing, setInstalling] = useState(false);

  const dismiss = useCallback(() => {
    markDismissed();
    setVisible(false);
    setInstallEvent(null);
  }, []);

  useEffect(() => {
    if (isStandalone() || wasDismissedRecently()) return;

    const onBeforeInstall = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setInstallEvent(e);
      setIosHint(false);
      setVisible(true);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);

    let timer: number | undefined;
    if (isIos()) {
      timer = window.setTimeout(() => {
        if (!isStandalone() && !wasDismissedRecently()) {
          setIosHint(true);
          setVisible(true);
        }
      }, SHOW_DELAY_MS);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  const handleInstall = async () => {
    if (!installEvent) return;
    setInstalling(true);
    try {
      await installEvent.prompt();
      const choice = await installEvent.userChoice;
      if (choice.outcome === 'accepted') {
        setVisible(false);
      } else {
        dismiss();
      }
    } catch (err) {
      console.warn('Install prompt failed:', err);
    } finally {
      setInstallEvent(null);
      setInstalling(false);
    }
  };

  if (!visible) return null;

  return (
    <div className="install-prompt" role="dialog" aria-labelledby="install-prompt-title" aria-live="polite">
      <div className="install-prompt__card">
        <img
          src="/CirculationsLogoNoBgFav.png"
          alt=""
          className="install-prompt__icon"
          width={48}
          height={48}
        />
        <div className="install-prompt__body">
          <h2 id="install-prompt-title" className="install-prompt__title">Install FabAI</h2>
          {iosHint ? (
            <p className="install-prompt__text">
              Add FabAI to your home screen for quick access. Tap the Share button in Safari, then choose
              {' '}<strong>Add to Home Screen</strong>.
            </p>
          ) : (
            <p className="install-prompt__text">
              Install FabAI on your device for quick access to your wardrobe and daily outfit suggestions.
            </p>
          )}
        </div>
        <div className="install-prompt__actions">
          {!iosHint && installEvent && (
            <button
              type="button"
              className="install-prompt__btn install-prompt__btn--primary"
              onClick={handleInstall}
              disabled={installing}
            >
              {installing ? 'Installing...' : 'Install'}
            </button>
          )}
          <button
            type="button"
            className="install-prompt__btn install-prompt__btn--ghost"
            onClick={dismiss}
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
