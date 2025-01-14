const repoInput = document.querySelector(".repo-input");
const getButton = document.querySelector(".get-button");
const workingStatusText = document.querySelector(".working-status-text");
const resultText = document.querySelector(".result-text");
const validRepoRegex = /^\s*([-\w]+)\/([-.\w]+)\s*$/
let working;

function setErroredState(state, element) {
  const originalClassValue = element.getAttribute("class");
  if (state) {
    element.setAttribute("class", originalClassValue + " error");
  } else {
    element.setAttribute("class", originalClassValue.replaceAll(" error", ""));
  }
}

class HTTPError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "HTTPError";
    this.statusCode = code;
  }
}

function get_next_number(owner, name) {
  return new Promise(function (resolve, reject) {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", `https://api.github.com/repos/${owner}/${name}/issues?state=all&direction=desc&sort=created&per_page=1`);
    xhr.setRequestHeader("Accept", "application/vnd.github.v3+json");
    xhr.onload = function () {
      if (this.status >= 200 && this.status < 300) {
        let result;
        let data = JSON.parse(xhr.responseText);
        if (data.length === 0) {
          result = 1;
        } else {
          result = data.pop().number + 1;
        }
        resolve(result);
      } else {
        let message = JSON.parse(xhr.responseText).message;
        reject(new HTTPError(xhr.status, message));
      }
    };
    xhr.onerror = function () {
      let message = JSON.parse(xhr.responseText).message;
      reject(new HTTPError(xhr.status, message));
    };
    xhr.send();
  });
}

function checkInputValidity() {
  const inputValue = repoInput.value;
  if (!validRepoRegex.test(inputValue)) {
    if (!repoInput.value.length) {
      repoInput.setCustomValidity(
        "Please enter a repo. e.g. github/docs"
      );
    } else {
      repoInput.setCustomValidity(
        "Please match the {owner}/{name} format. e.g. github/docs"
      );
    }
    repoInput.reportValidity();
    return false;
  }
  return true;
}

function setWorkingStatus() {
  working = true;
  let workingStep = 1;
  repoInput.readOnly = true;
  getButton.disabled = true;
  function showWorkingDots() {
    if (working) {
      workingStatusText.textContent = `working${" .".repeat(workingStep)}`
      if (workingStep === 3) {
        workingStep = 1;
      } else {
        workingStep++;
      }
      setTimeout(showWorkingDots, 150);
    }
  }
  showWorkingDots();
}

function setFinishedStatus(errored, details, _mayBeUnsafe = true) {
  working = false;
  workingStatusText.textContent = errored ?  "ERROR!!!" : "done!";
  setErroredState(errored, workingStatusText);
  if (_mayBeUnsafe) {
    resultText.textContent = details;
  } else {
    resultText.innerHTML = details;
  }
  setErroredState(errored, resultText);
  repoInput.readOnly = false;
  getButton.disabled = false;
}

function resetOutputStatus() {
  workingStatusText.innerHTML = "";
  setErroredState(false, workingStatusText);
  resultText.innerHTML = "";
  setErroredState(false, resultText);
}

async function onSubmit() {
  if (!checkInputValidity()){
    return;
  }
  const match = validRepoRegex.exec(repoInput.value);
  const [owner, name] = match.slice(1);
  resetOutputStatus();
  setWorkingStatus();
  let nextNumber, resultString;
  let failed = false, isResultStringUnsafe = true, unexpectedErr = null;
  try {
    nextNumber = await get_next_number(owner, name);
    resultString = `${nextNumber.toString().bold()} will be the next number assigned.`
    isResultStringUnsafe = false;
  }
  catch (err) {
    failed = true;
    if (err.name === "HTTPError") {
      if (err.statusCode === 404) {
        isResultStringUnsafe = false;
        resultString = "That repository doesn't exist.";
      } else if (err.statusCode === 403 && err.message.toLowerCase().includes("api rate limit exceeded")) {
        isResultStringUnsafe = false;
        resultString = "GitHub's API rate limit exceeded. Please wait and try again later."
      } else {
        resultString = `unexpected error: ${err.toString()}`;
        unexpectedErr = err;
      }
    } else {
      resultString = `unexpected error: ${err.toString()}`;
      unexpectedErr = err;
    }
  }
  setFinishedStatus(failed, resultString, isResultStringUnsafe);
  if (unexpectedErr != null) {
    throw unexpectedErr;
  }
}

repoInput.addEventListener("keydown", (event) => {
  repoInput.setCustomValidity("");
  if (event.key === "Enter") {
    onSubmit();
  }
});
getButton.addEventListener("click", onSubmit);

function maybeUseRepoFromURL() {
  const params = new URLSearchParams(document.location.search.substring(1));
  let owner = params.get("owner"), name = params.get("name");
  if (owner === null && name === null) {
    return;
  }
  owner = owner != null ? owner : "";
  name = name != null ? name : "";
  repoInput.value = `${owner}/${name}`;
  onSubmit();
}

window.addEventListener("DOMContentLoaded", maybeUseRepoFromURL);
