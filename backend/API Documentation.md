# API Documentation

## Overview

This document provides an overview of the API endpoints defined in the `servers.js` file. The API is built using Express.js and interacts with a MySQL database.

### Base URL

    ```
    http://localhost:3000
    ```

---

## Authentication

### 1. User Registration

- **Endpoint**: `/api/v1/auth/register`
- **Method**: `POST`
- **Request Body**:

  ```json
  {
    "username": "string",
    "email": "string",
    "password": "string",
    "user_type": "admin | privat | gewerblich",
    "payment_method": "paypal | iban | creditcard"
  }
  ```

- **Response**:
  - Success: `201 Created`
  - Failure: `400 Bad Request` or `500 Internal Server Error`

---

### 2. User Login

- **Endpoint**: `/api/v1/auth/login`
- **Method**: `POST`
- **Request Body**:

  ```json
  {
    "email": "string",
    "password": "string"
  }
  ```

- **Response**:
  ```json
  {
    "token": "string",
    "user": {
      "userId": "number",
      "userType": "admin | privat | gewerblich"
    }
  }
  ```
  - Success: `200 OK`
  - Failure: `404 Not Found` or `400 Bad Request`

---

## Books

### 3. Get All Books

- **Endpoint**: `/api/books`
- **Method**: `GET`
- **Response**:
  ```json
  [
    {
      "book_id": "number",
      "title": "string",
      "author": "string",
      "price": "number",
      ...
    }
  ]
  ```
  - Success: `200 OK`
  - Failure: `500 Internal Server Error`

---

### 4. Get Sample Book

- **Endpoint**: `/api/book/sample`
- **Method**: `GET`
- **Response**:
  ```json
  {
    "book_id": "number",
    "title": "string",
    "author": "string",
    "price": "number",
    ...
  }
  ```
  - Success: `200 OK`
  - Failure: `404 Not Found` or `500 Internal Server Error`

---

## Shop

### 5. Get Shop Books

- **Endpoint**: `/api/v1/shop`
- **Method**: `GET`
- **Query Parameters**:
  - `category`: Filter by category
  - `price_min`: Minimum price
  - `price_max`: Maximum price
  - `sort`: Sort field (e.g., `-price` for descending order)
- **Response**:
  ```json
  [
    {
      "book_id": "number",
      "title": "string",
      "author": "string",
      "price": "number",
      ...
    }
  ]
  ```
  - Success: `200 OK`
  - Failure: `500 Internal Server Error`

---

## Cart

### 6. Get Cart Items

- **Endpoint**: `/api/v1/cart`
- **Method**: `GET`
- **Authentication**: User only
- **Response**:
  ```json
  [
    {
      "cart_id": "number",
      "book_id": "number",
      "title": "string",
      "price": "number",
      ...
    }
  ]
  ```
  - Success: `200 OK`
  - Failure: `401 Unauthorized` or `500 Internal Server Error`

---

## Orders

### 7. Create Order

- **Endpoint**: `/api/v1/orders`
- **Method**: `POST`
- **Authentication**: User only
- **Request Body**:
  ```json
  {
    "shipping_address_id": "number",
    "payment_method": "string",
    "items": [
      {
        "book_id": "number",
        "quantity": "number"
      }
    ]
  }
  ```
- **Response**:
  ```json
  {
    "orderId": "number"
  }
  ```
  - Success: `201 Created`
  - Failure: `401 Unauthorized` or `500 Internal Server Error`

---

## Admin

---

### 8. Update Book Information (PUT)

- **Endpoint**: `/api/v1/books/:id`
- **Method**: `PUT`
- **Authentication**: Admin only
- **Request Body**:
  ```json
  {
    "field1": "value1",
    "field2": "value2"
  }
  ```
- **Response**:
  - Success: `200 OK`
  - Failure: `400 Bad Request`, `404 Not Found`, or `500 Internal Server Error`

---

### 9. Update Book Information (PATCH)

- **Endpoint**: `/api/v1/books/:id`
- **Method**: `PATCH`
- **Authentication**: Admin only
- **Request Body**:
  ```json
  {
    "field1": "value1",
    "field2": "value2"
  }
  ```
- **Response**:
  - Success: `200 OK`
  - Failure: `400 Bad Request`, `404 Not Found`, or `500 Internal Server Error`

---

### 10. Delete Book

- **Endpoint**: `/api/v1/books/:id`
- **Method**: `DELETE`
- **Authentication**: Admin only
- **Response**:
  - Success: `204 No Content`
  - Failure: `404 Not Found` or `500 Internal Server Error`

### 11. Update Book Prices

- **Endpoint**: `/api/v1/admin/pricing`
- **Method**: `POST`
- **Authentication**: Admin only
- **Request Body**:
  ```json
  {
    "title": "string",
    "adjustment": "number"
  }
  ```
- **Response**:
  - Success: `200 OK`
  - Failure: `403 Forbidden` or `500 Internal Server Error`

---

## Notes

- All endpoints that require authentication expect a JWT token in the `Authorization` header in the format: `Bearer <token>`.
- Error responses include a `message` field with details about the error.
