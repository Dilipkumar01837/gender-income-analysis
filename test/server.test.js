const test = require("node:test");
const assert = require("node:assert");
const http = require("node:http");
const { createServer } = require("../server.js");

function get(port, path) {
  return new Promise((resolve, reject) => {
    http.get({ port, path, host: "127.0.0.1" }, (res) => {
      let body = ""; res.on("data", (c) => (body += c));
      res.on("end", () => resolve({ status: res.statusCode, type: res.headers["content-type"], body }));
    }).on("error", reject);
  });
}

test("server serves the page, data and blocks path traversal", async () => {
  const server = createServer();
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  try {
    const home = await get(port, "/");
    assert.equal(home.status, 200); assert.match(home.body, /Fair Pay Playground/);
    const data = await get(port, "/data/results.json");
    assert.equal(data.status, 200); assert.match(data.type, /json/);
    assert.ok(JSON.parse(data.body).raw);
    assert.equal((await get(port, "/nope.html")).status, 404);
    assert.notEqual((await get(port, "/..%2fserver.js")).status, 200);
    assert.notEqual((await get(port, "/%2e%2e/server.js")).status, 200);
  } finally { server.close(); }
});
