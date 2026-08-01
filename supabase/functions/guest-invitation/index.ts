import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const hashToken = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))).map((byte) => byte.toString(16).padStart(2, "0")).join("");

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return json({ error: "Método no permitido." }, 405);

  const { action, token, payload } = await request.json();
  // Accept legacy long tokens and the new seven-character base64url tokens.
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{7,128}$/.test(token)) {
    return json({ error: "El enlace no es válido." }, 404);
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: invitation, error } = await admin
    .from("invitations")
    .select("*, invitation_members(*), rsvp_responses(*, rsvp_attendees(*)), events!inner(rsvp_deadline)")
    .eq("token_hash", await hashToken(token))
    .eq("access_status", "active")
    .maybeSingle();
  if (error || !invitation) return json({ error: "El enlace no es válido o fue pausado." }, 404);

  if (action === "read") {
    return json({ invitation: { ...invitation, token: undefined, token_hash: undefined, primary_contact_email: undefined, primary_contact_phone: undefined } });
  }

  if (action !== "submit-rsvp") return json({ error: "Acción no válida." }, 400);
  const deadline = new Date(`${invitation.events.rsvp_deadline}T23:59:59-03:00`);
  if (new Date() > deadline) return json({ error: "El plazo para confirmar asistencia ya finalizó." }, 409);
  const attendees = Array.isArray(payload?.attendees) ? payload.attendees : [];
  const attending = payload?.attending === "si";
  const confirmed = attendees.filter((item: { attending?: boolean }) => attending && item.attending);
  if (attending && (confirmed.length < 1 || confirmed.length > invitation.allowed_seats)) return json({ error: "La cantidad de asistentes no coincide con el cupo reservado." }, 422);
  if (confirmed.some((item: { type?: string; name?: string }) => item.type === "companion" && !item.name?.trim())) return json({ error: "Indicá el nombre de cada acompañante." }, 422);

  const { data: response, error: responseError } = await admin.from("rsvp_responses").upsert({
    invitation_id: invitation.id,
    status: attending ? "confirmado" : "rechazado",
    attending_count: attending ? confirmed.length : 0,
    comments: String(payload?.comments ?? "").slice(0, 300),
  }, { onConflict: "invitation_id" }).select().single();
  if (responseError) return json({ error: "No se pudo guardar la respuesta." }, 500);
  const { error: deleteAttendeesError } = await admin.from("rsvp_attendees").delete().eq("response_id", response.id);
  if (deleteAttendeesError) return json({ error: "No se pudieron actualizar los asistentes." }, 500);
  if (attendees.length) {
    const { error: attendeesError } = await admin.from("rsvp_attendees").insert(attendees.map((item: { memberId?: string; type?: string; name?: string; attending?: boolean; dietaryRestrictions?: string }) => ({
    response_id: response.id, member_id: item.memberId || null, attendee_type: item.type === "companion" ? "companion" : "member", name: String(item.name || "").slice(0, 120), attending: attending && Boolean(item.attending), dietary_restrictions: String(item.dietaryRestrictions || "").slice(0, 200),
    })));
    if (attendeesError) return json({ error: "No se pudieron guardar los asistentes." }, 500);
  }
  const { error: invitationError } = await admin.from("invitations").update({ delivery_status: attending ? "respondida" : "rechazada" }).eq("id", invitation.id);
  if (invitationError) return json({ error: "La respuesta se guardó, pero no se pudo actualizar la invitación." }, 500);
  return json({ ok: true });
});
