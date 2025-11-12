import "./ui";
import React, { useEffect, useRef } from "react";
import type { DruidUI as DruidUiType } from "./ui";

interface DruidUIProps {
  entrypoint?: string;
  path?: string;
}

export const DruidUI: React.FC<DruidUIProps> = ({ entrypoint, path }) => {
  const druidUiRef = useRef<DruidUiType>(null);

  useEffect(() => {
    if (druidUiRef.current) {
      // set a property on the custom element
      druidUiRef.current.addEventListener("init", (e) => {
        const event = e as CustomEvent<{ lua: any }>;
        console.log("DruidUI initialized", event);
      });
    }
  }, []);

  return React.createElement("druid-ui", {
    ref: druidUiRef,
    entrypoint,
    path,
  });
};
