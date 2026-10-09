import { Router } from "express";
import { createHash, randomUUID } from "node:crypto";
import { and, eq, sql } from "../db/index";
import {
  db,
  tradesTable,
  journalNotesTable,
  importRecordsTable,
} from "../db/index";
import { CreateTradeBody, CreateJournalNoteBody } from "../api-zod/index";
import {
  calendarDate,
  validCalendarDate,
  validImageDataUrl,
} from "../lib/note-validation";

import {
  tradeIdentity,
  noteIdentity,
  imageIdentity,
} from "../lib/import-identity";

const router = Router();
class ImportConflictError extends Error {}
const hash = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
const timestamp = (value: unknown) => {
  if (value === undefined) return undefined;
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d\d-\d\dT(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(
      value,
    ) ||
    !validCalendarDate(value.slice(0, 10)) ||
    !Number.isFinite(Date.parse(value))
  )
    throw new Error(
      "Backup timestamps must be valid ISO dates with an explicit timezone.",
    );
  return new Date(value);
};
const sourceId = (id: unknown) => {
  if (!Number.isSafeInteger(id) || Number(id) < 1 || Number(id) > 2147483647)
    throw new Error("Backup IDs must be positive integers.");
  return Number(id);
};
function validateInput(body: unknown) {
  const raw = body as { trades?: unknown[]; notes?: unknown[] };
  if (
    !raw ||
    !Array.isArray(raw.trades) ||
    !Array.isArray(raw.notes) ||
    raw.trades.length > 10000 ||
    raw.notes.length > 1000 ||
    (!raw.trades.length && !raw.notes.length)
  )
    throw new Error(
      "Choose a backup containing up to 10,000 trades and 1,000 notes.",
    );
  const trades = raw.trades.map((value) => {
    const input = value as Record<string, unknown>;
    const id = sourceId(input.id);
    timestamp(input.entryAt);
    const parsed = CreateTradeBody.parse(input);
    if (
      !parsed.symbol.trim() ||
      parsed.symbol.length > 32 ||
      !parsed.asset.trim() ||
      parsed.asset.length > 96 ||
      !parsed.strategy.trim() ||
      parsed.strategy.length > 96 ||
      !parsed.regime.trim() ||
      parsed.regime.length > 96 ||
      (parsed.notes?.length ?? 0) > 100000
    )
      throw new Error(`Trade ${id}: field length or required text is invalid.`);
    const data = {
      ...parsed,
      symbol: parsed.symbol.trim().toUpperCase(),
      asset: parsed.asset.trim(),
      strategy: parsed.strategy.trim(),
      regime: parsed.regime.trim(),
      notes: parsed.notes || null,
    };
    return {
      id,
      data,
      createdAt: timestamp(input.createdAt),
      updatedAt: timestamp(input.updatedAt),
    };
  });
  const notes = raw.notes.map((value) => {
    const input = value as Record<string, unknown>;
    const id = sourceId(input.id);
    const data = CreateJournalNoteBody.parse(input);
    calendarDate(new Date(), data.timeZone);
    if (
      !validCalendarDate(data.date) ||
      !data.title.trim() ||
      new Set(data.selectedTradeIds).size !== data.selectedTradeIds.length ||
      data.selectedTradeIds.some((id) => id > 2147483647) ||
      (data.linkMode === "date" && data.selectedTradeIds.length) ||
      (data.linkMode === "selected" && !data.selectedTradeIds.length) ||
      data.attachments.some((a) => !validImageDataUrl(a.dataUrl)) ||
      new Set(data.attachments.map((a) => a.id)).size !==
        data.attachments.length
    )
      throw new Error(`Note ${id}: invalid date, links or screenshots.`);
    return {
      id,
      data,
      createdAt: timestamp(input.createdAt),
      updatedAt: timestamp(input.updatedAt),
    };
  });
  if (
    new Set(trades.map((t) => t.id)).size !== trades.length ||
    new Set(notes.map((n) => n.id)).size !== notes.length
  )
    throw new Error("Duplicate IDs in backup.");
  return { trades, notes };
}

