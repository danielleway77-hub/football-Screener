import { cn } from "@/lib/utils";

type PageContainerProps = React.ComponentProps<"div"> & {
  /** `content` = 1280px, `wide` = 1440px (1680px at >= 1920px). */
  width?: "content" | "wide";
};

export function PageContainer({ width = "content", className, ...props }: PageContainerProps) {
  return (
    <div
      className={cn(width === "wide" ? "container-wide" : "container-content", className)}
      {...props}
    />
  );
}
