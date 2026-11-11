(() => {
  "use strict";

  function element(tag, className, ...children) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    node.append(...children);
    return node;
  }

  function stack(...children) {
    return element("div", "scene-stack", ...children);
  }

  function grid(...children) {
    return element("div", "scene-grid", ...children);
  }

  function strip(text, tone = "neutral", emphasized = false) {
    return element(
      "p",
      `scene-strip tone-${tone}${emphasized ? " is-emphasized" : ""}`,
      text,
    );
  }

  function callout(text, tone = "yellow", emphasized = false) {
    return element(
      "p",
      `scene-callout tone-${tone}${emphasized ? " is-emphasized" : ""}`,
      text,
    );
  }

  function card(tone, ...children) {
    return element("div", `scene-card tone-${tone}`, ...children);
  }

  function cardTitle(text) {
    return element("h3", "scene-heading", text);
  }

  function topic(line, tone = "neutral", emphasized = false) {
    const [title, body] = line.split(" | ");
    const result = card(tone, cardTitle(title), element("p", "", body));
    if (emphasized) result.classList.add("is-emphasized");
    return result;
  }

  function comparison(text, emphasized = false) {
    return strip(text, "neutral", emphasized);
  }

  function record(rows) {
    const result = element("dl", "scene-stack scene-record");
    for (const [text, tone = "neutral", extraClass = ""] of rows) {
      const [label, ...values] = text.split(" | ");
      const entry = element(
        "div",
        `scene-row scene-pair tone-${tone} ${extraClass}`.trim(),
        element("dt", "scene-label", label),
      );
      for (const value of values) {
        entry.append(element("dd", "scene-value", value));
      }
      result.append(entry);
    }
    return result;
  }

  function list(lines, className = "") {
    return element(
      "ul",
      `scene-list ${className}`.trim(),
      ...lines.map((text) => element("li", "", text)),
    );
  }

  function path(
    text,
    { direction = "vertical", tones = [], emphasized = -1, connector = "→" } = {},
  ) {
    const nodes = Array.isArray(text) ? text : text.split(` ${connector} `);
    const result = element("ol", `scene-path scene-path--${direction}`);
    for (const [index, label] of nodes.entries()) {
      const node = element(
        "li",
        `scene-node tone-${tones[index] || "neutral"}`,
        element("span", "scene-node-text", label),
      );
      if (index === emphasized) node.classList.add("is-emphasized");
      if (index + 1 < nodes.length) {
        const arrow = element("span", "scene-connector", connector);
        if (connector === "→") arrow.setAttribute("aria-hidden", "true");
        node.append(arrow);
      }
      result.append(node);
    }
    return result;
  }

  function questions(...lines) {
    return list(lines, "scene-list--outlined");
  }

  function prompt(text) {
    return element("p", "scene-callout scene-prompt tone-yellow is-emphasized", text);
  }

  function heading(text) {
    return element("h2", "scene-title", text);
  }

  function numberedCard(tone, title, ...lines) {
    return card(
      tone,
      heading(title),
      ...lines.map((line) => element("p", "scene-task-line", line)),
    );
  }

  function inventory(line) {
    const [terms, total] = line(2).split(" = ");
    const [scripts, decks, videos] = terms.split(" + ");
    return [
      heading(line(1)),
      element(
        "div",
        "scene-inventory",
        element(
          "p",
          "scene-inventory-equation scene-equation",
          element("span", "scene-inventory-scripts", scripts),
          element("span", "scene-inventory-plus", " + "),
          element("span", "scene-inventory-decks", decks),
          element("span", "scene-inventory-plus", " + "),
          element("span", "scene-inventory-videos", videos),
          element("span", "scene-inventory-total", ` = ${total}`),
        ),
        element("p", "scene-inventory-deck-note", line(3)),
        element("p", "scene-inventory-video-note", line(4)),
      ),
      strip(line(5)),
    ];
  }

  function equationTable(caption, lines, emphasizedIndex = -1) {
    const table = element("table", "scene-table scene-equation-table");
    if (caption) table.append(element("caption", "scene-title", caption));
    const body = element("tbody", "");
    for (const [index, line] of lines.entries()) {
      const [label, value] = line.split(" | ");
      const header = element("th", "scene-label", label);
      header.scope = "row";
      body.append(element(
        "tr",
        index === emphasizedIndex ? "is-emphasized" : "",
        header,
        element("td", "scene-equation", value),
      ));
    }
    table.append(body);
    return table;
  }

  function reconciliation(line, state) {
    const { columns, rows } = state.table;
    const table = element("table", "scene-table scene-desktop-table");
    table.append(element("caption", "scene-title", line(1)));
    const headerCells = columns.map((label, index) => {
      const header = element("th", index === 1 ? "scene-expected tone-sky" : "", label);
      header.scope = "col";
      return header;
    });
    table.append(element("thead", "", element("tr", "", ...headerCells)));

    const desktopRows = element("tbody", "");
    const mobileCards = element("div", "scene-mobile-cards");
    mobileCards.append(heading(line(1)));
    for (const [index, [category, expected, application, exported]] of rows.entries()) {
      const totalClass = index === rows.length - 1 ? "scene-table-total" : "";
      const rowHeading = element("th", "", category);
      rowHeading.scope = "row";
      desktopRows.append(element(
        "tr",
        totalClass,
        rowHeading,
        element("td", "scene-value scene-expected tone-sky", expected),
        element("td", "scene-status", application),
        element("td", "scene-status", exported),
      ));
      const mobileCard = card(
        "neutral",
        cardTitle(category),
        record([
          [`${columns[1]} | ${expected}`, "sky", "scene-expected"],
          [`${columns[2]} | ${application}`],
          [`${columns[3]} | ${exported}`],
        ]),
      );
      if (totalClass) mobileCard.classList.add(totalClass);
      mobileCards.append(mobileCard);
    }
    table.append(desktopRows);
    return [table, mobileCards, strip(line(7))];
  }

  const renderers = {
    "course-cost-path": (line) => [
      heading(line(1)),
      card(
        "sky",
        cardTitle(line(2)),
        path(line(3), { tones: ["mint"], emphasized: 0 }),
        element("p", "scene-card-footer", line(4)),
      ),
    ],

    "evidence-boundary": (line) => [
      heading(line(1)),
      stack(strip(line(2), "sky"), strip(line(3), "yellow"), strip(line(4))),
      comparison(line(5)),
    ],

    "responsibility-cards": (line) => [
      heading(line(1)),
      stack(
        topic(line(2), "sky", true),
        topic(line(3), "mint", true),
        topic(line(4), "yellow", true),
      ),
      topic(line(5)),
    ],

    "week1-baseline": (line) => [
      heading(line(1)),
      grid(...[2, 3, 4, 5].map((index) => card("sky", element("p", "", line(index))))),
      strip(line(6)),
    ],

    "review-counts": (line) => [
      heading(line(1)),
      strip(line(2), "sky"),
      grid(topic(line(3), "mint"), topic(line(4), "yellow")),
      comparison(line(5)),
    ],

    "technical-evidence-status": (line) => [
      heading(line(1)),
      stack(strip(line(2)), strip(line(3))),
      stack(comparison(line(4)), comparison(line(5))),
    ],

    "baseline-guardrails": (line) => [
      heading(line(1)),
      stack(strip(line(2), "sky"), strip(line(3), "yellow"), strip(line(4))),
      comparison(line(5)),
    ],

    "review-topic-cards": (line) => [
      heading(line(1)),
      stack(topic(line(2), "sky", true), topic(line(3), "mint", true)),
      strip(line(4)),
    ],

    "allocation-comparisons": (line) => [
      heading(line(1)),
      stack(comparison(line(2)), comparison(line(3)), comparison(line(4))),
      callout(line(5)),
    ],

    "hosting-evidence-discussion": (line) => [
      heading(line(1)),
      prompt(line(2)),
      stack(element("p", "", line(3)), element("p", "", line(4))),
    ],

    "cost-records-workflow": (line) => [
      heading(line(1)),
      element(
        "div",
        "scene-flow-with-note",
        path(line(2), { emphasized: 1 }),
        callout(line(3), "sky"),
      ),
      comparison(line(4)),
    ],

    "test-prerequisites": (line) => [
      heading(line(1)),
      questions(...[2, 3, 4, 5, 6].map(line)),
    ],

    "two-work-paths": (line) => [
      heading(line(1)),
      stack(topic(line(2), "sky"), topic(line(3), "yellow")),
      stack(strip(line(4)), strip(line(5))),
    ],

    "course-identifiers": (line) => [
      heading(line(1)),
      record([[line(2), "sky", "scene-identifier"], [line(3), "sky", "scene-identifier"]]),
      stack(strip(line(4)), strip(line(5))),
    ],

    "output-inventory": inventory,

    "cost-boundary": (line) => [
      heading(line(1)),
      stack(topic(line(2), "mint"), topic(line(3))),
      stack(strip(line(4)), comparison(line(5))),
    ],

    "traceability-questions": (line) => [
      heading(line(1)),
      questions(...[2, 3, 4, 5, 6, 7].map(line)),
    ],

    "synthetic-p01-record": (line) => [
      heading(line(1)),
      record([
        [line(2), "neutral", "scene-identifier"],
        [line(3), "neutral", "scene-identifier"],
        [line(4), "sky"],
        [line(5), "sky", "is-emphasized"],
        [line(6)],
        [line(7), "mint"],
      ]),
    ],

    "unknown-metadata": (line) => [
      heading(line(1)),
      record([[line(2)], [line(3)], [line(4)], [line(5)], [line(6), "sky"]]),
    ],

    "labor-equations": (line) => [
      equationTable(line(1), [2, 3, 4, 5, 6].map(line), 0),
      record([[line(7), "mint", "scene-total"]]),
      comparison(line(8)),
    ],

    "provider-equations": (line) => {
      const title = heading(line(1));
      title.id = "provider-equations-heading";
      const table = equationTable(null, [3, 4, 5, 6].map(line), 0);
      table.setAttribute("aria-labelledby", title.id);
      return [
        title,
        element("p", "scene-strip scene-equation tone-sky", line(2)),
        table,
        record([[line(7), "mint", "scene-total"]]),
        strip(line(8)),
      ];
    },

    "hosting-allocation": (line) => [
      heading(line(1)),
      grid(topic(line(2), "sky"), topic(line(3), "sky")),
      record([[line(4), "mint", "scene-total"]]),
      card("yellow", element("p", "", line(5)), element("p", "", line(6))),
    ],

    "baseline-total": (line) => [
      heading(line(1)),
      record([[line(2)], [line(3)], [line(4)], [line(5), "mint", "scene-total"]]),
      strip(line(6)),
      record([[line(7)]]),
    ],

    "preview-check": (line) => [
      heading(line(1)),
      path([2, 3, 4, 5].map(line), { tones: ["sky", "neutral", "neutral", "sky"], emphasized: 3 }),
      callout(line(6)),
    ],

    "mixed-file-review": (line) => [
      heading(line(1)),
      grid(topic(line(2), "sky"), topic(line(3))),
      topic(line(4), "yellow"),
      comparison(line(5)),
    ],

    "posting-trace": (line) => [
      heading(line(1)),
      path(line(2), { direction: "horizontal" }),
      path(line(3), { direction: "horizontal", connector: "↔", tones: ["sky", "sky", "sky"] }),
      record([[line(4)], [line(5), "yellow"]]),
    ],

    "missing-rate": (line) => [
      heading(line(1)),
      record([[line(2)], [line(3), "yellow"], [line(4), "yellow", "scene-total"]]),
      comparison(line(5).replace(" | ", " ")),
      stack(strip(line(6)), strip(line(7))),
    ],

    "invalid-inputs": (line) => [
      heading(line(1)),
      stack(topic(line(2)), topic(line(3), "yellow")),
      strip(line(4)),
      record([[line(5), "yellow"]]),
    ],

    "zero-quantity-discussion": (line) => [
      heading(line(1)),
      card("yellow", element("p", "", line(2)), element("p", "scene-equation", line(3))),
      stack(comparison(line(4)), comparison(line(5))),
      prompt(line(6)),
    ],

    "duplicate-expectation": (line) => {
      const stopped = topic(line(4), "neutral", true);
      stopped.classList.add("scene-stop");
      const branches = grid(topic(line(3)), stopped);
      branches.classList.add("scene-branch");
      return [
        heading(line(1)),
        strip(line(2), "sky"),
        branches,
        strip(line(5)),
        record([[line(6)]]),
      ];
    },

    "expense-identity": (line) => [
      heading(line(1)),
      stack(comparison(line(2)), comparison(line(3))),
      record([[line(4), "yellow"], [line(5)]]),
    ],

    "r1-usage": (line) => [
      heading(line(1)),
      record([[line(2)], [line(3)], [line(4), "sky"], [line(5), "sky"]]),
      record([[line(6)]]),
    ],

    "r1-cost-comparison": (line) => [
      heading(line(1)),
      stack(
        grid(topic(line(2)), topic(line(3), "sky")),
        grid(topic(line(4)), topic(line(5), "sky")),
      ),
      stack(strip(line(6)), strip(line(7))),
    ],

    "reconciliation-path": (line) => [
      heading(line(1)),
      path(line(2), { direction: "horizontal", tones: ["sky", "sky"] }),
      stack(strip(line(3)), callout(line(4))),
    ],

    "expectations-table": reconciliation,

    "difference-investigation": (line) => [
      heading(line(1)),
      record([[line(2), "sky"], [line(3)]]),
      strip(line(4)),
      comparison(line(5), true),
    ],

    "export-evidence": (line) => [
      heading(line(1)),
      card("neutral", questions(...[2, 3, 4, 5, 6].map(line))),
      callout(line(7)),
    ],

    "replay-basis": (line) => [
      heading(line(1)),
      card("sky", element("p", "scene-equation", line(2)), element("p", "scene-equation", line(3))),
      strip(line(4), "yellow", true),
      strip(line(5)),
    ],

    "financial-vs-diagnostic": (line) => [
      heading(line(1)),
      grid(topic(line(2), "mint"), topic(line(3), "sky")),
      stack(comparison(line(4)), comparison(line(5))),
      strip(line(6)),
    ],

    "oscar-handoff": (line) => [
      numberedCard("sky", ...[1, 2, 3, 4].map(line)),
      callout(line(5), "yellow", true),
    ],

    "shania-return": (line) => [
      numberedCard("mint", ...[1, 2, 3, 4].map(line)),
      callout(line(5)),
    ],

    "kailun-return": (line) => [
      numberedCard("yellow", ...[1, 2, 3, 4].map(line)),
      strip(line(5)),
      callout(line(6)),
    ],

    "proposed-returns": (line) => [
      heading(line(1)),
      stack(topic(line(2), "mint"), topic(line(3), "yellow")),
      record([[line(4)], [line(5), "yellow"]]),
      strip(line(6)),
    ],

    "finding-fields": (line) => [
      heading(line(1)),
      card("sky", questions(...[2, 3, 4, 5, 6].map(line))),
      record([[line(7), "yellow"]]),
    ],

    "finding-classification": (line) => [
      heading(line(1)),
      record([2, 3, 4, 5].map((index) => [line(index)])),
      stack(strip(line(6)), strip(line(7))),
    ],

    "correction-rechecks": (line) => [
      heading(line(1)),
      path(line(2), { direction: "horizontal" }),
      strip(line(3), "sky", true),
      stack(strip(line(4)), strip(line(5))),
      comparison(line(6)),
    ],

    "completion-definitions": (line) => [
      heading(line(1)),
      stack(
        card("neutral", cardTitle(line(2)), element("p", "", line(3))),
        card("sky", cardTitle(line(4)), element("p", "", line(5))),
      ),
      record([[line(6), "yellow"]]),
    ],

    "next-topic-boundaries": (line) => [
      heading(line(1)),
      stack(strip(line(2)), strip(line(3))),
      stack(comparison(line(4)), comparison(line(5))),
    ],

    "closing-discussion": (line) => [
      heading(line(1)),
      prompt(line(2)),
      element("p", "", line(3)),
      questions(...[4, 5, 6].map(line)),
      callout(line(7)),
    ],
  };

  window.renderScene = function renderScene(state) {
    if (!Object.hasOwn(renderers, state.scene)) {
      throw new Error(`No visual scene registered for ${state.id}.`);
    }
    const line = (number) => state.lines[number - 1];
    const scene = element("section", "scene", ...renderers[state.scene](line, state));
    scene.dataset.state = state.id;
    scene.dataset.motion = state.motion.toLowerCase();
    return scene;
  };
})();
