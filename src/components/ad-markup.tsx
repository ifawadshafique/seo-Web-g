import type { SlotConfig } from "@/lib/ad-policy";

export function adRegionStyle(slot: SlotConfig): React.CSSProperties {
  return {
    "--ad-mobile-width": slot.sizes.mobile[0] + "px",
    "--ad-mobile-height": slot.sizes.mobile[1] + "px",
    "--ad-desktop-width": slot.sizes.desktop[0] + "px",
    "--ad-desktop-height": slot.sizes.desktop[1] + "px",
  } as React.CSSProperties;
}

export function AdPlaceholder({ slot }: { slot: SlotConfig }) {
  return (
    <div
      style={adRegionStyle(slot)}
      className={`ad-region ad-device-${slot.device.toLowerCase()} ad-placement-${slot.key}`}
      data-ad-placement={slot.key}
      data-ad-mode="placeholder"
    >
      <small>Advertisement — layout preview</small>
      <div className="ad-reserved" />
    </div>
  );
}
