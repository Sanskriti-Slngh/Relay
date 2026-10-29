# Relay visual system — P4 Code Complete

## Playbooks document-first refinement (2026-10-29)

The Playbooks screen now treats the selected Playbook as the page's editorial
headline; the section label is intentionally quiet. Steps form a consistent
numbered reading sequence, and Step-attached Context appears automatically in a
subordinate gray-green block. Long Notes use a three-line preview with an
accessible Show more control, while Steps with no Context show no placeholder.

Step actions occupy one stable lower-right cluster. Edit and Questions remain
visible as labeled SVG affordances through accessible names and tooltips; reorder
and deletion live in a focused overflow menu with text labels. The menu reduces
repeated action copy without making essential editing or communication hover-only.

The pencil opens one in-place work surface containing Step wording and Context
management. Context is still saved through its independent actions and version
checks. Officers must explicitly choose **Fix wording** or **Information changed**,
and the latter states the Review consequence before saving. No combined Step and
Context transaction was introduced.

Double-click editing was deliberately omitted. It would duplicate the pencil,
complicate text selection, and provide little benefit once the persistent action
is adjacent to every Step. Subtle hover and `:focus-within` treatment identify the
active Step without layout movement; mobile retains 44px action targets and stacked
editing controls.

The final interaction pass gives each Step one explicit presentation mode:
reading, editing, or Questions. The pencil and speech-bubble controls coordinate
that mode instead of opening competing panels. Moving from a dirty editor to
Questions requires an explicit discard decision; hidden Question drafts remain
preserved. Questions use a compact Q/A transcript with one status label, while
Step save actions live in the editor header and Context attachment keeps its own
equally styled but semantically separate action.

Instruction and Context work now also occupy separate visual submodes inside
editing. The instruction submode shows only **Save step**; the Context submode
hides that action and shows only the relevant **Attach note** or **Save & attach
note** control. Returning to the instruction preserves the Context draft. This
makes the independent backend operations visible in the action hierarchy instead
of asking explanatory text to resolve competing green buttons. Question history
uses compact neutral conversation groups with an evergreen answer field, placing
Q/A identity and status beside the text they describe.

## Reviews, Questions, and Workspace refinement (2026-10-29)

After the Playbooks pass I went back to the three screens that still felt busy
and tried to give each one a single clear path.

**Reviews.** The Reviews page shows every Context change as a small lavender
card with a word-level diff — removed words struck through in red, added
words highlighted in green — so you can see what changed at a glance. If you
want the full text, there's a "Show full text" link that opens the before and
after as plain blocks. Under each change are small pills for the Steps it
affects. Clicking a pill opens the Playbook preview, scrolled to that Step.

The preview is now the only place you repair things. Every Step in the
Playbook is visible there, so you keep the context of the whole procedure.
Affected Steps get a thin amber line on the left — subtle, not a big colored
block. A small pencil next to an affected Step opens a textarea with Save and
Cancel; nothing starts out expanded. Each changed attachment has a Manage
button with two options: replace the Context on just this Step, or detach it
from just this Step. Unchanged attachments show up too but in grey, so you
can see them without thinking they need attention.

Editing the shared Context Note itself isn't offered here because that would
change every Playbook using it. A small Global note at the bottom of the
modal points to the Context page for that.

The main page ends with one decision: **Complete Review** finishes the task,
**Other** opens the preview to make repairs. Finished Reviews drop into a
quiet archive below; each one can be expanded to see the same compact diff.

**Questions.** Each open Question is a soft blue card with a round blue **Q**
badge, the question, what it's about, and an Open tag. The answer form sits
right under it, with a green **A** badge, a short textarea, and a blue Answer
button — so a question and its reply read like a conversation.

Answered Questions use the same Q and A layout. If you wrote the answer, a
small pencil at the end of the answer row lets you edit it. A red × next to
the Answered tag deletes the question. The old row of text buttons underneath
is gone — only the actions that apply are shown, right where you'd look.

