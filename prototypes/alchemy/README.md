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

## Where this stands (v319)

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
