import express, { type Express } from "express";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use("/api", (_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
app.all("/api/auth/*splat", toNodeHandler(auth));
app.use("/api/import", express.json({ limit: "40mb" }));
app.use("/api/journal-notes", express.json({ limit: "35mb" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
