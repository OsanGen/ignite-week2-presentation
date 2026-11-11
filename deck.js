(() => {
  "use strict";

  const get = (id) => document.getElementById(id);
  const fallback = get("fallback");
  const deck = get("deck");
  const reading = get("reading");

  try {
    initialize();
  } catch (error) {
    deck.hidden = true;
    reading.hidden = true;
    fallback.hidden = false;
    console.error("Presentation initialization failed", error);
  }

  function initialize() {
    const { slides, wording, auxiliary } = JSON.parse(get("deck-data").textContent);
    const states = slides.flatMap((slide) => slide.states);
    if (slides.length !== 15 || states.length !== 49 || new Set(states.map(({ id }) => id)).size !== 49) {
      throw new Error("Invalid presentation content");
    }

    const statePositions = new Map();
    const visualScenes = states.map((state, index) => {
      const slide = slides[state.slide - 1];
      if (slide?.states[state.part - 1] !== state || state.partCount !== slide.states.length ||
          !state.reading.length || !state.lines.length || !get(state.id)) {
        throw new Error("Invalid reading state");
      }
      statePositions.set(`${state.slide}:${state.part}`, index);
      const scene = window.renderScene(state);
      if (!(scene instanceof HTMLElement)) throw new Error("Invalid visual scene");
      return scene;
    });

    const stage = get("stage");
    const stageBody = get("stage-body");
    const selector = get("selector");
    const motionButton = get("motion");
    const fullscreenButton = get("fullscreen");
    const backButton = get("back");
    const nextButton = get("next");
    const status = get("position-status");
    const notice = get("deck-notice");
    const motionExplanation = get("motion-explanation");

    let position = -1;
    let observedURL;
    let opener;
    let selected = false;

    const motionKey = "ignite-week2.motion";
    const motionQuery = typeof matchMedia === "function"
      ? matchMedia("(prefers-reduced-motion: reduce)")
      : null;
    let motionWanted = false;
    let motionStorage;
    try {
      motionStorage = window.sessionStorage;
      motionWanted = motionStorage.getItem(motionKey) !== "off";
    } catch {
      motionStorage = undefined;
    }

    get("stage-keys").textContent = auxiliary["Stage keyboard description"];
    motionExplanation.textContent = auxiliary["Reduced-motion explanation"];

    const selectorButtons = slides.map((slide, index) => {
      const option = document.createElement("button");
      option.className = "selector-option";
      option.type = "button";
      option.append(
        createText("span", "selector-number", twoDigits(index + 1)),
        createText("span", "selector-title", slide.title),
      );
      option.addEventListener("click", () => {
        selected = true;
        selector.close();
        navigate(statePositions.get(`${index + 1}:1`));
        stage.focus({ preventScroll: true });
      });
      const row = document.createElement("li");
      row.append(option);
      get("selector-list").append(row);
      return option;
    });
    const journey = slides.map(() => {
      const segment = document.createElement("span");
      segment.className = "journey-segment";
      get("journey").append(segment);
      return segment;
    });

    function createText(tag, className, value) {
      const node = document.createElement(tag);
      if (className) node.className = className;
      node.textContent = value;
      return node;
    }

    function twoDigits(number) {
      return String(number).padStart(2, "0");
    }

    function route(state) {
      return `#slide=${state.slide}&step=${state.part}`;
    }

    function parsePosition(hash) {
      const first = { index: 0, invalid: false };
      if (!hash) return first;
      const invalid = { index: 0, invalid: true };
      if (hash.length > 128) return invalid;

      const fields = new URLSearchParams(hash.slice(1));
      const slide = fields.getAll("slide");
      const step = fields.getAll("step");
      if (!slide.length && !step.length) return first;
      const isPositiveInteger = (value) => /^[0-9]+$/.test(value) && Number(value) > 0;
      if (slide.length !== 1 || step.length > 1 || !isPositiveInteger(slide[0]) ||
          (step.length === 1 && !isPositiveInteger(step[0]))) return invalid;

      const index = statePositions.get(`${Number(slide[0])}:${Number(step[0] ?? 1)}`);
      return index === undefined ? invalid : { index, invalid: false };
    }

    function showNotice(message = "") {
      notice.textContent = message;
      notice.hidden = !message;
    }

    function updateMotion() {
      const reduced = motionQuery?.matches;
      const effective = Boolean(motionQuery && !reduced && motionWanted);
      motionButton.setAttribute("aria-pressed", String(effective));
      motionButton.querySelector(".motion-state").textContent = effective ? "on" : "off";
      motionExplanation.hidden = !reduced;
      if (reduced) {
        motionButton.setAttribute("aria-describedby", motionExplanation.id);
        motionButton.title = motionExplanation.textContent;
      } else {
        motionButton.removeAttribute("aria-describedby");
        motionButton.removeAttribute("title");
      }
      if (!effective) stageBody.removeAttribute("data-motion");
      return effective;
    }

    function toggleMotion() {
      motionWanted = !motionWanted;
      try {
        motionStorage?.setItem(motionKey, motionWanted ? "on" : "off");
      } catch {
        // Keep the in-memory preference when storage is read-only.
      }
      updateMotion();
    }

    function updateFullscreen() {
      const active = Boolean(document.fullscreenElement);
      fullscreenButton.hidden = !document.fullscreenEnabled || !document.documentElement.requestFullscreen;
      fullscreenButton.setAttribute("aria-label", auxiliary[active
        ? "Fullscreen exit accessible name"
        : "Fullscreen enter accessible name"]);
      fullscreenButton.setAttribute("aria-pressed", String(active));
    }

    async function toggleFullscreen() {
      try {
        if (document.fullscreenElement) {
          await document.exitFullscreen();
        } else if (document.fullscreenEnabled && document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        } else {
          throw new Error("Fullscreen is unavailable");
        }
      } catch {
        showNotice(auxiliary["Fullscreen failure notice"]);
      }
      updateFullscreen();
    }

    function setAddress(state, method) {
      const hash = route(state);
      if (location.hash === hash) return;
      try {
        history[method](null, "", hash);
      } catch {
        if (method === "replaceState") location.replace(hash);
        else location.hash = hash;
      }
    }

    function render(index, { animate = false } = {}) {
      if (index === position) return;
      position = index;
      const state = states[index];
      const slide = slides[state.slide - 1];
      const focused = document.activeElement;

      get("slide-section").textContent = slide.section;
      get("slide-title").textContent = slide.title;
      stage.dataset.state = state.id;
      stageBody.dataset.layout = state.layout;
      stageBody.dataset.discussion = String(state.discussion);

      const narration = state.reading.map((paragraph) => createText("p", "", paragraph));
      if (state.discussion) {
        const label = createText("p", "discussion", wording["Discussion label"]);
        narration.unshift(label);
      }
      get("narration").replaceChildren(...narration);
      stageBody.removeAttribute("data-motion");
      get("visual").replaceChildren(visualScenes[index]);
      if (animate && updateMotion()) stageBody.dataset.motion = state.motion;

      const slideNumber = get("slide-number");
      slideNumber.textContent = `${twoDigits(state.slide)} / ${slides.length}`;
      slideNumber.setAttribute("aria-label", `${wording["Slide selector button"]}. Slide ${state.slide} of ${slides.length}.`);
      get("part-label").textContent = `Part ${state.part} of ${state.partCount}`;
      get("part-marks").replaceChildren(...Array.from({ length: state.partCount }, (_, part) => {
        const mark = document.createElement("span");
        mark.className = "part-mark";
        mark.setAttribute("aria-current", String(part === state.part - 1));
        return mark;
      }));
      journey.forEach((segment, slideIndex) => {
        segment.setAttribute("aria-current", String(slideIndex === state.slide - 1));
        segment.dataset.visited = String(slideIndex < state.slide - 1);
      });
      selectorButtons.forEach((button, slideIndex) => {
        button.setAttribute("aria-current", String(slideIndex === state.slide - 1));
      });

      backButton.disabled = index === 0;
      nextButton.textContent = state.control;
      nextButton.disabled = state.controlDisabled;
      if ((focused === backButton && backButton.disabled) || (focused === nextButton && nextButton.disabled)) {
        stage.focus({ preventScroll: true });
      }

      const linear = new URL(location.href);
      linear.searchParams.set("view", "linear");
      linear.hash = route(state);
      get("read-all").href = linear.href;

      const interactive = new URL(location.href);
      interactive.searchParams.delete("view");
      interactive.hash = route(state);
      get("return-to-deck").href = interactive.href;
      get("standalone-transcript").href = `transcript.html#${state.id}`;
      get("fallback-transcript").href = `transcript.html#${state.id}`;

      status.textContent = auxiliary["Position announcement"]
        .replace("{slide}", state.slide).replace("{part}", state.part).replace("{parts}", state.partCount);
    }

    function restore() {
      if (observedURL === location.href) return;
      const { index, invalid } = parsePosition(location.hash);
      setAddress(states[index], "replaceState");
      observedURL = location.href;
      const isLinear = new URL(location.href).searchParams.get("view") === "linear";
      deck.hidden = isLinear;
      reading.hidden = !isLinear;
      if (isLinear) get("reading-content").before(notice);
      else stageBody.before(notice);
      render(index);
      showNotice(invalid ? auxiliary["Invalid-position notice"] : "");
      fallback.hidden = true;
    }

    function navigate(index) {
      if (index < 0 || index >= states.length || index === position) return;
      render(index, { animate: true });
      setAddress(states[index], "pushState");
      observedURL = location.href;
      showNotice();
      if (window.scrollY > 0) window.scrollTo(0, 0);
    }

    function openSelector(from) {
      if (selector.open) return;
      opener = from;
      selected = false;
      selector.showModal();
      const current = selectorButtons[states[position].slide - 1];
      current.focus({ preventScroll: true });
      current.scrollIntoView({ block: "nearest" });
    }

    selector.addEventListener("close", () => {
      if (!selected) opener?.focus({ preventScroll: true });
      opener = undefined;
    });
    get("close-selector").addEventListener("click", () => selector.close());
    for (const button of [get("open-selector"), get("slide-number")]) {
      button.addEventListener("click", () => openSelector(button));
    }

    const shortcuts = new Map([
      ["ArrowRight", () => navigate(position + 1)],
      ["PageDown", () => navigate(position + 1)],
      [" ", () => navigate(position + 1)],
      ["ArrowLeft", () => navigate(position - 1)],
      ["PageUp", () => navigate(position - 1)],
      ["Home", () => navigate(0)],
      ["End", () => navigate(states.length - 1)],
      ["g", () => openSelector(stage)],
      ["m", toggleMotion],
      ["f", toggleFullscreen],
    ]);

    stage.addEventListener("keydown", (event) => {
      if (event.target !== stage || selector.open || event.defaultPrevented || event.repeat ||
          event.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey ||
          !window.getSelection()?.isCollapsed) return;

      const action = shortcuts.get(event.key);
      if (action) {
        event.preventDefault();
        action();
      }
    });

    backButton.addEventListener("click", () => navigate(position - 1));
    nextButton.addEventListener("click", () => navigate(position + 1));
    motionButton.addEventListener("click", toggleMotion);
    fullscreenButton.addEventListener("click", toggleFullscreen);
    get("print-reading").addEventListener("click", () => window.print());
    motionQuery?.addEventListener("change", updateMotion);
    document.addEventListener("fullscreenchange", updateFullscreen);
    window.addEventListener("popstate", restore);
    window.addEventListener("hashchange", restore);
    updateMotion();
    updateFullscreen();
    restore();
  }
})();
