# Relay visual system — P3 Beta

## Intent

The earlier interface exposed Relay's behavior, but it gave content, metadata,
forms, and secondary actions nearly equal visual weight. Small type, uppercase
metadata, stacked bordered panels, decorative symbols, and permanently expanded
forms made the application read like a component inventory rather than a shared
knowledge base.

P3 establishes a quieter, document-first hierarchy. A club member can scan a
Playbook index, open one procedure, and read its Steps and supporting Context
without first interpreting the implementation's concepts. An officer sees the
same document with editing controls at the point where they apply. These changes
affect presentation and disclosure, not Relay's concept or sync-engine
boundaries.

The system combines Linear's restraint, Notion's writing-first interaction, and
Kinfolk's editorial pacing. GitHub Primer informed the readable type scale and
durable controls; Radix Themes informed the semantic colors; Nielsen Norman
Group's progressive-disclosure guidance informed when forms and secondary
actions appear.

## Foundations

- Canvas `#FAFAF8`; surface `#FFFFFF`; primary text `#202522`; secondary text
  `#59665E`; separator `#E5E8E3`; accent `#285D4B`.
- Pending uses `#8A5216` on `#FFF4DF`; complete uses `#25684D` on `#ECF6EF`;
  errors use `#A72C38`. Every status also has a text label, so color is never
  the only signal.
- Inter is bundled locally under its Open Font License. Reading text is at least
  15px with relaxed line height and a roughly 70-character measure. Metadata is
  smaller but remains legible.
- Spacing follows a 4/8/12/16/24/32/48px scale. Whitespace and one-pixel
  separators form most groups; borders and rounded containers are reserved for
  controls or genuinely distinct surfaces. Relay uses no decorative shadows or
  gradients.
- Interactive elements retain semantic HTML and visible `:focus-visible`
  treatment. Essential actions do not depend on hover.

## Information hierarchy

The application shell identifies the current workspace and Role, then provides
stable navigation. The main column shares one title edge and a bounded reading
width. Workspace switching, membership, invitations, and ownership live
together instead of competing with Playbook content.

The principal screens follow one consistent reading order:

- **Overview:** Playbooks lead. An Officer's unfinished Reviews and unanswered
  Questions appear in an amber attention rail, while neutral Recent Activity
  remains subordinate. Selecting a row opens that exact Playbook, Review, or
  Question. The preview alternates Reviews and Questions so one inbox cannot
  occupy every available row.
- **Playbooks:** a scannable title index sits beside one document-like
  procedure. Ordered Steps read continuously. Officer controls stay at the edge
  of the relevant Step; Members see the same instructions without mutation
  controls. Editing one Step preserves its stable identity, and polling does not
  replace its unfinished draft.
- **Shared Context:** the current Note leads. Dependencies, Questions, and
  before-and-after history remain adjacent but collapsed until useful. Context
  attached to a Step appears there under **Why this matters**, not in a detached
  footer. An empty Step offers Officers **+ Add context** without showing a
  placeholder to Members.
- **Reviews and Questions:** open work comes first, with source and status
  visible before expansion. Completed history uses quieter typography. An open
  Review presents changed Context, the Playbook's current instructions, and the
  decision as three distinct regions.
- **Workspace:** club identity and the viewer's Role lead, followed by joined
  Members, pending invitations, and other memberships. Joined users and pending
  invitations remain separate. Email addresses and administrative actions are
  visible only to authorized Roles.

This hierarchy preserves object identity across navigation. A Review link opens
the affected Playbook with the changed Context still visible and a route back to
the Review. Background refreshes replace server data without resetting local
drafts or disclosures.

## Consequences and recovery

Relay distinguishes a wording correction from a meaningful information change
before an officer saves. **Fix wording** changes the current text without
creating Review work. **Information changed** preserves the exact before-and-
after text and may create or update Reviews for affected active Playbooks. The
form states the number of affected Playbooks before submission, so the user does
not need to infer the consequence from an implementation term.

After a meaningful change, Relay waits for the refreshed Review projection and
matches the saved Change identity to returned Causes. Only then does it name the
affected Playbooks and offer **Review affected Playbooks**. If the refreshed
state cannot confirm that outcome, the interface reports the uncertainty rather
than inventing a list. A wording correction receives a separate no-Review
confirmation.

