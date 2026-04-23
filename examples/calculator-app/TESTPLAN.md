# Calculator App QA Test Plan

## Scope

Manual smoke coverage for the static calculator app in `index.html`, `styles.css`, and `script.js`, based on code inspection plus a JavaScript syntax check.

## Static Validation

- Command: `node --check examples/calculator-app/script.js`
- Result: Passed with exit code `0` and no syntax errors reported.

## Manual Smoke Tests

| ID | Area | Steps | Expected Result |
| --- | --- | --- | --- |
| 1 | Initial render | Open `index.html` in a browser. | Calculator panel is centered, display shows `0`, history line is empty, keypad is visible. |
| 2 | Digit entry | Click `7`, `8`, `9`. | Display updates to `789`. |
| 3 | Leading zero replacement | Refresh or press `C`, then click `0`, `5`. | Display shows `5`, not `05`. |
| 4 | Decimal guard | Press `C`, then click `1`, `.`, `2`, `.`. | Display remains `1.2`; second decimal is ignored. |
| 5 | Basic addition | Press `C`, then `2`, `+`, `3`, `=`. | History shows `2 + 3 =`, display shows `5`. |
| 6 | Chained operations model | Press `C`, then `2`, `+`, `3`, `*`, `4`, `=`. | App uses immediate execution model: display ends at `20`, not `14`. |
| 7 | Sign toggle | Press `C`, then `9`, `+/-`. | Display changes to `-9`; pressing `+/-` again returns to `9`. |
| 8 | Percent | Press `C`, then `5`, `0`, `%`. | Display shows `0.5`. |
| 9 | Divide by zero recovery | Press `C`, then `8`, `/`, `0`, `=`. Then click `7`. | Display shows `Cannot divide by zero`; history tells user to recover; entering `7` clears error and shows `7`. |
| 10 | Clear reset | Enter any calculation, then press `C`. | Display resets to `0`; pending operator, stored value, history, and error state clear. |
| 11 | Keyboard digits/operators | Use keyboard: `1`, `2`, `+`, `3`, `Enter`. | Calculator responds without focus issues; display shows `15`. |
| 12 | Keyboard decimal/backspace/escape | Type `4`, `.`, `5`, `Backspace`, `Escape`. | Display changes from `4.5` to `4.` after backspace, then resets to `0` after escape. |
| 13 | Unsupported keys | Press a letter key such as `A`. | No calculator state change and no visible error. |
| 14 | Responsive layout | Check near mobile width and desktop width. | Layout remains readable; buttons stay usable; `0` key spans two columns. |

## Residual Risks

- No live browser verification was performed in this task, so layout, hover/focus states, and ARIA/live-region behavior remain unconfirmed.
- Static review suggests repeated `=` is not supported; confirm this matches intended product behavior.
- Backspace leaves values like `4.` instead of normalizing to `4`; acceptable if intended, but worth a quick UX check in browser.
