import test from "node:test";
import assert from "node:assert/strict";
import {
  addCalendarDaysGregorian,
  enumerateInclusiveDays,
  inclusiveDayCount,
  isValidIsoCalendarDay,
  labelInTimeZone,
  rangeBoundsUtc,
  startOfNamedDayInZone,
} from "./zoned-range.js";

test("startOfNamedDayInZone for Nairobi new year", () => {
  const s = startOfNamedDayInZone("2024-01-01", "Africa/Nairobi");
  assert.equal(s.toISOString(), "2023-12-31T21:00:00.000Z");
  assert.equal(labelInTimeZone(s, "Africa/Nairobi"), "2024-01-01");
});

test("rangeBoundsUtc is half-open in UTC", () => {
  const { start, endExclusive } = rangeBoundsUtc("2024-01-01", "2024-01-01", "Africa/Nairobi");
  assert.equal(start.toISOString(), "2023-12-31T21:00:00.000Z");
  assert.equal(endExclusive.toISOString(), "2024-01-01T21:00:00.000Z");
});

test("enumerateInclusiveDays counts inclusive span", () => {
  assert.deepEqual(enumerateInclusiveDays("2024-01-01", "2024-01-03"), ["2024-01-01", "2024-01-02", "2024-01-03"]);
  assert.equal(inclusiveDayCount("2024-01-01", "2024-01-03"), 3);
});

test("addCalendarDaysGregorian rolls months", () => {
  assert.equal(addCalendarDaysGregorian("2024-01-31", 1), "2024-02-01");
});

test("isValidIsoCalendarDay rejects bad calendar dates", () => {
  assert.equal(isValidIsoCalendarDay("2024-02-30"), false);
  assert.equal(isValidIsoCalendarDay("2024-02-29"), true);
});
