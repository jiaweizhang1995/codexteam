const todos = [];

const form = document.querySelector("#todo-form");
const input = document.querySelector("#todo-input");
const list = document.querySelector("#todo-list");
const emptyState = document.querySelector("#empty-state");
const formMessage = document.querySelector("#form-message");

function generateTodoId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `todo-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createTodo(text) {
  return {
    id: generateTodoId(),
    text,
    completed: false,
  };
}

function setMessage(message) {
  formMessage.textContent = message;
}

function render() {
  list.replaceChildren();

  todos.forEach((todo) => {
    const item = document.createElement("li");
    item.className = `todo-item${todo.completed ? " completed" : ""}`;

    const toggle = document.createElement("input");
    toggle.className = "todo-toggle";
    toggle.type = "checkbox";
    toggle.checked = todo.completed;
    toggle.setAttribute("aria-label", `Mark "${todo.text}" as completed`);
    toggle.addEventListener("change", () => {
      todo.completed = toggle.checked;
      render();
    });

    const text = document.createElement("span");
    text.className = "todo-text";
    text.textContent = todo.text;

    const removeButton = document.createElement("button");
    removeButton.className = "delete-button";
    removeButton.type = "button";
    removeButton.setAttribute("aria-label", `Delete "${todo.text}"`);
    removeButton.textContent = "Delete";
    removeButton.addEventListener("click", () => {
      const index = todos.findIndex((entry) => entry.id === todo.id);
      if (index !== -1) {
        todos.splice(index, 1);
        render();
        input.focus();
      }
    });

    item.append(toggle, text, removeButton);
    list.append(item);
  });

  emptyState.hidden = todos.length > 0;
}

function addTodo(rawValue) {
  const text = rawValue.trim();

  if (!text) {
    setMessage("Enter a todo before adding it.");
    return false;
  }

  todos.push(createTodo(text));
  setMessage("");
  render();
  input.value = "";
  input.focus();
  return true;
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  addTodo(input.value);
});

input.addEventListener("input", () => {
  if (formMessage.textContent) {
    setMessage("");
  }
});

render();
