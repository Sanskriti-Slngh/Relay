# Relay visual system — P4 Code Complete

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

Workspace management follows the club's state rather than presenting a generic
settings form: club identity and the viewer's Role lead, followed by joined
Members, Owner/Officer-only pending invitations, the invitation form, and other club
memberships. Joined users and pending invitations remain separate. Member
rows expose names and Roles to the club; email and invitation administration
appear only to Owners and Officers. A newly issued code is a temporary success surface
with Copy and expiry information. Reissue clearly states that the replacement
invalidates the previous code, and the plaintext value is never persisted in
the browser.

The Workspace page also keeps multi-club navigation available after onboarding.
Every authenticated user can switch among joined clubs, create another club as
its Owner, or enter an invitation to join another club as a Member. These
account-level actions are separate from Officer-only membership administration.
Workspace transitions clear the prior club's projections before loading the
new club, while failed submissions keep the current club and local form input.

Role management stays compact within Member rows. Officers see only Member
promotion/removal actions; Owners can additionally demote Officers and open a
separate, explicit ownership-transfer form. The transfer form states the sole-
Owner consequence, lets the current Owner choose their resulting role, and
requires confirmation. Legacy workspaces show one setup action instead of an
automatically guessed owner.

Playbooks use a master-detail layout: a scannable title index and one focused,
document-like procedure. Steps retain stable identity and order but read as a
continuous numbered document. Each Officer sees a consistent right-hand Step
toolbar for moving, editing, and removing; Members see the same instructions
without mutation controls. Editing replaces only the selected Step with its
textarea and Save/Cancel actions. Local drafts are keyed by stable Step
identity, so polling does not replace unfinished text. Removal remains a
confirmed destructive action.

Step-anchored Context appears beside its Step rather than in a generic
Playbook footer. Attached notes use the quiet label **Why this matters**; an
unattached Step offers only **+ Add context** to Officers and has no empty
placeholder. Reusing a shared note and writing a new one remain available in
that disclosure. Empty Playbooks similarly show only **+ Add step**. Questions
remain adjacent to their source. These presentation changes use the existing
Step and Context operations: normal Step edits preserve identity and do not
request Reviews, while meaningful shared-Context changes retain their existing
Review behavior.

Navigation preserves object identity. Overview rows focus the selected
Playbook instead of merely opening the Playbooks section. Review links focus
the affected Playbook with the changed Context still visible in a compact
work banner and a direct return to the Review. Background refreshes replace
server data without keying or resetting these local disclosure and draft
states.

Shared Context uses an editorial ledger. Update first requires a clear choice
between a wording correction (no Review) and a meaningful information change
(exact before/after history and potentially new Reviews). Attachments,
questions, and history remain adjacent to the note but collapsed until useful.
Before a meaningful update is submitted, Relay states the exact number of
active Playbooks that will receive or update a Review. This explicit choice
removes the need for a second browser confirmation. Confirming or resolving a
Review is likewise a direct task action; destructive removal, archiving, and
Review cancellation retain confirmation.

After a meaningful update, Relay now waits for the refreshed Review projection
before naming an outcome. It matches the successful Change identity to the
Causes returned by that projection, then shows the exact affected Playbook
count and names with a direct **Review affected Playbooks** action. If refresh
cannot confirm that state, Relay says so and offers no inferred list. Wording
corrections retain their explicit no-Review confirmation.

Questions and Reviews are inboxes. Open work is first, with source and status
visible before expansion. The primary next action appears in the expanded row;
less common alternatives sit under a plainly labeled disclosure. Completed
history remains accessible with quieter typography and spacing.

Within a Playbook Step, opening **Why this matters** prioritizes the attached
Context Notes as reading material. When Context already exists, the reuse and
creation controls remain behind a quieter **Add another context** disclosure;
an empty Step still reveals the first-add controls directly. The Reviews empty
state says **All caught up** and explains that meaningful shared-information
changes will place affected Playbooks there, without presenting an unrelated
navigation action.

