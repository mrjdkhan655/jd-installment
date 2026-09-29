"use server";

import { createClient } from "@/lib/supabase/server";
import { assertSuperAdmin, writeAudit } from "@/lib/auth";
import { z } from "zod";
import { revalidatePath } from "next/cache";

const SettingsSchema = z.object({
  businessName: z.string().min(1),
  businessAddress: z.string().optional(),
  businessPhone: z.string().optional(),
  businessEmail: z.string().email().optional().or(z.literal("")),
  defaultPenaltyMethod: z
    .enum(["fixed_per_month", "percent_per_month", "custom_amount", "custom_rule"])
    .optional()
    .nullable(),
  defaultPenaltyValue: z.number().nonnegative().optional().nullable(),
});

export async function updateBusinessSettings(input: z.infer<typeof SettingsSchema>) {
  const parsed = SettingsSchema.parse(input);
  const actor = await assertSuperAdmin();
  const supabase = await createClient();

  const { data: before } = await supabase.from("business_settings").select("*").eq("id", 1).single();

  const { error } = await supabase
    .from("business_settings")
    .update({
      business_name: parsed.businessName,
      business_address: parsed.businessAddress || null,
      business_phone: parsed.businessPhone || null,
      business_email: parsed.businessEmail || null,
      default_penalty_method: parsed.defaultPenaltyMethod ?? null,
      default_penalty_value: parsed.defaultPenaltyValue ?? null,
      updated_by: actor.id,
    })
    .eq("id", 1);

  if (error) throw new Error("Could not save the settings.");

  await writeAudit({
    actorId: actor.id,
    action: "settings.update",
    entityType: "business_settings",
    previousValue: before,
    newValue: parsed,
  });

  revalidatePath("/dashboard/settings");
}
