# Calculator App Target

This directory is the target for the Codex Agent Teams calculator demo.
The expected deliverable is a simple browser calculator implemented as a static app.

## Implementation Plan

### UI Layout

- Build a single calculator panel centered in the page.
- Include a display area with:
  - an optional expression/history line for the current pending operation
  - a primary result line for the current input or evaluated result
- Arrange buttons in a standard calculator grid with clear visual grouping:
  - top utility row: `C`, `+/-`, `%`, `/`
  - number rows: `7 8 9 *`, `4 5 6 -`, `1 2 3 +`
  - bottom row: `0`, `.`, `=`
- Make the `0` key wider than other number keys if the layout supports it cleanly.
- Distinguish operator, utility, and equals buttons with separate visual styles.
- Keep the layout responsive so it remains usable on narrow mobile widths and standard desktop widths.

### Supported Operations

- Numeric entry for digits `0` through `9`
- Decimal entry with a single `.` per number
- Binary operations:
  - addition
  - subtraction
  - multiplication
  - division
- Unary operations:
  - sign toggle via `+/-`
  - percent conversion via `%`
- Clear behavior:
  - `C` resets current entry, pending operator, stored value, and displayed result state
- Evaluation behavior:
  - `=` computes the current pending expression
  - repeated `=` support is optional unless the implementation is already structured for it
- Error handling:
  - division by zero should display a clear error state and allow recovery via `C` or new numeric entry

### Keyboard Behavior

- Support digit keys `0-9` for number entry.
- Support `.` for decimal entry.
- Support `+`, `-`, `*`, and `/` for operators.
- Support `Enter` and `=` to evaluate.
- Support `Backspace` to delete the last typed digit from the current entry.
- Support `Escape` to perform full clear.
- Ignore unsupported keys without breaking calculator state.
- Prevent accidental browser-side form submission or focus behavior from interfering with calculator key handling.

### File Layout

- Keep the app implementation small and static, with a layout similar to:
  - `index.html` for the calculator markup and app mount point
  - `styles.css` for layout, visual grouping, and responsive styling
  - `script.js` for state management, rendering, button handlers, and keyboard handlers
- If the implementation prefers a `src/` subdirectory, keep the same separation of concerns:
  - UI structure
  - presentation styles
  - calculator state and interaction logic
- Keep business logic isolated enough that the supported operations can be tested independently from DOM wiring if tests are added later.

### Acceptance Criteria

- The app renders a usable calculator in a browser with no build step required beyond serving static files.
- Clicking buttons supports number entry, clear, sign toggle, percent, the four basic operators, and equals.
- Keyboard input mirrors the supported calculator interactions for digits, decimal, operators, evaluate, backspace, and clear.
- The display updates correctly for chained operations such as `2 + 3 * 4` according to the chosen calculator interaction model, and that model should be consistent throughout the app.
- Decimal input prevents duplicate decimal points in a single operand.
- Division by zero produces a visible recoverable error state.
- The layout remains readable and operable on both mobile-sized and desktop-sized viewports.
- The implementation is organized into clearly separated files for structure, styling, and behavior.
