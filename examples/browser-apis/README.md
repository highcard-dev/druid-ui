# Standalone browser APIs

Rust WASM calls browser capabilities through separate typed WIT interfaces. No
Druid daemon, account, deployment, network proxy or JSON tool provider is used.
The host supplies these imports by default; select `browser-client` when building
a guest, or import only the interfaces needed in a custom world.

The default page is a live, responsive illustrated gallery:

- Canvas: a thousand-point orbital constellation, with batched vector paths.
- WebGL: an animated iridescent sphere rendered by a GLSL fragment shader.
- WebGPU: 16,384 stars positioned by a compute shader and rendered as instances.
- Audio: a four-note Rust PCM synthesizer with a matching waveform drawing.
- Video: locally generated VP8 media played natively and decoded through WIT.
- Animation: a frame-paced clock, measured FPS and p95 submission telemetry.
- Keyboard: focus-scoped typed events invoking Rust directly, without polling.
- Pointer: scoped mouse/pen/touch, drag capture, clicks and wheel input; coalesced movement invokes Rust directly.

Motion starts automatically, sound does not. **Pause motion** also pauses native
video and suspends active audio. **Enable sound** plays a quiet looping chord;
mute it with the same button. Graphics and the synthesized waveform are driven by
the Rust guest; React/OpenUI owns the layout and controls. Frame state is reported
once per second rather than sending every frame through React/JSON.

Click a scene (or Tab into **Gallery keyboard controls**), then press **Space**
to pause/resume or **M** to toggle sound. Buttons, text fields, media controls
and links retain their normal keyboard behavior. The Rust handler ignores
repeats and modified shortcuts for these toggles; other guests can use repeats,
key releases and modifiers for game controls.

The old diagnostics remain at `?checks`, linked by **Under the hood**. The styling
is example-local; no styles or palettes are added to the SDK host.

## Space Invaders

Open `?invaders` (or **Play Space Invaders** in the gallery footer) for a playable
Rust/WASM arcade example. It uses only the existing Canvas, animation, keyboard
and audio interfaces—no extra host APIs, game engine, assets or dependencies.

- Click/tap the arena or press Space to start. Hold arrows or A/D to move, and
  Space to fire. P pauses/resumes, R restarts and M toggles synthesized effects.
- Pointer/touch users can hold the on-screen movement and fire buttons.
- Forty enemies, destructible shields, three lives, brief hit invulnerability,
  scoring, session best and progressively faster waves are simulated in Rust.
- Sound is off initially. Enabling it requires a user interaction. The session
  best lasts only for the current page/guest instance; no storage API is used.
- Focus loss clears held input. Native controls keep their normal behavior.

`guest/src/invaders/game.rs` is a pure deterministic simulation, independently
testable without the browser. `mod.rs` owns the fixed 120 Hz simulation, bounded
frame catch-up, packed drawing batches, WIT input and cached PCM effects. Canvas
renders once per browser frame; React/JSON receives HUD changes only, not frame
state. The same paired WASM package powers the gallery and arcade documents.

Run its native simulation tests with the installed Rust compiler:

```sh
mkdir -p .verification
rustc --edition=2021 --test examples/browser-apis/guest/src/invaders/game.rs -o .verification/invaders-tests
.verification/invaders-tests
```

| WIT file        | Capabilities                                                                                |
| --------------- | ------------------------------------------------------------------------------------------- |
| `canvas.wit`    | Canvas 2D drawing batches, packed rectangle batches, RGBA upload/readback                   |
| `webgl.wit`     | WebGL2 shaders, persistent float buffers, attributes, uniforms, drawing/readback            |
| `webgpu.wit`    | Native WGSL, explicit layouts, textures/samplers, indexed/instanced drawing and multipass frames |
| `audio.wit`     | Web Audio PCM buffers, decoding, scheduling, playback and WASM AudioWorklet DSP             |
| `video.wit`     | Browser video playback, seeking, frame drawing and WebCodecs video decoding                 |
| `animation.wit` | Animation-frame scheduling and monotonic timing                                             |
| `keyboard.wit`  | Guest-exported key-down/up and focus-loss handler, scoped to explicit regions               |

