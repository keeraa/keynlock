# Alchemy prototypes — cleaned

Staging copy of the single-file demo, split up and made safe to embed. Nothing
here is wired into the game yet: `check.mjs` only walks `js/` and `css/`, so
this folder is invisible to the build.

Source: `alchemy_mechanics_prototypes_optimized_v109_bottom_fill_hover_bubbles.html`

## What changed

**Images out of the stylesheet.** Five PNGs were inlined as base64, which is
265 KB of the 416 KB file. They are files now (202 KB — base64 inflates by a
third), so the browser caches them instead of re-parsing them with every load
of the stylesheet.

**Split into parts.** 12 KB html, 70 KB css, 69 KB js.

**The script is wrapped in a closure.** It declared 231 top-level names. The
game loads classic scripts that all share one lexical environment, where two of
those (`apply`, `shuffle`) already collide — and that environment has bitten us
twice already (`noise` against the audio generator, `gate` against the motion
permission). Wrapped, it contributes nothing to the global scope. Expose
through `window.Alchemy` when wiring it in.

**The stylesheet is scoped under `.alchemyRoot`.** Eleven class names collide
with the game, and several are load-bearing there: `.tab` styles the 19 mode
tabs, `.locked` eight map nodes, `.scene` is the game's main stage, plus
`.app`, `.active`, `.status`. Dropped in raw, the prototype would restyle half
the game. `alchemy.scoped.css` is generated from `alchemy.css` by prefixing
every selector; keyframes are left alone. Verified both ways — the prototype
renders the same under the root class, and loading the scoped sheet into the
running game changes nothing.

Nothing was removed: checked for dead CSS and there is none. All 169 classes
are referenced, several only from template strings in the script.

## Where this stands (v335)

In the game: `js/world/alchemy.js`, `css/alchemy.css`, `assets/alchemy/`,
reached from a lair hotspot. Three color-game stations run — mixing,
concentrations, separation. The whole prototype script came over at once,
so the remaining seven need only their markup; missing elements get a
stand-in rather than throwing, and every query the ported code makes is
confined to `#alchemyRoot`.

**The ingredient rack lives outside the modal now, as a bottom drawer**
(`#alchemyRackDrawer`) — it was a fourth "Стойка" tab through v296-301, but
that made it just another color-game station when it isn't a puzzle at all,
and boxed it into the modal's own width/height budget when a 1614:690 shelf
with seven items across wants room the modal doesn't have to spare. Moved
out to match the lockpick case instead
(`css/overrides-05-inventory.css` `.inventoryDrawer`,
`js/world/inventory.js`): fixed to the bottom of the screen, peeking above
the edge, sliding open on click, closing on an outside click — same
mechanics, same construction (a back board, the bottles, a front board
whose lower half repeats the cubby art with its middle band cut
transparent, so the dividers sit in front of each bottle's base while the
body still shows through the gap). No JS drives *visibility* — showing the
drawer exactly while the alchemy module is the open one is one selector,
`body:has(#lairModuleWindow.open .lairPanel[data-lair-panel="alchemy"]
.active)`, because `#lairModuleWindow` only ever carries `.open` in sync
with its own `hidden` attribute (`js/world/lair.js`
`openLairModule`/`closeLairModule`) and only the active tab's panel carries
`.active`. JS only runs the open/closed toggle and the bottle click.

"Same mechanics" turned out to mean two more things once asked for
directly (v303): the peek rises as the cursor approaches rather than
waiting for a click — `js/core/inventory-hit-testing.js`'s pointer-
proximity easing (`v260`), generalized from one drawer to a
`makeApproach(selector, cssVar, maxLift)` factory so `#inventoryDrawer` and
`#alchemyRackDrawer` approach and retract independently through the same
`pointermove` listener rather than needing two — and `--rack-open-y` (was
`2%`, picked without checking against `.inventoryDrawer`'s own
`--inv-open-y`) matches that at `20%`, so the bottom fifth of the rack
stays tucked below the screen edge at full open. The status line under
the rack ("Выбери элемент…") is gone too — the selected glow on the
bottle itself already says which one is picked.

v304 pushed both further and fixed a real bug the approach lift
introduced. The bug: `.alchemyRackDrawerToggle` covered the entire peek
strip at `z-index:5`, above the bottles (`z-index:2`) — so a bottle that
had risen into view via the approach lift, but hadn't been clicked open
yet, still routed its click to the toggle. The click opened the drawer
instead of selecting the bottle it landed on, which read as "I hovered
over it and it just didn't pick." Fixed by dropping the *peeking* toggle
to `z-index:0` (below the bottles — the open-state pull-tab stays at `5`,
since closing has to win there even over a bottle underneath) and by
having a bottle's own click handler call `setOpen(true)` itself, so
clicking a bottle always both selects it and brings the drawer fully open
regardless of what state it started in. The rack's own approach lift also
grew — `maxLift` for the rack is `30 + rect.height*0.15` instead of the
flat `30` everyone else gets, so at full approach substantially more of
the shelf clears the peek line, not just a few extra px of cork. The
selected bottle rises further still on its own (`translateY(-22px)`,
`-27px` on hover) — its medallion is the only thing that names it, no
text label prints the name anymore, and at the same height as its
neighbours it could still be sitting below the peek line even when
"selected." And `--rack-open-y` moved again, to `30%` (10 points past
where it matches the lockpick case), on request.

Seven bottles by element — Stannum, Plumbum, Aurum, Sulfur, Hydrargyrum,
Argentum, Ferrum, in that order — from a shelf image
(`assets/alchemy/rack-back.png` + `rack-front.png`) built for exactly seven
slots. No name is printed on the shelf; each bottle carries its own
alchemical symbol on a medallion instead. Clicking one selects it (the
choice lands in `window.Alchemy.selectedElement`); nothing branches on the
selection yet. The plan is to gate which elixir recipes are buildable by
the chosen element, mirrored on the tension tool's lock-type match in
`js/core/inventory-hit-testing.js`
(`typeBySkin`/`selectedTensionType`/`currentRequiredTensionType`/
`tensionCompatible`) — a lock only opens for the matching tool; an elixir
should only brew from the matching element. Not built.

Each bottle is shorter than its own art would give at a naive `top:7%`
(`.alchemyRackDrawerBottle` is `height:61%` — not the ~72% the ring
position alone would suggest): the ring sits at ~32% down the rack, and at
72% that lands on each bottle at roughly its neck-to-shoulder line — where
a pendant hangs from a chain whose length isn't identical across the seven
separate illustrations. Shrinking the bottle pushes that same absolute
ring position deeper into the image (~55-60% into the bottle instead of
~35%), into the wide jar body that every one of the seven fills solidly
full-width from that point down.

`rack-front.png` is `rack-back.png`'s own bottom 439 of 690px, bottom-
aligned — that split was measured, not eyeballed. The seven ring-centre
x-positions took three tries to actually get right (see the "Two things"
section below) — the value that stuck is an ellipse fit to each ring's own
edge contour: 204.5, 405.0, 604.1, 803.0, 1003.3, 1201.6, 1401.9 of a
1614px-wide source. See the CSS comments on
`.alchemyRackDrawerFront`/`.alchemyRackDrawerBottle` if the art ever
changes.

The three stations were tuned for the lair window rather than the demo's
scrolling page: the window went from 1280px down to 780px, the glassware
scales with the window instead of sitting at a fixed 96×224, and a short
screen (max-height:760px) trims chrome instead of pushing the verdict off the
bottom. Pour/drain animates faster (820/680ms, was 1350/1100), the color
transition itself is slower (.6s, was .22s) so a swap doesn't flash, and each
reagent caps at 6 drops — past that the tube was already at its visual
maximum, so more clicks did nothing but invite the player to find out what 99
looked like.

Styles the seven cannot reach yet are parked in `stations-pending.css`. Move a
block back when its station's markup lands.

Stylesheet went 87 KB -> 44 KB: the demo's own page chrome, the rules bound to
unported stations, and the prototype's layout, which was written for a
scrolling catalogue and replaced with about 4 KB written for the lair window.
The glassware and the 81 lines of game logic were never touched — that is the
part worth keeping.

Success is only a verdict for now. Nothing is banked; potions that carry into
the next lock are the agreed next step, not built.

**Each of the three color-game stations is now three columns: bench,
reagents, element slot.** The two glassware bottles and four reagent flasks
shrank to make room for a third cell — a dashed bottle-silhouette button
(`.alchemyElementCell`) with the Проверить/Сброс pair moved underneath it.
Clicking the cell opens the rack drawer; picking any of the seven rack
bottles fills the cell (with that bottle's own art, via
`--element-bottle-img`) and enables all three stations' Check buttons at
once — one selection, shared across the whole module, same as the rack's
`window.Alchemy.selectedElement` was already shared. The target bottle also
grows a second label under "цель" naming one of the seven elements
(`ALCHEMY_ELEMENT_NAMES`, rerolled alongside the round itself). Nothing
checks the placed element *against* that name yet — the gameplay ask was
just "some element must be present to check," not "the right one," so the
name is a hint for future work, not a gate today.

