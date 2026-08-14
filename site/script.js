const status = document.querySelector("#copy-status");
const headlineRotator = document.querySelector("[data-headline-rotator]");

function splitHeadlinePhrase(phrase) {
  const fragment = document.createDocumentFragment();
  const characters = [...(phrase.textContent ?? "")];
  let animatedIndex = 0;

  for (const value of characters) {
    if (value === " ") {
      const space = document.createElement("span");
      space.className = "headline-space";
      space.textContent = "\u00a0";
      fragment.append(space);
      continue;
    }

    const glyph = document.createElement("span");
    const character = document.createElement("span");
    const base = document.createElement("span");
    const accent = document.createElement("span");
    const screen = document.createElement("span");
    glyph.className = "headline-glyph";
    character.classList.add(
      "headline-character",
      animatedIndex % 2 === 0
        ? "headline-character--from-below"
        : "headline-character--from-above",
      `headline-character--accent-${(animatedIndex % 2) + 1}`,
    );
    character.style.setProperty("--character-index", String(animatedIndex));
    base.className = "headline-character-base";
    base.textContent = value;
    accent.className = "headline-character-accent";
    accent.setAttribute("aria-hidden", "true");
    accent.textContent = value;
    screen.className = "headline-character-screen";
    screen.setAttribute("aria-hidden", "true");
    screen.textContent = value;
    character.append(base, accent, screen);
    glyph.append(character);
    fragment.append(glyph);
    animatedIndex += 1;
  }

  phrase.replaceChildren(fragment);
}

function startHeadlineRotation(rotator) {
  const phrases = [...rotator.querySelectorAll(".headline-phrase")];
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (phrases.length < 2 || reducedMotion.matches) return;

  for (const phrase of phrases) splitHeadlinePhrase(phrase);
  rotator.classList.add("is-enhanced");

  let activeIndex = 0;
  window.setInterval(() => {
    if (document.hidden || reducedMotion.matches) return;

    const current = phrases[activeIndex];
    activeIndex = (activeIndex + 1) % phrases.length;
    const next = phrases[activeIndex];

    current.classList.remove("is-active");
    current.classList.add("is-leaving");

    window.setTimeout(() => next.classList.add("is-active"), 90);
    window.setTimeout(() => current.classList.remove("is-leaving"), 900);
  }, 3000);
}

if (headlineRotator) startHeadlineRotation(headlineRotator);

function enhanceFaq(details) {
  const summary = details.querySelector("summary");
  const answer = details.querySelector(".faq-answer");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (!summary || !answer || typeof answer.animate !== "function") return;

  let animation = null;

  summary.addEventListener("click", (event) => {
    if (reducedMotion.matches) return;
    event.preventDefault();
    if (animation) return;

    const opening = !details.open;
    if (opening) details.open = true;
    else details.classList.add("is-closing");

    const startHeight = opening ? 0 : answer.offsetHeight;
    const endHeight = opening ? answer.scrollHeight : 0;
    animation = answer.animate(
      [
        {
          height: `${startHeight}px`,
          opacity: opening ? 0 : 1,
          transform: opening ? "translateY(-4px)" : "translateY(0)",
        },
        {
          height: `${endHeight}px`,
          opacity: opening ? 1 : 0,
          transform: opening ? "translateY(0)" : "translateY(-4px)",
        },
      ],
      {
        duration: 340,
        easing: "cubic-bezier(0.4, 0, 0.2, 1)",
      },
    );

    animation.addEventListener(
      "finish",
      () => {
        if (!opening) details.open = false;
        details.classList.remove("is-closing");
        animation = null;
      },
      { once: true },
    );
  });
}

for (const details of document.querySelectorAll(".faq-list details")) {
  enhanceFaq(details);
}

async function copyText(value) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textArea = document.createElement("textarea");
  textArea.value = value;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  document.body.append(textArea);
  textArea.select();
  const copied = document.execCommand("copy");
  textArea.remove();
  if (!copied) throw new Error("Copy command was rejected.");
}

for (const button of document.querySelectorAll("[data-copy]")) {
  button.addEventListener("click", async () => {
    const label = button.querySelector("span");
    try {
      await copyText(button.dataset.copy ?? "");
      button.classList.add("copied");
      if (label) label.textContent = "Copied";
      if (status) status.textContent = "Copied to clipboard.";
      window.setTimeout(() => {
        button.classList.remove("copied");
        if (label) label.textContent = "Copy";
      }, 1800);
    } catch {
      if (status) status.textContent = "Copy failed. Select and copy the text.";
    }
  });
}
