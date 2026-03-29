import { cn } from "@/lib/utils";

import { SkeletonBlock } from "./skeleton-block";

type LoadingCardProps = {
  className?: string;
  variant?: "default" | "kpi" | "list";
};

export function LoadingCard({ className, variant = "default" }: LoadingCardProps) {
  if (variant === "kpi") {
    return (
      <div className={cn("panel p-5 sm:p-6", className)}>
        <div className="space-y-4">
          <SkeletonBlock className="h-7 w-24 rounded-full" />
          <SkeletonBlock className="h-12 w-28 rounded-[18px]" />
          <SkeletonBlock className="h-2.5 w-full rounded-full" />
        </div>
      </div>
    );
  }

  if (variant === "list") {
    return (
      <div className={cn("panel p-5 sm:p-6", className)}>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <SkeletonBlock className="h-6 w-20 rounded-full" />
            <SkeletonBlock className="h-4 w-28 rounded-full" />
          </div>
          <SkeletonBlock className="h-7 w-3/4 rounded-[18px]" />
          <SkeletonBlock className="h-4 w-full rounded-full" />
          <SkeletonBlock className="h-4 w-5/6 rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn("panel p-5 sm:p-6", className)}>
      <div className="space-y-4">
        <SkeletonBlock className="h-5 w-28 rounded-full" />
        <SkeletonBlock className="h-7 w-2/3 rounded-[18px]" />
        <SkeletonBlock className="h-4 w-full rounded-full" />
        <SkeletonBlock className="h-4 w-4/5 rounded-full" />
      </div>
    </div>
  );
}