This is a focused graphics/media interface, not a complete mirror of every Web
API. For example, indexed WebGL drawing, capture,
encoding and media demuxing are not currently exposed. Decode takes encoded
chunks, not an entire MP4/WebM file; use normal video playback for media URLs.

WebGPU keeps buffers, textures, samplers, layouts and pipelines persistent. Each
gallery frame records compute and instanced rendering into one frame encoder,
then submits once. Explicit depth attachments, comparison sampling, dynamic
bindings, blending and multisampling are available to other guests. Device loss
requires rebuilding resources; there is no WebGL fallback. `read-buffer` and
`completed` are opt-in diagnostics, not normal frame operations. The checks page
uses them to verify its compute result.

## Run

After installing dependencies and building SDK packages from the repository root:

```sh
npm run build:guest --workspace=druid-browser-apis-example
npm run dev --workspace=druid-browser-apis-example
```

Requires stable Rust, `wasm32-unknown-unknown` and the existing SDK build tooling.
For a Rust-only build, use the SDK's `packages/client/build-rust.sh` as in the
other Rust examples, passing `--document=examples/browser-apis/src/view.openui`.
The crate chooses `browser-client` itself; no Node/npm is needed for this path.

Spread the exported `browserComponents` into your own OpenUI library. This example
uses the same Canvas, Video, Keyboard and Pointer definitions as Druid, without local wrappers.
They attach to instance-local IDs, not document-wide selectors. Surfaces created
during Rust initialization are mounted when the document renders. Outside a
running host they render inert placeholders. Canvas width/height are backing
pixels, not CSS layout; handle device-pixel-ratio changes by calling `resize`.
One surface can use only one context type (2D, WebGL2 or WebGPU).

### Mouse / pointer events

The first Canvas scene demonstrates `Pointer("orbit", ["move", "down", "up", "enter", "leave", "wheel"], [Canvas("canvas", 640, 400)], "Orbit pointer controls")`.
Move to steer the constellation, hold the left button to change its color, and
scroll to resize it. Rust stores input locally; it does not put every mouse move
into React state or call a JSON tool.

Guests implement `exports::druid::openui::pointer::Guest::handle_event` from
`pointer.wit`; the canonical `browser-client` world includes it. Each event has
region ID, kind, pointer ID/device, CSS-local coordinates and region size,
movement deltas, changed button and held-button bitmask, pressure, modifiers,
normalized wheel deltas and a browser timestamp. Convert into backing pixels
with `event.x * canvas_width / event.width`. Captured drags may have negative or
out-of-bounds coordinates. Movement coalesces once per pointer per animation
frame, and accumulated deltas are retained before an immediate release.

The React component is `BrowserPointer`. It ignores native controls and nested
pointer regions, leaves modified wheel gestures native, releases held state on
cancel/blur and removes listeners/pending frames when the guest is replaced.
An active region captures drags and disables native touch panning. Right-click
menus are suppressed only with the optional `preventContextMenu` prop. Regions
are inert in isolated layout previews or when the guest has no pointer export.
There is no pointer lock or document-wide mouse listener.

### Keyboard events

`BrowserKeyboard` is a reusable region, not a document-wide keystroke listener.
It takes `id`, `codes`, optional accessible `label`, and children. It becomes
focusable only when the guest exports the keyboard interface. Clicking a scene
focuses its region without autofocus or stealing clicks from native controls.
Unmodified bound keys prevent page scrolling; modified keys keep browser defaults.
Input method composition and native editable controls do not dispatch events.

`keyboard.wit` defines `key-event`: region, kind (`down`, `up`, `blur`), key, code,
repeat, shift/control/alt/meta and monotonic browser event timestamp. `blur` has
empty key/code; clear held-key state on it, including when the browser loses
focus or focus enters a native control. Guest replacement removes handlers.
Events are delivered immediately through typed WIT, independently of animation
or React state updates. Async handlers can overlap: manage application-specific
in-flight work in the guest rather than starting long operations on every repeat.

