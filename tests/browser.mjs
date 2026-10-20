import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { build } from "esbuild";
import puppeteer from "puppeteer-core";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = resolve(root, ".test-build");
const mocks = {
    "@api/DataStore": null,
    "@api/ServerList": null,
    "@webpack/common": null,
    "@webpack": null,
    "@utils/clipboard": null,
    "@utils/Logger": null,
    "@utils/types": "definePlugin",
    "@components/ErrorBoundary": "ErrorBoundary"
};
await mkdir(output, { recursive: true });
await build({
    absWorkingDir: root,
    entryPoints: ["tests/harness.tsx"], outfile: resolve(output, "app.js"),
    bundle: true, format: "iife", jsx: "automatic",
    plugins: [{
        name: "vencord-test-api",
        setup(builder) {
            builder.onResolve({ filter: /^@/ }, args => Object.hasOwn(mocks, args.path) ? { path: args.path, namespace: "mock" } : undefined);
            builder.onLoad({ filter: /.*/, namespace: "mock" }, args => ({
                contents: mocks[args.path] ? `export { ${mocks[args.path]} as default } from "./mocks.tsx";` : "export * from './mocks.tsx';",
                resolveDir: resolve(root, "tests")
            }));
            builder.onResolve({ filter: /\?managed$/ }, () => ({ path: "style", namespace: "managed" }));
            builder.onLoad({ filter: /.*/, namespace: "managed" }, () => ({ contents: 'export default "server-bubbles-style";' }));
        }
    }]
});

