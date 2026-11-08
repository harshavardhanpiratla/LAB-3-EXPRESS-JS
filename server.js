const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "books.db");
const PORT = process.env.PORT || 3000;
let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({ filename: dbPath, driver: sqlite3.Database });
    await db.exec(`CREATE TABLE IF NOT EXISTS book (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      author TEXT,
      price INTEGER,
      pages INTEGER
    )`);
    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}/`);
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

// ---------- helpers ----------
const sendError = (res, status, message) => res.status(status).json({ message });

// column names cannot use ? placeholders, so only allow a fixed list
const ALLOWED_ORDER_BY = ["id", "title", "author", "price", "pages"];

const isNumeric = (v) =>
  (typeof v === "number" && Number.isFinite(v)) ||
  (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)));

// returns an error message string, or null when the body is valid
const validateBook = (body) => {
  if (!body || typeof body !== "object") return "Request body must be JSON";
  const { title, author, price, pages } = body;
  if (typeof title !== "string" || title.trim() === "") return "title is required";
  if (typeof author !== "string" || author.trim() === "") return "author is required";
  if (price === undefined || price === null) return "price is required";
  if (!isNumeric(price)) return "price must be a number";
  if (Number(price) < 0) return "price cannot be negative";
  if (pages !== undefined && pages !== null) {
    if (!isNumeric(pages) || !Number.isInteger(Number(pages)) || Number(pages) <= 0) {
      return "pages must be a positive whole number";
    }
  }
  return null;
};

const validId = (id) => /^\d+$/.test(id);

// ---------- routes ----------

// GET /books/ with search, filter, sort and pagination
app.get("/books/", async (req, res) => {
  const {
    search_q = "",
    order_by = "id",
    order = "ASC",
    limit = "10",
    offset = "0",
    min_price,
    max_price,
  } = req.query;

  if (!ALLOWED_ORDER_BY.includes(order_by)) {
    return sendError(res, 400, `order_by must be one of: ${ALLOWED_ORDER_BY.join(", ")}`);
  }
  const direction = String(order).toUpperCase();
  if (direction !== "ASC" && direction !== "DESC") {
    return sendError(res, 400, "order must be ASC or DESC");
  }
  if (!/^\d+$/.test(limit) || Number(limit) < 1) {
    return sendError(res, 400, "limit must be a positive whole number");
  }
  if (!/^\d+$/.test(offset)) {
    return sendError(res, 400, "offset must be a whole number 0 or more");
  }
  if (min_price !== undefined && !isNumeric(min_price)) {
    return sendError(res, 400, "min_price must be a number");
  }
  if (max_price !== undefined && !isNumeric(max_price)) {
    return sendError(res, 400, "max_price must be a number");
  }
  if (min_price !== undefined && max_price !== undefined && Number(min_price) > Number(max_price)) {
    return sendError(res, 400, "min_price cannot be greater than max_price");
  }

  const conditions = ["title LIKE ?"];
  const params = [`%${search_q}%`];
  if (min_price !== undefined) {
    conditions.push("price >= ?");
    params.push(Number(min_price));
  }
  if (max_price !== undefined) {
    conditions.push("price <= ?");
    params.push(Number(max_price));
  }
  params.push(Number(limit), Number(offset));

  // order_by and direction are whitelisted above, so they are safe to place in the string
  const query = `SELECT * FROM book WHERE ${conditions.join(" AND ")}
                 ORDER BY ${order_by} ${direction} LIMIT ? OFFSET ?;`;
  try {
    const books = await db.all(query, params);
    res.status(200).json(books);
  } catch (e) {
    sendError(res, 500, "Internal server error");
  }
});

// GET /books/:bookId/
app.get("/books/:bookId/", async (req, res) => {
  const { bookId } = req.params;
  if (!validId(bookId)) return sendError(res, 400, "bookId must be a whole number");
  try {
    const book = await db.get("SELECT * FROM book WHERE id = ?;", [bookId]);
    if (!book) return sendError(res, 404, "Book not found");
    res.status(200).json(book);
  } catch (e) {
    sendError(res, 500, "Internal server error");
  }
});

// POST /books/
app.post("/books/", async (req, res) => {
  const problem = validateBook(req.body);
  if (problem) return sendError(res, 400, problem);
  const { title, author, price, pages } = req.body;
  try {
    const result = await db.run(
      "INSERT INTO book (title, author, price, pages) VALUES (?, ?, ?, ?);",
      [title.trim(), author.trim(), Number(price), pages == null ? null : Number(pages)]
    );
    res.status(201).json({ message: "Book added successfully", id: result.lastID });
  } catch (e) {
    sendError(res, 500, "Internal server error");
  }
});

// PUT /books/:bookId/
app.put("/books/:bookId/", async (req, res) => {
  const { bookId } = req.params;
  if (!validId(bookId)) return sendError(res, 400, "bookId must be a whole number");
  const problem = validateBook(req.body);
  if (problem) return sendError(res, 400, problem);
  const { title, author, price, pages } = req.body;
  try {
    const result = await db.run(
      "UPDATE book SET title = ?, author = ?, price = ?, pages = ? WHERE id = ?;",
      [title.trim(), author.trim(), Number(price), pages == null ? null : Number(pages), bookId]
    );
    if (result.changes === 0) return sendError(res, 404, "Book not found");
    res.status(200).json({ message: "Book updated successfully" });
  } catch (e) {
    sendError(res, 500, "Internal server error");
  }
});

// DELETE /books/:bookId/
app.delete("/books/:bookId/", async (req, res) => {
  const { bookId } = req.params;
  if (!validId(bookId)) return sendError(res, 400, "bookId must be a whole number");
  try {
    const result = await db.run("DELETE FROM book WHERE id = ?;", [bookId]);
    if (result.changes === 0) return sendError(res, 404, "Book not found");
    res.status(200).json({ message: "Book deleted successfully" });
  } catch (e) {
    sendError(res, 500, "Internal server error");
  }
});

// malformed JSON body -> 400
app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") return sendError(res, 400, "Invalid JSON in request body");
  sendError(res, 500, "Internal server error");
});

// unknown routes
app.use((req, res) => sendError(res, 404, "Route not found"));

initializeDBAndServer();
