import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

export default async function Page() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  // Queries events table in Supabase
  const { data: events } = await supabase.from("events").select();

  return (
    <main style={{ padding: 24, fontFamily: "sans-serif" }}>
      <h1>CITYPULSE | Supabase Events Stream</h1>
      <ul>
        {events?.map((ev) => (
          <li key={ev.id}>
            <strong>{ev.event_type}</strong> - {ev.address || `${ev.latitude}, ${ev.longitude}`} [{ev.status}]
          </li>
        ))}
      </ul>
    </main>
  );
}
