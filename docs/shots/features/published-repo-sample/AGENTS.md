# Working on this site

<!-- builder:features:start -->
## Features: how working parts are built on this site

This site was designed in a visual builder. Anything it could not make work is a task in
`TASKS.md`, under the part's stable id. Build it as a **feature**, in this shape, and the builder
can take it back into its library and reuse it on the owner's other sites.

A feature is working code with **no look of its own**. It is attached to a part, and it writes
into that part's own element, so the part keeps the style it was designed with.

Each feature lives in `features/<name>/` (the folder's name is the feature's id):

- `manifest.json` — plain data:
  - `id` (the folder name), `name`, `category` (e.g. `"data"`), `blurb`, `version`
  - `inputs`: `[{ "id", "label", "kind": "text" | "number" | "one", "default", "values"? }]`
  - `needs`: `"none"` (runs on a static page), `"wallet"`, `"backend"` or `"key"`
  - `says`: phrases the owner might type to attach it (e.g. `"sol price"`)
  - `look`: `{ "sample": "$142.37" }`, what a part carrying it shows
  - `parts`: the ids of the parts it is attached to (from `TASKS.md`)
- `script.js` — plain browser JavaScript, no framework, no imports:

  ```js
  siteFeatures.define("<name>", function (el, inputs, api) {
    // el: the part's element (document.getElementById(part id))
    // inputs: the manifest's inputs, as set on the part
    // api.json(url), api.set(el, text), api.money(n), api.percent(n), api.stale(el), api.seconds(v, d)
    function tick() {
      return api.json("https://…").then(function (j) { api.set(el, api.money(j.price)); })
        .catch(function () { api.stale(el); });
    }
    tick();
    return setInterval(tick, api.seconds(inputs.every, 30) * 1000);
  });
  ```
- `README.md` — what it does, its inputs, and what it needs.

The builder publishes `assets/features/runtime.js` (which defines `siteFeatures`), one
`assets/features/<name>.js` per feature in use, and on each page a
`<script id="site-features" type="application/json">` list of which part takes which feature.
Those files are rewritten on every publish: change a feature in `features/<name>/`, not in
`assets/`. The owner reviews every new or changed folder before the builder uses it.
<!-- builder:features:end -->
