# Postman test list (Lab 3)

Import `postman_collection.json` into Postman (set the `baseUrl` variable to your local or live URL). Each request has a test that checks the status code. Run the tests in this order on a fresh `books.db`: the POST creates id 11, which the PUT and DELETE then use.

| # | Test | Method | Path | Body | Expected status |
| - | ---- | ------ | ---- | ---- | --------------- |
| 1 | GET all (defaults) | GET | `/books/` | - | 200 |
| 2 | GET search + sort + limit | GET | `/books/?search_q=the&order_by=price&order=desc&limit=3` | - | 200 |
| 3 | GET price range | GET | `/books/?min_price=200&max_price=300&order_by=title` | - | 200 |
| 4 | GET pagination | GET | `/books/?limit=2&offset=2` | - | 200 |
| 5 | GET one book | GET | `/books/1/` | - | 200 |
| 6 | POST add book | POST | `/books/` | `{"title": "New Book", "author": "Me", "price": 100, "pages": 50}` | 201 |
| 7 | PUT update book | PUT | `/books/11/` | `{"title": "Edited Book", "author": "Me", "price": 120, "pages": 60}` | 200 |
| 8 | DELETE book | DELETE | `/books/11/` | - | 200 |
| 9 | FAIL invalid order_by | GET | `/books/?order_by=drop` | - | 400 |
| 10 | FAIL invalid order | GET | `/books/?order=up` | - | 400 |
| 11 | FAIL invalid limit | GET | `/books/?limit=abc` | - | 400 |
| 12 | FAIL min_price > max_price | GET | `/books/?min_price=500&max_price=100` | - | 400 |
| 13 | FAIL id not a number | GET | `/books/abc/` | - | 400 |
| 14 | FAIL book not found | GET | `/books/99/` | - | 404 |
| 15 | FAIL POST missing title | POST | `/books/` | `{"author": "Me", "price": 100}` | 400 |
| 16 | FAIL POST missing author | POST | `/books/` | `{"title": "x", "price": 100}` | 400 |
| 17 | FAIL POST price not numeric | POST | `/books/` | `{"title": "x", "author": "y", "price": "abc"}` | 400 |
| 18 | FAIL PUT not found | PUT | `/books/99/` | `{"title": "x", "author": "y", "price": 10}` | 404 |
| 19 | FAIL DELETE not found | DELETE | `/books/99/` | - | 404 |
| 20 | FAIL unknown route | GET | `/nope` | - | 404 |

Success cases: 1-8. Failure cases: 9-20. Every error body has the form `{ "message": "..." }`.
