import puppeteer from "puppeteer-core";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const browser = await puppeteer.launch({
  executablePath: CHROME, headless: true,
  defaultViewport: { width: 900, height: 700 },
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--host-rules=MAP foobarbaz.xiaojin.app xiaojin.app"],
});
const page = await browser.newPage();
await page.setExtraHTTPHeaders({ "Host": "foobarbaz.xiaojin.app" });
// can't easily fake host for HTTPS, so just visit the html locally
await page.goto("file:///tmp/gate.html", { waitUntil: "domcontentloaded", timeout: 10_000 });
await new Promise(r => setTimeout(r, 500));
await page.screenshot({ path: "/tmp/xiaojin-smoke-modals/12-subdomain-gate.png" });
await browser.close();
console.log("saved");
