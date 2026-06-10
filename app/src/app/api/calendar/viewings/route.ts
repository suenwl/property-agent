import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listUpcomingViewings, deleteViewingEvent } from "@/lib/google-calendar";

export async function GET() {
  const session = await auth();
  const accessToken = session?.accessToken;

  if (!accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const viewings = await listUpcomingViewings(accessToken);
    return NextResponse.json({ viewings });
  } catch (err) {
    console.error("Failed to list viewings:", err);
    return NextResponse.json({ error: "Failed to fetch viewings" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await auth();
  const accessToken = session?.accessToken;

  if (!accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { eventId } = await request.json() as { eventId: string };

  if (!eventId) {
    return NextResponse.json({ error: "Missing eventId" }, { status: 400 });
  }

  try {
    await deleteViewingEvent(accessToken, eventId);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Failed to delete viewing:", err);
    return NextResponse.json({ error: "Failed to cancel viewing" }, { status: 500 });
  }
}
