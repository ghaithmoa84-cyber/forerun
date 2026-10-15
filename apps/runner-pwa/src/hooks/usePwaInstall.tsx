import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

// Module-level storage to catch the event even before React mounts
let savedPromptEvent: BeforeInstallPromptEvent | null = null;

const PROMPT_EVENT_NAME = 'forerun-pwa-prompt-available';
const INSTALLED_EVENT_NAME = 'forerun-pwa-installed';

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the default browser mini-infobar or automatic behavior
    e.preventDefault();
    savedPromptEvent = e as BeforeInstallPromptEvent;
    window.dispatchEvent(new Event(PROMPT_EVENT_NAME));
  });

  window.addEventListener('appinstalled', () => {
    savedPromptEvent = null;
    window.dispatchEvent(new Event(INSTALLED_EVENT_NAME));
  });
}

function checkIsStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true ||
    document.referrer.includes('android-app://')
  );
}

interface PwaInstallContextType {
  isInstallable: boolean;
  isInstalled: boolean;
  isInstalling: boolean;
  installError: string | null;
  clearInstallError: () => void;
  installApp: () => Promise<boolean>;
}

const PwaInstallContext = createContext<PwaInstallContextType | undefined>(undefined);

const INSTALL_TIMEOUT_MS = 15000;

export function PwaInstallProvider({ children }: { children: ReactNode }) {
  const [isStandalone, setIsStandalone] = useState<boolean>(() => checkIsStandalone());
  const [hasPrompt, setHasPrompt] = useState<boolean>(() => savedPromptEvent !== null);
  const [isInstalling, setIsInstalling] = useState<boolean>(false);
  const [installError, setInstallError] = useState<string | null>(null);

  const clearInstallError = useCallback(() => {
    setInstallError(null);
  }, []);

  useEffect(() => {
    const handlePrompt = () => {
      setHasPrompt(true);
    };

    const handleInstalled = () => {
      setHasPrompt(false);
      setIsStandalone(true);
      setInstallError(null);
    };

    window.addEventListener(PROMPT_EVENT_NAME, handlePrompt);
    window.addEventListener(INSTALLED_EVENT_NAME, handleInstalled);

    // Also monitor media query changes in case display mode changes
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleMediaChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setIsStandalone(true);
        setHasPrompt(false);
      }
    };
    mediaQuery.addEventListener('change', handleMediaChange);

    return () => {
      window.removeEventListener(PROMPT_EVENT_NAME, handlePrompt);
      window.removeEventListener(INSTALLED_EVENT_NAME, handleInstalled);
      mediaQuery.removeEventListener('change', handleMediaChange);
    };
  }, []);

  const installApp = useCallback(async (): Promise<boolean> => {
    if (!savedPromptEvent) {
      setInstallError(
        'المتصفح لم يُتح نافذة التثبيت التلقائي بعد. يمكنك التثبيت يدوياً عبر قائمة المتصفح (⋮) ثم "إضافة إلى الشاشة الرئيسية".',
      );
      return false;
    }

    setIsInstalling(true);
    setInstallError(null);

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const timeoutPromise = new Promise<{ outcome: 'dismissed'; platform: 'timeout' }>((resolve) => {
      timeoutId = setTimeout(() => {
        resolve({ outcome: 'dismissed', platform: 'timeout' });
      }, INSTALL_TIMEOUT_MS);
    });

    try {
      await savedPromptEvent.prompt();
      const choice = await Promise.race([savedPromptEvent.userChoice, timeoutPromise]);

      if (timeoutId) clearTimeout(timeoutId);

      if (choice.platform === 'timeout') {
        setInstallError(
          'لم يستجب المتصفح لنافذة التثبيت بالوقت المحدد. يمكنك تثبيت التطبيق يدوياً عبر قائمة المتصفح (⋮) ثم اختيار "إضافة إلى الشاشة الرئيسية" أو "تثبيت التطبيق".',
        );
        return false;
      }

      if (choice.outcome === 'accepted') {
        savedPromptEvent = null;
        setHasPrompt(false);
        setIsStandalone(true);
        setInstallError(null);
        return true;
      }

      // User explicitly dismissed the native prompt dialog
      return false;
    } catch (err) {
      if (timeoutId) clearTimeout(timeoutId);
      console.error('Failed to trigger PWA installation prompt:', err);
      setInstallError(
        'تعذر إكمال التثبيت التلقائي عبر المتصفح. يمكنك التثبيت يدوياً عبر قائمة المتصفح (⋮) ثم اختيار "إضافة إلى الشاشة الرئيسية".',
      );
      return false;
    } finally {
      setIsInstalling(false);
    }
  }, []);

  const isInstallable = !isStandalone && hasPrompt;

  return (
    <PwaInstallContext.Provider
      value={{
        isInstallable,
        isInstalled: isStandalone,
        isInstalling,
        installError,
        clearInstallError,
        installApp,
      }}
    >
      {children}
    </PwaInstallContext.Provider>
  );
}

export function usePwaInstall(): PwaInstallContextType {
  const context = useContext(PwaInstallContext);
  if (!context) {
    throw new Error('usePwaInstall must be used within a PwaInstallProvider');
  }
  return context;
}