**A long element name needs the same absolute-label handling mobile-side
that "текущая смесь" already got.** `.target-element-hint` sits
`position:absolute;top:100%` under the target tube, same trick as
`.swatch-label` above it (see "A wide label..." below) — kept out of flow
so it can't widen `.tube-box` and drag the whole row off-centre. At the
mobile breakpoint the tube column is only ~58px wide, and Cyrillic-style
`white-space:nowrap` let "HYDRARGYRUM" run 130px past its box into
"текущая смесь" 24px away. Fixed with `width:100%` (not a guessed
max-width — 100% of the tube-box, its own positioned ancestor, so it
literally cannot exceed the column) plus `overflow-wrap:break-word` (a bare
`white-space:normal` does not break an unbroken word — it only wraps at
existing spaces, and this is one word) and a matching `margin-top` to clear
`.swatch-label`, which sits at that same `top:100%` and would otherwise
print on the same line. `.lab`'s own scroll region ended up the tightest
budget in the stack: its flex-1 share is whatever's left after the reagent
band and the new element column, both flex-0, so the reagent labels also
needed a 2-line clamp (`-webkit-line-clamp:2`) — Separation's "Убрать
красную примесь" alone was ~50px taller than Mixing's "Красный" and that
difference was enough to push the target-element-hint below `.lab`'s
visible area on that station only, even after the tube-pair budget was
tuned against Mixing.

**The three color-game panels sit on an actual wooden desk now** instead of
the dark bordered card. One supplied table image
(`table.png`, drawn at a slight angle with two front legs) became three
files — `desk-cap-left.png`/`desk-cap-right.png` (each keeping a full leg,
250px wide) and `desk-mid.png` (a 120px flat-grain strip with no leg,
cropped from the one x-range, 250–836px of the 1086px source, where the
table's own top/bottom edges measured pixel-identical across nine sample
columns — proof the artist drew that stretch without perspective
convergence, so it repeats cleanly). `.lab.color-game-lab`,
`.alchemyReagents` and `.alchemyElementColumn` each get the same three-layer
background (`background-size:auto 100%` on every layer, so a shorter box —
the reagent band — gets proportionally narrower caps instead of an
oversized leg): left cap, right cap, and the middle tiled `repeat-x`
between them. That single rule is what makes both layouts work with zero
extra assets — stacked on mobile it reads as three separate desks (the
"cut the table, combine left+right per block" ask), side by side in the
wide 3-column grid it reads as close to one continuous bench. Bottles and
the Проверить/Сброс buttons keep their own opaque backgrounds, so nothing
needed to change there — only the panel chrome around them did.

**v306's three separate desks were wrong on both ends, per feedback off a
screenshot.** Wide screens got three tabletops with a strip of bare panel
between them where the user wanted one continuous desk; narrow screens got
each block's two 250px leg caps overlapping (blocks run ~340px there) into
a doubled top edge where the user wanted a plain stretch of grain with no
leg art at all. Split the one shared rule in two: the always-on base rule
(mobile) now draws only `desk-mid.png`, repeated, no caps; a new wide-only
rule moves the full three-layer (caps + mid) background onto
`.scene.active` itself — one background behind the whole grid row, so the
14px column gap still separates bench/reagents/element but the desk paints
straight through it — and clears `background` back to `none` on the three
child panels so they don't double-draw under it. Same two source images
either way, just applied at a different level of the DOM depending on
whether there's room for the caps.

**The rack drawer was still sized off its 760px desktop cap on mobile.**
Its own `max-width:760px` breakpoint only touched `--rack-peek` (the peek
height), never `width` — so next to the lockpick case, which does widen at
that breakpoint (`css/overrides-05-inventory.css`, `min(96vw,calc(100vw -
16px))`), the rack visibly stayed the smaller of the two. Matched the
case's own mobile width step; since every bottle and the rack art itself
are sized off `.alchemyRackDrawer`'s width via percentages and
`aspect-ratio`, widening the one property scales all of it together.

**v307's wide desk still left a band of the (near-black) `.alchemyRoot`
background above the tabletop's own back edge**, per a follow-up
screenshot — "фон вокруг всего". `auto 100%` keeps the source table
undistorted, but undistorted isn't the same as "fills the box": the wide
row's own aspect ratio is wider relative to its height than the table
source is, so the caps-and-mid layers, each individually sized to the
row's height, simply didn't reach as high as the row — same underlying
image, rendered smaller than the box that was supposed to be full of it.
Switched to one full, unsliced image (`desk-full.png`, the whole
`table.png` trimmed to its bbox) stretched `100% 100%` — no gap possible
by construction, at the cost of accepting some perspective distortion at
extreme row aspect ratios. The mid-tile/cap-slicing trick stays for
mobile, where each stacked block's own height already roughly matches its
content, so there's no gap to stretch away in the first place.

**The wide reagent band was a 2×2 grid; feedback wanted one row of four,
same as mobile.** That grid was itself deliberate (v292-ish, "four
reagents read better as a block of two than as a tall column" — see the
comment history) for the *narrow* reagents column that existed back then.
The column's since widened for the single-desk backdrop above
(`minmax(150px,180px)` → `minmax(220px,280px)`, still much narrower than
the bench), so reverting `.color-controls` to the same `flex-row` the base
layout already uses (rather than inventing a new wide-only rule) fits
without the old cramping.

