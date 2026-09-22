interface BrandMarkProps {
  size?: "small" | "large";
}

/** The lightning-bolt mark from the wireframes (chats/chat1.md: renamed
 * "Thunder Bait" mid-design, mark changed from a price tag to a bolt). */
export function BrandMark({ size = "small" }: BrandMarkProps) {
  return <span class={`brand-mark brand-mark--${size}`} aria-hidden="true" />;
}
