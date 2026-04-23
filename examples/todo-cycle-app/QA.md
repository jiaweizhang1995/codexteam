# QA Notes

## Smoke Tests

- Open `index.html`: Pass. Structure includes title, form, empty state, list container, stylesheet, and script reference.
- Add todo with button: Pass by code inspection. Form submit calls `addTodo(input.value)`, appends a new item, clears the input, re-renders, and restores focus.
- Add todo with Enter: Pass by code inspection. Enter on the text input submits the form handler.
- Reject empty or whitespace-only todo: Pass. `addTodo()` trims input and shows `Enter a todo before adding it.` for empty values.
- Toggle completed state: Pass. Checkbox change updates `todo.completed` and re-renders with the `completed` class.
- Completed state visible: Pass. Completed rows get muted text and line-through styling.
- Delete todo: Pass. Delete button removes the matching item, re-renders, and returns focus to the input.
- Empty state visibility: Pass. `emptyState.hidden = todos.length > 0` shows it only when there are zero items.
- `node --check examples/todo-cycle-app/script.js`: Pass. Exit code `0` with no syntax errors reported.

## Observed Behavior

- Implementation is intentionally small and readable, with a single in-memory `todos` array and a full `render()` loop after each action.
- The form includes accessible naming for the input and live status messaging for validation feedback.
- Mobile layout is accounted for in `styles.css` with a single-column form and stacked delete action under `640px`.

## Risks

- `script.js` depends on `crypto.randomUUID()` for item IDs. That works in modern browsers, but older or restricted environments can fail at runtime and prevent adding todos.

## Recommended Follow-up Fix

- Replace or guard `crypto.randomUUID()` with a simple compatibility fallback so the static demo keeps working in browsers that do not expose that API.
