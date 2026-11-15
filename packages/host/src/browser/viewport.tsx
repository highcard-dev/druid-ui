import type { ReactNode } from "react";

/** A surface and ordinary accessible controls sharing the same bounds. */
export function BrowserViewport({
  surface,
  children,
}: {
  surface: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      data-druid-viewport
      style={{
        position: "relative",
        isolation: "isolate",
        width: "fit-content",
        maxWidth: "100%",
        overflow: "hidden",
      }}
    >
      {surface}
      {children}
    </div>
  );
}

export function BrowserOverlay({
  position,
  children,
  interactive = true,
}: {
  position: "top" | "bottom" | "center";
  children: ReactNode;
  interactive?: boolean;
}) {
  return (
    <div
      data-druid-overlay={position}
      style={{
        position: "absolute",
        inset: 0,
        padding: "clamp(0.25rem, 1.5%, 0.75rem)",
        display: "flex",
        flexDirection: "column",
        pointerEvents: "none",
        justifyContent:
          position === "top"
            ? "flex-start"
            : position === "bottom"
              ? "flex-end"
              : "center",
        alignItems: position === "center" ? "center" : "stretch",
      }}
    >
      <div
        style={{
          pointerEvents: interactive ? "auto" : "none",
          maxHeight: "100%",
          overflow: "auto",
          minWidth: 0,
          width: "100%",
          maxWidth: position === "center" ? "28rem" : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
}
