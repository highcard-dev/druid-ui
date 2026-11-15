import { useEffect, useRef } from "react";
import {
  action,
  createLibrary,
  defineAction,
  defineComponent,
  useTriggerAction,
} from "@openuidev/react-lang";
import { browserComponents } from "@druid-ui/host";
import { z } from "zod";
import { invaderComponents } from "./invaders";

const layout = (name: string, className: string) =>
  defineComponent({
    name,
    description: name,
    props: z.object({ children: z.array(z.unknown()) }),
    component: ({ props, renderNode }) => (
      <div className={className}>{renderNode(props.children)}</div>
    ),
  });
export const library = createLibrary({
  actions: [
    ...[
      "CheckBrowser",
      "Animate",
      "StartGallery",
      "ToggleMotion",
      "ToggleSound",
      "StartInvaders",
      "PlayInvaders",
      "RestartInvaders",
      "PauseInvaders",
      "SoundInvaders",
    ].map((name) =>
      defineAction({ name, description: name, params: z.object({}) }),
    ),
    defineAction({
      name: "InputInvaders",
      description: "Set held game controls",
      params: z.object({
        code: z.enum(["ArrowLeft", "ArrowRight", "Space"]),
        pressed: z.boolean(),
      }),
    }),
  ],
  components: [
    ...browserComponents,
    ...invaderComponents,
    layout("Stack", "checks-stack"),
    layout("Controls", "controls"),
    layout("Scenes", "scenes"),
    defineComponent({
      name: "Gallery",
      description: "A live browser API gallery",
      props: z.object({ onStart: action(), children: z.array(z.unknown()) }),
      component: ({ props, renderNode }) => {
        const trigger = useTriggerAction(),
          start = useRef({ trigger, action: props.onStart });
        useEffect(() => {
          void start.current.trigger(
            "Start gallery",
            undefined,
            start.current.action,
          );
        }, []);
        return <main className="gallery">{renderNode(props.children)}</main>;
      },
    }),
    defineComponent({
      name: "Hero",
      description: "Gallery introduction",
      props: z.object({}),
      component: () => (
        <>
          <header className="masthead">
            <a className="brand" href="./">
              <span className="brand-mark">◈</span> druid
              <span className="brand-separator" />
              browser lab
            </a>
            <span className="live">
              <i /> LIVE / LOCAL
            </span>
          </header>
          <div className="hero">
            <div className="eyebrow">A STUDY IN BROWSER POSSIBILITIES</div>
            <h1>
              Small worlds.
              <br />
              <span>Native possibilities.</span>
            </h1>
            <p>
              Six little experiments. One Rust guest.
              <br />
              Graphics, sound, and motion—without a platform in between.
            </p>
            <p className="keyboard-hint">
              Click a scene or focus the gallery: <kbd>Space</kbd> pause / play
              · <kbd>M</kbd> sound
            </p>
            <div className="hero-orbit" aria-hidden="true">
              <span />
              <span />
              <span />
              <i />
            </div>
          </div>
        </>
      ),
    }),
    defineComponent({
      name: "Metrics",
      description: "Measured frame telemetry",
      props: z.object({ fps: z.string(), submission: z.string() }),
      component: ({ props }) => (
        <div className="metrics">
          <div>
            <strong>
              {props.fps}
              <small> FPS</small>
            </strong>
            <span>measured, not promised</span>
          </div>
          <div>
            <strong>
              {props.submission}
              <small> ms</small>
            </strong>
            <span>p95 frame submission</span>
          </div>
          <div>
            <strong>
              Rust <small>→ WIT → Browser</small>
            </strong>
            <span>no JSON on the rendering path</span>
          </div>
          <div className="metric-note">
            <i /> No backend.
            <br />
            Just your browser.
          </div>
        </div>
      ),
    }),
    defineComponent({
      name: "SceneCard",
      description: "An illustrated browser capability",
      props: z.object({
        number: z.string(),
        api: z.string(),
        title: z.string(),
        description: z.string(),
        children: z.array(z.unknown()),
        footer: z.string(),
        accent: z.enum(["mint", "violet", "amber", "blue"]),
      }),
      component: ({ props, renderNode }) => (
        <article className={"scene " + props.accent}>
          <div className="scene-heading">
            <span className="scene-number">{props.number}</span>
            <span className="api-label">{props.api}</span>
            <span className="scene-dot" />
          </div>
          <div className="scene-art">{renderNode(props.children)}</div>
          <div className="scene-copy">
            <h2>{props.title}</h2>
            <p>{props.description}</p>
          </div>
          <div className="scene-footer">
            <span className="tiny-dot" />
            {props.footer}
          </div>
        </article>
      ),
    }),
    defineComponent({
      name: "VideoPair",
      description: "Native and decoded video side by side",
      props: z.object({ children: z.array(z.unknown()) }),
      component: ({ props, renderNode }) => (
        <div className="video-pair">
          {props.children.map((child, index) => (
            <div key={index}>
              <span>{index === 0 ? "NATIVE PLAYBACK" : "WIT / WEBCODECS"}</span>
              {renderNode(child)}
            </div>
          ))}
        </div>
      ),
    }),
    defineComponent({
      name: "GalleryFooter",
      description: "Capabilities and diagnostics",
      props: z.object({ status: z.string() }),
      component: ({ props }) => (
        <footer className="gallery-footer">
          <p>Built with curiosity. Rendered with Druid UI.</p>
          <span>RUST WASM · TYPED WIT · OPENUI</span>
          <a href="?checks">Under the hood ↗</a>
          <a href="?invaders">Play Space Invaders ↗</a>
          {props.status && <p role="status">{props.status}</p>}
        </footer>
      ),
    }),
    defineComponent({
      name: "Text",
      description: "Text",
      props: z.object({ text: z.string() }),
      component: ({ props }) => <p>{props.text}</p>,
    }),
    defineComponent({
      name: "Button",
      description: "Guest action",
      props: z.object({ label: z.string(), action: action() }),
      component: ({ props }) => {
        const trigger = useTriggerAction();
        return (
          <button
            onClick={() => void trigger(props.label, undefined, props.action)}
          >
            {props.label}
          </button>
        );
      },
    }),
  ],
});
