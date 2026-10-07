// Check actual image signatures as well as the declared MIME type. SVG is excluded.
export function validImageDataUrl(value: string): boolean {
  const match =
    /^data:image\/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/]+={0,2})$/.exec(
      value,
    );
  if (!match) return false;
  const bytes = Buffer.from(match[2], "base64");
  if (
    !bytes.length ||
    bytes.length > 5 * 1024 * 1024 ||
    bytes.toString("base64") !== match[2]
  )
    return false;
  switch (match[1]) {
    case "png":
      return bytes
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    case "jpeg":
      return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    case "gif":
      return ["GIF87a", "GIF89a"].includes(bytes.toString("ascii", 0, 6));
    case "webp":
      return (
        bytes.toString("ascii", 0, 4) === "RIFF" &&
        bytes.toString("ascii", 8, 12) === "WEBP"
      );
    default:
      return false;
  }
}

export function calendarDate(value: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

export function validCalendarDate(value: string) {
  const parsed = new Date(`${value}T12:00:00Z`);
  return (
    Number(value.slice(0, 4)) >= 1 &&
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}