An open Review presents three intentionally distinct regions: exact changed
Context as evidence, the Playbook's current ordered instructions, and the
decision. The scope note says that Context may apply to the whole Playbook or
to a particular Step, avoiding the false implication that every displayed Step
is attached to that Context. Both legitimate pending decisions—**Still
correct** and **Needs updating**—remain visible together. The existing
edit-and-return path and resolve action remain unchanged for Reviews awaiting
changes.

Routine action labels use a readable 14px scale, while genuinely secondary
metadata remains smaller. Evergreen identifies actions and current approved
information; amber remains reserved for unfinished attention. Separators and
spacing distinguish evidence, instructions, and decisions without adding
cards, shadows, gradients, or decorative symbols.

Concurrent-edit recovery uses the same selective hierarchy. An amber inline
panel appears only after the server refuses a stale save. It names the conflict
in plain language, places the current saved text beside the preserved local
draft, and offers consequence-based actions: use the saved version or save the
local version against the newly observed state. The server checks again on the
second action. On narrow screens the comparison stacks into one column. Answer
conflicts respect original-answer ownership rather than presenting an action
the server would refuse.

The Overview uses a deliberate 70/30 hierarchy on desktop. A dominant
Playbooks column shows up to six substantial, readable rows, while an Officer
attention rail shows up to four actual unanswered Questions or unfinished
Reviews. Selecting a Playbook preserves its Procedure identity; selecting a
task opens that exact Question or Review rather than only changing sections.
Shared Context is intentionally absent because it is reference material, not
the Overview's primary next action. Additional Playbooks remain one click away
through **View all Playbooks**, so workspace growth does not turn the page into
another dense index. On mobile the columns stack, and the attention list moves
first only when pending work exists. Members never receive Officer task
controls. Empty Officers receive one create action, while empty Members get a
short role-appropriate explanation.

The attention preview alternates unfinished Reviews and unanswered Questions
when both exist, preventing either inbox from occupying every preview row.
Question text is clamped only in the preview and opens the exact full item.
When no work is pending, the amber treatment falls away so the empty state does
not compete with Playbooks.

For Officers, a compact **Recent activity** ledger sits directly below **Needs
attention** in the same rail. The distinction is deliberate: amber attention
rows are unfinished work, while neutral activity rows answer who changed what
and when. At most five server-recorded events appear, newest first. Playbook
events retain their Procedure identity and open that exact Playbook; long
labels truncate visually while the full activity sentence remains available
as an accessible title. Relative times carry full machine-readable and hover
timestamps. Members do not receive the activity projection. On narrow screens
the two rail sections stay together, with pending work still taking priority.
The ledger favors meaningful continuity over exhaustive telemetry: archives,
new or attached Context, completed Review decisions, and initial Question
answers appear, while reordering, wording corrections, answer revisions,
navigation, and polling do not. Inline Context creation and attachment reads as
one natural “added context” event rather than two implementation-level rows.

## First-use simplification

The follow-up simplification pass removes page subtitles that repeated the
heading or navigation label and shortens explanatory copy throughout the
shell. A truly empty workspace now leads with one action: create the first
Playbook. The empty Playbooks page opens its creation form immediately for an
Officer, while Members receive a concise role-appropriate state.

Playbook headers now show only the title and Step count. Question threads and
archives remain available through labeled disclosures, while routine Step
editing controls stay visible to Officers. Context Notes lead with their text;
dependencies and history are collapsed. The update choice uses the user-facing
labels **Fix wording** and **Information changed**, while continuing to invoke
the existing correction and meaningful-change operations exactly as before.
Questions and Reviews retain compact summary rows, with source text,
before/after evidence, and lifecycle actions revealed only when a row is
opened.

## P4 hierarchy and readability audit

The P4 pass applies the course visual-design rubric directly: organization,
selective emphasis, readability, consistency, and appropriateness take
priority over decoration. The interface continues to use the same typography,
spacing scale, semantic colors, and separator-based grouping. The audit found
no reason to introduce a second design language, extra icons, shadows, or a
component library.

Each major screen now has an explicit visual reading order:

