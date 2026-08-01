import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return json({ error: "Método no permitido." }, 405);
  const { action, eventId, payload } = await request.json();
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  if (typeof eventId !== "string") return json({ error: "Evento inválido." }, 400);

  if (action === "gift-contribution") {
    if (!payload?.guestName || !payload?.guestContact || Number(payload?.amount) <= 0) return json({ error: "Completá nombre, contacto y monto." }, 422);
    const { error } = await admin.from("gift_contributions").insert({ event_id: eventId, gift_item_id: payload.giftItemId || null, guest_name: String(payload.guestName).slice(0, 120), guest_contact: String(payload.guestContact).slice(0, 160), amount: Number(payload.amount), notes: String(payload.notes || "").slice(0, 240), proof_path: payload.proofPath || null });
    return error ? json({ error: "No se pudo registrar el aporte." }, 500) : json({ ok: true });
  }
  if (action === "message") {
    if (!payload?.guestName || String(payload?.note || "").length < 10) return json({ error: "Completá tu nombre y mensaje." }, 422);
    const { error } = await admin.from("guest_messages").insert({ event_id: eventId, guest_name: String(payload.guestName).slice(0, 120), note: String(payload.note).slice(0, 360), photo_path: payload.photoPath || null });
    return error ? json({ error: "No se pudo enviar el mensaje." }, 500) : json({ ok: true });
  }
  if (action === "song") {
    if (!payload?.title || !payload?.requestedBy) return json({ error: "Completá canción y nombre." }, 422);
    const { error } = await admin.from("song_suggestions").insert({ event_id: eventId, title: String(payload.title).slice(0, 160), artist: String(payload.artist || "").slice(0, 160), requested_by: String(payload.requestedBy).slice(0, 120) });
    return error ? json({ error: "No se pudo enviar la canción." }, 500) : json({ ok: true });
  }
  return json({ error: "Acción no válida." }, 400);
});
