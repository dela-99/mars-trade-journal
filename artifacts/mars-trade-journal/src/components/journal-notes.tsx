import { useState, type FormEvent } from "react";
import { BookOpen, ImagePlus, Link2, Pencil, Plus, Trash2 } from "lucide-react";
import {
  createJournalNote,
  updateJournalNote,
  deleteJournalNote,
  type JournalNote,
  type JournalNoteInput,
  type Trade,
} from "@workspace/api-client-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { journalDate, noteLinks, readDataUrl } from "@/lib/journal";

export function JournalNotes({
  notes,
  trades,
  onEdit,
  onNew,
  onChanged,
}: {
  notes: JournalNote[];
  trades: Trade[];
  onEdit: (note: JournalNote) => void;
  onNew: () => void;
  onChanged: () => void;
}) {
  const [search, setSearch] = useState("");
  const [date, setDate] = useState("");
  const [removing, setRemoving] = useState<JournalNote | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const filtered = notes.filter(
    (n) =>
      (!date || n.date === date) &&
      `${n.title} ${n.body} ${n.attachments.map((a) => a.caption).join(" ")}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  async function remove() {
    if (!removing) return;
    setBusy(true);
    setError("");
    try {
      await deleteJournalNote(removing.id);
      setRemoving(null);
      onChanged();
    } catch {
      setError("Could not delete the note. Try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="mt-6 space-y-5" aria-label="Journal notes">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold">
            The thinking behind the trade.
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Daily reflections, chart captures, and lessons — connected by date.
          </p>
        </div>
        <button className="btn-primary" onClick={onNew}>
          <Plus size={16} />
          New note
        </button>
      </div>
      <div className="flex flex-wrap gap-3">
        <input
          className="control-input max-w-xs"
          aria-label="Search notes"
          placeholder="Search reflections or captions…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <input
          className="control-input w-auto"
          type="date"
          aria-label="Filter notes by date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        {(date || search) && (
          <button
            className="btn-quiet"
            onClick={() => {
              setDate("");
              setSearch("");
            }}
          >
            Clear filters
          </button>
        )}
      </div>
      {filtered.length === 0 ? (
        <div className="stat-card px-5 py-14 text-center">
          <BookOpen className="mx-auto text-primary" />
          <h3 className="mt-3 font-semibold">
            {notes.length
              ? "No notes match your filters."
              : "Give your trades some context."}
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Write a reflection, add screenshots, and choose the day you traded.
          </p>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {filtered.map((note) => {
            const links = noteLinks(note, trades);
            return (
              <article
                key={note.id}
                className="stat-card overflow-hidden"
                data-testid={`note-${note.id}`}
              >
                {note.attachments[0] && (
                  <button
                    className="block w-full bg-muted"
                    onClick={() => onEdit(note)}
                    aria-label={`View screenshots for ${note.title}`}
                  >
                    <img
                      loading="lazy"
                      className="h-48 w-full object-contain"
                      src={note.attachments[0].dataUrl}
                      alt={
                        note.attachments[0].caption || note.attachments[0].name
                      }
                    />
                  </button>
                )}
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono-custom text-xs text-primary">
                        {note.date} · {note.timeZone}
                      </p>
                      <h3 className="mt-2 break-words font-display text-xl font-bold">
                        {note.title}
                      </h3>
                    </div>
                    <div className="flex shrink-0">
                      <button
                        className="btn-quiet"
                        aria-label={`Edit note ${note.title}`}
                        onClick={() => onEdit(note)}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        className="btn-quiet"
                        aria-label={`Delete note ${note.title}`}
                        onClick={() => {
                          setRemoving(note);
                          setError("");
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <p className="mt-3 line-clamp-5 whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">
                    {note.body}
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3 text-xs">
                    <Link2 size={14} className="text-primary" />
                    <span>
                      {note.linkMode === "date" ? "By date" : "Selected trades"}
                    </span>
                    {links.linked.map((t) => (
                      <span
                        className="rounded bg-primary/10 px-2 py-1 text-primary"
                        key={t.id}
                      >
                        #{t.id} {t.symbol} · {t.side}
                      </span>
                    ))}
                    {!links.linked.length && (
                      <span className="text-muted-foreground">
                        {note.linkMode === "date"
                          ? "No trades yet — matches will link automatically"
                          : "No linked trades available"}
                      </span>
                    )}
                  </div>
                  {(links.missingTradeIds.length > 0 ||
                    links.changedDateTradeIds.length > 0) && (
                    <p className="mt-2 text-xs text-destructive">
                      Review links: {links.missingTradeIds.length} deleted,{" "}
                      {links.changedDateTradeIds.length} moved to another date.
                    </p>
                  )}
                  <button
                    className="btn-quiet mt-3 px-0 text-xs"
                    onClick={() => onEdit(note)}
                  >
                    Read note · {note.attachments.length} screenshots
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
      <Dialog
        open={Boolean(removing)}
        onOpenChange={(open) => {
          if (!open && !busy) setRemoving(null);
        }}
      >
        <DialogContent>
          <DialogTitle>Delete this note?</DialogTitle>
          <DialogDescription>
            “{removing?.title}” and its screenshots will be permanently removed.
            Linked trades will remain.
          </DialogDescription>
          {error && (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button
              className="btn-quiet"
              onClick={() => setRemoving(null)}
              disabled={busy}
            >
              Keep note
            </button>
            <button
              className="btn-primary"
              disabled={busy}
              onClick={() => void remove()}
            >
              {busy ? "Deleting…" : "Delete note"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

export function NoteEditor({
  note,
  trade,
  trades,
  onClose,
  onSaved,
}: {
  note?: JournalNote;
  trade?: Trade;
  trades: Trade[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<JournalNoteInput>(() => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return (
      note ?? {
        date: journalDate(trade?.entryAt ?? new Date().toISOString(), timeZone),
        timeZone,
        title: "",
        body: "",
        linkMode: trade ? "selected" : "date",
        selectedTradeIds: trade ? [trade.id] : [],
        attachments: [],
      }
    );
  });
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [discard, setDiscard] = useState(false);
  const matches = trades.filter(
    (t) => journalDate(t.entryAt, form.timeZone) === form.date,
  );
  const links = noteLinks(form, trades);
  function change(patch: Partial<JournalNoteInput>) {
    setForm((f) => ({ ...f, ...patch }));
    setDirty(true);
  }
  function close() {
    if (busy || reading) return;
    if (dirty) setDiscard(true);
    else onClose();
  }
  async function filesSelected(files: File[]) {
    setReading(true);
    setError("");
    try {
      if (files.length + form.attachments.length > 5)
        throw new Error("Add up to 5 screenshots per note.");
      if (
        files.some(
          (f) =>
            !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(
              f.type,
            ) ||
            !f.size ||
            f.size > 5 * 1024 * 1024,
        )
      )
        throw new Error(
          "Choose PNG, JPEG, WebP or GIF images up to 5 MB each.",
        );
      const attachments = await Promise.all(
        files.map(async (f) => {
          const dataUrl = await readDataUrl(f);
          const image = new Image();
          image.src = dataUrl;
          await image.decode().catch(() => {
            throw new Error(`Cannot read ${f.name} as an image.`);
          });
          return {
            id: crypto.randomUUID(),
            name: f.name,
            caption: "",
            dataUrl,
          };
        }),
      );
      change({ attachments: [...form.attachments, ...attachments] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load screenshots.");
    } finally {
      setReading(false);
    }
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!form.title.trim()) {
      setError("Give your note a title.");
      return;
    }
    if (form.linkMode === "selected" && !form.selectedTradeIds.length) {
      setError("Select at least one trade or choose automatic date linking.");
      return;
    }
    setBusy(true);
    try {
      if (note) await updateJournalNote(note.id, form);
      else await createJournalNote(form);
      onSaved();
    } catch {
      setError(
        "Could not save. Your draft is still here. Check the connection, date and trade links, then try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent
        className="max-w-3xl"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogTitle className="font-display text-2xl">
          {note ? "Your journal note" : "Capture the whole story"}
        </DialogTitle>
        <DialogDescription>
          Save your reflections and screenshots together. The journal date
          determines which trades match.
        </DialogDescription>
        <form onSubmit={(e) => void save(e)} className="space-y-5">
          <fieldset
            disabled={busy || reading}
            className="space-y-5 disabled:opacity-70"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <label>
                <span className="control-label">Journal date</span>
                <input
                  type="date"
                  required
                  className="control-input"
                  value={form.date}
                  onChange={(e) =>
                    change({
                      date: e.target.value,
                      selectedTradeIds: [],
                      linkMode: "date",
                    })
                  }
                />
              </label>
              <div>
                <span className="control-label">Date matching timezone</span>
                <p className="py-2 text-sm">{form.timeZone}</p>
                <p className="text-xs text-muted-foreground">
                  Saved with this note, even if you travel.
                </p>
              </div>
            </div>
            <label className="block">
              <span className="control-label">Title</span>
              <input
                required
                maxLength={200}
                className="control-input"
                placeholder="What did this session teach you?"
                value={form.title}
                onChange={(e) => change({ title: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="control-label">Your notes</span>
              <textarea
                className="control-input min-h-44"
                maxLength={100000}
                placeholder="The setup, your reasoning, how you felt, and what you would do differently…"
                value={form.body}
                onChange={(e) => change({ body: e.target.value })}
              />
            </label>
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
              <label>
                <span className="control-label">Link to trades</span>
                <select
                  className="control-input"
                  value={form.linkMode}
                  onChange={(e) =>
                    change({
                      linkMode: e.target.value as "date" | "selected",
                      selectedTradeIds: [],
                    })
                  }
                >
                  <option value="date">
                    Automatically link all trades on this date
                  </option>
                  <option value="selected">
                    Choose specific trades on this date
                  </option>
                </select>
              </label>
              <p className="mt-2 text-xs text-muted-foreground">
                {matches.length} trades on {form.date || "this date"}.{" "}
                {form.linkMode === "date"
                  ? "Trades added later will also match automatically."
                  : "Only the trades you select will be linked."}
              </p>
              {form.linkMode === "selected" && (
                <div className="mt-3 max-h-40 space-y-2 overflow-auto">
                  {matches.map((t) => (
                    <label
                      className="flex items-center gap-2 text-sm"
                      key={t.id}
                    >
                      <input
                        type="checkbox"
                        checked={form.selectedTradeIds.includes(t.id)}
                        onChange={(e) =>
                          change({
                            selectedTradeIds: e.target.checked
                              ? [...form.selectedTradeIds, t.id]
                              : form.selectedTradeIds.filter(
                                  (id) => id !== t.id,
                                ),
                          })
                        }
                      />
                      #{t.id} {t.symbol} · {t.side} ·{" "}
                      {new Date(t.entryAt).toLocaleTimeString([], {
                        timeZone: form.timeZone,
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </label>
                  ))}
                  {form.selectedTradeIds
                    .filter((id) => !matches.some((t) => t.id === id))
                    .map((id) => (
                      <label
                        key={id}
                        className="flex items-center gap-2 text-sm text-destructive"
                      >
                        <input
                          type="checkbox"
                          checked
                          onChange={() =>
                            change({
                              selectedTradeIds: form.selectedTradeIds.filter(
                                (x) => x !== id,
                              ),
                            })
                          }
                        />
                        Trade #{id} — deleted or date changed (uncheck to
                        unlink)
                      </label>
                    ))}
                </div>
              )}
              {form.linkMode === "date" && links.linked.length > 0 && (
                <p className="mt-2 text-xs text-primary">
                  {links.linked.map((t) => `#${t.id} ${t.symbol}`).join(" · ")}
                </p>
              )}
            </div>
            <div>
              <div className="flex items-center justify-between">
                <span className="control-label">
                  Screenshots ({form.attachments.length}/5)
                </span>
                <span className="text-xs text-muted-foreground">
                  Saved with your note
                </span>
              </div>
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-primary/40 bg-primary/5 p-4">
                <ImagePlus className="shrink-0 text-primary" size={24} />
                <span className="min-w-0 text-sm">
                  <span className="block font-semibold">
                    {reading ? "Reading images…" : "Add chart screenshots"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    PNG, JPG, WebP or GIF · 5 MB each
                  </span>
                  <input
                    className="mt-2 block w-full text-xs"
                    aria-label="Upload note screenshots"
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    multiple
                    onChange={(e) => {
                      const files = Array.from(e.target.files ?? []);
                      e.target.value = "";
                      if (files.length) void filesSelected(files);
                    }}
                  />
                </span>
              </label>
              <div className="mt-3 space-y-4">
                {form.attachments.map((a) => (
                  <div
                    className="rounded-xl border border-border p-3"
                    key={a.id}
                  >
                    <img
                      className="max-h-80 w-full rounded-lg object-contain"
                      src={a.dataUrl}
                      alt={a.caption || a.name}
                    />
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="truncate text-xs text-muted-foreground">
                        {a.name}
                      </span>
                      <button
                        type="button"
                        className="btn-quiet shrink-0"
                        aria-label={`Remove ${a.name}`}
                        onClick={() =>
                          change({
                            attachments: form.attachments.filter(
                              (x) => x.id !== a.id,
                            ),
                          })
                        }
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                    <label>
                      <span className="control-label">Screenshot caption</span>
                      <textarea
                        className="control-input"
                        maxLength={2000}
                        placeholder="Explain what the AI should notice in this chart…"
                        value={a.caption}
                        onChange={(e) =>
                          change({
                            attachments: form.attachments.map((x) =>
                              x.id === a.id
                                ? { ...x, caption: e.target.value }
                                : x,
                            ),
                          })
                        }
                      />
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </fieldset>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {discard && (
            <div role="alert" className="rounded-lg border p-3 text-sm">
              Discard your unsaved changes?
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  className="btn-quiet"
                  onClick={() => setDiscard(false)}
                >
                  Keep writing
                </button>
                <button
                  type="button"
                  className="btn-quiet text-destructive"
                  onClick={onClose}
                >
                  Discard changes
                </button>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2 border-t pt-4">
            <button
              type="button"
              className="btn-quiet"
              disabled={busy || reading}
              onClick={close}
            >
              Close
            </button>
            <button className="btn-primary" disabled={busy || reading}>
              {busy ? "Saving…" : "Save note"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