**`background-size:100% 100%` fills the box; it does not fill the image.**
v308's stretch fix closed the gap along the row's own edges, but the
source table is a photo of an *object* — drawn at an angle on a
transparent canvas, legs and all, not a rectangular texture — so its own
top corners (above the tabletop's receding back edge) are transparent
pixels baked into the file itself. Stretching moves those pixels around
with the rest of the image; it can't paint over them, because alpha
scales right along with color. The near-black `.alchemyRoot` panel
underneath kept showing through at exactly those corners — smaller than
the v307 gap, easy to mistake for "basically fixed" in a quick look, but
still the same underlying complaint. The actual fix is a
`background-color` under the image (sampled as the average of
`desk-mid.png`'s opaque pixels, `#7a4e31`) so the object's own transparent
margin reads as "more desk" instead of a hole. Any background built from a
non-rectangular source image needs this same pairing — the image alone
only ever paints where it has content.

**All of v306-v309 was aimed at the wrong target.** Every fix up to that
point made the *desk sit inside the modal window* look better — filling
its box, no black corners — but the actual ask, once it was spelled out
plainly, was that there shouldn't be a modal window at all: "не чтобы
окно открывалось, в котором стол, а чтобы просто открывалась картинка
стола". Removed `#lairModuleWindow`'s border/border-radius/box-shadow
specifically while the alchemy panel is active (same `:has()` scoping as
everything else here, so Dialogue/Map/Team keep their own card exactly as
before) — tabs and title now sit directly over whatever's behind them,
no card implied.

**"Whatever's behind them" turned out to be the lair room itself,
hotspots and all — dropping the background outright wasn't the fix
either.** On mobile the window is nearly full-screen
(`overrides-04-universal-lock.css`), so a fully transparent window meant
the reagent tubes rendered directly over the standing character
illustrations, with the room's own "Алхимия"/"Анализ города" hotspot
buttons (still very much alive underneath, `.topRightHud` sits at
z-index:360, well above the window's 40) visible and clickable right
through the gaps. A flat `background:#7a4e31` — the same wood tone
sampled for the transparent-corner fix above — keeps the window
opaque without reading as a UI card: no border, no shadow, no rounded
corners, just more of the same desk color the detailed photo already
sits on, so title/tabs/tubes all look like they belong to one continuous
wooden surface instead of a window with a table drawn inside it.

**v310's flat wood-tone window fill was itself unwanted — swapped for a
blur.** Per feedback, any solid color reads as "a UI panel" no matter how
well it's sampled from the desk photo; `backdrop-filter:blur(20px)` plus a
neutral `rgba(10,8,6,.28)` (not brown) keeps the lair room behind
illegible without introducing a color of its own. Still scoped to
`#lairModuleWindow:has(.lairPanel[data-lair-panel="alchemy"].active)`
only, so other lair panels are untouched.

**Bottles now stand on the desk's own surface (wide screens) instead of
sinking into its front edge/legs — `transform`, not repositioned layout,
and each group needed a different fix once buttons started colliding.**
The big bench bottles (`translateY` + `scale(.5)`, `transform-origin:bottom
center`) were straightforward — nothing sits below them, so a pure visual
transform was enough. The reagent flasks weren't: they live in
`.color-card` (swatch → hidden label → hidden drops → ±/Filter button),
and a `translateY` on just `.mini-swatch` moved the swatch without moving
the button after it — since transforms never affect layout, the flasks
visually slid right down into their own controls once the labels were
hidden and the natural gap disappeared with them. Chasing that with a
matching margin on the button didn't work either: `.alchemyReagents` was
`align-items:center` on its row, and — surprisingly — center/flex-end
alignment cares about each flex item's *content height*, not its bottom
position, so padding the item didn't relocate its bottom edge at all.
The actual fix was structural: switching `.alchemyReagents` to
`align-items:flex-end` (matching how `.tube-pair` already anchors the
bench) put the reagents' natural baseline near the table's front edge on
its own, so the swatches only needed a small `translateY`, not one big
enough to reach past their own buttons. The element-slot cell hit the
same problem one layer up — a `translateY` shift and the verdict
text/Check button below it (a *sibling* in a plain flex column, not
row-aligned at all) started overlapping — solved with `margin-top`
instead of `translateY` there specifically, since that column has no
flex-end trick to lean on and margin is the one transform-like property
that *does* push later siblings down with it.

**All three groups' target position was found empirically, the same way
the ring centers and mask bounds earlier in this file were** — read each
group's `getBoundingClientRect().bottom` via the console, nudge the
transform, repeat until bench/reagents/element all report the same
number (663–664px at a representative 1200×900 window in this pass).
These are unapologetically pixel values, not percentages — like the
`.tube-pair` gap fix above, this file keeps choosing fixed px over a
formula when the underlying image itself is a fixed-aspect object, not
something that reflows cleanly at every size. Short screens
(`@media (min-width:900px) and (max-height:760px)`) needed their own,
smaller push-down and cell margin — the full-size ones were tuned against
a normal window height and ate into the already-tight short-screen budget
enough to clip Проверить/Новая партия at the window's own bottom edge.

**A `backdrop-filter` on the window only ever blurs what's directly
behind its own box — that's not "the whole screen" once the window is
narrower than the viewport.** v311's blur sat on `#lairModuleWindow`
itself, capped at 780px wide; everything past its edges (the room, the
character portraits either side) stayed sharp, visible on a wide-enough
browser window. Moved the blur to its own full-viewport layer instead
(`#alchemyFullBlur`, a sibling of `#lairModuleWindow` inside
`#lairOverlay`) — `position:absolute;inset:0` is enough to cover the
whole screen here because `#lairOverlay` is itself `position:fixed`,
sidestepping the transform-on-ancestor containing-block trap
`#lairModuleWindow`'s own `transform` sets for any `position:fixed`
descendant (the same reason the rack drawer had to move out of the lair
DOM subtree, `v302` above). Ordering in the markup is what keeps the top
HUD and rack drawer sharp: the blur layer sits right before
`#lairModuleWindow`, after all the room/hotspot/character markup, so
`backdrop-filter` picks up everything already painted behind it and
nothing painted after — the HUD and rack drawer live outside
`#lairOverlay` entirely regardless, at z-index 360 and 214 against its
160, so they were never in reach either way.

**`minmax(0,1fr)` on the bench row means "fill whatever height the
window has," and the window's own height budget (`max-height:82vh`) can
be a lot more than a photographed tabletop wants.** On a tall browser
window the row — and the desk image stretched `100% 100%` across it —
grew well past a sensible table height, reading as a wall of wood rather
than a tabletop sitting under three columns of glassware. `max-height:
420px` on `.scene.active` caps the row without touching the window's own
sizing (still auto height, still capped at 82vh) — the window just ends
up with a bit of slack above/below the row on a very tall screen instead
of stretching the photo to fill it.

**Two of v312's three follow-up complaints were the same underlying
regression, seen once by eye and once by name.** "Стол растянут" and
"коричневая обводка" both pointed at the `background-color:#7a4e31` fill
under the desk photo (added in v309 to hide its own transparent corners
against the panel's old near-black background). Once the row also had a
hard `max-height` (v312) its box became visibly rectangular, and that
flat brown fill in the corners read as its own box drawn around the
organic table shape — "stretched" and "outlined" are two ways of
describing the same rectangle-vs-trapezoid mismatch becoming visible.
Removed the fill outright rather than re-tuning it: v309's fix predates
the full-screen blur from later in v312, and blurred room in those
corners (instead of a flat color, instead of the old near-black) is a
strictly better background than anything this file was trying to paint
there itself.

**Z-index numbers copied from one comment to justify a value elsewhere
in the same file need to be re-checked against the actual CSS, not
assumed.** v312's blur used z-index:1, reasoning (never actually
verified) that anything from the room would be even lower. Сай's own
portrait sits at z-index:3 (`css/overrides-06-digital.css`,
`.lairSceneCharacter.sai`), inside `#lairSceneCharacters` at z-index:8 —
both comfortably above 1, so she kept painting on top of the blur meant
to cover her. Fixed at z-index:9, one past that container.

**`100% 100%` and `max-height` together is how you get exactly double the
distortion you were trying to fix.** v312 capped the row at 420px to stop
it stretching the desk photo *taller* on a tall window; measured live,
that capped row is 740×420 (≈1.76:1) against the source photo's own
1086×266 (≈4.08:1) — stretching to fill it exactly meant scaling the
image roughly 2.3x more on the vertical axis than the horizontal, which
is "stretched vertically, definitely by double" from testing, read
correctly. The cap didn't cause the distortion (`100% 100%` always
distorts whenever box and image proportions don't match) but it did make
the mismatch worse by holding height fixed while width could still vary
with the window. `background-size:contain` fixes the actual cause instead
of the symptom — the photo scales uniformly by whichever axis is more
constraining, undistorted at any row size, with blur (v312) filling the
letterboxed space above/below rather than a stretched or a flat-filled
one. That also moved every bottle's target line: the photo no longer
fills the row's full height, so the "same level" transforms tuned in
v311-312 against a full-bleed image needed re-measuring against the
now-centered, smaller one (~45-50px higher up in this pass).

**A blurred, non-interactive room can still have live buttons poking
through it if their own z-index outranks the blur layer's** — same
lesson as Сай's portrait in v313, one level up. `.lairHotspot`
("Диалоги", "Выбор персонажа", etc., `css/overrides-03-lair.css`) sits at
z-index:18, clean past the blur's z-index:9 from that same fix. Raised to
z-index:30, past every z-index this file's own room content actually
uses (`.lairSceneTop`'s 25 is the highest) rather than bumping past just
the one culprit found this time — the room's stacking layers aren't
documented anywhere else, so picking a number with headroom beats another
round of "found one more thing poking through."

**A wide-screen layout pass, in one go: Проверить/Сброс beside the element
bottle, the verdict text moved to a strip under the tabs, ±/Filter
flanking each reagent tube instead of sitting together, цель/текущая
смесь pulled back up to the (now higher) bottles, the desk pushed lower
still.** Each piece had its own gotcha:

**`position:static!important` from an early "protect alchemy from the
game's leaking styles" rule (v284-era, `.alchemyRoot
.scene,.alchemyRoot .status,.alchemyRoot .tab{position:static!important;
...}`) beat a normal-weight `position:absolute` no matter how specific
the selector.** Needed to move the verdict text out of the element
column and up under the tabs; wrote a plain `.alchemyRoot .scene.active
.status{position:absolute;top:46px;...}`, checked it in the browser, and
it measured `position: static` anyway. `!important` always wins against
normal-weight rules regardless of specificity or source order — the
fix was giving the new rule `!important` too, not writing it more
specifically. `.status` never moved in the DOM; `.alchemyRoot` being the
nearest *positioned* ancestor already made this legal — each station's
own `#mixStatus`/`#unknownStatus`/`#sepStatus` still only shows when its
own `.scene` is `.active`, same as before, just painted somewhere else.

**Flex-shrink crushed the element cell down to a 20px sliver once
Проверить/Сброс moved into the same row as it.** The "element" grid
column was only 120–150px — barely enough for the bottle alone, let alone
beside a button stack with its own 100px+ floor. Neither the cell nor the
buttons had `flex-shrink:0`, so the row absorbed the deficit by crushing
whichever item had no floor to fall back on — the bottle, not the
buttons (which did have `min-width`). Widened the column to 210–260px
*and* added `flex-shrink:0` to both; the width fix alone wasn't enough
because the row was still tight enough to shrink something.

**Percentage `margin-top` resolves against the containing block's
*width*, not its height — a different quirk than `.tube-pair`'s `vh` gap
below, but the same family of "the unit didn't mean what it looked like
it meant".** Pushing the desk row lower (`margin-top` on `.scene.active`,
a percentage) moved it by a fraction of the row's own *width* (~740px),
not a fraction of the window's height. A modest-looking `35%` request
(meant as "a bit more than the existing 20%") worked out to ~260px,
enough to squeeze the row well below its own `max-height` since there
wasn't that much room left in the window's own height budget. Backed off
to a value that fits instead of chasing the literal percentage.

**Another "transforms don't move layout" collision, this time between two
elements that both needed one.** v315 put the reagent tube's ± controls
above it in the layout via flex `order:-1` and left the swatch's own
`translateY(-70px)` alone; that lined the buttons up with the swatch's
*old, untransformed* position, and since the swatch renders 70px higher
than that via transform, the two ended up overlapping instead of stacked.
Gave the buttons their own `translateY` too, tuned separately, rather
than trying to make `order` alone account for a shift it has no way to
know about — `order` only ever reasons about layout, and the thing it
needed to clear moves entirely outside layout's view.

**`overflow:auto!important` from the same "protect alchemy from the
game's leaking styles" rule as v315's `position:static!important`
started showing a real scrollbar once the bench bottles render
translateY'd above their own box.** Transforms don't grow the box they're
applied to — `.lab`'s layout height is still whatever the untransformed
bottle needed, so the auto-scroll region "saw" overflow at the top the
moment the bottle rendered outside it. Nothing here is meant to scroll at
this width; `overflow:visible!important` on `.lab.color-game-lab`
specifically (scoped past the generic rule's `.lab`, so it doesn't touch
whatever markup-only stations end up using that class later) fixed it.

**Percentage `margin-top` (v315's desk push-down) hit its own ceiling —
the window's own height budget — before it could push far enough to
read as "the table moved."** Rather than fight that budget again,
pushed the *contents* (bottle groups' own transforms) further down
instead of the row itself. Visually similar outcome, achieved by moving
what actually had room to move.

**"колба с металлом обрезается слева" wasn't the rack bottle at all — it
was HYDRARGYRUM's own leading letter, clipped by the window's edge.**
`.target-element-hint` centers itself under the *leftmost* item in the
bench column via `left:50%;transform:translateX(-50%)`, `white-space:
nowrap`. For an 11-letter name that math put the text's left edge outside
`#lairModuleWindow`'s own left edge — measured, 193px against the
window's 210px — and the window clips (`overflow:hidden`, plain, not
`!important`, but still enough). Same fix as the mobile breakpoint
already uses: `white-space:normal;width:100%` (of the tube-box, its
positioned ancestor) so it wraps to two lines within its own column
instead of overflowing sideways into a hard edge.

**Raising the bench bottles 10% (v317) meant every position tuned
against their *old* line needed the same push, not just the bottles
themselves** — the reagent ± buttons (positioned above the swatch via a
matching `translateY`, v316) and цель/текущая смесь's own labels (already
pulled up once in v315 to track the bottles) both needed the identical
delta reapplied, or they'd drift back out of alignment with bottles that
had just moved without them.

**A cleanup pass, prompted by "the code definitely has problems" rather
than a specific symptom.** Read back through the v311-v317 additions
specifically (the ones from this feature's most recent, fastest-moving
stretch) looking for exactly the kind of thing rapid iteration leaves
behind — dead code, stale comments, broken scoping — rather than
re-verifying things already re-checked each version. Found two real ones:

**`.alchemyElementCell` (and its `.filled`/hover/`Hint` variants) were
never wrapped in `.alchemyRoot`, unlike every other selector in this
file.** The comment right above the game/alchemy scoping rules (v284-era)
spells out exactly why that prefix exists — "scoping protects the game
from this stylesheet; [the neutralise rule] protects the stations from
the game's" — and this class, added later when the element slot was
built, never got it. No actual collision today (checked: nothing outside
`#alchemyRoot` uses the name), but it's exactly the gap that convention
exists to close. Prefixed all six rules.

**A genuinely stale override:
`.alchemyRoot .scene.active .alchemyElementCell{margin-top:90px;}` in
the short-screen media query, left over from v315 when the cell used
`margin-top` for its vertical placement.** v316 switched the cell to the
same `transform:translateY(...)` approach the bottles and swatches
already used, and the base rule's own `margin-top` came out — but this
short-screen copy of it didn't, so on any short wide-screen window the
cell was still getting an *extra* 90px pushed onto it on top of the
transform, a real (if narrow-window-only) misplacement that nothing
since v316 had re-tested. Removed; the cell's normal transform already
carries over into short screens fine on its own.

**A second, more thorough cleanup pass, this time reading the whole file
line by line rather than spot-checking the recent additions.** Wrote a
small script to list every selector using a custom `.alchemy*` class
without an `.alchemyRoot` ancestor — the same category of gap v318 fixed
for `.alchemyElementCell` — and cross-checked each hit against the
markup/JS before touching anything, since `.alchemyRackDrawer*` and
`.alchemyFullBlur` are *correctly* unscoped (both live outside
`#alchemyRoot` entirely, by design). Found four more genuine misses:
`.alchemyReagents`, `.alchemyElementColumn` (plus its `.big-actions`/`.ctl`
children), and — while checking those — `.alchemyStations`/
`.alchemyStationTab` too, unscoped since before this whole feature. None
had an actual collision (checked each name against the rest of the
codebase), same as v318's find; still worth closing for the same reason
the convention exists.

**Also found an exact duplicate: `.alchemyStations`/`.alchemyStationTab`
were defined twice, ~120 lines apart, with the tab rule's `font` shorthand
differing between the two (`var(--ui-font,Arial,sans-serif)` vs
`inherit`).** Not a visible bug — cascade order made the second,
`inherit` version win outright, and `inherit` resolves to the same
`var(--ui-font,...)` value anyway since `.alchemyRoot` itself sets that as
its `font-family` — but the first block was 100% dead weight, silently
copy-pasted at some earlier point rather than reused. Deleted the first
occurrence, scoped the surviving one.

**"−" moved back below the tube (only "+" stays above), and the same
flow-vs-transform gap that "+" hit in v317 showed up again on the way
back down.** Reverting "−" to normal flow order put it below the
swatch's *untransformed* layout box, ~110px under the swatch's actual
(transformed-higher) visual position — the same mismatch as always,
just discovered from the opposite direction this time. A second
`translateY`, tuned separately from "+"'s, closes it.

**That second `translateY` needed `:not(:last-child)` or Separation's
single "Фильтр" button (`:first-child` and `:last-child` at once) got
both rules' conflicting values and cascade order picked the wrong one.**
Same shape of bug as v317's HYDRARGYRUM crop, different mechanism:
there it was two elements' positions drifting out of sync, here it's
one element matching two selectors that disagree.

**`.lab h3` ("Образец и текущая смесь" etc.) dropped per feedback —
wide screens only.** The bottles' own цель/текущая смесь labels already
say what's being compared; mobile keeps the heading since it wasn't
asked to change and the stacked layout there has more use for it.

**v321 pushed the desk lower and the glassware higher again, and moved the
left (target) bottle onto the wood — each a small ask that touched a lot
of tuned pixel values.** Wide-screen desk `margin-top` went 36% → 41% (a
further 5% on top of v320's 10%); every element standing on that desk —
bench bottles, reagent swatches, the element cell, their labels, the
reagent ±buttons — got its own `translateY` bumped by the same ~63px so
feet stay on the (now lower) table edge instead of floating above it,
same "retune the whole dependent chain together" pattern as v311's
original "stand on the table" pass. The left bottle wasn't the fix
target's fault — `background-size:contain` on the desk photo (v308)
letterboxes it inside `.scene.active`'s box, so the *painted* table
doesn't reach the box's own left edge, and the target bottle's un-nudged
position landed past that edge, off the wood. `transform:translateX(52px)`
on `.tube-pair` (not on the two tube-boxes individually) moves both
bottles and their absolutely-positioned цель/текущая смесь labels
together as one rigid block — no per-element X compensation needed, since
they share one parent, unlike the Y-axis raise where label/button
transforms live on separate siblings and each needed tuning by hand.

**The direction was "right," not "left," and getting it backwards broke
the layout badly enough to be its own lesson.** "Сместить левее" read
literally as *move left*; a `translateX(-52px)` pushed the target bottle
further off the table's own left edge (worse, not better) and crushed the
element cell down to a thin sliver — both fell out once corrected to
`+52px` per the follow-up ("имел в виду правее"). A first pass also
carried the same `translateX(52px)` onto `.color-controls` (the reagent
band), reading "и всё остальное на столе подвинуть тоже" as *everything*
rather than *everything the bottle shift affects* — that shoved
Separation's fourth "Фильтр" button 36px past `.alchemyReagents`'s own
`overflow:auto` edge, clipping it. Reverted: only `.tube-pair` needed the
shift, since the reagents were never reported broken and nothing about
raising the bottles or lowering the desk moves them horizontally at all.

**The short-screen query (`max-height:760px`) silently drifted out of
sync with the raise amounts above it, same failure mode v311 already
named once.** That block only ever scaled `margin-top` back (8%, unrelated
to the wide default's now-41%) — it never touched the `translateY` raises
on the bottles/swatches/cell/buttons/labels a few rules up, which are
tuned *against* that 41%. Left at full strength on a short window, they
lifted every element clear off a desk that had barely been pushed down at
all — bottles floating mid-air, "цель"/"текущая смесь" overlapping the
target name instead of sitting under the bottle. Fixed by giving the
short-screen block its own copy of every one of those `translateY`
values, set back to what they were before this round grew them (the same
numbers v320 shipped) — this is exactly the pairing v311's own note above
warned about needing "their own, smaller push-down," just for a wider set
of properties than margin-top alone this time.

**v322 turned out to be mostly mobile — the stacked layout had never gotten
the "stand on the table" pass the wide grid got back in v311.** The
mobile `.lab`/`.alchemyReagents`/`.alchemyElementColumn` stack always had
its own transform-free layout (no `margin-top`, no per-element
`translateY`), which is why the mobile panels still read as flat and
close-packed while the wide row already had headroom and raised
glassware. Added the same two-part move — push the panel's own table
level down (`margin-top` on `.tube-pair`, since nothing needs to track a
plain layout shift the way a transform's flow-position mismatch would),
raise what stands on it (`translateY` on the two bench bottles, the four
reagent swatches) — tuned in px against the stacked panel's own height
rather than reusing the wide numbers, which were tuned against a
completely different box.

**"Образец и текущая смесь" is gone everywhere now, not just wide.** The
per-station `.lab h3` used to hide only inside the `min-width:900px`
query (v320); moved the `display:none` onto the base rule instead and
dropped the now-redundant wide-only copy. Same reasoning as v320 already
gave for wide — the bottles' own цель/текущая смесь labels say what's
being compared — just extended to the panel that was still carrying it.

**Reagents 3 and 4 sat 18px lower than 1 and 2, and it wasn't a
translateY at all — it was `min-height:0`.** `.color-controls` has always
been `align-items:flex-end` (v311, to anchor the row's baseline near the
table's front edge), which lines up each card's *bottom* edge, not its
swatch's top. A 2-line label ("Крас-\nный") makes its card taller than a
1-line one ("Синий") sitting right next to it — bottom-aligned, the
taller card's swatch sits higher, the shorter card's lower. The mobile
line-clamp rule (v317, added to stop Separation's long labels from
ballooning the panel) set `min-height:0` on the label specifically to let
short labels take only the room they need — which is exactly what broke
the alignment for any station where labels happen to differ in line
count within the same row. Restored `min-height:2.2em` (the same
reservation the non-clamped base rule already used) alongside the clamp,
so every label reserves full 2-line height regardless of how many lines
its own text needs — cards end up the same total height again, and
`flex-end` lines up their swatches instead of their labels.

**The element cell's dashed border is mobile-only gone — width also grew
50%, aspect-ratio kept it proportional.** Both are cosmetic-only changes
scoped inside `@media (max-width:760px)`; the wide layout's own element
cell sizing and (border-less already, see v321's `.filled{border:none}`)
styling are untouched.

**Проверить/Сброс moved to one row on mobile — its own `.ctl{width:100%}`
still had to be overridden alongside the row's `flex-direction`.** Base
`.alchemyElementColumn .ctl{width:100%}` was written for the *column*
layout (v305) where each full-width button stacks under the next; simply
flipping `.big-actions` to `flex-direction:row` left both buttons still
individually claiming 100% of the row's width, so they'd still stack (now
overlapping) instead of sitting side by side. `flex:1 1 0` on `.ctl`
(mobile-scoped, same media block) splits the row evenly between them —
the wide layout was never touched, so its own separate stacked
Проверить/Сброс (`width:auto;min-width:100px`, v305) still reads that
way; only mobile asked to change here.

**Two real desktop bugs surfaced once this round's asks pushed the
raise/shift numbers further: reagent swatches and the element cell were
losing a few px off their own top edge, and the target bottle needed
more clearance than the row's own width implied.** The clipping:
`.alchemyReagents`/`.alchemyElementColumn` both still carried the base
grid rule's `overflow:auto` (meant for scrolling long verdict text, not
for this) — v321 already fixed the identical bug for `.lab` when the
bench bottles' raise first pushed them past their own box's top edge, but
never extended the same `overflow:visible!important` to the other two
columns, which is exactly what a further raise on the reagents/element
cell this round needed and didn't have. Same fix, same reasoning, applied
to both remaining columns. The shift: `.tube-pair`'s `translateX` went
52px → 82px (an added ~4% of the row's own 740px width, on top of v321's
value) to clear the desk photo's own tapered left edge by a wider margin,
and the element cell's own raise grew from -83px to -107px so its foot
lands on the same line the two big bottles' feet already do
(`getBoundingClientRect().bottom`, same measurement technique v311 used
to line the three groups up in the first place) — both retuned by the
same "measure, nudge, repeat" process as everything else pixel-tuned in
this file.

**v323 found a real positioning bug in the hover bubble burst, and traded
three text buttons for icons/symbols per feedback.** The bug: hovering a
reagent swatch spawned its liquid-burst bubbles ~150px below the tube
instead of inside it — `liquidBurst()` (`js/world/alchemy.js`) computes
the burst's inline `top`/`left` from `getBoundingClientRect()` diffs
between the swatch and its vessel (`.color-card`, since a reagent swatch
isn't nested inside a `.test-tube` the way the big bottles' liquid layer
is), which is transform-safe math — but a CSS rule reset the whole `inset`
shorthand to `auto !important` to fix an unrelated sizing conflict, and
`auto` on all four offsets while `position:absolute` beats even the
inline `top`/`left` (a stylesheet `!important` outranks a non-`!important`
inline style regardless of specificity). With every offset auto, the
burst rendered at its plain flow position instead — dead last among
swatch/label/drops/buttons in `.color-card`'s own column, i.e. well under
the tube. Never surfaced for the big bottles because their burst host and
vessel are nearly the same box, so the auto fallback happened to land
close enough by coincidence. Fixed by narrowing that rule to only reset
`right`/`bottom` (the actual sizing conflict this was for), leaving
`top`/`left` free for the inline values to win as originally intended.

The three-button swap: Проверить keeps its label, but Сброс/Новая
партия/Новая смесь are now a bare reset icon (`.ctl-icon`, inline SVG —
reused the same `refresh` glyph path `js/core/init.js`'s own
`tablerIcon()` helper already draws elsewhere in the game, rather than
the `<i class="ti ti-*">` webfont classes alchemy.js uses for its other
icons, since no such font is actually loaded anywhere in this project —
those render as blank glyphs today, a pre-existing gap out of scope
here). Separation's single-button "Убрать примесь" control lost its
"Фильтр" label for a bare "−", matching the ±-button look Mixing and
Concentrations already use — it already had all the CSS a two-button pair
gets (`:last-child{order:-1}` lifts it above the swatch the same way),
just carried different text.

**Проверить/Сброс now sit centered against the element cell's own
*rendered* height, not its pre-transform layout height.** `align-items:
center` on the row already centers `.big-actions` against the cell — but
the cell also carries its own `translateY` raise (to stand on the table
like the bottles do), which moves it up visually without moving its
layout box, so plain centering was still centering against where the
cell *would* sit un-raised. A matching `translateY` on `.big-actions`
(tuned by eye against `getBoundingClientRect()`, same measure-nudge-repeat
process as every other raise in this file) re-centers it against the
cell's actual on-screen position instead.

**The reagent row shifted right within its own column, same idea as the
bench bottles' own rightward nudge a few versions back — a plain
`translateX`, no compensation needed.** Unlike the bench (where labels
live on separate sibling elements needing their own matching shift), the
reagent swatches, their buttons, and their (hidden, wide-only) labels are
all descendants of `.color-controls` itself, so one transform on that
single container carries all of them together.

**v324 fixed Separation's single "−" button landing above its tube like a
"+" instead of below — and along the way found why a single-button
reagent card can't just skip the reorder.** Separation's control matches
both `:first-child` and `:last-child` at once (it's the only child), so
it inherited the `:last-child{order:-1;...}` rule wholesale — the same
"reordered above the swatch" treatment "+" gets in the two-button
stations. Feedback: minus signs belong under the tube everywhere,
matching Mixing/Concentrations' own "−".

The obvious fix — drop `order:-1` for the single-button case so it stays
in its natural (post-swatch) position — broke the *tube* line across
stations instead. `.alchemyReagents`/`.color-controls` both anchor their
row's bottom edge (`align-items:flex-end`), so every card in it starts
its flow from that shared bottom regardless of how tall the card's own
content is. A two-button card (Mixing/Concentrations) has one more flow
item than a one-button card (Separation) — same swatch, same hidden
label/drops, but a second button's worth of extra height. Shorter flow
height, same bottom anchor, means the *top* of a one-button card starts
lower than a two-button one's — and since the swatch's raise transform is
one shared, fixed pixel value across all three stations, starting from a
lower flow position landed Separation's tube visibly lower than Mixing's
after the same lift, breaking the "line of all tubes on the table" the
feedback specifically called out.

Fixed both at once, working *with* that mechanism instead of around it:
`order:-1` stays on the single button (so its card keeps the same flow
height as a two-button one — the reordered button still occupies the
leading flow slot, it just doesn't have to visually render there) and
only its `transform` changes, aimed down at the "−" position instead of
up at the "+" one. The swatch itself still needed its own extra lift on
top of that (`:has(.ctrl-row .small-btn:only-child)`, a card with the
button reordered-but-redirected is *still* one real button short of two,
so the flow deficit is only half addressed by keeping order:-1 — the
missing button's height must be compensated somewhere, and the swatch's
own transform was the one already built to absorb exactly this kind of
per-station tuning).

**The wide fix's own `:has()` selector leaked into the short-screen query
nested inside the same `min-width:900px`, silently overpowering that
block's smaller, separately-tuned numbers.** `:has(.ctrl-row .small-btn
:only-child)` is more specific than the short-screen block's plain
descendant-selector override of the same property, so once both matched
(short screens are still `min-width:900px`, just also `max-height:760px`)
the *wide* compensation value won even in the short-screen context it was
never tuned for — swatch position 71px off, this time in the opposite
direction (too high, not too low) once the wide value's much larger lift
got applied against the short screen's much smaller base raise. Needed
its own `:has()` override, at equal-or-higher specificity, inside the
short-screen block itself — matching that block's own established
pattern of shadowing the wide numbers wholesale rather than layering on
top of them.

**v325 swapped the sulfur rack bottle's art** (`assets/alchemy/bottle-sulfur.png`,
still that filename — only the pixels changed, `data-element="sulfur"`
and the DOM/markup are untouched) for a supplied `cuprum_bottle_04.png`
(150×411, close enough to the original 150×408 that nothing needed
retuning).

**And fixed what "the tube line" actually meant — it was the reagent
swatch's own *bottom edge* the whole time, not wherever its "−" button
happened to land.** Every earlier "stand on the table" pass (v311
onward) tuned the swatch and its buttons together as one unit, always by
eye against a screenshot — close enough each time to look right, but the
actual anchor was never verified against the *big* bottles' own bottom
edge until asked directly. Measured: the reagent swatch's rendered bottom
sat 40px above the big bottles' (matched only by the "−" button
underneath it, which is why it read as "the tubes are already on the
table" at a glance — something was there, just the wrong something).
Every `translateY` in the reagent group — the swatch, both button
positions, the single-button compensation, and its own swatch
compensation — shifted down by that same 40px (34px at the short-screen
scale) so the swatch's bottom, not the button's, lands on the shared
line. The buttons drop below the table edge as a result, which reads
fine since they're controls, not glassware standing on the wood.

**v326: v325's sulfur→cuprum art swap was only half done — kept the old
filename and `data-element`, which is exactly backwards from how this
system is wired.** The element cell's own bottle art, once one is picked
from the rack, is built directly from that string —
`--element-bottle-img: url("/assets/alchemy/bottle-${element}.png")` — and
its aria-label capitalizes the same string (`js/world/alchemy.js`
`applySelection`). Leaving `data-element="sulfur"` under the new copper
art meant the accessible name would still say "Sulfur" no matter what the
bottle showed. Renamed everything the identifier touches together: the
file (`bottle-sulfur.png` → `bottle-cuprum.png`, `git mv` so the history
follows it), the rack button's `data-element`/`img src`/`alt`, and its
entry in `ALCHEMY_ELEMENT_NAMES` (the array `randomElementName()` draws
the target-element-hint from) — the *string* is the whole identity here,
not the picture next to it.

**The mobile bottle panel grew a scrollbar nothing in it needed — same
bug as v321's wide-layout one, just never patched for the stacked
layout.** `.lab`'s base `overflow:auto` exists so a long verdict can
scroll instead of blowing out the modal; v321 already found that raising
the bench bottles past their own un-transformed box triggers it as a false
positive on wide screens and added a scoped `overflow:visible!important`
there. The identical mobile-only bottle raise (`.lab.color-game-lab
.test-tube.tube-lg{transform:translateY(-27px)}`, same v321 round)
triggers the exact same false positive on the stacked layout, just never
got the matching fix — added it alongside the raise.

**Reagent names ("Красный", "Убрать красную примесь"...) are gone
everywhere now, not conditionally.** They'd already been wide-only-hidden
since early on, and mobile's own copy carried a fair amount of
since-superseded scaffolding around it — a two-line clamp plus a
`min-height:2.2em` reservation, both there specifically to stop cards
with differently-long labels from throwing off `align-items:flex-end`
(see v322's misalignment bug above). A `display:none` label can't
balloon a card or leave a mismatched flow height either way, so all of
that — plus three now-pointless leftover `min-height`/`font-size`
tweaks on an invisible element, one wide, one short-screen, one already
dead — came out with it.

**v327: a picked bottle now leaves the shelf instead of just glowing on
it.** Once an element is on the table (in the station's own slot), it
reads oddly to still see it standing in the rack too — `.selected` used
to raise it and add a gold glow in place; now it's `opacity:0;
pointer-events:none` instead, an empty gap where it stood. Picking a
*different* bottle still works exactly as before (`select()` toggles
`.selected` across all seven, so the old pick's opacity comes back the
moment a new one takes over) — the only thing that changed is what
"selected" looks like, not the one-at-a-time selection logic itself.

**Mobile's three shelves get the same two moves this file has made for
the wide layout a dozen times now: pushed down, and let loose sideways.**
The top shelf (target/current bottles) drops further from the station
tabs — `margin-top` on the *panel*, not on `.tube-pair` inside it (that's
a separate, already-existing knob that only moves the bottles within the
shelf) — and immediately uncovered a second bug: `.scene.active > .lab`
carries the base rule's `flex:1 1 auto!important` (written for the wide
grid, where `.lab` is one capped-height column that legitimately needs
to shrink+scroll), and on mobile nothing actually constrains `.scene`'s
height enough to make that shrink meaningful — except now it did,
compressing `.lab`'s own box shorter than its (pushed-down, raised)
content actually needed and letting the *next* shelf's opening edge
land on top of the still-visible target-element-hint text. `flex-shrink:
0!important` locks it to its natural content height instead — needed
`!important` to beat the base rule's own, an equal-specificity fight
where only source order would otherwise decide and the base rule sits
later in the file.

All three shelves also lose the `margin-left`/`margin-right` that used
to stop at `.lairModuleBody`'s own 12px padding (`css/overrides-04-
universal-lock.css`, shared with every lair panel) — a matching negative
margin cancels it, so the wood runs edge-to-edge with the window instead
of floating in from both sides. Each panel's own inner `padding` (`.lab`,
`.alchemyReagents`, `.alchemyElementColumn`) is untouched, so the actual
content — bottles, reagent tubes, buttons — keeps the same clearance from
the wood's own edge as before; only the wood itself got wider.

**v328 replaced both glass assets and swapped the target's name-under-
the-bottle for a planet-sigil label stuck on the glass itself.**

New bottle art (`lab_test_big.png`/`lab_test_small.png`, supplied files)
drops straight into the existing frame+mask system with zero structural
change, because it happens to already be built the same way the old art
was: fully transparent in the glass's own interior (alpha=0 at every
sampled point, checked directly against the pixels), opaque only along
the outline/highlights. That's exactly the "outline drawn on top at
z-index 30, liquid shows through the transparent middle" contract
`.test-tube:after` already assumes — a plain drop-in for `--tube-big-frame`
and `--tube-sm1/2-frame` (one image standing in for both small-tube
variants now, since only one was supplied). The one thing that *wasn't*
supplied — a filled silhouette mask to clip the liquid layer to the new
big bottle's shape (`--tube-big-mask`) — got built from the frame image
itself: threshold its alpha to a binary outline, flood-fill inward from
all four image edges to find the true "outside," and everything the
flood fill *didn't* reach (the outline plus whatever it encloses)
becomes the mask's opaque region. No mask was needed for the small tube
— that one was never mask-clipped to begin with, just a plain
`.mini-liquid-layer` positioned by percentage, unaffected by a frame-only
swap. The four now-unreferenced original glass PNGs came out with the
CSS variables that pointed at them.

The label: `.target-element-hint` used to be `.tube-box`'s sibling,
holding capitalized element text (STANNUM, AURUM…) positioned below the
bottle with its own `translateY` retuned at every breakpoint to chase
the bottle's own raise — three separate copies of that chase, one per
screen size (`css/alchemy.css`, base/mobile/wide/short-screen). Per
feedback, the element name is a parchment card image now
(`assets/alchemy/label-<element>.png`, one per planet correspondence:
sun→aurum, moon→argentum, mercury→hydrargyrum, venus→cuprum, mars→ferrum,
jupiter→stannum, saturn→plumbum — classical alchemy's own planet-metal
pairing, matching the supplied filenames), and it moved from being a
sibling of `.test-tube` to a *child* of it. That one move deleted all
three of the old per-breakpoint overrides outright: a transform on
`.test-tube` carries its whole subtree along, so a label riding inside
it tracks the bottle's raise automatically at every screen size — the
exact chase the old sibling positioning needed hand-tuned copies of
because it *wasn't* inside the transformed box. Sized to 30% of the
tube's own width via `aspect-ratio` (not a stretched guess), centered
with `top:50%;left:50%;transform:translate(-50%,-50%)`, at a z-index one
above the glass frame so it reads as stuck to the outside of the bottle
rather than floating inside the liquid. `setTargetElementHint()`
(`js/world/alchemy.js`) now sets a `--element-label-img` custom property
(root-relative `url()`, same reasoning as `applySelection`'s bottle art —
a JS-set custom property resolves against wherever the `var()` is
*consumed*, not where the JS ran) instead of `textContent`.

**v329: the v328 glass swap looked right at a glance and was still
leaking liquid past the reagent tube's own walls — the small tube's
`.mini-liquid-layer` insets were never actually re-tuned for the new
art.** Its `left:17%;right:17%` (plus an even-card-only `22%/13%`
variant, a leftover from when `--tube-sm1-frame`/`--tube-sm2-frame` were
two *different* images) were measured against the old frame's own,
notably wider-drawn glass — the new `lab_test_small.png` draws a much
narrower tube with a heavier decorative outline eating more of the
canvas. Fixed by sampling the new PNG's own alpha channel directly
(where it's actually transparent = real glass interior) rather than
eyeballing against a screenshot: consistently ~44%/38% left/right and
~18%/9% top/bottom across the tube's straight-sided body. The even-card
override came out too — both frame variables point at the same image
since v328, so there's no longer a second shape to correct for.

Three more adjustments landed alongside it, all straightforward
find-the-winning-rule-and-scale jobs once the exact winning declaration
was confirmed against `document.styleSheets` (this cascade has enough
`!important` layered on `!important` by now that guessing from source
order alone isn't reliable — check the actual winner before touching
anything):

- The planet label doubled to 60% of the tube's own width (was 30%).
- `.tube-count` (the drop-count digit inside each reagent swatch) down
  to 15px from 25px — the winning rule turned out to be
  `.side-color-controls .tube-count`, not the plainer base `.tube-count`
  its own weaker specificity always loses to.
- The reagent swatches themselves 30% taller: the two `clamp()` height
  rules that actually apply (`.color-controls .color-card .mini-swatch`
  as the base/mobile fallback, `.alchemyReagents .color-controls
  .color-card .mini-swatch` overriding it on wide/short-screen) both
  scaled by 1.3x across all three clamp arguments, so the vh-based
  middle argument keeps tracking window height the same way it always
  did, just to a taller target.

**v330 found the real bug behind the big bottle's liquid sliding off to
one side, added an element-match requirement to Check, and let a bottle
be dragged onto the table instead of only clicked.**

The slide: `mask-position:50% 14.6%;mask-size:100% 102.6%` on
`.test-tube>.tube-liquid` was tuned (v109, long before this round)
against the *old* mask+frame pair's own baked-in margins — that mask's
silhouette ran 14.6%–96.2% of its canvas, not edge to edge, so the
position/size compensated for empty space that doesn't exist in
`tube-big-mask.png` (v328's replacement, generated *from*
`tube-big-frame.png`'s own alpha via flood fill, so the two already
share one coordinate system with zero margin). Applying the old
compensation to a mask that needs none is exactly what pushed the
liquid off-center. `mask-position:0 0;mask-size:100% 100%` — a plain,
untransformed fit — is now correct by construction: regenerate the mask
from whatever frame replaces this one, and identity mapping keeps
working without new tuning.

The element match: picking an element from the rack always filled every
station's slot (`window.Alchemy.selectedElement`), but nothing checked
*which* one against the target's own planet label — any element unlocked
Check, matching only on colour. `setTargetElementHint()` now stashes the
rolled element's id on the hint node itself
(`el.dataset.targetElement`), and all three Check handlers compare that
against `window.Alchemy.selectedElement` alongside their existing colour/
cleanliness test — a status message distinguishes "wrong colour" from
"right colour, wrong metal" so a near-miss doesn't read as a total
whiff. Reset (`newMixRound`/`rerollUnknown`/`resetSeparation`) now also
calls a new `window.Alchemy.clearSelection()` (defined alongside
`select()` in the rack-bottle IIFE, since that's where the `bottles`
array already lives) — the bottle currently standing on the table goes
back on the shelf (`.selected` removed, `opacity` fades back to 1) and
every station's cell empties, since the selection was always shared
across all three, not per-station.

Drag-to-drop: pointer events, not the HTML5 Drag and Drop API — that API
has no real touch backing, and this rack sees as much phone use as
mouse. `pointerdown` on a bottle arms a listener pair on `document`;
past an 8px move threshold it spawns a fixed-position ghost clone that
tracks the pointer, and `pointerup` checks `elementFromPoint` for a
`.alchemyElementCell` underneath to complete the same `select()` a click
would have triggered. A plain tap (no threshold crossed) leaves `click`
to fire normally — `suppressClick` only swallows the synthetic click
that follows a *completed* drag, so tap-to-select still works exactly as
before. `touch-action:none` on the bottles stops the browser from
claiming a moving touch as a page scroll before the drag logic gets a
look at it. One thing worth remembering if this needs debugging later:
a drag toward the element cell can fail to find it if the rack drawer is
already fully open when the drag starts — the open drawer's own covered
region can overlap the cell on short viewports, same as it would block
a click there too. Not fixed (matches existing click behavior, and the
peeking, not-fully-open state most drags actually start from doesn't
have this problem).

Also, per feedback once the new glassware and label were live: swatch-
label font halved (11px → 5.5px), the reagent-tube drop-count digit down
another 30% (15px → 10.5px, on top of v329's own 25px → 15px cut), both
big-bottle height clamps up 15% across all three clamp arguments, and
the planet label's own anchor moved from dead center (`top:50%`) to
`top:65%`.

**v331: v330's mask-position fix wasn't the whole story — a second,
older rule was still shifting the liquid off the frame's silhouette.**
A leftover v109 override, `.test-tube.tube-lg > .tube-liquid{left:3px;
right:3px;top:8px;bottom:-1px;border-radius:6px 6px 32px 32px}`, was
never touched during the v328 art swap or the v330 mask fix — it resizes
`.tube-liquid`'s *own box* away from `.test-tube`'s (shrunk, and shifted
down since top's pushed in 8px against bottom's -1px). `mask-size:100%
100%` sizes the mask against whatever box it's actually applied to, so
once that box stopped matching `.test-tube` 1:1, the mask — generated
pixel-for-pixel against `.test-tube`'s own frame image — silently
stopped lining up with it too, despite v330's `mask-position:0 0` fix
being individually correct. Both bugs had to go for the liquid to
actually sit inside the drawn glass: v330 fixed the mask's own
position/size, this one fixes what box that position/size is even
measured against. Removed the override outright — no border-radius
needed either, since the mask already carves the exact silhouette
(rounded bottom included) straight from the art.

**v332: still a sliver of colour past the drawn glass after v331 — this
time it's the mask itself, not a coordinate mismatch.** Both real bugs
(v330's mask-position, v331's resized liquid box) were fixed, and the
mask does share `.test-tube`'s exact coordinate system by construction
— but `tube-big-mask.png`'s own flood fill (v328) reads a few
anti-aliased edge pixels of the frame art as "inside," so the mask's own
silhouette lands a hair outside the frame's crisp visible line, most
noticeably on the right/bottom where a highlight streak's soft edge
gives the flood fill the most room to overreach. Not worth regenerating
the mask over a few px — a `transform:translate(-2%,-3%)` on
`.tube-lg > .tube-liquid` nudges the liquid (mask riding along, same
element) back inside the line instead. Percentages are of the liquid
layer's own box, tuned against a screenshot; scoped to `.tube-lg`
specifically so it doesn't touch whatever other minigames' plain
`.test-tube` instances share the same mask/frame variables.

**v333 gave each of the four reagent tubes its own drawing instead of
one image reused across all four.** Four supplied source PNGs
(`tube-small-1..4.png`) replace the single `tube-small-frame.png` v328
introduced; `--tube-sm1-frame` through `--tube-sm4-frame` now each point
at a different file, and `.side-color-controls .color-card:nth-child(1..4)
.mini-swatch{--mini-frame:...}` assigns one per card position (the old
mechanism only ever had two slots, alternating by `:nth-child(even)`,
left over from when there were only two source images).

Per feedback, `.mini-liquid-layer`'s inset wasn't re-measured per tube —
one shared value averaged across all four instead. Sampled each source
PNG's own transparent interior at several rows and a full column
(same technique as v329's single-tube measurement) and meaned the four:
left settled around 36%, right 42%, top 19%, bottom 14%. The four
tubes' neck-rim heights vary more than their body widths do, so top is
the least precise of the four numbers on any *individual* tube — an
accepted tradeoff for one inset instead of four, per the ask.

**v334, wide layout: the two bench bottles stand closer together, and
their feet land exactly on the reagent tubes' own line.** The gap
between them looked wider than the shared 16px `gap` on `.tube-pair`
because each bottle also carries its own `scale(.6)` (the "stand on the
table" raise) — scaling shrinks a box toward its own center, pulling
both edges inward, so the *rendered* gap is the CSS gap plus however much
each bottle's edges retreated from their unscaled position (measured:
58px total against a nominal 16px). Closing that further isn't as simple
as shrinking `gap` — the scale-driven inward pull is fixed regardless of
gap, and pushing gap toward 0 only gets partway to "half." Added opposite
`translateX` pulls on the row's two flex children instead
(`.tube-pair > .tube-box` and `.current-cluster`, ±15px) — cheaper than
re-deriving the gap math, and it stacks cleanly on top of `.tube-pair`'s
own existing `translateX(82px)` row-shift since transforms compose. The
target bottle's label rides along for free (it's a child of `.test-tube`
now, per v330). Landed at 28.6px rendered gap against a 58px starting
point — close enough to "half" to call it done. The raise: `.test-tube.
tube-lg`'s own `translateY` went from -118px to -123px, closing what was
still a 5px gap between the bottles' feet and the reagent tubes' shared
bottom line (see v325's original "stand on the table" alignment) — a
plain unscaled-pixel nudge, since `translateY` in a `translateY(...)
scale(...)` list moves in the *parent's* coordinate system regardless of
the element's own scale, not the shrunk one.

**Small reagent tubes: 40% taller, 20% narrower — both `clamp()` height
rules (base/mobile and the wide/short-screen override) scaled by 1.4x
across all three arguments each, and every width declaration that
actually wins in some context (mobile's plain 42px, wide/short-screen's
34px) scaled by 0.8x.** Same "confirm the actual winning rule before
touching anything" approach as v329 — this file has enough layered
`!important` overrides by now that several `width`/`height` declarations
for `.mini-swatch` can be present in the cascade at once, only one of
them actually rendering.

Every round of visual tweaking through v334 kept hitting the same wall:
the "stand on the table" positioning (bottle raise, reagent raise,
element-cell raise, ± button offsets, label offset, desk push-down) was a
full `transform: translateY(...) scale(...)` shorthand string, redeclared
whole at each of mobile/wide/short-screen plus a couple of single-button-
card variants. Moving something 5px meant finding which candidate rule
actually won the cascade, rewriting the whole string without dropping
`scale()`/`transform-origin`, and repeating per breakpoint. Converted to
CSS custom properties instead: each positioned element now carries one
rule declaring `translate`/`scale` (the individual CSS properties, not
the shorthand) off tokens like `--bench-raise`/`--bench-scale`, and each
breakpoint block only reassigns 2-3 numbers on `.alchemyRoot`. `translate`
and `scale` as separate properties compose in the same order as the
`translateY() scale()` shorthand did (translate always resolves in the
un-scaled parent coordinate system either way), confirmed with a live
`getBoundingClientRect()` comparison before converting the rest. This
also fixes the recurring "can't add a transform here without clobbering
the existing raise" bug (hit twice this session, on the drag-over
highlight and the swatch-label offset) — a future one-off `rotate` or
`transform` addition can now layer on top of a token-driven `translate`/
`scale` instead of replacing it outright.

Also, contrary to the "Nothing was removed... all 169 classes are
referenced" note from the original split (above): they were referenced
from *source*, but `js/world/alchemy.js`'s `doc.getElementById` is a shim
(line 44) that returns a detached, `display:none` spare `<div>` for any
id missing from the page, specifically so one unbuilt station's render
function doesn't throw and kill the rest of `boot()`. That meant every
render function for the seven still-unwired stations *does* run at boot
and writes real DOM into that spare div — so their classes were "used" by
the script without ever reaching the visible page. Confirmed class by
class, both statically (`document.querySelectorAll('.<class>').length`
in the running game) and dynamically (grepped every `classList.add/
remove/toggle` and template-string `className=` in the JS for a path
reachable from the three built stations, since a couple of classes —
`.liquid-burst-v13`/`.liquid-bubble-v13`, `.liquid-surface-pulse-v83` —
are toggled at runtime and would otherwise have looked dead in an idle
snapshot). Roughly 100 selectors for the seven unbuilt stations (sequence,
formula, compound, essence, branch, distillation, layer-react) came out;
everything the three live stations actually touch — `.tube-liquid`,
`.mini-swatch`, `.test-tube`, `.passive-bubble-v44`/`.passive-bubbles-
v44`, `.liquid-burst-v13`/`.liquid-bubble-v13`, `.liquid-surface-pulse-
v83`, `.tab`, `.ctl` — and their keyframes stayed. The 138+ live station-
layout section and the rack drawer were untouched.

## Two things that cost hours — do not rediscover them

**The class names leak both ways.** Eleven are shared with the game. Scoping
this stylesheet under `.alchemyRoot` keeps alchemy out of the game, and that
much was done in v284 — but nothing kept the game out of alchemy. Its `.status`
is positioned absolutely, so the verdict drew over the reagent labels; its
`.scene` is `width:100vw !important` **and** `width:min(1180px,100vw)
!important`, which pinned the station at 1180px inside an 888px panel. Nothing
outranks `!important`: not `minmax(0,1fr)`, not `min-width:0` on every grid
item, not an inline width. The guard at the top of the layout section resets
these with `!important`. If a station ever measures wider than its panel again,
look there first.

**Percentages will not size this chain.** The module body's height comes from
growing as a flex item — a used height, not a specified one — so `height:100%`
below it resolves to auto. The chain is flex and grid throughout for that
reason.

**The mask PNG has empty margin baked in, and stretching it evenly moves both
edges.** Its silhouette runs 14.6%–96.2% of the image, not edge to edge, so a
plain 100%/100% mask left the liquid's floor short of the glass's own rounded
bottom. The first fix stretched the mask symmetrically to close that gap —
and moved the top edge with it, bleeding liquid color out past the neck where
the frame art doesn't cover it. The second fix anchored the top back on
14.6% and only pulled the bottom in, but overshot it: it targeted 99.5%,
past where the *frame* PNG's own silhouette ends (98.955%), so the liquid
still poked out below the drawn glass — just at the bottom now instead of
the top. The bottom target is 98.3%, a margin inside the frame's own edge,
not 100% or even the frame's exact number. Touch `mask-size`/`mask-position`
on `.test-tube>.tube-liquid` and check both the mask's bounds *and* the
frame's, not just one image.

**`.tube-pair`'s gap was in `vh`, and the module window's height isn't fixed.**
Each station's footer text wraps to a different height, so the window — sized
to its content, capped at 82vh — is a few px taller or shorter station to
station. A `clamp(24px,4vh,48px)` gap read that difference back as the two
flasks sitting visibly closer together on one tab than another. Fixed px
values now (32px / 40px by breakpoint) — width may still resize it, height
must not.

**A wide label under the current tube used to widen its whole column.** The
target's label is always "цель" — short, narrower than the tube. The current
tube's label is per-station ("текущая смесь", "получилось", "грязная смесь")
and on a narrow layout every one of those is wider than the ~70px tube itself,
so `.tube-box`/`.current-cluster` — a flex column, sized to its widest child —
took the *label's* width, not the tube's. `.tube-pair`'s `justify-content:
center` then centered the row on two mismatched columns, and the target tube
visibly landed at a different x per station, tracking whatever the other
label's length was. Fix: the label is `position:absolute` under the tube now,
centered by its own transform, so it can be wider than its column without
setting the column's width. That takes the label out of flow, so `.tube-pair`
carries an explicit `padding-bottom` to keep the space it needs inside the
scrollable `.lab` — drop that and the label clips a few px short.

**`font:600 12px/1 inherit` is invalid CSS, and it's all over this file.**
`inherit` can't sit in the font shorthand's family slot next to an explicit
weight and size — only a bare `font:inherit` is valid — so browsers drop the
whole declaration and the element falls back to the 16px default instead of
the size the rule names. Confirmed on `.ctl` (`#mixCheck`'s computed
font-size is 16px, not the 12px the rule asks for); a `grep -n
"font:.*inherit" css/alchemy.css` turns up several more from before this
session. The rack's own new rules use longhand
(`font-weight`/`font-size`/`line-height`) instead, deliberately, after
running into this while sizing `.alchemyRackLabel`. The rest are unfixed —
flagged as a separate task rather than folded into this one, since it
touches sizes across every station and wants its own look before-and-after.

**A gridline overlay judged by eye compounds error across seven repeats.**
The rack's first ring-centre measurement (v296) drew vertical lines over
`rack-back.png` at guessed x-positions and nudged them until they looked
centered — close enough on ring 1, but the guessed *step* between rings was
212px against a true ~199px, and that 13px-per-ring error stacks: ring 7
landed 65px off from a 13px mistake at ring 1. It read exactly like the
bottles were "drifting" further wrong toward the right, because they were —
just not for a reason that lived in the CSS. `.alchemyRackBottle`'s
height:62% (v298) was a real improvement in its own right, but didn't
touch this; it was shipped on a hunch before the actual measurement was
redone with `cv2.matchTemplate` (a cropped ring matched against the full
image, correlation peaks found across the row) and cross-checked against
the rim's own left/right edges by hand. Eyeballing a single instance is
fine; eyeballing a *spacing* that repeats seven times is not — eyeball
error is per-ring, but position error is per-ring-times-how-many-rings-away.

**The `matchTemplate` fix (v299) traded a compounding error for a
constant one — still wrong, just wrong the same amount everywhere.** The
template was a crop centred on a guessed x for ring 2; correlation finds
where the template's *own* pixel pattern recurs, not where the ring
geometrically centres, so whatever offset was baked into that guess (~7px)
came back on six of the seven matches. Six bottles reading uniformly
crooked while the seventh (whose crop happened to be closer to centred)
read fine is a harder pattern to catch by skimming a screenshot than the
one-directional drift before it — it took being told plainly that only one
bottle looked right to go looking again. Fixed by not comparing rings to
each other at all: Canny edges (`cv2.Canny`) plus `cv2.findContours` and
`cv2.fitEllipse` on each ring's own boundary, independently, cross-checked
by two separate contours (inner hole, outer rim) landing within ~1px of
each other per ring. Two rings agreeing with a template is still just the
template being self-consistent; two independent fits on the *same* ring
agreeing with each other is the actual signal.

**A `position:fixed` descendant only escapes to the viewport if nothing
between it and the root sets a transform.** `.lairModuleWindow` animates
open with `transform:translate(-50%,-50%) scale(1)` — any `position:fixed`
element nested inside it would be fixed *to that box*, not the screen,
because a transformed ancestor becomes the containing block for its fixed
descendants (same rule that makes `position:absolute` respect a
`position:relative` ancestor). The rack drawer has to be pinned to the
literal bottom of the screen regardless of where the modal is sized or
positioned, so it isn't inside `#lairOverlay` at all — it sits as a
top-level sibling of `#inventoryDrawer`, outside the whole lair DOM
subtree, and relies on `body:has(...)` rather than nesting to know when to
show itself. Nothing about "it's a lair-only element" required it to
physically live inside the lair markup.

**A relative `url()` written into a custom property resolves against the
stylesheet, not the page.** Filling `.alchemyElementCell`'s
`--element-bottle-img` from JS with
`url("assets/alchemy/bottle-${element}.png")` 404'd — the property is only
*read* by `css/alchemy.css`, one directory below the project root, and a
relative `url()` resolves against wherever the declaration using it lives,
not the document that set the property or the document itself. It landed as
`/css/assets/alchemy/...`. Root-relative (`/assets/alchemy/...`) fixed it.

**That fix doesn't transfer to a plain `url()` written directly in the
stylesheet — those two cases resolve opposite ways.** Reached for
`/assets/alchemy/desk-cap-left.png` again for the v306 desk backgrounds,
by pattern-matching the fix above, and `check.mjs` caught it immediately:
a literal `url()` in `alchemy.css` *is* relative to the stylesheet already
(that's the normal, correct case CSS relative paths are built for) — only
a JS-set custom property is the odd one out, because the browser resolves
*that* relative to wherever the `var()` is consumed, not where the JS ran.
`../assets/...` (one level up from `css/`) is what the file's other rules
already use (`--tube-big-frame` etc.) and is what actually works here.

## Still to do

The other seven stations — markup only, no JS work. A bench texture under the
glassware and recipe cards were proposed and not built; both need a decision
first.

A near-empty tube (freshly reset, nothing poured) reads as a solid black
bottle rather than empty glass — `.test-tube` carries no fill of its own
(`background:none!important`, deliberate, from the port), so wherever
`clip-path` hides the liquid, the dark lair panel just shows through the
glass. Easy to mistake for the mask-bleed bug since it's the same tube art;
it isn't one — confirmed by dropping the clip-path, which fills clean. Not
fixed: needs a decision on what "empty" should look like, not just a value
tweak.

The rack's pick now gates the three Check buttons (any element unlocks all
three — see v305 above) but nothing checks *which* element was placed
against the target-element-hint's name yet. Next step is wiring that
comparison in, per the tension-tool analogy above.

`#lairModuleClose`'s hit area overlaps the game's persistent top-right HUD
(`.topRightHud`, z-index:360) on mobile — found while chasing the v310
window-chrome removal, but pre-existing and not caused by it (neither the
window's position nor the HUD's z-index changed this session). Tapping
that exact corner activates the map icon instead of closing the panel.
Not fixed here — same top bar covers every lair module, not just alchemy,
so it wants its own pass rather than a scoped `:has()` patch.
