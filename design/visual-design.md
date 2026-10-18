# Relay visual system — P3 Beta

## Audit and intent

The earlier interface exposed Relay's complete behavior, but it gave nearly
every object and action equal visual weight. Small type, uppercase metadata,
stacked bordered panels, decorative symbols, and permanently expanded forms
made the application read like a component inventory rather than a shared
knowledge base. The redesign keeps the concept and sync-engine boundaries
unchanged while making the interface document-first: people scan a quiet
index, open one item, read it at a comfortable measure, and reveal a mutation
only when they intend to perform it.

The intended character combines Linear's restraint, Notion's writing-first
interaction model, and Kinfolk's editorial pacing. GitHub Primer informed the
readable type scale and durable control patterns; Radix Themes informed the
small semantic color system; Nielsen Norman Group's progressive-disclosure
guidance informed when secondary actions and forms appear.

## Foundations

- Canvas `#FAFAF8`; surface `#FFFFFF`; primary text `#202522`; secondary text
  `#59665E`; separator `#E5E8E3`; accent `#285D4B`.
- Pending uses `#8A5216` on `#FFF4DF`; complete uses `#25684D` on `#ECF6EF`;
  errors use `#A72C38`. Status always has a text label, so color is not the
  sole signal.
- Inter is bundled locally under its Open Font License and is the primary
  face. Body copy is at least 15px in reading contexts,
  with relaxed line height and a roughly 70-character document measure.
  Metadata is secondary, not tiny or artificially uppercased.
- Spacing follows a 4/8/12/16/24/32/48px scale. One-pixel separators establish
  groups; borders, rounded containers, and shadows are reserved for controls
  or genuinely distinct surfaces.
- Every interactive element has a visible `:focus-visible` treatment. Native
  buttons, inputs, radio controls, lists, headings, and `details` disclosures
  retain semantic keyboard behavior.

## Page and interaction patterns

The sidebar now shows a clear workspace name, role, quiet navigation, and the
unanswered counts that demand attention. Workspace switching and invitations
live on a dedicated Workspace page. The main column uses one consistent title
edge and a bounded reading width. On narrow screens the sidebar becomes a
compact header and the navigation remains reachable without hover.

Playbooks use a master-detail layout: a scannable title index and one focused,
document-like procedure. Steps retain stable identity and order but read as a
continuous numbered document. Rename, archive, reorder, remove, and edit are
available through labeled disclosures; adding and asking appear only on
request. Questions expand next to their source, while attached Context Notes
read as quiet callouts. Review links focus the affected Playbook directly.

Shared Context uses an editorial ledger. Update first requires a clear choice
between a wording correction (no Review) and a meaningful information change
(exact before/after history and potentially new Reviews). Attachments,
questions, and history remain adjacent to the note but collapsed until useful.

Questions and Reviews are inboxes. Open work is first, with source and status
visible before expansion. The primary next action appears in the expanded row;
less common alternatives sit under a plainly labeled disclosure. Completed
history remains accessible with quieter typography and spacing. The Overview
prioritizes unanswered Questions and unfinished Reviews, then offers compact
recent-knowledge lists instead of metric cards.

## First-use simplification

The follow-up simplification pass removes page subtitles that repeated the
heading or navigation label and shortens explanatory copy throughout the
shell. A truly empty workspace now leads with one action: create the first
Playbook. The empty Playbooks page opens its creation form immediately for an
Officer, while Members receive a concise role-appropriate state.

Playbook headers now show only the title and Step count. Context attachments,
Question threads, archives, and per-Step actions remain available through
labeled disclosures. Context Notes lead with their text; dependencies and
history are collapsed. The update choice uses the user-facing labels **Fix
wording** and **Information changed**, while continuing to invoke the existing
correction and meaningful-change operations exactly as before. Questions and
Reviews retain compact summary rows, with source text, before/after evidence,
and lifecycle actions revealed only when a row is opened.

## Sources applied

- [Nielsen Norman Group, Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/): frequent actions stay visible; advanced or destructive actions use explicit, labeled disclosure.
- [Notion, Writing and editing basics](https://www.notion.com/help/writing-and-editing-basics) and [Updating the design of Notion pages](https://www.notion.com/en-gb/blog/updating-the-design-of-notion-pages): document-first reading, contextual controls, and reduced chrome.
- [Linear, Conceptual model](https://linear.app/docs/conceptual-model): compact work lists, restrained hierarchy, and calm application framing.
- [GitHub Primer, Typography](https://primer-docs-preview.github.com/product/getting-started/foundations/typography/): rem-based readable sizing, unitless line height, bounded line length, and emphasis that does not depend only on color.
- [Radix Themes, Color](https://www.radix-ui.com/themes/docs/theme/color): a small neutral/accent scale and semantic colors designed for their UI purpose.
- [Alex Hunting Studio, Kinfolk](https://alexhunting.studio/blogs/projects/kinfolk): editorial whitespace, confident scale contrast, and muted photographic color.

