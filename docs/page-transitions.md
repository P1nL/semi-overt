# Desktop page transitions — V4.4 implementation

Approved motion contract, updated 2026-10-08. Scope: desktop (>=1024px), normal
pages only. Existing article/editor/review sheets remain owned by `App.vue` and
`PageSheet`; closing a sheet must not replay its background entrance.

## Timing / clock

| Route | Leave | Enter | Total |
|---|---:|---:|---:|
| Home -> category/search | 2.5s | 2s | 4.5s |
| Category/search -> home | 1.5s | 2s | 3.5s |
| Category <-> search | concurrent content replacement | | 2s |
| Home -> profile / profile -> home | 2.5s / 2s | 2s / 2s | 4.5s / 4s |
| Results -> profile / profile -> results | 1.5s / 2s | 2s / 2s | 3.5s / 4s |
| Profile A -> B | concurrent content replacement | | 2s |

`motionClock.ts` provides one shared, wall-time-driven RAF painter capped at 60
updates/second. No frame-count-based duration, even on 120/144/165/240 Hz displays.
GSAP's shared ticker and the result-menu WebGL renderer are also capped at 60.
This is an update-rate ceiling / target, not a guarantee of hardware rendering
60 frames every second. Development scenes expose `data-motion-report` after a
run (budget, elapsed time, paint count and observed FPS).

## Home

Exit: 0-.5s stop autonomous motion, then measure all precise attachment points.
Start a shared rope clock after that batch completes: grow lines from viewport
top (zero length) to the anchors over .6s, hold the connection for .05s, then
accelerate the glyphs upward and the tesseract/cards downward together to 2.5s.
Anchor measurement time must not consume rope descent time. Use linear growth,
not a short cubic ease-out that reveals most of the rope in its first few frames.
Both directions use the same quadratic displacement curve, with no end slowdown.
Ropes attach to a measured topmost ink/circle/cube silhouette point, not an em-box
or container center. A retained invisible point tracks perspective while lifting.
Ropes stay hidden until the stopped glyph's precise anchor is measured; the first
visible segment already uses that anchor. Never draw toward a box-center point
and switch anchors halfway through the descent.
Each rope shares the orbit's stacking context and depth with its own glyph, but
is inserted immediately behind it. Front glyphs occlude rear ropes rather than
all ropes being painted in a foreground viewport overlay. Screen-space anchors
are converted through the SVG screen matrix to keep attachment exact.

Return: no ropes. Independent glyphs fall directly to their orbit slots, with
constant-deceleration vertical displacement and separately controlled spin.
Keep the same stagger and duration: y = -distance * (1 - progress)^2 starts fast
and reaches the target with exactly zero vertical velocity at progress=1.
Stop exactly at each target slot with no rebound, no squash/stretch, no inter-element collisions and
no mouse/touch dragging. **Position returns to the ring; pose does not reset.**
Every entrance samples new local-plane rotations for all glyphs, including the
cube. Position and local angle stop changing immediately at landing.
Retain the ring's depth/opacity hierarchy and resume its
continuous rotation as soon as the return animation completes.
The motion wrapper only translates and supplies --glyph-local-roll. Each visual
applies orbit yaw followed by local Z roll, so the plane normal remains radial:
the visual plane is perpendicular to the direction toward the ring center,
not locked to the screen.
Keep natural side-view perspective; do not add independent X/Y tumbling.
The cube also retains its orbit yaw and modeled shape with local-plane roll.
Glyphs finish falling within 2s; the tesseract and cards rise from below
in 1.7s, within the same two-second entrance budget.

## Results

Only the main WebGL instance scales at its final projected center; surrounding
cards keep their matrices/dimensions and fade. Never scale the canvas. Left/right copy uses fast character
flow (not line reveal); outgoing copy retracts from last character to first.
Metadata separators are real text nodes and participate in the same character
stream, not CSS-generated dots. The drag hint defaults to hidden until renderer
readiness; its CSS opacity transition is disabled while a scene timeline owns it.
Main-card scale lasts 1.1s on entrance and .85s on exit. Companion text, fades and
sparks are retimed to fit the 2s entrance / 1.5s exit; sibling replacement stays 2s.
On entry, hide the canvas until the renderer has drawn the current motion state.
DOM readiness alone cannot reveal a buffer still containing a static full-size card.
The button uses the very same 12-ray geometry as the existing opening sequence,
via `buttonBurst.ts`; exit is another outward burst, not reversed absorption.
Sibling results keep the shell stable, replace content with short directional
movement, and never replay a full scale entrance or burst. Query updates retain
their component/input focus and use local replacement.

