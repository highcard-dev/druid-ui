import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
  type KeyboardEvent,
} from "react";
import type { KeyEvent } from "@druid-ui/client/types";
import { interactive } from "./input-target";

export const KeyboardContext = createContext<
  ((event: KeyEvent) => void) | null
>(null);

const blurEvent = (region: string, timestamp: number): KeyEvent => ({
  region,
  kind: "blur",
  key: "",
  code: "",
  repeat: false,
  shift: false,
  control: false,
  alt: false,
  meta: false,
  timestamp,
});

/** Opt-in keyboard scope. Register in an OpenUI library alongside BrowserCanvas. */
export function BrowserKeyboard({
  id,
  codes,
  label = "Keyboard controls",
  children,
}: {
  id: string;
  codes: readonly string[];
  label?: string;
  children: ReactNode;
}) {
  const dispatch = useContext(KeyboardContext);
  const region = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!dispatch) return;
    const blur = (event: Event) => {
      if (region.current?.contains(document.activeElement))
        dispatch(blurEvent(id, event.timeStamp));
    };
    window.addEventListener("blur", blur);
    return () => window.removeEventListener("blur", blur);
  }, [dispatch, id]);
  const key = (kind: "down" | "up", event: KeyboardEvent<HTMLDivElement>) => {
    if (
      !dispatch ||
      event.defaultPrevented ||
      event.nativeEvent.isComposing ||
      interactive(event.target) ||
      !codes.includes(event.code)
    )
      return;
    // Unmodified bound keys (e.g. Space) belong to this region, not page scrolling.
    // Modified browser/OS shortcuts keep their native behavior.
    if (!event.ctrlKey && !event.altKey && !event.metaKey)
      event.preventDefault();
    event.stopPropagation();
    dispatch({
      region: id,
      kind,
      key: event.key,
      code: event.code,
      repeat: event.repeat,
      shift: event.shiftKey,
      control: event.ctrlKey,
      alt: event.altKey,
      meta: event.metaKey,
      timestamp: event.timeStamp,
    });
  };
  return (
    <div
      ref={region}
      role="group"
      aria-label={label}
      tabIndex={dispatch ? 0 : undefined}
      onKeyDown={(event) => key("down", event)}
      onKeyUp={(event) => key("up", event)}
      onPointerDown={(event) => {
        if (dispatch && !event.defaultPrevented && !interactive(event.target)) {
          event.currentTarget.focus({ preventScroll: true });
          event.stopPropagation();
        }
      }}
      onBlur={(event) => {
        if (
          dispatch &&
          (!event.currentTarget.contains(event.relatedTarget) ||
            interactive(event.relatedTarget))
        )
          dispatch(blurEvent(id, event.timeStamp));
      }}
    >
      {children}
    </div>
  );
}
