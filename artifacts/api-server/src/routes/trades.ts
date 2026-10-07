import { Router, type IRouter } from "express";
import { and, desc, eq, ilike, or } from "@workspace/db";
import { db, tradesTable } from "@workspace/db";
import {
  CreateTradeBody,
  CreateTradeResponse,
  DeleteTradeParams,
  GetTradeSummaryResponse,
  ListTradesQueryParams,
  ListTradesResponse,
  UpdateTradeBody,
  UpdateTradeParams,
  UpdateTradeResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function toApiTrade(trade: typeof tradesTable.$inferSelect) {
  return {
    ...trade,
    lotSize: Number(trade.lotSize),
    pnl: Number(trade.pnl),
    notes: trade.notes ?? null,
  };
}

function parseTradeBody(
  body: unknown,
  schema: typeof CreateTradeBody | typeof UpdateTradeBody,
) {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return { error: parsed.error.flatten() };
  }

  return {
    data: {
      ...parsed.data,
      notes: parsed.data.notes ?? null,
    },
  };
}

router.get("/trades", async (req, res) => {
  const parsedQuery = ListTradesQueryParams.safeParse(req.query);
  if (!parsedQuery.success) {
    res.status(400).json({ error: "Invalid trade filters" });
    return;
  }

  const { search, side } = parsedQuery.data;
  const filters: Array<ReturnType<typeof and>> = [
    eq(tradesTable.userId, res.locals.userId),
  ];

  if (side) {
    filters.push(eq(tradesTable.side, side));
  }

  if (search) {
    filters.push(
      or(
        ilike(tradesTable.symbol, `%${search}%`),
        ilike(tradesTable.asset, `%${search}%`),
        ilike(tradesTable.strategy, `%${search}%`),
        ilike(tradesTable.regime, `%${search}%`),
      ),
    );
  }

  const trades = await db
    .select()
    .from(tradesTable)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(tradesTable.entryAt), desc(tradesTable.id));

  const data = ListTradesResponse.parse(trades.map(toApiTrade));
  res.json(data);
});

router.post("/trades", async (req, res) => {
  const parsed = parseTradeBody(req.body, CreateTradeBody);
  if ("error" in parsed) {
    res
      .status(400)
      .json({ error: "Invalid trade data", details: parsed.error });
    return;
  }

  const [trade] = await db
    .insert(tradesTable)
    .values({
      userId: res.locals.userId,
      symbol: parsed.data.symbol.trim().toUpperCase(),
      asset: parsed.data.asset.trim(),
      side: parsed.data.side,
      lotSize: String(parsed.data.lotSize),
      entryAt: parsed.data.entryAt,
      strategy: parsed.data.strategy.trim(),
      regime: parsed.data.regime.trim(),
      pnl: String(parsed.data.pnl),
      notes: parsed.data.notes?.trim() || null,
    })
    .returning();

  req.log.info({ tradeId: trade.id }, "Trade journal entry created");
  res.status(201).json(CreateTradeResponse.parse(toApiTrade(trade)));
});

router.get("/trades/summary", async (_req, res) => {
  const trades = await db
    .select()
    .from(tradesTable)
    .where(eq(tradesTable.userId, res.locals.userId));
  const summary = {
    totalTrades: trades.length,
    buys: trades.filter((trade) => trade.side === "buy").length,
    sells: trades.filter((trade) => trade.side === "sell").length,
    totalPnl: trades.reduce((total, trade) => total + Number(trade.pnl), 0),
    symbolsTraded: new Set(trades.map((trade) => trade.symbol)).size,
    winningTrades: trades.filter((trade) => Number(trade.pnl) > 0).length,
    losingTrades: trades.filter((trade) => Number(trade.pnl) < 0).length,
  };

  res.json(GetTradeSummaryResponse.parse(summary));
});

router.patch("/trades/:id", async (req, res) => {
  const parsedParams = UpdateTradeParams.safeParse(req.params);
  const parsed = parseTradeBody(req.body, UpdateTradeBody);

  if (!parsedParams.success || "error" in parsed) {
    res.status(400).json({ error: "Invalid trade data" });
    return;
  }

  const [trade] = await db
    .update(tradesTable)
    .set({
      userId: res.locals.userId,
      symbol: parsed.data.symbol.trim().toUpperCase(),
      asset: parsed.data.asset.trim(),
      side: parsed.data.side,
      lotSize: String(parsed.data.lotSize),
      entryAt: parsed.data.entryAt,
      strategy: parsed.data.strategy.trim(),
      regime: parsed.data.regime.trim(),
      pnl: String(parsed.data.pnl),
      notes: parsed.data.notes?.trim() || null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(tradesTable.id, parsedParams.data.id),
        eq(tradesTable.userId, res.locals.userId),
      ),
    )
    .returning();

  if (!trade) {
    res.status(404).json({ error: "Trade not found" });
    return;
  }

  req.log.info({ tradeId: trade.id }, "Trade journal entry updated");
  res.json(UpdateTradeResponse.parse(toApiTrade(trade)));
});

router.delete("/trades/:id", async (req, res) => {
  const parsedParams = DeleteTradeParams.safeParse(req.params);
  if (!parsedParams.success) {
    res.status(400).json({ error: "Invalid trade id" });
    return;
  }

  const [trade] = await db
    .delete(tradesTable)
    .where(
      and(
        eq(tradesTable.id, parsedParams.data.id),
        eq(tradesTable.userId, res.locals.userId),
      ),
    )
    .returning({ id: tradesTable.id });

  if (!trade) {
    res.status(404).json({ error: "Trade not found" });
    return;
  }

  req.log.info({ tradeId: trade.id }, "Trade journal entry deleted");
  res.status(204).send();
});

export default router;
