import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { validateDrive, rovyTrip } from "./rovy";

export const rovyImportData = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data: vehicles, error } = await context.supabase.from("vehicles").select("*").eq("user_id", context.userId).order("name");
  if (error) throw new Error("Could not load Garage vehicles.");
  const imported: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const result = await context.supabase.from("trips").select("rovy_drive_id").eq("user_id", context.userId).not("rovy_drive_id", "is", null).order("id").range(offset, offset + 999);
    if (result.error) throw new Error("Could not check previous imports.");
    for (const row of result.data) if (row.rovy_drive_id) imported.push(row.rovy_drive_id);
    if (result.data.length < 1000) break;
  }
  return { vehicles: vehicles ?? [], imported };
});

export const importRovyDrive = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ drive: z.unknown().transform(validateDrive), route: z.array(z.tuple([z.number().finite().min(-90).max(90), z.number().finite().min(-180).max(180)])).max(100000), vehicleId: z.string().uuid().nullable() }).parse(input))
  .handler(async ({ data, context }) => {
    if (data.vehicleId) {
      const vehicle = await context.supabase.from("vehicles").select("id").eq("id", data.vehicleId).eq("user_id", context.userId).maybeSingle();
      if (vehicle.error || !vehicle.data) throw new Error("Choose one of your Garage vehicles.");
    }
    // INSERT only: a unique owner/source index also protects concurrent imports.
    const result = await context.supabase.from("trips").insert({ ...rovyTrip(data.drive, data.route, data.vehicleId), user_id: context.userId }).select("id").single();
    if (result.error?.code === "23505") return { status: "duplicate" as const };
    if (result.error) throw new Error("This drive could not be imported. Retry the remaining drives.");
    return { status: "imported" as const };
  });

export const createRovyVehicle = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ name: z.string().trim().min(1).max(200) }).parse(input))
  .handler(async ({ data, context }) => {
    const existing = await context.supabase.from("vehicles").select("*").eq("user_id", context.userId).ilike("name", data.name.replace(/[\\%_]/g, "\\$&"));
    if (existing.error) throw new Error("Could not check Garage.");
    if (existing.data[0]) return existing.data[0];
    const result = await context.supabase.from("vehicles").insert({ name: data.name, user_id: context.userId }).select("*").single();
    if (result.error) throw new Error("Could not create Garage vehicle.");
    return result.data;
  });

export const pendingRovyDestinations = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const result = await context.supabase.from("trips").select("id,destination_lat,destination_lng").eq("user_id", context.userId).eq("rovy_destination_pending", true).not("rovy_drive_id", "is", null).order("created_at").limit(20);
  if (result.error) throw new Error("Could not load destination names.");
  return result.data;
});
export const finishRovyDestination = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid(), name: z.string().trim().min(1).max(1000) }).parse(input))
  .handler(async ({ data, context }) => {
    const result = await context.supabase.from("trips").update({ destination: data.name, rovy_destination_pending: false }).eq("id", data.id).eq("user_id", context.userId).eq("rovy_destination_pending", true).eq("destination", "Unknown destination").not("rovy_drive_id", "is", null);
    if (result.error) throw new Error("Could not save destination name.");
    return { ok: true };
  });