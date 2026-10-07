import { useEffect, useState } from "react";
import { Download, Share } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};
// Capture the browser event before switching between sign-in and the dashboard.
let promptEvent: InstallPrompt | null = null;
let installed = false;
const listeners = new Set<() => void>();
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  promptEvent = event as InstallPrompt;
  listeners.forEach((fn) => fn());
});
window.addEventListener("appinstalled", () => {
  installed = true;
  promptEvent = null;
  listeners.forEach((fn) => fn());
});
export function InstallApp() {
  const [open, setOpen] = useState(false);
  const [, refresh] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone;
  useEffect(() => {
    const update = () => refresh((v) => v + 1);
    listeners.add(update);
    return () => {
      listeners.delete(update);
    };
  }, []);
  if (standalone || installed) return null;
  async function install() {
    if (!promptEvent) {
      setOpen(true);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const event = promptEvent;
      await event.prompt();
      await event.userChoice;
      promptEvent = null;
      refresh((v) => v + 1);
    } catch {
      setError("Use your browser menu to install this app.");
      setOpen(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button
        className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-semibold text-primary"
        disabled={busy}
        onClick={() => void install()}
      >
        <Download size={14} />
        {busy ? "Opening…" : "Install app"}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogTitle>Keep M.A.R.S. on your home screen</DialogTitle>
          <DialogDescription>
            Open your journal in its own app window. Sign in with the same
            account on every device.
          </DialogDescription>
          <div className="space-y-3 text-sm leading-relaxed">
            <p>
              <strong>iPhone or iPad:</strong> open this page in Safari, tap{" "}
              <Share className="inline" size={14} /> Share, then{" "}
              <strong>Add to Home Screen</strong> and enable “Open as Web App”
              if shown.
            </p>
            <p>
              <strong>Android or desktop:</strong> use your browser’s{" "}
              <strong>Install app</strong> or{" "}
              <strong>Add to Home screen</strong> menu.
            </p>
            <p className="text-xs text-muted-foreground">
              Installation requires a supported browser and an HTTPS site. Your
              journal still needs an internet connection to load and save data.
            </p>
            {!window.isSecureContext && (
              <p role="alert" className="text-destructive">
                Open the HTTPS version of this site to install it.
              </p>
            )}
            {error && <p role="alert">{error}</p>}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
