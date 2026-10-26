# Relay design index

Start with the concise [P4 final design](./p4-final-design.md). The remaining
files are either current technical specifications or preserved milestone work.

## Current P4 specifications

- [Relay composition and HTTP contract](./compositions/Relay.md)
- Concepts: [ProcedureMaintaining](./concepts/ProcedureMaintaining.md),
  [ContextTracking](./concepts/ContextTracking.md),
  [Questioning](./concepts/Questioning.md),
  [Reviewing](./concepts/Reviewing.md), and
  [RoleBasedAccessing](./concepts/RoleBasedAccessing.md)
- [Shared external types](./types.md)
- [Collaborative version-control design](./version-control.md)
- [P4 visual-design specification](./visual-design.md)

## Preserved P1–P3 work

- [Problem framing](./problem-framing.md) and
  [application pitch](./application-pitch.md)
- [P1 concept design and low-fidelity sketches](./concept-design.md)
- [P1 product-direction user journey](./user-journey.md)
- [P2 MVP user journey](../mvp/p2-mvp-user-journey.md)
- [P3 Beta user journey](../mvp/p3-beta-user-journey.md)
- [P3 deployment record](../mvp/p3-beta-deployment-verification.md)
- [Historical P3 demonstration](https://youtu.be/2jB5J9K8b5Y)

The original P1 sketches remain available as
[workspace](./club-workspace.png), [Playbook](./playbook-detail.png),
[Context change](./context-change.png), and
[Review](./review-playbook.png) images. The P3 visual study remains available
as rendered [typography](../slide-catalog/typography-slide.png) and
[color](../slide-catalog/color-slide.png) slides, with editable
[typography](../slide-catalog/typography-slide.svg) and
[color](../slide-catalog/color-slide.svg) sources.

The gray [`early-prototype-styles.css`](./early-prototype-styles.css) file was
created with the initial MVP design and is preserved only as historical
visual-development material. It is not loaded by the application; the current frontend imports
[`web/styles.css`](../web/styles.css).

The current personal design notebook is stored in the private individual course
repository and is intentionally excluded from this public project. Generated
wire artifacts live in [`generated/`](../generated/) and are supporting build
outputs, not reviewed design prose.
