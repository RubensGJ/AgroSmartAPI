const DEFAULT_TIME_ZONE = "America/Sao_Paulo";

function getOffsetForTimeZone(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const zone = parts.find((part) => part.type === "timeZoneName")?.value || "";
  const match = zone.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/i);

  if (!match) {
    return "-03:00";
  }

  const sign = match[1];
  const hours = match[2].padStart(2, "0");
  const minutes = (match[3] || "00").padStart(2, "0");
  return `${sign}${hours}:${minutes}`;
}

function getDateTimeParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    hourCycle: "h23",
  }).formatToParts(date);

  const valueByType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: valueByType.year,
    month: valueByType.month,
    day: valueByType.day,
    hour: valueByType.hour,
    minute: valueByType.minute,
    second: valueByType.second,
  };
}

function getNowInBrasiliaISO() {
  const now = new Date();
  const timeZone = process.env.APP_TIMEZONE || DEFAULT_TIME_ZONE;
  const dateParts = getDateTimeParts(now, timeZone);
  const offset = getOffsetForTimeZone(now, timeZone);

  return `${dateParts.year}-${dateParts.month}-${dateParts.day}T${dateParts.hour}:${dateParts.minute}:${dateParts.second}${offset}`;
}

module.exports = {
  getNowInBrasiliaISO,
};