**Workspace.** The Workspace page used to be a stack of bordered sections,
each shouting for the same amount of attention. Now it reads as one page.
The borders between Switch club, Members, and Pending invitations are gone;
spacing does the grouping instead. Only two thin lines remain: between
individual members (so people are easy to tell apart), and above Advanced
workspace management (so you know it's a different kind of thing).

Each Member row has a small **Manage ▾** button that opens a short menu with
Change role and Remove member — one place to go instead of three scattered
buttons. Inviting someone is a small link next to the Members heading; click
it and the email field appears, with a **Generate invite code** button. The
old "Create code" button was ambiguous — people weren't sure whether an
email was being sent — so the new label spells out what actually happens.

When you're only in one club, Switch club doesn't repeat the current one;
when there are no pending invitations, the whole section collapses into one
quiet line inside Members.

Advanced workspace management is an accordion. Rename, Transfer ownership,
and Archive each start collapsed, with a chevron that rotates so you know
it's clickable. Opening one closes the others. Rename opens straight to the
input — no second button to press. Transfer stacks labels above inputs, with
the Transfer button right below the form.

None of this changed any backend behavior. Permissions, Review generation,
and the sync-engine boundary all work the same way.

## Intent

Relay should read like a shared knowledge base, not a component inventory. The
earlier interface gave similar weight to content, metadata, forms, and secondary
actions. P4 establishes a quieter hierarchy: people scan an index, open one
item, read it at a comfortable measure, and reveal editing controls only when
they need them. These changes affect presentation and disclosure, not Relay's
concept or sync-engine boundaries.

The system combines Linear's restraint, Notion's document-first interaction,
and Kinfolk's editorial pacing. GitHub Primer informed the type scale and
control patterns; Radix Themes informed the semantic colors; Nielsen Norman
Group's progressive-disclosure guidance informed when forms and secondary
actions appear.

## Foundations

- Canvas `#FAFAF8`; surface `#FFFFFF`; primary text `#202522`; secondary text
  `#59665E`; separator `#E5E8E3`; accent `#285D4B`.
- Pending uses `#8A5216` on `#FFF4DF`; complete uses `#25684D` on `#ECF6EF`;
  errors use `#A72C38`. Every status also has a text label.
- Inter is bundled locally under the Open Font License. Reading text is at
  least 15px with relaxed line height and a roughly 70-character measure.
  Metadata is smaller but remains legible.
- Spacing follows a 4/8/12/16/24/32/48px scale. Separators and whitespace form
  most groups; borders and rounded containers are reserved for controls or
  distinct surfaces. Relay uses no gradients or decorative shadows.
- Interactive elements retain semantic HTML and visible `:focus-visible`
  treatment. Status and affordance never depend on color or hover alone.

## Information hierarchy

The application shell identifies the selected workspace and the user's Role,
then provides stable navigation. The main column shares one title edge and a
bounded reading width. Workspace switching, membership, invitations, and
ownership live together on the Workspace page instead of competing with
Playbook content.

The principal screens follow a consistent reading order:

- **Overview:** active Playbooks lead. For Officers, unfinished Reviews and
  Questions appear in a contrasting attention rail; neutral Recent Activity
  remains subordinate. Selecting a row opens that exact Playbook, Review, or
  Question rather than only changing sections.
- **Playbooks:** a title index sits beside one focused, document-like procedure.
  Ordered Steps read continuously. Officer editing controls stay at the edge of
  each Step; Members see the same content without mutation controls.
- **Shared Context:** the current Note leads. Attachments, Questions, and history
  remain adjacent but collapsed until needed. Context attached to a Step appears
  there under **Why this matters**, rather than in a detached footer.
- **Reviews and Questions:** open work comes first, with source and status visible
  before expansion. Completed history uses quieter typography. The primary next
  action is visible; uncommon repair actions sit under a labeled disclosure.
- **Workspace:** club identity leads, followed by membership, ownership, pending
  invitations, and other memberships. Email addresses and administration are
  visible only to authorized Roles.

This hierarchy keeps object identity intact. Links from Overview or Reviews
focus the intended item, and background polling refreshes server data without
discarding the user's open disclosure or local draft.

## Consequences and recovery

Relay distinguishes a wording correction from a meaningful information change
before the user saves. **Fix wording** creates no Review. **Information changed**
preserves before-and-after evidence and can create or update Reviews for affected
Playbooks. Before submission, the interface states how many active Playbooks
will be affected.

After a meaningful change, Relay waits for the refreshed Review projection and
matches the saved Change identity to its returned Causes. Only then does it name
the affected Playbooks and offer **Review affected Playbooks**. If the refreshed
state cannot confirm that result, the interface reports the uncertainty instead
of inferring a list.

An open Review presents changed Context, current instructions, and the decision
in that order. **Still correct** and **Needs updating** remain visible together.
The latter keeps the Review open while the Officer edits the Playbook, then
returns to resolve it. Less common Context replacement and detachment actions
remain available without dominating this ordinary path.

Concurrent-edit recovery appears only after the server rejects a stale save. An
amber inline panel places the current saved text beside the preserved draft and
offers consequence-based choices. Retrying uses the newly observed version and
still performs another server check. Answer conflicts also respect the original
answerer's ownership rather than displaying an action the server would refuse.

Destructive removal, workspace deletion, archiving, ownership transfer, and
Review cancellation require explicit confirmation. Invitation reissue states
that the old code becomes invalid. A newly issued code shows its expiry and can
be copied, but its plaintext value is not persisted in the browser.

## First use and progressive disclosure

An empty Officer workspace leads with one action: create the first Playbook.
The creation form opens immediately; Members receive a short explanation of
their read-only role instead. Empty Steps offer **+ Add context**, while existing
Context reveals reuse or creation under **Add another context**. Empty Reviews
say **All caught up** and explain what will create future Review work.

Page subtitles that repeated a heading or navigation label were removed.
Archives, histories, dependencies, and full Question threads remain available
through labeled disclosures. This keeps routine reading short without hiding
evidence or recovery paths.

## Responsive and accessible behavior

- Below 960px, Review evidence and instructions stack.
- Below 840px, the Playbook index moves above the full-width document and can
  scroll horizontally.
- Below 720px, navigation becomes a bottom bar, forms stack, and before/after
  comparisons become one column.
- The layout supports widths down to 320px. Long user-authored text wraps rather
  than causing page overflow, and navigation may scroll instead of shrinking
  labels beyond legibility.

Primary content remains 15–18px; 12–13px text is limited to metadata such as
timestamps, counts, and Roles. Keyboard focus remains visible, essential actions
do not require a pointer, and text accompanies every status color. These
source-level rules were supplemented by desktop and 390px browser checks; they
do not claim exhaustive accessibility certification.

## Sources applied

- [Nielsen Norman Group, Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/): keep frequent actions visible and disclose advanced or destructive actions explicitly.
- [Notion, Writing and editing basics](https://www.notion.com/help/writing-and-editing-basics) and [Updating the design of Notion pages](https://www.notion.com/en-gb/blog/updating-the-design-of-notion-pages): document-first reading and contextual controls.
- [Linear, Conceptual model](https://linear.app/docs/conceptual-model): compact work lists and restrained hierarchy.
- [GitHub Primer, Typography](https://primer-docs-preview.github.com/product/getting-started/foundations/typography/): readable sizing, line height, and bounded measure.
- [Radix Themes, Color](https://www.radix-ui.com/themes/docs/theme/color): neutral, accent, and semantic color roles.
- [Alex Hunting Studio, Kinfolk](https://alexhunting.studio/blogs/projects/kinfolk): editorial whitespace and scale contrast.

The two-slide study uses [MoMA's Josef Müller-Brockmann poster record](https://www.moma.org/collection/works/7916),
[Kinfolk Issue 58](https://magazinecafestore.com/products/kinfolk-magazine-issue-58),
[Notion's writing guide](https://www.notion.com/help/writing-and-editing-basics),
[EPITOME's card-catalog essay](https://epitome.hypotheses.org/2384), and
[Radix Themes](https://www.radix-ui.com/themes). The tracked SVG files are the
editable sources; the PNG files are submission-ready renders. The earlier [color exploration](../slide-catalog/color-slide-early.png) and [typography exploration](../slide-catalog/typography-slide-early.png) are preserved to show the initial visual direction. These were inspiration boards, not specifications for the final application. The current slides above document the refined visual system used for P4.
