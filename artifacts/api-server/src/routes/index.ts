import { Router, type IRouter } from "express";
import healthRouter from "./health";
import tradesRouter from "./trades";

import journalNotesRouter from "./journal-notes";

const router: IRouter = Router();

router.use(healthRouter);
router.use(tradesRouter);
router.use(journalNotesRouter);

export default router;
