import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calendarDate,
  validCalendarDate,
  validImageDataUrl,
} from "./note-validation";

test("rejects normalized impossible dates and invalid timezones", () => {
  assert.equal(validCalendarDate("2026-02-30"), false);
  assert.equal(validCalendarDate("0000-01-01"), false);
  assert.equal(validCalendarDate("2024-02-29"), true);
  assert.equal(validCalendarDate("garbage"), false);
  assert.throws(() => calendarDate(new Date(), "not/a-zone"));
  assert.equal(
    calendarDate(new Date("2026-10-06T01:00:00Z"), "America/New_York"),
    "2026-10-05",
  );
});
test("checks MIME, signature, canonical base64 and decoded image size", () => {
  const data = (type: string, content: Buffer) =>
    `data:image/${type};base64,${content.toString("base64")}`;
  assert.equal(
    validImageDataUrl(
      data("png", Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    ),
    true,
  );
  assert.equal(
    validImageDataUrl(data("jpeg", Buffer.from([255, 216, 255, 224]))),
    true,
  );
  assert.equal(validImageDataUrl(data("png", Buffer.from("<script>"))), false);
  assert.equal(
    validImageDataUrl(data("svg+xml", Buffer.from("<svg/>"))),
    false,
  );
  assert.equal(validImageDataUrl("data:image/png;base64,===="), false);
  assert.equal(
    validImageDataUrl(data("png", Buffer.alloc(5 * 1024 * 1024 + 1))),
    false,
  );
});
