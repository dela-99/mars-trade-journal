import { Router, type IRouter, type Request, type Response } from "express";
import { desc, eq, inArray } from "drizzle-orm";
import { db, journalNotesTable, tradesTable } from "@workspace/db";
import { CreateJournalNoteBody } from "@workspace/api-zod";
import {
  calendarDate,
  validCalendarDate,
  validImageDataUrl,
} from "../lib/note-validation";

const router: IRouter = Router();

router.get("/journal-notes", async (_req, res) => {
  res.json(
    await db
      .select()
      .from(journalNotesTable)
      .orderBy(desc(journalNotesTable.date), desc(journalNotesTable.id)),
  );
});

router.post("/journal-notes", saveNote);
router.put("/journal-notes/:id", saveNote);

async function saveNote(req: Request, res: Response) {
  const id = req.params.id === undefined ? undefined : Number(req.params.id);
  const parsed = CreateJournalNoteBody.safeParse(req.body);
  if (
    !parsed.success ||
    (id !== undefined && (!Number.isSafeInteger(id) || id < 1 || id > 2147483647))
  ) {
    res
      .status(400)
      .json({
        error: "Invalid note. Check field lengths and screenshot limits.",
      });
    return;
  }
  const data = parsed.data;
  try {
    calendarDate(new Date(), data.timeZone);
  } catch {
    res.status(400).json({ error: "Choose a valid timezone." });
    return;
  }
  if (
    !validCalendarDate(data.date) ||
    !data.title.trim() ||
    data.selectedTradeIds.some(id => id > 2147483647) ||
    data.attachments.some((a) => !validImageDataUrl(a.dataUrl)) ||
    new Set(data.attachments.map((a) => a.id)).size !==
      data.attachments.length ||
    new Set(data.selectedTradeIds).size !== data.selectedTradeIds.length ||
    (data.linkMode === "selected" && !data.selectedTradeIds.length) ||
    (data.linkMode === "date" && data.selectedTradeIds.length > 0)
  ) {
    res
      .status(400)
      .json({
        error:
          "Check the date, trade selection and screenshots (PNG, JPEG, WebP or GIF, up to 5 MB each).",
      });
    return;
  }
  // Existing selections can survive a deleted or re-dated trade; new selections must match.
  const [existing] =
    id === undefined
      ? []
      : await db
          .select()
          .from(journalNotesTable)
          .where(eq(journalNotesTable.id, id));
  if (id !== undefined && !existing) {
    res.status(404).json({ error: "Note not found" });
    return;
  }
  const retainedIds =
    existing?.date === data.date &&
    existing.timeZone === data.timeZone &&
    existing.linkMode === "selected"
      ? existing.selectedTradeIds
      : [];
  const newIds = data.selectedTradeIds.filter(
    (tradeId) => !retainedIds.includes(tradeId),
  );
  if (newIds.length) {
    const trades = await db
      .select()
      .from(tradesTable)
      .where(inArray(tradesTable.id, newIds));
    if (
      trades.length !== newIds.length ||
      trades.some((t) => calendarDate(t.entryAt, data.timeZone) !== data.date)
    ) {
      res
        .status(400)
        .json({
          error:
            "Selected trades must exist and match the note date in its timezone. Refresh and try again.",
        });
      return;
    }
  }
  const values = { ...data, title: data.title.trim(), updatedAt: new Date() };
  const [note] =
    id === undefined
      ? await db.insert(journalNotesTable).values(values).returning()
      : await db
          .update(journalNotesTable)
          .set(values)
          .where(eq(journalNotesTable.id, id))
          .returning();
  if (!note) {
    res.status(404).json({ error: "Note not found" });
    return;
  }
  res.status(id === undefined ? 201 : 200).json(note);
}

router.delete("/journal-notes/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1 || id > 2147483647) {
    res.status(400).json({ error: "Invalid note id" });
    return;
  }
  const [note] = await db
    .delete(journalNotesTable)
    .where(eq(journalNotesTable.id, id))
    .returning({ id: journalNotesTable.id });
  if (!note) {
    res.status(404).json({ error: "Note not found" });
    return;
  }
  res.status(204).send();
});

export default router;
