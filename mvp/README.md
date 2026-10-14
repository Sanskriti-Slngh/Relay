# Relay P2 Submission Deliverables

This directory contains the three submission artifacts that accompany the
working application. The application itself remains at the repository root so
its normal source layout and startup commands stay intact.

## 1. Working MVP implementation — present

The Vue frontend is under [`../web/`](../web/). The sync-engine composition,
concept implementations, local HTTP host, and MongoDB integration are under
[`../src/`](../src/). Setup and demonstration instructions are in
[`../README.md`](../README.md).

## 2. One-paragraph informal user journey — present

[`p2-mvp-user-journey.md`](./p2-mvp-user-journey.md) begins with the required
one-paragraph outline. The remaining sections clarify implemented P2 scope and
deferred P3 work.

## 3. Screen recording — replacement required before submission

[`My Movie.mp4`](./My%20Movie.mp4) is the current screen recording. It is a
4-minute, 38-second 1920×1080 MP4 with H.264 video and AAC audio. A full media
decode completed without errors.

The assignment limits the recording to two minutes, so this 4-minute, 38-second
cut is not submission-ready. It also starts with populated Playbooks and ends
after both Reviews are confirmed, while the submitted journey starts from a
clean workspace and leaves one Review pending. Replace it with a narrated video
of at most two minutes that shows the submitted journey through the real Vue
interface and backend. Do not use fixtures, direct database edits, or mock UI.
Save the replacement as `relay-p2-screen-recording.mp4` and update this link.

## 4. Design notes — present

[`design-notebook.md`](./design-notebook.md) records the plan, architecture,
significant decisions, design changes, concurrency failure and refinement,
security boundary, validation evidence, remaining risks, and P3 scope.
