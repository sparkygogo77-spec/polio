siteFeatures.define("sol-price", function (el, inputs, api) {
  var change = /change/.test(inputs.show || "");
  function tick() {
    return api.json("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd&include_24hr_change=true")
      .then(function (j) {
        var p = j && j.solana;
        if (!p || !isFinite(p.usd)) throw new Error("no price");
        api.set(el, change ? api.percent(p.usd_24h_change) : api.money(p.usd, inputs.format));
      })
      .catch(function () {
        return api.json("https://lite-api.jup.ag/price/v3?ids=So11111111111111111111111111111111111111112").then(function (j) {
          var p = j && j["So11111111111111111111111111111111111111112"];
          if (!p || !isFinite(p.usdPrice)) throw new Error("no price");
          api.set(el, change ? api.percent(p.priceChange24h) : api.money(p.usdPrice, inputs.format));
        });
      })
      .catch(function () { api.stale(el); });
  }
  tick();
  return setInterval(tick, api.seconds(inputs.every, 30) * 1000);
});