An unfinished Review keeps both legitimate decisions visible: **Still correct**
and **Needs updating**. The first completes the Review; the second keeps it open
while the officer edits the Playbook and returns to resolve it. The scope note
also explains that a Context Note may support the whole Playbook or one
particular Step, avoiding the false implication that every displayed Step uses
that Context.

Concurrent-edit recovery appears only after the server rejects a stale save. An
amber inline panel places the current saved text beside the preserved draft and
offers consequence-based choices: use the saved version or retry the local
version against the newly observed state. The server checks again before the
retry. Answer conflicts respect the original answerer's ownership rather than
offering an action the server would refuse.

Destructive removal, Playbook archiving, ownership transfer, and Review
cancellation retain confirmation. Invitation reissue states that the previous
code becomes invalid. A newly issued code shows its expiry and can be copied,
but its plaintext value is not persisted in the browser.

## First use and progressive disclosure

A truly empty Officer workspace leads with one action: create the first
Playbook. The Playbooks page opens that form immediately; a Member instead sees
a concise explanation of the read-only state. Once content exists, routine Step
editing remains available while archives, histories, dependencies, and full
Question threads move behind labeled disclosures.

This selectivity is intentional. For example, an attached Context Note is
useful reading, so **Why this matters** remains beside its Step. Adding a second
Note is less common, so reuse and creation move under **Add another context**.
Similarly, the Reviews empty state says **All caught up** and explains that a
meaningful shared-information change will put affected Playbooks there; it does
not offer an unrelated action merely to fill the page.

Recent Activity follows the same rule. It sits below **Needs attention** and
shows at most five server-recorded events, newest first. Amber rows mean
unfinished work; neutral activity rows answer who changed what and when.
Reorders, wording corrections, answer revisions, navigation, and polling stay
out of the feed. Creating and immediately attaching inline Context reads as one
useful “added context” event rather than two implementation-level operations.

## Responsive and accessible behavior

- Below 960px, Review evidence and instructions stack.
- Below 720px, the sidebar becomes a bottom navigation bar, the Playbook index
  moves above the document, forms stack, and before/after comparisons become one
  column.
- Long user-authored text wraps instead of forcing page overflow. Narrow-screen
  comparisons preserve the saved value and draft in reading order.
- Primary content remains 15–18px; smaller text is reserved for supporting
  metadata such as timestamps, counts, and Roles.
- Keyboard focus remains visible, native controls retain their semantics, and
  every status color is accompanied by text.

These rules describe the implemented P3 interface. They are not a claim of
exhaustive accessibility certification.

## Sources applied

- [Nielsen Norman Group, Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/): keep frequent actions visible and disclose advanced or destructive actions explicitly.
- [Notion, Writing and editing basics](https://www.notion.com/help/writing-and-editing-basics) and [Updating the design of Notion pages](https://www.notion.com/en-gb/blog/updating-the-design-of-notion-pages): document-first reading and contextual controls.
- [Linear, Conceptual model](https://linear.app/docs/conceptual-model): compact work lists and restrained hierarchy.
- [GitHub Primer, Typography](https://primer-docs-preview.github.com/product/getting-started/foundations/typography/): readable sizing, line height, bounded measure, and emphasis that does not depend on color alone.
- [Radix Themes, Color](https://www.radix-ui.com/themes/docs/theme/color): neutral, accent, and semantic color roles.
- [Alex Hunting Studio, Kinfolk](https://alexhunting.studio/blogs/projects/kinfolk): editorial whitespace and scale contrast.

The two-slide study additionally cites the exact references used in its collage:
[MoMA's Josef Müller-Brockmann poster record](https://www.moma.org/collection/works/7916),
[Kinfolk Issue 58](https://www.kinfolk.com/product/issue-58/),
[Notion's writing guide](https://www.notion.com/help/writing-and-editing-basics),
[EPITOME's card-catalog essay](https://epitome.hypotheses.org/2384), and
[Radix Themes](https://www.radix-ui.com/themes). The tracked SVG files are the
editable sources; the PNG files are the submission-ready renders.
