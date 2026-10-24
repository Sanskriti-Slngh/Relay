# Questioning

## Purpose

Preserve the resolution of uncertainty so the same ambiguity does not have to
be rediscovered and resolved repeatedly.

## Principle

A question is raised about a particular subject. Once an answer is recorded,
the original question and its resolution remain together for later readers.

## Types

```types
external Subject
  The item about which uncertainty is raised.

external Answerer
  The verified identity of the person who records an answer.

QuestionStatus is OPEN or ANSWERED
  The lifecycle status of a Question.
```

## State

```state
a set of Questions with
  a subject Subject
  a text String
  a status QuestionStatus
  an optional answer String
  an optional answerer Answerer
  a version Number

Rule: every OPEN Question has no answer and no answerer

Rule: every ANSWERED Question has an answer and an answerer
```

## Actions

```actions
ask (subject: Subject, text: String) : returns (question: Question)
  where true
  then
    create a new Question with given subject and text
    set question status to OPEN
    set question answer to absent
    set question answerer to absent
    set question version to 1
    returns question

answer (question: Question, answer: String, answerer: Answerer, expectedVersion?: Number) : returns ()
  where question does not exist
  then
    refuses QUESTION_NOT_FOUND "There is no such Question."
  where question exists and question status is ANSWERED
  then
    refuses QUESTION_NOT_OPEN "Only an OPEN Question can be answered."
  where question exists and question status is OPEN and question version is not expectedVersion
  then
    refuses VERSION_CONFLICT "The Question changed after it was loaded."
  where question exists and question status is OPEN
  then
    associate answer with question
    associate answerer with question
    set question status to ANSWERED
    increment question version
    returns

reviseAnswer (question: Question, answer: String, answerer: Answerer, expectedVersion?: Number) : returns ()
  where question does not exist
  then
    refuses QUESTION_NOT_FOUND "There is no such Question."
  where question is ANSWERED, question answerer is answerer, and question version is not expectedVersion
  then
    refuses VERSION_CONFLICT "The Question changed after it was loaded."
  where question is not ANSWERED or question answerer is not answerer
  then
    refuses QUESTION_ANSWER_NOT_EDITABLE "Only the original answerer can revise an ANSWERED Question."
  where question exists, question status is ANSWERED, and question answerer is answerer
  then
    replace the answer associated with question
    preserve the original question, subject, and answerer
    increment question version
    returns

removeForSubject (subject: Subject) : returns ()
  where true
  then
    permanently remove every Question about subject
    returns
```

## Queries

```queries
_forSubject (subject: Subject) : many (question: Question, text: String, status: QuestionStatus, answer?: String, answerer?: Answerer)
  answers all Questions about the Subject, including answered Questions
  answers no rows when the Subject has no Questions
  orders rows by stable Question identity
_open () : many (question: Question, subject: Subject, text: String)
  answers all OPEN Questions
  answers no rows when there are no OPEN Questions
  orders rows by stable Question identity
_questions () : many (question: Question, subject: Subject, text: String, status: QuestionStatus, answer?: String, answerer?: Answerer)
  answers all Questions, including answered Questions
  answers no rows when there are no Questions
  orders rows by stable Question identity
_get (question: Question) : optional (subject: Subject, text: String, status: QuestionStatus, answer?: String, answerer?: Answerer)
  answers no row for an unknown Question
_getVersion (question: Question) : optional (version: Number)
  answers the current version of a known Question
```
