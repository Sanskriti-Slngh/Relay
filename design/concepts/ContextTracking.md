# ContextTracking

## Purpose

Preserve shared context together with the subjects that depend on it, so the
impact of a later change can be identified.

## Principle

A piece of context is recorded once and attached to the subjects that rely on
it. If the underlying information later changes, the shared context is changed
once while its attachments continue to identify every subject that depended
on it. A correction replaces the current text without recording a change;
a change preserves the exact previous and new text.

## Types

```types
external Scope
  The shared scope in which context is recorded.
external Subject
  An object that depends on recorded context.
external Anchor
  An optional point within a subject to which context applies.
```

## State

```state
a set of ContextNotes with
  a scope Scope
  a text String
  a version Number

a set of Attachments with
  a context ContextNote
  a subject Subject
  an optional anchor Anchor

a set of Changes with
  a context ContextNote
  a before String
  an after String
  an optional occurredAt String

Rule: there is at most one Attachment with the same context, subject, and optional anchor
```

## Actions

```actions
record (scope: Scope, text: String) : returns (context: ContextNote)
  where true
  then
    create a new ContextNote with given scope and text
    set context version to 1
    returns context

attach (context: ContextNote, subject: Subject) : returns (attachment: Attachment)
  where context is unknown
  then
    refuses CONTEXT_NOT_FOUND "There is no such ContextNote."
  where context is known and an Attachment already connects context and subject without an anchor
  then
    refuses ATTACHMENT_ALREADY_EXISTS "That ContextNote is already attached to the subject without an anchor."
  where context is known and no Attachment connects context and subject without an anchor
  then
    create an Attachment connecting context and subject
    returns attachment

attachAt (context: ContextNote, subject: Subject, anchor: Anchor) : returns (attachment: Attachment)
  where context is unknown
  then
    refuses CONTEXT_NOT_FOUND "There is no such ContextNote."
  where context is known and an Attachment already connects context, subject, and anchor
  then
    refuses ATTACHMENT_ALREADY_EXISTS "That ContextNote is already attached to the subject at that anchor."
  where context is known and no Attachment connects context, subject, and anchor
  then
    create an Attachment connecting context, subject, and anchor
    returns attachment

detach (attachment: Attachment) : returns ()
  where attachment is unknown
  then
    refuses ATTACHMENT_NOT_FOUND "There is no such Attachment."
  where attachment is known
  then
    remove attachment
    returns

remove (context: ContextNote, expectedVersion?: Number) : returns ()
  where context is unknown
  then
    refuses CONTEXT_NOT_FOUND "There is no such ContextNote."
  where context version is not expectedVersion
  then
    refuses VERSION_CONFLICT "The ContextNote changed after it was loaded."
  where context is known
  then
    permanently remove the ContextNote and all of its Attachments
    preserve its Changes as immutable evidence for existing Review history
    returns

correct (context: ContextNote, text: String, expectedVersion?: Number) : returns (change: Change)
  where context is unknown
  then
    refuses CONTEXT_NOT_FOUND "There is no such ContextNote."
  where context is known and context version is not expectedVersion
  then
    refuses VERSION_CONFLICT "The ContextNote changed after it was loaded."
  where context is known
  then
    replace context text with text
    increment context version
    returns change

change (context: ContextNote, text: String, expectedVersion?: Number) : returns (change: Change)
  where context is unknown
  then
    refuses CONTEXT_NOT_FOUND "There is no such ContextNote."
  where context is known and context version is not expectedVersion
  then
    refuses VERSION_CONFLICT "The ContextNote changed after it was loaded."
  where context is known and text is context's current text
  then
    refuses CHANGE_NOT_DIFFERENT "The new text must differ from the current text."
  where context is known and text is not context's current text
  then
    create a new Change with context, before set to context's current text, and after set to text
    set change occurredAt to the current timestamp
    replace context text with text
    increment context version
    returns change
```

## Queries

```queries
_notes (scope: Scope) : many (context: ContextNote, text: String)
  answers ContextNotes in the given Scope
  answers no rows when the Scope has no ContextNotes
  orders rows by stable ContextNote identity
_get (context: ContextNote) : optional (scope: Scope, text: String)
  answers no row for an unknown ContextNote
_getVersion (context: ContextNote) : optional (version: Number)
  answers the current version of a known ContextNote
_attachments (context: ContextNote) : many (attachment: Attachment, subject: Subject, anchor?: Anchor)
  answers Attachments for the ContextNote, including whether each has an Anchor
  answers no rows for an unknown ContextNote or a ContextNote with no Attachments
  orders rows by stable Attachment identity
_getAttachment (attachment: Attachment) : optional (context: ContextNote, subject: Subject, anchor?: Anchor)
  answers no row for an unknown Attachment
_atAnchor (anchor: Anchor) : many (attachment: Attachment, context: ContextNote, subject: Subject)
  answers Attachments located at the given Anchor
  answers no rows when the Anchor has no Attachments
  orders rows by stable Attachment identity
_changes (context: ContextNote) : many (change: Change, before: String, after: String, occurredAt?: String)
  answers the exact before and after text for each Change to the ContextNote, including preserved Changes after the ContextNote is removed
  answers no rows when the identity has no Changes
  orders rows by stable Change identity
_getChange (change: Change) : optional (context: ContextNote, before: String, after: String, occurredAt?: String)
  answers no row for an unknown Change
```