Rust guests implement `exports::druid::openui::keyboard::Guest::handle_event`;
see `guest/src/lib.rs`. JavaScript guests can export the same interface from
their entry file alongside `client`:

```ts
import type { KeyboardExports } from "@druid-ui/client/types";
export const keyboard: KeyboardExports = {
  async handleEvent(event) {
    if (event.kind === "down" && event.code === "Space" && !event.repeat) {
      // Run guest behavior here.
    }
  },
};
```

Build with `--world-name=browser-client`, or define a custom world that includes
`openui-client` and `export keyboard;` without the graphics/media imports.

## Performance and lifetimes

- Hot-path calls are synchronous typed WIT imports, not async JSON host calls.
- `fill-rects` accepts packed `f32` tuples; uploads accept typed byte/float lists.
- Keep graphics pipelines, buffers and bind groups alive across frames. Submit
  batches and keep data on the GPU. Readback explicitly synchronizes/copies.
- WIT's canonical ABI can copy lists. This is **not** a zero-copy claim.
- Canvas/WebGL/WebGPU host calls currently execute on the main thread; avoid
  long CPU loops. Await `animation.next-frame` for animation. OffscreenCanvas
  worker execution is not implemented by this change.
- Audio DSP executes inside AudioWorklet, independently of React and the UI
  action loop. It does not allocate or send messages per processing quantum.
- Release handles when no longer needed. Aborting/unmounting/replacing a guest
  releases its remaining resources, including devices, decoders and audio.
  Never persist handles across guest instances.
- WebGPU buffer usage flags match the browser constants. Uploads need COPY_DST;
  readback needs COPY_SRC. Render shaders generate vertices using vertex_index
  or read vertex data from bound storage buffers.

### Audio DSP ABI

Call `resume` from a user interaction before `start-processor`. Supply a core
WASM module (not a WIT component) with no imports and these exports:

```text
memory
process(frames: i32, channels: i32, sample_rate: f32)
```

Preallocate output memory. `process` writes planar `f32` output starting at byte
zero, channel stride `frames`. It must write every sample, not allocate/grow
memory, and return within the real-time audio deadline. Current initialization
requires space for at least 128 samples per channel; the worklet checks actual
quantum size on every call. See `fixtures/dsp.wat` for the deterministic fixture.

## Verification

Open `?checks` and click **Run browser API checks** to execute the compiled Rust guest against real
canvas, WebGL, WebGPU compute/render, audio/worklet and video decoding. It checks
pixels and compute values, not only successful function calls. The canvas
benchmark reports CPU submission time; it is not end-to-end GPU latency.

**Measure 180 animation frames** reports achieved frame rate and p50/p95 packed
canvas submission time for 1,000 rectangles per frame. Keep the tab foreground;
browser scheduling, hardware, screen refresh rate and load affect results.

Additional browser checks can be run from the development page's console:

```js
await (await import("/src/verify.browser.ts")).verifyBrowserHost();
```

These measure actual worklet PCM with an analyser, decode a real WAV, and record
and play a local WebM fixture. No external media or credentials are required.

The checked-in aurora fixtures are synthesized locally, not downloaded media.
Optionally regenerate them with `sh examples/browser-apis/fixtures/generate.sh`
from the SDK root (requires FFmpeg with libvpx). Rebuild afterward to embed the
matching IVF chunks in WASM and copy the WebM into the example bundle. Normal
builds do not need FFmpeg. Shader sources live beside `gallery.rs` and are embedded
in the Rust guest.

Use HTTPS or localhost. GPU/codec availability depends on browser and hardware;
errors are returned through WIT, with no silent graphics fallback. Autoplay and
CORS policies still apply. The existing host also requires JSPI support. An API
being present in WIT does not make unsupported browser features available.
