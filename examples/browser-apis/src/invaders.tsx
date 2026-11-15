import { useEffect, useRef } from "react";
import {
  action,
  defineComponent,
  useTriggerAction,
} from "@openuidev/react-lang";
import { z } from "zod";

export const invaderComponents = [
  defineComponent({
    name: "Arcade",
    description: "Rust arcade shell; clicking the arena starts a mission",
    props: z.object({
      onStart: action(),
      onPlay: action(),
      children: z.array(z.unknown()),
    }),
    component: ({ props, renderNode }) => {
      const trigger = useTriggerAction(),
        start = useRef({ trigger, action: props.onStart });
      useEffect(() => {
        void start.current.trigger(
          "Start game loop",
          undefined,
          start.current.action,
        );
      }, []);
      return (
        <main
          className="arcade"
          onPointerDown={(event) => {
            if (event.target instanceof HTMLCanvasElement)
              void trigger("Start mission", undefined, props.onPlay);
          }}
        >
          <header className="arcade-top">
            <a href="./">◈ druid / browser lab</a>
            <span>RUST WASM ARCADE · 01</span>
          </header>
          <div className="arcade-intro">
            <div>
              <p className="eyebrow">ONE SHIP. FORTY UNINVITED GUESTS.</p>
              <h1>
                Space <span>Invaders.</span>
              </h1>
            </div>
            <p>
              Your planet called.
              <br />
              It could use a hand.
            </p>
          </div>
          {renderNode(props.children)}
          <footer className="arcade-footer">
            <span>SIMULATION IN RUST · CANVAS + KEYBOARD + WEB AUDIO</span>
            <a href="./">Back to the experiments ↗</a>
          </footer>
        </main>
      );
    },
  }),
  defineComponent({
    name: "ArcadeHUD",
    description: "Game telemetry, updated only when it changes",
    props: z.object({
      score: z.string(),
      best: z.string(),
      wave: z.string(),
      lives: z.string(),
      remaining: z.string(),
      status: z.string(),
    }),
    component: ({ props }) => (
      <div className="arcade-hud">
        <div>
          <span>SCORE</span>
          <strong>{props.score}</strong>
        </div>
        <div>
          <span>SESSION BEST</span>
          <strong>{props.best}</strong>
        </div>
        <div>
          <span>WAVE</span>
          <strong>{props.wave}</strong>
        </div>
        <div>
          <span>SHIPS</span>
          <strong>{props.lives}</strong>
        </div>
        <div className="arcade-mission">
          <span role="status">{props.status}</span>
          <small>{props.remaining} hostiles remaining</small>
        </div>
      </div>
    ),
  }),
  defineComponent({
    name: "ArcadeScreen",
    description: "Responsive pixel canvas frame",
    props: z.object({ children: z.array(z.unknown()) }),
    component: ({ props, renderNode }) => (
      <div className="arcade-screen">{renderNode(props.children)}</div>
    ),
  }),
  defineComponent({
    name: "ArcadeInstructions",
    description: "Keyboard and touch control help",
    props: z.object({}),
    component: () => (
      <div className="arcade-instructions">
        <p>
          Click the arena, then <kbd>Space</kbd> to start / fire. Hold{" "}
          <kbd>←</kbd> <kbd>→</kbd> or <kbd>A</kbd> <kbd>D</kbd> to move.
        </p>
        <p>
          <kbd>P</kbd> pause · <kbd>R</kbd> restart · <kbd>M</kbd> sound. Or
          hold the controls below.
        </p>
      </div>
    ),
  }),
  defineComponent({
    name: "ArcadePad",
    description: "Touch and pointer controls",
    props: z.object({ children: z.array(z.unknown()) }),
    component: ({ props, renderNode }) => (
      <div className="arcade-pad">{renderNode(props.children)}</div>
    ),
  }),
  defineComponent({
    name: "HoldButton",
    description: "Hold an action using pointer, touch or keyboard",
    props: z.object({ label: z.string(), down: action(), up: action() }),
    component: ({ props }) => {
      const trigger = useTriggerAction();
      const down = () => void trigger(props.label, undefined, props.down);
      const up = () => void trigger(props.label, undefined, props.up);
      return (
        <button
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            down();
          }}
          onPointerUp={up}
          onPointerCancel={up}
          onLostPointerCapture={up}
          onBlur={up}
          onKeyDown={(event) => {
            if (["Space", "Enter"].includes(event.code)) {
              event.preventDefault();
              if (!event.repeat) down();
            }
          }}
          onKeyUp={(event) => {
            if (["Space", "Enter"].includes(event.code)) {
              event.preventDefault();
              up();
            }
          }}
        >
          {props.label}
        </button>
      );
    },
  }),
];
