const http = require("http");
const { spawn } = require("child_process");
const sqlite3 = require("sqlite3");

const PORT = 3000;

function resetDBSequence() {
  return new Promise((resolve) => {
    const db = new sqlite3.Database("books.db");
    db.run("DELETE FROM book WHERE id > 10;", () => {
      db.run("UPDATE sqlite_sequence SET seq = 10 WHERE name = 'book';", () => {
        db.close(resolve);
      });
    });
  });
}

async function main() {
  await resetDBSequence();

  const server = spawn("node", ["server.js"], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: ["ignore", "pipe", "pipe"]
  });

  server.stdout.on("data", async (chunk) => {
    if (chunk.toString().includes("Server running")) {
      try {
        await runAllTests();
      } catch (err) {
        console.error(err);
        process.exitCode = 1;
      } finally {
        await resetDBSequence();
        server.kill();
        process.exit();
      }
    }
  });

  server.stderr.on("data", (chunk) => {
    console.error("Server stderr:", chunk.toString());
  });
}

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: PORT,
        path,
        method,
        headers: body ? { "Content-Type": "application/json" } : {}
      },
      (res) => {
        let raw = "";
        res.on("data", (c) => (raw += c));
        res.on("end", () => resolve({ status: res.statusCode, body: raw }));
      }
    );
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runAllTests() {
  let createdBookId = 11;
  const tests = [
    { id: 1, name: "GET all (defaults)", method: "GET", getPath: () => "/books/", exp: 200 },
    { id: 2, name: "GET search + sort + limit", method: "GET", getPath: () => "/books/?search_q=the&order_by=price&order=desc&limit=3", exp: 200 },
    { id: 3, name: "GET price range", method: "GET", getPath: () => "/books/?min_price=200&max_price=300&order_by=title", exp: 200 },
    { id: 4, name: "GET pagination", method: "GET", getPath: () => "/books/?limit=2&offset=2", exp: 200 },
    { id: 5, name: "GET one book", method: "GET", getPath: () => "/books/1/", exp: 200 },
    {
      id: 6,
      name: "POST add book",
      method: "POST",
      getPath: () => "/books/",
      body: { title: "New Book", author: "Me", price: 100, pages: 50 },
      exp: 201,
      after: (res) => {
        try {
          const parsed = JSON.parse(res.body);
          if (parsed && parsed.id) createdBookId = parsed.id;
        } catch (_) {}
      }
    },
    { id: 7, name: "PUT update book", method: "PUT", getPath: () => `/books/${createdBookId}/`, body: { title: "Edited Book", author: "Me", price: 120, pages: 60 }, exp: 200 },
    { id: 8, name: "DELETE book", method: "DELETE", getPath: () => `/books/${createdBookId}/`, exp: 200 },
    { id: 9, name: "FAIL invalid order_by", method: "GET", getPath: () => "/books/?order_by=drop", exp: 400 },
    { id: 10, name: "FAIL invalid order", method: "GET", getPath: () => "/books/?order=up", exp: 400 },
    { id: 11, name: "FAIL invalid limit", method: "GET", getPath: () => "/books/?limit=abc", exp: 400 },
    { id: 12, name: "FAIL min_price > max_price", method: "GET", getPath: () => "/books/?min_price=500&max_price=100", exp: 400 },
    { id: 13, name: "FAIL id not a number", method: "GET", getPath: () => "/books/abc/", exp: 400 },
    { id: 14, name: "FAIL book not found", method: "GET", getPath: () => "/books/99/", exp: 404 },
    { id: 15, name: "FAIL POST missing title", method: "POST", getPath: () => "/books/", body: { author: "Me", price: 100 }, exp: 400 },
    { id: 16, name: "FAIL POST missing author", method: "POST", getPath: () => "/books/", body: { title: "x", price: 100 }, exp: 400 },
    { id: 17, name: "FAIL POST price not numeric", method: "POST", getPath: () => "/books/", body: { title: "x", author: "y", price: "abc" }, exp: 400 },
    { id: 18, name: "FAIL PUT not found", method: "PUT", getPath: () => "/books/99/", body: { title: "x", author: "y", price: 10 }, exp: 404 },
    { id: 19, name: "FAIL DELETE not found", method: "DELETE", getPath: () => "/books/99/", exp: 404 },
    { id: 20, name: "FAIL unknown route", method: "GET", getPath: () => "/nope", exp: 404 }
  ];

  console.log("Running Lab 3 API Test Suite (20 tests)...\n");
  let passed = 0;
  for (const t of tests) {
    const path = t.getPath();
    const res = await request(t.method, path, t.body);
    if (t.after) t.after(res);
    const ok = res.status === t.exp;
    if (ok) passed++;
    const mark = ok ? "\x1b[32m✔ PASS\x1b[0m" : "\x1b[31m✖ FAIL\x1b[0m";
    console.log(`[${mark}] #${String(t.id).padStart(2, " ")} ${t.name.padEnd(32)} -> ${res.status} (expected ${t.exp})`);
  }

  console.log(`\nResult: ${passed}/${tests.length} tests passed.`);
  if (passed !== tests.length) process.exitCode = 1;
}

main();
