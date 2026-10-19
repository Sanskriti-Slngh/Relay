# Reviewing

## Purpose

Ensure questionable information is explicitly reconsidered for a known reason
before it continues to be treated as current.

## Principle

A review records an item together with the reasons it needs reconsideration.
The item can then be confirmed as current, marked as requiring changes,
resolved after those changes, or removed from consideration if the review is
no longer relevant.

## Types

```types
external Item
  The item whose current status is being reconsidered.
external Cause
  A reason for reconsidering an Item.

ReviewStatus is PENDING or CHANGES_REQUIRED or COMPLETE or CANCELLED
  The lifecycle status of a Review.
```

## State

```state
a set of Reviews with
  an item Item
  a causes set of Cause
  a status ReviewStatus
  a version Number

Rule: for each Item, at most one Review has status PENDING or CHANGES_REQUIRED
```

## Actions

```actions
request (item: Item, cause: Cause) : returns (review: Review)
  where item has a Review with status PENDING or CHANGES_REQUIRED
  then
    refuses REQUEST_ALREADY_UNFINISHED "This Item already has an unfinished Review; add the cause to that Review."
  where item has no Review with status PENDING or CHANGES_REQUIRED
  then
    create a new Review for item
    set review causes to {cause}
    set review status to PENDING
    set review version to 1
    returns review

addCause (review: Review, cause: Cause) : returns ()
  where review does not exist
  then
    refuses ADD_CAUSE_REVIEW_NOT_FOUND "There is no such Review."
  where review exists and review status is COMPLETE or CANCELLED
  then
    refuses ADD_CAUSE_REVIEW_FINISHED "Causes can only be added to an unfinished Review."
  where review exists and its status is either PENDING or CHANGES_REQUIRED, and cause is already in review causes
  then
    refuses CAUSE_ALREADY_PRESENT "That cause is already associated with the Review."
  where review exists and its status is either PENDING or CHANGES_REQUIRED, and cause is not already in review causes
  then
    add cause to review causes
    increment review version
    returns

confirm (review: Review, expectedVersion?: Number) : returns ()
  where review does not exist
  then
    refuses CONFIRM_REVIEW_NOT_FOUND "There is no such Review."
  where review exists and review status is not PENDING
  then
    refuses REVIEW_NOT_PENDING_FOR_CONFIRMATION "Only a PENDING Review can be confirmed."
  where review exists and review status is PENDING and review version is not expectedVersion
  then
    refuses VERSION_CONFLICT "The Review changed after it was loaded."
  where review exists and review status is PENDING
  then
    set review status to COMPLETE
    increment review version
    returns

requireChanges (review: Review, expectedVersion?: Number) : returns ()
  where review does not exist
  then
    refuses REQUIRE_CHANGES_REVIEW_NOT_FOUND "There is no such Review."
  where review exists and review status is not PENDING
  then
    refuses REVIEW_NOT_PENDING_FOR_CHANGES "Only a PENDING Review can be marked as requiring changes."
  where review exists and review status is PENDING and review version is not expectedVersion
  then
    refuses VERSION_CONFLICT "The Review changed after it was loaded."
  where review exists and review status is PENDING
  then
    set review status to CHANGES_REQUIRED
    increment review version
    returns

resolve (review: Review, expectedVersion?: Number) : returns ()
  where review does not exist
  then
    refuses RESOLVE_REVIEW_NOT_FOUND "There is no such Review."
  where review exists and review status is not CHANGES_REQUIRED
  then
    refuses REVIEW_NOT_AWAITING_CHANGES "Only a Review requiring changes can be resolved."
  where review exists and review status is CHANGES_REQUIRED and review version is not expectedVersion
  then
    refuses VERSION_CONFLICT "The Review changed after it was loaded."
  where review exists and review status is CHANGES_REQUIRED
  then
    set review status to COMPLETE
    increment review version
    returns

cancel (review: Review, expectedVersion?: Number) : returns ()
  where review does not exist
  then
    refuses CANCEL_REVIEW_NOT_FOUND "There is no such Review."
  where review exists and review status is COMPLETE or CANCELLED
  then
    refuses CANCEL_REVIEW_FINISHED "Only an unfinished Review can be cancelled."
  where review exists, review is unfinished, and review version is not expectedVersion
  then
    refuses VERSION_CONFLICT "The Review changed after it was loaded."
  where review exists and its status is either PENDING or CHANGES_REQUIRED
  then
    set review status to CANCELLED
    increment review version
    returns
```

## Queries

```queries
_unfinished () : many (review: Review, item: Item, status: ReviewStatus)
  answers Reviews whose status is PENDING or CHANGES_REQUIRED
  answers no rows when there are no unfinished Reviews
  orders rows by stable Review identity
_forItem (item: Item) : many (review: Review, status: ReviewStatus)
  answers all Reviews for the Item, including finished Reviews
  answers no rows for an Item with no Reviews
  orders rows by stable Review identity
_get (review: Review) : optional (item: Item, status: ReviewStatus)
  answers no row for an unknown Review
_getVersion (review: Review) : optional (version: Number)
  answers the current version of a known Review
_causes (review: Review) : many (cause: Cause)
  answers the distinct causes associated with the Review
  answers no rows for an unknown Review or a Review with no causes
  orders rows by stable Cause identity
```