## Profile

The entire profile cover card/container slides down from above, including its
surface/border. Avatar traces a circle and resolves real image blocks from coarse
to fine (Locomotive-style nearest-neighbour refinement, not a checkerboard).
Slow images keep a static pixel shell without a busy frame loop; unavailable
source pixels use an initial-avatar fallback. When no image is configured, draw
the outline and fade the actual DOM initials: never swap a differently styled
canvas letter for the final text. Keep the same opaque circular surface and
border as an image avatar (not transparent into the cover).
Name/signature use fast character flow without wrapping or changing their
measured layout. Both source and visual copy disable CSS ellipsis during the
stream; normal overflow handling is restored afterwards. Left tabs enter from left,
divider fades, articles rise from below, review section enters from right.
Writing statistics enter from the right in .15-1s, ahead of review's .25-1.25s.
Review items enter from the section's right edge after data readiness and queue
into their own slots. Exit reverses these directions and the avatar sequence.

Profile A -> B: text scrambles in place; avatar pixels switch identity before
resolving; old/new covers slide upward in a shared clipped container. Article
card avatars/covers reuse the same effects. Never retain A's avatar as B while
waiting for B's image.
When the review section exists on only one side of a profile swap, snapshot its
old geometry and move the entire article region from its old slot to the new one.
Admin -> ordinary: a noninteractive old-review copy exits right as articles move
up. Ordinary -> admin: articles move down and the new review section enters from
the right. Measure relative to the scene (not viewport scroll); remove copies and
restore owned styles on completion/cancellation. Start profile swaps after data
readiness so these two-second effects cannot be consumed behind the old page.

## Lifecycle / data

The incoming scene mounts with ancestor opacity=0 (descendants cannot override
this) while the old scene leaves so queries and
assets can start immediately. Route snapshots isolate outgoing content from
new route params. Latest navigation cancels old timers/effects; no queue of
stacked animations. Restore scroll before measuring the new entrance.
Staged scenes disable legacy entrance CSS immediately. An explicit first-paint
barrier keeps enter/swap invisible until their painters initialize every current
target, preventing a static incoming profile from flashing before choreography.
Hard refresh waits for router readiness before mounting; direct desktop profile
and category/search visits start in the hidden enter phase too. Profile entrances wait for real content
(or a load error) before their two-second clock begins, so a cover-shaped skeleton
does not appear and vanish before the cover slides in. Network wait is separate
from animation duration; cancellation disconnects the readiness observer.
Results entrances also wait for their real content/renderer; the additional canvas
first-draw gate prevents a stale static frame on both cold loads and route changes.
Scoped MutationObservers handle late API content without extending route time.
Leave effects hold their invisible/offscreen endpoints until unmount, avoiding
a static old-page flash. Cleanup then restores only owned CSS properties and
removes all temporary visuals.
Reduced-motion switches to a short fade, with no ropes/spin/particles/scrambling.
Mobile retains immediate navigation; no new mobile choreography is introduced.

## Verification / isolated fixtures

```sh
npm run test:page-motion
npm run test:page-scroll
npm run build
# With the normal Vite dev server running on 5173:
npm run dev:motion-fixture
```

The optional fixture binds only `127.0.0.1:5198`. It serves synthetic authors
`motion-a` / `motion-b` / `motion-slow` / `motion-spaces` (Test User), cover/avatar SVGs, delayed avatar loading,
and a delayed review queue. It does not forward API requests or write to the
real database. Frontend assets alone are proxied to Vite. The fixture is not
included in the production build. Useful routes: `/`, `/category/SHORT`,
`/search?keyword=motion`, `/search?type=users&keyword=motion`, `/u/motion-a`.

Acceptance: complete home/results/profile navigation; mid-flight renavigation;
profile-to-profile updates; delayed avatars/review data; sheet open/close without
background replay; no residual overlays/inert state; desktop light/dark modes.
