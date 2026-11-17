import { publicAdPlan } from "@/lib/advertising";
import { AdRegion } from "./ad-slot";
import { AdPlaceholder } from "./ad-markup";
import type { SlotConfig } from "@/lib/ad-policy";
export async function AdPlacement({ name }: { name: SlotConfig["key"] }) {
  const plan = await publicAdPlan();
  if (!plan.contentEligible || plan.administrator || plan.ads_mode === "off")
    return null;
  const slot = plan.slots.find((slot) => slot.key === name && slot.enabled);
  if (!slot) return null;
  if (plan.ads_mode === "placeholder") return <AdPlaceholder slot={slot} />;
  return (
    <AdRegion
      slot={slot}
      mode={plan.ads_mode}
      publisherId={plan.publisher_id}
    />
  );
}