- **Overview:** active Playbooks are the dominant content; unfinished work is
  the contrasting secondary rail; neutral recent activity stays subordinate.
  First-use guidance replaces the work layout only while there are no active
  Playbooks, so it cannot compete with real tasks.
- **Playbooks:** the selected Playbook title and ordered instructions lead.
  Step tools remain muted and spatially separate; Context, Questions, and
  mutation forms appear only when requested. Instruction and supporting-copy
  measures are bounded to about 70 characters for comfortable reading.
- **Shared context:** current information leads, while dependencies, history,
  and questions stay quiet. In update mode, the selected change type has a
  visible state: evergreen for wording correction and amber for a meaningful
  change that can create Review work.
- **Reviews:** the summary names both the affected Playbook and why attention
  is required. The expanded task reads in four levels: a one-sentence purpose,
  changed Context evidence, current instructions, then the decision. Evidence
  and instructions use a separator rather than additional cards; the decision
  heading receives the accent because it is the next action, not because every
  control needs emphasis.
- **Questions:** the Question is primary, its Step or Context source is
  secondary, and the answer form appears only inside the open thread. Preserved
  answers use the existing completion color and remain distinguishable by text.
- **Workspace:** club identity leads; memberships, members, ownership, and
  invitation sections follow as separate settings groups. Destructive actions
  use red text only at the point of action, while the rest of the page remains
  calm.

At widths below 960px, Review evidence and instructions stack with a horizontal
separator. Below 840px, Playbooks replace the cramped master-detail columns
with a horizontally scrollable index above the full-width document. Below
720px, the sidebar becomes bottom navigation, forms stack, before/after
comparisons become one column, and dense inbox summaries put status on its own
line. At 320px the six navigation destinations may scroll horizontally rather
than shrinking their labels. Member identity and role controls also stack and
wrap instead of compressing names or actions. Long user-authored Context,
Question, history, and member strings use emergency wrapping rather than
forcing page overflow. The minimum viewport remains 320px; controls keep
visible focus outlines and status continues to be communicated with words as
well as color. Disabled controls retain 60% opacity so their labels remain
legible while still appearing inactive.

This pass deliberately leaves the established 15px application body size and
12–13px metadata sizes intact. Primary reading content is 15–18px with relaxed
line height; the smaller scale is reserved for timestamps, counts, roles, and
other supporting context. These source-level decisions still require rendered
inspection on representative desktop and 390px mobile viewports.

## Sources applied

- [Nielsen Norman Group, Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/): frequent actions stay visible; advanced or destructive actions use explicit, labeled disclosure.
- [Notion, Writing and editing basics](https://www.notion.com/help/writing-and-editing-basics) and [Updating the design of Notion pages](https://www.notion.com/en-gb/blog/updating-the-design-of-notion-pages): document-first reading, contextual controls, and reduced chrome.
- [Linear, Conceptual model](https://linear.app/docs/conceptual-model): compact work lists, restrained hierarchy, and calm application framing.
- [GitHub Primer, Typography](https://primer-docs-preview.github.com/product/getting-started/foundations/typography/): rem-based readable sizing, unitless line height, bounded line length, and emphasis that does not depend only on color.
- [Radix Themes, Color](https://www.radix-ui.com/themes/docs/theme/color): a small neutral/accent scale and semantic colors designed for their UI purpose.
- [Alex Hunting Studio, Kinfolk](https://alexhunting.studio/blogs/projects/kinfolk): editorial whitespace, confident scale contrast, and muted photographic color.

The two-slide study additionally cites the exact visual references used in its
collage: [MoMA's Josef Müller-Brockmann poster record](https://www.moma.org/collection/works/7916),
[Kinfolk Issue 58](https://magazinecafestore.com/products/kinfolk-magazine-issue-58),
[Notion's writing and editing guide](https://www.notion.com/help/writing-and-editing-basics),
[EPITOME's card-catalog essay](https://epitome.hypotheses.org/2384), and
[Radix Themes](https://www.radix-ui.com/themes). The tracked SVG files are the
editable study source; the PNG files are the submission-ready renders.

