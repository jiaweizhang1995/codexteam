# Todo Cycle App

This directory contains a small browser todo app implemented as static files only. The app should run by opening `index.html` in a browser or serving the folder with any simple static file server. No build step, package install, or framework is required.

## App Shape

The app is a single-page todo list for one user and one session.

UI sections:

- App header with a clear title.
- Input row with:
  - a text input for the todo label
  - an add button
- Main list area that shows current todos.
- Empty state message when the list has no items.

Each todo row should include:

- A checkbox or toggle control for completed state.
- The todo text.
- A delete button.

Recommended visual behavior:

- Completed items are visually distinct, such as strikethrough text and reduced emphasis.
- The layout should remain readable on narrow screens.
- Controls should have visible labels or accessible names.

## Core Interactions

### Add Todo

- User types text into the input.
- Submitting by clicking the add button adds a new todo.
- Pressing Enter in the input should also add a new todo.
- Ignore entries that are empty or whitespace only.
- After a successful add:
  - the new item appears in the list immediately
  - the input is cleared
  - focus returns to the input

### Toggle Complete

- User toggles a todo’s checkbox or equivalent control.
- The item updates immediately between active and completed states.
- Toggling should not remove or reorder the item unless the builder chooses to do so deliberately and documents it.

### Delete Todo

- User activates the delete button for a row.
- The item is removed immediately from the list.

### Empty State

- When there are zero todos, show a visible empty-state message.
- When at least one todo exists, hide the empty-state message.

## Data Model

The app may keep state in memory only. Persistence is not required.

Each todo should have at least:

- `id`: unique per item in the current session
- `text`: the displayed label
- `completed`: boolean

## Acceptance Criteria

The implementation is complete when all of the following are true:

1. Opening `index.html` shows a usable todo interface without build tooling.
2. A user can add a todo by typing text and clicking the add button.
3. A user can add a todo by typing text and pressing Enter.
4. Empty or whitespace-only submissions do not create items.
5. Added todos render as individual rows in a visible list.
6. A user can mark an item completed and unmark it again.
7. The completed state is visually reflected in the UI.
8. A user can delete any existing todo item.
9. When no items exist, an empty-state message is shown.
10. When one or more items exist, the empty-state message is hidden.
11. The app works with plain static files and no external dependency install.
12. The JavaScript is organized clearly enough that another teammate can review behavior quickly.

## Suggested File Layout

The builder should keep the implementation in this directory with this simple shape:

- `index.html`: page structure, app container, input row, list container, and script/style references
- `styles.css`: all styling for layout, spacing, states, and responsive behavior
- `script.js`: state, DOM queries, rendering, and event handling
- `README.md`: this planning document
- `QA.md`: manual verification notes written by QA

## Implementation Notes

- Use semantic HTML where practical: `form`, `input`, `button`, `ul`, `li`, `label`.
- Prefer a small `render()` flow that redraws the todo list from in-memory state after each action.
- Keep selectors and function names straightforward so the demo is easy to inspect.
- Avoid unnecessary features such as filtering, counters, persistence, drag-and-drop, or edit-in-place unless explicitly requested later.
