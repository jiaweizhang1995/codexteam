(function () {
  const historyEl = document.getElementById("history");
  const displayEl = document.getElementById("display");
  const keypadEl = document.querySelector(".keypad");

  const state = {
    displayValue: "0",
    storedValue: null,
    pendingOperator: null,
    waitingForOperand: false,
    error: false,
  };

  function clearState() {
    state.displayValue = "0";
    state.storedValue = null;
    state.pendingOperator = null;
    state.waitingForOperand = false;
    state.error = false;
  }

  function normalizeNumber(value) {
    if (!Number.isFinite(value)) {
      return "Error";
    }

    const rounded = Math.round((value + Number.EPSILON) * 1e12) / 1e12;
    const text = String(rounded);
    return text === "-0" ? "0" : text;
  }

  function compute(left, right, operator) {
    switch (operator) {
      case "+":
        return left + right;
      case "-":
        return left - right;
      case "*":
        return left * right;
      case "/":
        return right === 0 ? null : left / right;
      default:
        return right;
    }
  }

  function setError(message) {
    state.displayValue = message;
    state.storedValue = null;
    state.pendingOperator = null;
    state.waitingForOperand = true;
    state.error = true;
    render();
  }

  function render() {
    displayEl.textContent = state.displayValue;
    displayEl.classList.toggle("is-error", state.error);

    if (state.error) {
      historyEl.textContent = "Press C or type a number to recover";
      return;
    }

    if (state.pendingOperator && state.storedValue !== null) {
      const current = state.waitingForOperand ? "" : state.displayValue;
      historyEl.textContent = `${normalizeNumber(state.storedValue)} ${state.pendingOperator} ${current}`.trim();
      return;
    }

    historyEl.textContent = "";
  }

  function resetErrorIfDigit(nextDigit) {
    if (!state.error) {
      return false;
    }

    clearState();
    state.displayValue = nextDigit;
    render();
    return true;
  }

  function inputDigit(digit) {
    if (resetErrorIfDigit(digit)) {
      return;
    }

    if (state.waitingForOperand) {
      state.displayValue = digit;
      state.waitingForOperand = false;
    } else if (state.displayValue === "0") {
      state.displayValue = digit;
    } else {
      state.displayValue += digit;
    }

    render();
  }

  function inputDecimal() {
    if (state.error) {
      clearState();
      state.displayValue = "0.";
      render();
      return;
    }

    if (state.waitingForOperand) {
      state.displayValue = "0.";
      state.waitingForOperand = false;
      render();
      return;
    }

    if (!state.displayValue.includes(".")) {
      state.displayValue += ".";
      render();
    }
  }

  function applyOperator(nextOperator) {
    if (state.error) {
      return;
    }

    const inputValue = Number(state.displayValue);

    if (state.pendingOperator && !state.waitingForOperand) {
      const result = compute(state.storedValue, inputValue, state.pendingOperator);
      if (result === null) {
        setError("Cannot divide by zero");
        return;
      }

      state.storedValue = result;
      state.displayValue = normalizeNumber(result);
    } else if (state.storedValue === null) {
      state.storedValue = inputValue;
    }

    state.pendingOperator = nextOperator;
    state.waitingForOperand = true;
    render();
  }

  function evaluate() {
    if (state.error || state.pendingOperator === null || state.waitingForOperand) {
      return;
    }

    const inputValue = Number(state.displayValue);
    const result = compute(state.storedValue, inputValue, state.pendingOperator);

    if (result === null) {
      setError("Cannot divide by zero");
      return;
    }

    historyEl.textContent = `${normalizeNumber(state.storedValue)} ${state.pendingOperator} ${state.displayValue} =`;
    state.displayValue = normalizeNumber(result);
    state.storedValue = null;
    state.pendingOperator = null;
    state.waitingForOperand = true;
    state.error = false;
    displayEl.textContent = state.displayValue;
    displayEl.classList.remove("is-error");
  }

  function clearAll() {
    clearState();
    render();
  }

  function toggleSign() {
    if (state.error) {
      return;
    }

    const value = Number(state.displayValue);
    state.displayValue = normalizeNumber(value * -1);
    render();
  }

  function applyPercent() {
    if (state.error) {
      return;
    }

    const value = Number(state.displayValue) / 100;
    state.displayValue = normalizeNumber(value);
    state.waitingForOperand = false;
    render();
  }

  function backspace() {
    if (state.error) {
      clearAll();
      return;
    }

    if (state.waitingForOperand) {
      return;
    }

    if (state.displayValue.length === 1 || (state.displayValue.length === 2 && state.displayValue.startsWith("-"))) {
      state.displayValue = "0";
    } else {
      state.displayValue = state.displayValue.slice(0, -1);
    }

    render();
  }

  keypadEl.addEventListener("click", (event) => {
    const target = event.target.closest("button[data-action]");
    if (!target) {
      return;
    }

    const { action, value } = target.dataset;

    switch (action) {
      case "digit":
        inputDigit(value);
        break;
      case "decimal":
        inputDecimal();
        break;
      case "operator":
        applyOperator(value);
        break;
      case "equals":
        evaluate();
        break;
      case "clear":
        clearAll();
        break;
      case "sign":
        toggleSign();
        break;
      case "percent":
        applyPercent();
        break;
      default:
        break;
    }
  });

  window.addEventListener("keydown", (event) => {
    const { key } = event;
    const isModifier = event.metaKey || event.ctrlKey || event.altKey;

    if (isModifier) {
      return;
    }

    if (/^\d$/.test(key)) {
      event.preventDefault();
      inputDigit(key);
      return;
    }

    switch (key) {
      case ".":
        event.preventDefault();
        inputDecimal();
        break;
      case "+":
      case "-":
      case "*":
      case "/":
        event.preventDefault();
        applyOperator(key);
        break;
      case "=":
      case "Enter":
        event.preventDefault();
        evaluate();
        break;
      case "Backspace":
        event.preventDefault();
        backspace();
        break;
      case "Escape":
        event.preventDefault();
        clearAll();
        break;
      default:
        break;
    }
  });

  clearState();
  render();
})();