const server = createServer(async (request, response) => {
    if (request.url === "/") {
        response.setHeader("Content-Type", "text/html");
        response.end('<!doctype html><html lang="en"><meta charset="utf-8"><link rel="stylesheet" href="/app.css"><style>body{margin:0;background:#131b24;color:#dce8ee;font-family:sans-serif}.test-modal{position:fixed;inset:12px;background:#172027;padding:12px;overflow:auto}.test-modal>h1{font-size:16px}#settings{padding:30px}</style><div id="app-mount"></div><script src="/app.js"></script></html>');
        return;
    }
    if (!["/app.js", "/app.css"].includes(request.url)) { response.writeHead(404).end(); return; }
    response.setHeader("Content-Type", request.url.endsWith("css") ? "text/css" : "application/javascript");
    response.end(await readFile(resolve(output, request.url.slice(1))));
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const browser = await puppeteer.launch({ executablePath: process.env.BROWSER_PATH || "/usr/bin/chromium", headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
let page;
try {
    page = await browser.newPage();
    const errors = [];
    page.on("pageerror", error => { errors.push(String(error)); console.error("Browser error:", error.message); });
    page.setDefaultTimeout(10000);
    await page.setViewport({ width: 1280, height: 850, deviceScaleFactor: 1 });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.waitForSelector("#sb-launcher");
    await page.evaluate(() => { window.clicks = []; for (const type of ["pointerdown", "click"]) document.addEventListener(type, event => clicks.push([type, event.target.tagName, event.target.className?.baseVal ?? event.target.className, event.clientX, event.clientY]), true); });
    await page.click("#sb-launcher");
    await page.waitForSelector(".sb-server-open");
    assert.equal(await page.$$eval(".sb-server-open", elements => elements.length), 12);
    await mkdir(resolve(root, "test-results"), { recursive: true });
    await (await page.$("#sb-overlay")).screenshot({ path: resolve(root, "test-results/bubbles.png") });

    await page.click('[aria-label="Find a server"]');
    await page.type('input[type="search"]', "cafe");
    await page.waitForFunction(() => document.querySelectorAll(".sb-server-open").length === 1);
    assert.match(await page.$eval(".sb-server-name", element => element.textContent), /Café/);
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => document.querySelectorAll(".sb-server-open").length === 12);
    await page.click('.sb-pin[aria-label="Favorite Café Coders"]');
    await page.evaluate(() => [...document.querySelectorAll(".sb-vencord-filters button")].find(button => button.textContent === "Favorites").click());
    await page.waitForFunction(() => document.querySelectorAll(".sb-server-open").length === 1);
    await page.click(".sb-server-open");
    await page.waitForFunction(() => !document.getElementById("sb-overlay"));
    assert.equal(await page.evaluate(() => testRuntime.routes.at(-1)), "/channels/101/777");

    await page.click("#settings .sb-settings-button");
    await page.waitForSelector(".sb-studio");
    await page.select('select[aria-label="Surface"]', "solid");
    assert.equal(await page.evaluate(() => testRuntime.preferences().material), "solid");
    await page.evaluate(() => [...document.querySelectorAll('[role="tab"]')].find(tab => tab.textContent === "Share").click());
    const look = JSON.parse(await page.$eval('textarea[aria-label="Your shareable look"]', element => element.value));
    assert.equal(Object.hasOwn(look.settings, "favorites"), false);
    await page.evaluate(() => [...document.querySelectorAll('[role="tab"]')].find(tab => tab.textContent === "Controls").click());
    await page.click('input[aria-label="Hide the regular server list"]');
    assert.equal(await page.$eval(".test-guilds", element => getComputedStyle(element).display), "none");
    await page.evaluate(() => plugin.stop());
    await page.waitForFunction(() => !document.querySelector("#sb-launcher, .sb-studio, #sb-overlay"));
    assert.notEqual(await page.$eval(".test-guilds", element => getComputedStyle(element).display), "none");
    await page.keyboard.down("Control"); await page.keyboard.down("Shift"); await page.keyboard.press("Space"); await page.keyboard.up("Shift"); await page.keyboard.up("Control");
    assert.equal(await page.$("#sb-overlay"), null);
    await page.evaluate(() => plugin.start());
    await page.waitForSelector("#sb-launcher");
    assert.equal(await page.evaluate(() => testRuntime.preferences().material), "solid");
    assert.deepEqual(await page.evaluate(() => testRuntime.preferences().favorites), ["101"]);
    await page.click("#settings .sb-settings-button");
    await page.waitForSelector(".sb-studio");
    await (await page.$(".sb-studio")).screenshot({ path: resolve(root, "test-results/studio.png") });

    await page.evaluate(() => { plugin.stop(); testRuntime.holdReads = true; plugin.start(); });
    await page.waitForFunction(() => testRuntime.pendingReads.length === 1);
    await page.evaluate(() => { plugin.stop(); testRuntime.releaseReads(); });
    await page.waitForFunction(() => !document.getElementById("sb-launcher"));
    assert.equal(await page.evaluate(() => testRuntime.preferences().material), "solid");

    await page.evaluate(() => { testRuntime.failRead = true; plugin.start(); });
    await page.waitForFunction(() => testRuntime.toasts.length === 1);
    assert.equal(await page.$("#sb-launcher"), null);
    assert.equal(await page.evaluate(() => testRuntime.writes.at(-1).material), "solid");
    await page.evaluate(() => { plugin.stop(); testRuntime.failRead = false; plugin.start(); });
    await page.waitForSelector("#sb-launcher");
    await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
    await page.click("#sb-launcher");
    await page.waitForSelector('.sb-vencord-stage[data-reduced="true"]');
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
    await page.waitForFunction(() => {
        const stage = document.querySelector(".sb-vencord-stage").getBoundingClientRect();
        return [...document.querySelectorAll(".sb-server-open")].every(element => {
            const rect = element.getBoundingClientRect();
            return rect.left >= stage.left - 2 && rect.right <= stage.right + 2 && rect.top >= stage.top - 2 && rect.bottom <= stage.bottom + 2;
        });
    });
    await (await page.$("#sb-overlay")).screenshot({ path: resolve(root, "test-results/mobile.png") });
    assert.deepEqual(errors, []);
    assert.equal(await page.evaluate(() => testRuntime.errors.length), 1); // the deliberate storage failure
    console.log("Browser checks passed: search, favorites, navigation, customization, privacy, persistence, stop/start races, failed storage, reduced motion, narrow layout.");
} catch (error) {
    await page?.screenshot({ path: resolve(root, "test-results/failure.png") });
    console.error(await page?.evaluate(() => ({ errors: window.testRuntime?.errors, clicks: window.clicks?.slice(-12), routes: window.testRuntime?.routes, favorites: window.testRuntime?.preferences().favorites, html: document.body.innerHTML.slice(0, 1800) })));
    throw error;
} finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
}
