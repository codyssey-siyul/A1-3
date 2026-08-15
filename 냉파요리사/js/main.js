const menuButton = document.querySelector(".menu-button");
const navLinks = document.querySelector(".nav-links");
const recipeForm = document.querySelector("#recipe-form");
const ingredientsInput = document.querySelector("#ingredients");
const styleSelect = document.querySelector("#style");
const resultArea = document.querySelector("#result-area");
const submitButton = document.querySelector("#submit-button");

/* 모바일 메뉴 열기/닫기 */
menuButton.addEventListener("click", () => {
  const isOpen = navLinks.classList.toggle("is-open");
  menuButton.setAttribute("aria-expanded", String(isOpen));
  menuButton.setAttribute("aria-label", isOpen ? "메뉴 닫기" : "메뉴 열기");
});

document.querySelectorAll(".nav-links a").forEach((link) => {
  link.addEventListener("click", () => {
    navLinks.classList.remove("is-open");
    menuButton.setAttribute("aria-expanded", "false");
    menuButton.setAttribute("aria-label", "메뉴 열기");
  });
});

/* 화면에 넣을 텍스트를 안전하게 처리하는 함수 */
function escapeHtml(text) {
  const element = document.createElement("div");
  element.textContent = text;
  return element.innerHTML;
}

/* AI가 보내준 레시피를 화면에 표시하는 함수 */
function showRecipe(recipe) {
  const ingredientsList = recipe.ingredients
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");

  const stepsList = recipe.steps
    .map((step) => `<li>${escapeHtml(step)}</li>`)
    .join("");

  resultArea.innerHTML = `
    <article class="result-card">
      <h3>🍳 ${escapeHtml(recipe.title)}</h3>
      <p class="recipe-meta">⏱ 예상 조리 시간: ${escapeHtml(recipe.cooking_time)}</p>

      <h4>🥘 필요한 재료</h4>
      <ul>${ingredientsList}</ul>

      <h4>👩‍🍳 만드는 법</h4>
      <ol>${stepsList}</ol>

      <h4>💡 한 줄 요리 팁</h4>
      <p class="cooking-tip">${escapeHtml(recipe.tip)}</p>
    </article>
  `;
}

/* 안내 또는 오류 메시지를 표시하는 함수 */
function showMessage(message, type) {
  resultArea.innerHTML = `
    <p class="status-message ${type}">
      ${escapeHtml(message)}
    </p>
  `;
}

/* '레시피 추천받기' 버튼을 눌렀을 때 */
recipeForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const ingredients = ingredientsInput.value.trim();
  const style = styleSelect.value;

  /* 실패 처리 1: 재료를 비웠을 때 */
  if (!ingredients) {
    showMessage("앗, 요리할 재료를 먼저 입력해 주세요!", "status-error");
    ingredientsInput.focus();
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = "🍳 레시피를 생각하고 있어요...";
  showMessage("AI가 냉장고 속 재료를 살펴보고 있어요. 잠시만 기다려 주세요!", "status-loading");

  /* 실패 처리 3: 25초가 지나면 요청을 멈추고 안내 */
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);

  try {
    /*
      실제 배포 후에는 /api/recipe 주소의 Python 파일이 이 요청을 받습니다.
      ingredients와 style이 JavaScript의 fetch를 통해 백엔드로 전달됩니다.
    */
    const response = await fetch("/api/recipe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        ingredients: ingredients,
        style: style
      }),
      signal: controller.signal
    });

    const data = await response.json();

    /* 실패 처리 2: API 오류(4xx/5xx) */
    if (!response.ok) {
      throw new Error(data.error || "일시적인 오류가 발생했어요.");
    }

    showRecipe(data);
  } catch (error) {
    if (error.name === "AbortError") {
      showMessage(
        "응답이 조금 늦어지고 있어요. 잠시 후 다시 시도해 주세요.",
        "status-error"
      );
    } else {
      showMessage(
        "일시적인 오류가 발생했어요. 잠시 후 다시 시도해 주세요.",
        "status-error"
      );
    }

    console.error("레시피 요청 오류:", error);
  } finally {
    clearTimeout(timeoutId);
    submitButton.disabled = false;
    submitButton.textContent = "✨ 레시피 추천받기";
  }
});