router.post("/import/:action", async (req, res) => {
  if (!["preview", "commit"].includes(String(req.params.action))) {
    res.sendStatus(404);
    return;
  }
  let input: ReturnType<typeof validateInput>;
  try {
    input = validateInput(req.body);
  } catch (error) {
    res.status(400).json({
      error:
        error instanceof Error && error.name !== "ZodError"
          ? error.message
          : "Some records have invalid or missing fields. No records were imported.",
    });
    return;
  }
  const userId = res.locals.userId as string;
  const preview = req.params.action === "preview";
  try {
    const result = await db.transaction(async (tx) => {
      // Serialize imports for one account: retries and two devices cannot insert duplicates.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}))`);
      const currentTrades = await tx
        .select()
        .from(tradesTable)
        .where(eq(tradesTable.userId, userId));
      const currentNotes = await tx
        .select()
        .from(journalNotesTable)
        .where(eq(journalNotesTable.userId, userId));
      const receipts = await tx
        .select()
        .from(importRecordsTable)
        .where(eq(importRecordsTable.userId, userId));
      const tradeMap = new Map<number, number>();
      const counts = {
        tradesAdded: 0,
        notesAdded: 0,
        tradesSkipped: 0,
        notesSkipped: 0,
        images: 0,
        missingLinks: 0,
      };
      const seenTrades = new Map(
        currentTrades.map((t) => [tradeIdentity(t), t.id]),
      );
      const seenNotes = new Map(
        currentNotes.map((n) => [noteIdentity(n), n.id]),
      );
      const preserveIdenticalTrades = req.body.preserveIdenticalTrades === true;
      const consumed = new Set<number>();
      for (const t of input.trades) {
        const key = hash(["trade", t.id, t.createdAt ?? t.data]);
        const receipt = receipts.find((r) => r.sourceKey === key);
        // A deleted imported record stays deleted. Import never resurrects it or overwrites edits.
        const identity = tradeIdentity(t.data);
        const same = preserveIdenticalTrades
          ? currentTrades.find(
              (row) => !consumed.has(row.id) && tradeIdentity(row) === identity,
            )?.id
          : seenTrades.get(identity);
        let targetId = receipt?.entityId ?? same;
        if (targetId !== undefined) {
          counts.tradesSkipped++;
          consumed.add(targetId);
        } else {
          counts.tradesAdded++;
          if (!preview) {
            const [saved] = await tx
              .insert(tradesTable)
              .values({
                ...t.data,
                userId,
                lotSize: String(t.data.lotSize),
                pnl: String(t.data.pnl),
                createdAt: t.createdAt,
                updatedAt: t.updatedAt,
              })
              .returning();
            targetId = saved.id;
          } else targetId = -t.id;
        }
        seenTrades.set(identity, targetId);
        tradeMap.set(t.id, targetId);
        if (!preview && !receipt)
          await tx.insert(importRecordsTable).values({
            id: randomUUID(),
            userId,
            sourceKey: key,
            entityId: targetId,
            kind: "trade",
          });
      }
      for (const n of input.notes) {
        // Attachment IDs are transport identifiers; image bytes/captions determine identity.
        const key = hash([
          "note",
          n.id,
          n.createdAt ?? {
            ...n.data,
            attachments: n.data.attachments.map(({ id: _, ...a }) => a),
          },
        ]);
        const receipt = receipts.find((r) => r.sourceKey === key);
        if (receipt) {
          counts.notesSkipped++;
          // A CSV may have restored the note without image bytes. A later full backup
          // can fill those gaps without overwriting edited text, links or existing images.
          const existing = currentNotes.find(
            (row) => row.id === receipt.entityId,
          );
          if (existing) {
            const additions = n.data.attachments.filter(
              (a) =>
                !existing.attachments.some(
                  (old) =>
                    old.id === a.id || imageIdentity(old) === imageIdentity(a),
                ),
            );
            if (existing.attachments.length + additions.length > 5)
              throw new ImportConflictError(
                "A restored note would exceed five screenshots. Remove unneeded images from that note before retrying. No records were imported.",
              );
            {
              counts.images += additions.length;
              const combined = [...existing.attachments, ...additions];
              seenNotes.delete(noteIdentity(existing));
              existing.attachments = combined;
              seenNotes.set(noteIdentity(existing), existing.id);
              if (!preview && additions.length)
                await tx
                  .update(journalNotesTable)
                  .set({
                    attachments: combined,
                    updatedAt: new Date(),
                  })
                  .where(
                    and(
                      eq(journalNotesTable.id, existing.id),
                      eq(journalNotesTable.userId, userId),
                    ),
                  );
            }
          }
          continue;
        }
        const mappedIds: number[] = [];
        for (const id of n.data.selectedTradeIds) {
          let mapped = tradeMap.get(id);
          if (mapped === undefined) {
            counts.missingLinks++;
            if (preview) mapped = -id;
            else {
              // Reserve an unused ID so a missing source link can never point at another user's trade.
              const reserved = await tx.execute<{ id: number }>(
                sql`select nextval(pg_get_serial_sequence('trades','id'))::int as id`,
              );
              mapped = reserved.rows[0].id;
            }
          }
          tradeMap.set(id, mapped);
          mappedIds.push(mapped);
        }
        const data = { ...n.data, selectedTradeIds: [...new Set(mappedIds)] };
        const identity = noteIdentity(data);
        let targetId = seenNotes.get(identity);
        if (targetId !== undefined) counts.notesSkipped++;
        else {
          counts.notesAdded++;
          counts.images += data.attachments.length;
          if (!preview) {
            const [saved] = await tx
              .insert(journalNotesTable)
              .values({
                ...data,
                userId,
                createdAt: n.createdAt,
                updatedAt: n.updatedAt,
              })
              .returning();
            targetId = saved.id;
          } else targetId = -n.id;
        }
        seenNotes.set(identity, targetId!);
        if (!preview)
          await tx.insert(importRecordsTable).values({
            id: randomUUID(),
            userId,
            sourceKey: key,
            entityId: targetId!,
            kind: "note",
          });
      }
      return counts;
    });
    res.json(result);
  } catch (error) {
    if (error instanceof ImportConflictError) {
      res.status(409).json({ error: error.message });
      return;
    }
    throw error;
  }
});
export default router;
