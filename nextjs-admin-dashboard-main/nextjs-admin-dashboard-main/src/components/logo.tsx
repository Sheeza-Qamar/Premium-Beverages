import { cn } from "@/lib/utils";
import Image from "next/image";

export const BRAND_LOGO_SRC = "/images/logo/elegant-premium-beverages-logo.png";

type LogoProps = {
  /** Smaller circle for mobile header */
  compact?: boolean;
  className?: string;
};

export function Logo({ compact = false, className }: LogoProps) {
  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-full shadow-md",
        compact
          ? "size-12 sm:size-14"
          : "size-32 min-[850px]:size-36",
        className,
      )}
    >
      <Image
        src={BRAND_LOGO_SRC}
        alt="Premium Beverages"
        fill
        className="object-cover object-center"
        sizes={compact ? "56px" : "(max-width: 850px) 128px, 144px"}
        priority
        quality={92}
      />
    </div>
  );
}
