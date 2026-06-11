// ---------------------------------------------------------------------------
// Google Calendar REST API helpers
// All operations use the user's OAuth access token obtained via NextAuth.
// ---------------------------------------------------------------------------

const CALENDAR_API = "https://www.googleapis.com/calendar/v3";
const SINGAPORE_TZ = "Asia/Singapore";
// Viewing windows: 9am–9pm SGT, in 1-hour increments
const SLOT_HOUR_START = 9;
const SLOT_HOUR_END = 21;
const SLOT_DURATION_MS = 60 * 60 * 1000;

export interface FreeSlot {
  startIso: string;
  label: string; // e.g. "Tue, 10 Jun · 10:00am – 11:00am"
}

function toSGT(date: Date): Date {
  // Convert a UTC Date to Singapore local time by adjusting offset (+8h)
  const utcMs = date.getTime();
  const sgtOffsetMs = 8 * 60 * 60 * 1000;
  return new Date(utcMs + sgtOffsetMs);
}

function formatSlotLabel(start: Date): string {
  // start is a UTC Date representing the slot start time
  const sgt = toSGT(start);
  const endSgt = new Date(sgt.getTime() + SLOT_DURATION_MS);

  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];

  const dayName = days[sgt.getUTCDay()];
  const date = sgt.getUTCDate();
  const month = months[sgt.getUTCMonth()];

  function fmtHour(h: number, m: number): string {
    const suffix = h < 12 ? "am" : "pm";
    const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return m === 0 ? `${hour12}${suffix}` : `${hour12}:${String(m).padStart(2, "0")}${suffix}`;
  }

  const startStr = fmtHour(sgt.getUTCHours(), sgt.getUTCMinutes());
  const endStr = fmtHour(endSgt.getUTCHours(), endSgt.getUTCMinutes());

  return `${dayName}, ${date} ${month} · ${startStr} – ${endStr}`;
}

/**
 * Queries the user's Google Calendar for busy periods and returns a list of
 * available 1-hour viewing slots within the next `days` calendar days (9am–7pm SGT).
 *
 * Returns at most 10 slots so the agent response stays concise.
 */
