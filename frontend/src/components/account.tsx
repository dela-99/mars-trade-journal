import { InstallApp } from "./install-app";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
  type FormEvent,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Cloud,
  Eye,
  EyeOff,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Target,
} from "lucide-react";

type User = { id: string; name: string; email: string };
const AccountContext = createContext<{
  user: User;
  signOut: () => Promise<void>;
} | null>(null);
export const useAccount = () => useContext(AccountContext)!;
async function authRequest(path: string, body?: unknown) {
  const response = await fetch(`/api/auth/${path}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: "same-origin",
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(
      data.message || "Sign-in could not finish. Please try again.",
    );
  return data;
}
export function AccountGate({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    const check = async () => {
      try {
        const session = await authRequest("get-session");
        if (!active) return;
        setUser((current) => {
          if (current?.id !== session?.user?.id) {
            void queryClient.cancelQueries();
            queryClient.clear();
          }
          return session?.user ?? null;
        });
        setError("");
      } catch {
        if (active)
          setError(
            "Could not reach your account. Check your connection and retry.",
          );
      } finally {
        if (active) setLoading(false);
      }
    };
    void check();
    window.addEventListener("focus", check);
    const interval = window.setInterval(check, 30000);
    return () => {
      active = false;
      window.removeEventListener("focus", check);
      clearInterval(interval);
    };
  }, [queryClient, retry]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      await authRequest(mode === "signup" ? "sign-up/email" : "sign-in/email", {
        email: String(data.get("email")).trim(),
        password: data.get("password"),
        ...(mode === "signup" ? { name: String(data.get("name")).trim() } : {}),
      });
      await queryClient.cancelQueries();
      queryClient.clear();
      setRetry((v) => v + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }
  async function signOut() {
    setBusy(true);
    setError("");
    try {
      await authRequest("sign-out", {});
      await queryClient.cancelQueries();
      queryClient.clear();
      setUser(null);
    } catch {
      setError("Could not sign out. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }
  if (loading)
    return (
      <main className="grid min-h-screen place-items-center bg-background">
        <p role="status">Opening your journal…</p>
      </main>
    );
  if (user)
    return (
      <AccountContext.Provider value={{ user, signOut }}>
        <div key={user.id}>
          {error && (
            <p
              role="alert"
              className="bg-destructive p-3 text-center text-destructive-foreground"
            >
              {error}
            </p>
          )}
          {children}
        </div>
      </AccountContext.Provider>
    );
  return (
    <main className="paper-grid flex min-h-screen items-center justify-center px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-lg sm:p-9">
        <div className="flex items-center gap-3 text-primary">
          <Target size={28} />
          <span className="font-display font-extrabold tracking-[.2em]">
            M.A.R.S.
          </span>
        </div>
        <p className="mt-8 text-xs font-semibold uppercase tracking-widest text-primary">
          Your journal, wherever you trade
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold">
          {mode === "login" ? "Welcome back." : "Start your journal."}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Sign in on any device to access your trades, notes and saved
          screenshots.
        </p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          {mode === "signup" && (
            <label className="block text-sm font-medium">
              Name
              <input
                name="name"
                className="control-input mt-1 w-full"
                autoComplete="name"
                required
                maxLength={100}
              />
            </label>
          )}
          <label className="block text-sm font-medium">
            Email
            <input
              name="email"
              type="email"
              className="control-input mt-1 w-full"
              autoComplete="email"
              required
              maxLength={254}
            />
          </label>
          <label className="block text-sm font-medium">
            Password
            <span className="relative mt-1 block">
              <input
                name="password"
                type={showPassword ? "text" : "password"}
                className="control-input w-full pr-11"
                autoComplete={
                  mode === "signup" ? "new-password" : "current-password"
                }
                required
                minLength={mode === "signup" ? 12 : 1}
                maxLength={128}
              />
              <button
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                title={showPassword ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                onClick={() => setShowPassword((visible) => !visible)}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </span>
          </label>
          {mode === "signup" && (
            <p className="text-xs text-muted-foreground">
              Use at least 12 characters. Keep your password in a password
              manager.
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <button
            disabled={busy}
            className="btn-primary w-full justify-center"
            type="submit"
          >
            {busy
              ? "Please wait…"
              : mode === "login"
                ? "Sign in"
                : "Create account"}
          </button>
        </form>
        <button
          disabled={busy}
          className="mt-4 w-full text-sm text-primary"
          onClick={() => {
            setMode(mode === "login" ? "signup" : "login");
            setError("");
          }}
        >
          {mode === "login"
            ? "New here? Create an account"
            : "Already have an account? Sign in"}
        </button>
        <div className="mt-4 text-center">
          <InstallApp />
        </div>
        <div className="mt-7 border-t border-border pt-5 text-xs leading-relaxed text-muted-foreground">
          <p className="flex items-center gap-2">
            <ShieldCheck size={16} />
            Your journal belongs to your account.
          </p>
          <p className="mt-2">
            Have a backup? You can import it after signing in.
          </p>
        </div>
      </section>
    </main>
  );
}
export function AccountBar() {
  const { user, signOut } = useAccount();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 text-xs">
      <div className="flex min-w-0 items-center gap-2">
        <Cloud size={16} className="shrink-0 text-primary" />
        <span className="truncate">{user.email}</span>
        <span className="hidden text-muted-foreground sm:inline">
          · Updates refresh every 15 seconds
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <InstallApp />
        <button
          className="inline-flex items-center gap-1 text-primary"
          onClick={() => void queryClient.invalidateQueries()}
        >
          <RefreshCw size={13} />
          Refresh
        </button>
        <button
          disabled={busy}
          className="inline-flex items-center gap-1"
          onClick={async () => {
            setBusy(true);
            await signOut();
            setBusy(false);
          }}
        >
          <LogOut size={13} />
          {busy ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </div>
  );
}
