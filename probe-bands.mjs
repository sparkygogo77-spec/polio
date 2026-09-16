import { chromium } from "playwright-core";
const U = process.argv[2], TAG = process.argv[3];
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const p = await b.newContext({ viewport: { width: 1800, height: 1000 } }).then((c) => c.newPage());
await p.goto(`${U}/builder`, { waitUntil: "networkidle" });
await p.waitForTimeout(2200);
await p.locator("[data-finish]").click();
await p.waitForTimeout(3000);
const bandInfo = () => p.evaluate(() => [...document.querySelectorAll("[data-lane-box]")].map((e) => {
  const line = e.querySelector("[data-lane-band-line]");
  const s = line ? getComputedStyle(line) : null;
  return { band: e.getAttribute("data-lane-band"),
    lineColour: s ? (s.backgroundColor !== "rgba(0, 0, 0, 0)" ? s.backgroundColor : s.borderTopColor) : null,
    lineBg: s?.backgroundColor, lineBorder: s?.borderTopColor };
}));
console.log(`=== ${TAG} : cost band indicator ===`);
console.log(JSON.stringify(await bandInfo(), null, 1));
// Take control -> blue box, then read its body line ground.
const takes = await p.locator("[data-lane-take]:not([disabled])").all();
if (takes.length) {
  await takes[0].click();
  await p.waitForTimeout(3500);
  const blue = await p.evaluate(() => {
    const boxes = [...document.querySelectorAll("[data-box]")];
    const pick = (hue) => boxes.find((e) => getComputedStyle(e).getPropertyValue("--box-hue").trim() === hue);
    const read = (e) => {
      if (!e) return null;
      const body = e.querySelector("p,pre,[data-lane-detail]") ?? e;
      const s = getComputedStyle(body);
      let on = null;
      for (let n = body; n && n !== document.body; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (cs.backgroundColor !== "rgba(0, 0, 0, 0)") { on = cs.backgroundColor; break; }
      }
      return { size: s.fontSize, colour: s.color, sitsOn: on };
    };
    return { blue: read(pick("210")), green: read(pick("152")), hues: boxes.map((e) => getComputedStyle(e).getPropertyValue("--box-hue").trim()) };
  });
  console.log(`=== ${TAG} : body line inside the boxes ===`);
  console.log(JSON.stringify(blue, null, 1));
}
await b.close();