export async function getFreeSlotsNextNDays(
  accessToken: string,
  days: number
): Promise<FreeSlot[]> {
  const now = new Date();

  // Build candidate slots: every hour between 9am–7pm SGT for the next `days` days
  // We start from the next full hour if we're already past 9am today SGT.
  const sgtNow = toSGT(now);

  const candidateStarts: Date[] = [];

  for (let d = 0; d < days; d++) {
    // Build the SGT date for this day
    const sgtDay = new Date(sgt0OfDay(sgtNow, d));

    for (let h = SLOT_HOUR_START; h < SLOT_HOUR_END; h++) {
      // sgtDay is already the UTC timestamp for SGT midnight; add hours directly
      const slotStartUtc = new Date(sgtDay.getTime() + h * 60 * 60 * 1000);

      // Skip slots in the past (with a 30-min buffer)
      if (slotStartUtc.getTime() < now.getTime() + 30 * 60 * 1000) continue;

      candidateStarts.push(slotStartUtc);
    }
  }

  if (candidateStarts.length === 0) return [];

  const timeMin = candidateStarts[0].toISOString();
  const timeMax = new Date(
    candidateStarts[candidateStarts.length - 1].getTime() + SLOT_DURATION_MS
  ).toISOString();

  // Query freebusy
  const res = await fetch(`${CALENDAR_API}/freeBusy`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      timeMin,
      timeMax,
      timeZone: SINGAPORE_TZ,
      items: [{ id: "primary" }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google Calendar freebusy error ${res.status}: ${err}`);
  }

  const data = await res.json() as {
    calendars: Record<string, { busy: { start: string; end: string }[] }>;
  };

  const busyPeriods = data.calendars?.primary?.busy ?? [];

  // Convert busy periods to [start, end] ms pairs
  const busyMs = busyPeriods.map((b) => ({
    start: new Date(b.start).getTime(),
    end: new Date(b.end).getTime(),
  }));

  const freeSlots: FreeSlot[] = [];

  for (const slotStart of candidateStarts) {
    if (freeSlots.length >= 10) break;

    const slotStartMs = slotStart.getTime();
    const slotEndMs = slotStartMs + SLOT_DURATION_MS;

    const overlaps = busyMs.some(
      (b) => b.start < slotEndMs && b.end > slotStartMs
    );

    if (!overlaps) {
      freeSlots.push({
        startIso: slotStart.toISOString(),
        label: formatSlotLabel(slotStart),
      });
    }
  }

  return freeSlots;
}

/** Returns the UTC timestamp for SGT midnight of `sgtBase + offsetDays` */
function sgt0OfDay(sgtBase: Date, offsetDays: number): number {
  // sgtBase is already shifted by +8h; strip the time component
  const sgtOffsetMs = 8 * 60 * 60 * 1000;
  const dayMs = 24 * 60 * 60 * 1000;
  const sgtMidnight =
    Math.floor(
      (sgtBase.getTime()) / dayMs
    ) *
    dayMs +
    offsetDays * dayMs;
  // Convert back to UTC
  return sgtMidnight - sgtOffsetMs;
}

export interface ViewingEvent {
  id: string;
  summary: string;
  location: string;
  startIso: string;
  startLabel: string;
  htmlLink: string;
}

/**
 * Lists all upcoming "Property Viewing:" events from the user's primary Google Calendar,
 * ordered by start time.
 */
export async function listUpcomingViewings(
  accessToken: string
): Promise<ViewingEvent[]> {
  const timeMin = new Date().toISOString();
  const params = new URLSearchParams({
    q: "Property Viewing:",
    timeMin,
    orderBy: "startTime",
    singleEvents: "true",
    maxResults: "50",
  });

  const res = await fetch(
    `${CALENDAR_API}/calendars/primary/events?${params.toString()}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google Calendar events.list error ${res.status}: ${err}`);
  }

  const data = await res.json() as {
    items?: {
      id: string;
      summary: string;
      location?: string;
      start: { dateTime?: string; date?: string };
      htmlLink?: string;
    }[];
  };

  return (data.items ?? []).map((item) => {
    const startIso = item.start.dateTime ?? item.start.date ?? "";
    const startDate = startIso ? new Date(startIso) : new Date();
    return {
      id: item.id,
      summary: item.summary ?? "",
      location: item.location ?? "",
      startIso,
      startLabel: formatSlotLabel(startDate),
      htmlLink: item.htmlLink ?? "",
    };
  });
}

/**
 * Deletes a Google Calendar event by ID.
 */
export async function deleteViewingEvent(
  accessToken: string,
  eventId: string
): Promise<void> {
  const res = await fetch(
    `${CALENDAR_API}/calendars/primary/events/${encodeURIComponent(eventId)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!res.ok && res.status !== 410) {
    const err = await res.text();
    throw new Error(`Google Calendar events.delete error ${res.status}: ${err}`);
  }
}

/**
 * Creates a 1-hour "Property Viewing" event on the user's primary Google Calendar.
 * Returns the HTML link to the created event.
 */
export async function createViewingEvent(
  accessToken: string,
  propertyName: string,
  propertyAddress: string,
  startIso: string
): Promise<{ eventLink: string }> {
  const startDate = new Date(startIso);
  const endDate = new Date(startDate.getTime() + SLOT_DURATION_MS);

  const body = {
    summary: `Property Viewing: ${propertyName}`,
    location: propertyAddress,
    description: `Viewing appointment for ${propertyName} at ${propertyAddress}.\n\nBooked via PropertyAgent.`,
    start: { dateTime: startDate.toISOString(), timeZone: SINGAPORE_TZ },
    end: { dateTime: endDate.toISOString(), timeZone: SINGAPORE_TZ },
    reminders: {
      useDefault: false,
      overrides: [{ method: "popup", minutes: 60 }],
    },
  };

  const res = await fetch(
    `${CALENDAR_API}/calendars/primary/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google Calendar events.insert error ${res.status}: ${err}`);
  }

  const event = await res.json() as { htmlLink?: string };
  return { eventLink: event.htmlLink ?? "" };
}
