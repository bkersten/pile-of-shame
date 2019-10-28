const DEFAULT_MAX_AGE_MINUTES = 60 * 24;

function saveOptions(e) {
  e.preventDefault();

  browser.storage.local.set({
    max_age: document.querySelector("#max_age").value
  });
}

function restoreOptions() {
  browser.storage.local.get("max_age").then(
    result => {
      document.querySelector("#max_age").value =
        result.max_age || DEFAULT_MAX_AGE_MINUTES;
    },
    error => {
      console.log(`Error: ${error}`);
    }
  );
}

document.addEventListener("DOMContentLoaded", restoreOptions);
document.querySelector("form").addEventListener("submit", saveOptions);
