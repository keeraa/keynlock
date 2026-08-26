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

## Where this stands (v298)

In the game: `js/world/alchemy.js`, `css/alchemy.css`, `assets/alchemy/`,
reached from a lair hotspot. Three color-game stations run — mixing,
concentrations, separation — plus a fourth, non-puzzle station: an
ingredient rack. The whole prototype script came over at once, so the
remaining seven color-game stations need only their markup; missing
elements get a stand-in rather than throwing, and every query the ported
code makes is confined to `#alchemyRoot`.

**The rack** (`Стойка` tab) shows seven bottles by element — Stannum,
Plumbum, Aurum, Sulfur, Hydrargyrum, Argentum, Ferrum, in that order —
picked from a shelf image (`assets/alchemy/rack-back.png` + `rack-front.png`)
built for exactly seven slots. No name is printed on the shelf; each bottle
carries its own alchemical symbol on a medallion instead, and the verdict
line below names the element once picked. Clicking one selects it; nothing
branches on the selection yet. The plan is to gate which elixir recipes are
buildable by the chosen element, mirrored on the tension tool's lock-type
match in `js/core/inventory-hit-testing.js`
(`typeBySkin`/`selectedTensionType`/`currentRequiredTensionType`/
`tensionCompatible`) — a lock only opens for the matching tool; an elixir
should only brew from the matching element. Not built.

Unlike the other three stations, the rack gets its own, wider module window
(1040px, not 780px) — `#lairModuleWindow:has(.lairPanel[data-lair-panel=
"alchemy"] .alchemyRackScene.active)`, scoped to just that scene so the
color-game stations keep the narrower window they were sized for. A 1614:690
shelf with seven items across needs the room; at 780px the bottles read as
cramped rather than sitting cleanly in their rings.

Each bottle is shorter than its own art would give at a naive `top:7%`
(`.alchemyRackBottle` is `height:62%`, not the ~72% the ring position alone
would suggest): the ring sits at ~32% down the rack, and at 72% that lands on
each bottle at roughly its neck-to-shoulder line — where a pendant hangs from
a chain whose length isn't identical across the seven separate illustrations.
Shrinking the bottle pushes that same absolute ring position deeper into the
image (~55-60% into the bottle instead of ~35%), into the wide jar body that
every one of the seven fills solidly full-width from that point down. Chased
by eye against a screenshot that looked like two rings had nothing in
them — never reproduced directly (measured identical `getBoundingClientRect`
for all seven bottles, and a from-scratch canvas recomposite of the same two
layers came out clean) — but the fix stands on its own regardless: it trades
a part of the art that wasn't guaranteed to line up the same way twice for
one that is.

The rack is layered like the inventory case
(`css/overrides-05-inventory.css` `.inventoryCaseBack`/`.inventoryCaseFront`,
`js/world/inventory.js`): a back board with the bottles' slot holes, the
bottles positioned over them, then a front board on top whose lower half
repeats the same cubby art with its middle band cut transparent — so the
front board's dividers sit in front of each bottle's base while the bottle's
own body still shows through the gap, rather than getting fully hidden or
fully exposed. `rack-front.png` is `rack-back.png`'s own bottom 439 of
690px, bottom-aligned; that split and the seven ring-centre x-positions
(200, 412, 623, 835, 1047, 1258, 1470 of a 1614px-wide source) were measured
from the source art, not eyeballed — see the CSS comments on
`.alchemyRackFront`/`.alchemyRackBottle` if the art ever changes.

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

The rack picks an element but nothing reads the pick yet. Next step is
wiring it to gate elixir recipes, per the tension-tool analogy above.
