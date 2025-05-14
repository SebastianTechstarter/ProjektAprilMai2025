# API-Dokumentation

## Übersicht

Diese Dokumentation bietet einen Überblick über die in der Datei `servers.js` definierten API-Endpunkte. Die API wurde mit Express.js erstellt und interagiert mit einer MySQL-Datenbank.

### Basis-URL

    ~~~
    http://localhost:3000
    ~~~

---

## Authentifizierung

### 1. Benutzerregistrierung

- **Endpunkt**: `/api/v1/auth/register`
- **Methode**: `POST`
- **Anfragekörper**:

```json
{
  "username": "string",
  "email": "string",
  "password": "string",
  "user_type": "admin | privat | gewerblich",
  "payment_method": "paypal | iban | creditcard"
}
```

- **Antwort**:
  - Erfolg: `201 Created`
  - Fehler: `400 Bad Request` oder `500 Internal Server Error`

---

### 2. Benutzeranmeldung

- **Endpunkt**: `/api/v1/auth/login`
- **Methode**: `POST`
- **Anfragekörper**:

```json
{
  "email": "string",
  "password": "string"
}
```

- **Antwort**:

```json
{
  "token": "string",
  "user": {
    "userId": "number",
    "userType": "admin | privat | gewerblich"
  }
}
```

- Erfolg: `200 OK`
- Fehler: `404 Not Found` oder `400 Bad Request`

---

## Bücher

### 3. Alle Bücher abrufen

- **Endpunkt**: `/api/books`
- **Methode**: `GET`
- **Antwort**:

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

- Erfolg: `200 OK`
- Fehler: `500 Internal Server Error`

---

## Shop

### 5. Bücher im Shop filtern

- **Endpunkt**: `/api/v1/shop`
- **Methode**: `GET`
- **Abfrageparameter**:
  - `category`: Nach Kategorie filtern
  - `price_min`: Mindestpreis
  - `price_max`: Höchstpreis
  - `sort`: Sortierfeld (z.B. `-price` für Preisabsteigend)
- **Antwort**:

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

- Erfolg: `200 OK`
- Fehler: `500 Internal Server Error`

---

## Warenkorb

### 6. Warenkorbinhalte abrufen

- **Endpunkt**: `/api/v1/cart`
- **Methode**: `GET`
- **Authentifizierung**: Erforderlich
- **Antwort**:

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

- Erfolg: `200 OK`
- Fehler: `401 Unauthorized` oder `500 Internal Server Error`

---

## Bestellungen

### 7. Bestellung erstellen

- **Endpunkt**: `/api/v1/orders`
- **Methode**: `POST`
- **Authentifizierung**: Erforderlich
- **Anfragekörper**:

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

- **Antwort**:

```json
{
  "orderId": "number"
}
```

- Erfolg: `201 Created`
- Fehler: `401 Unauthorized` oder `500 Internal Server Error`

---

## Admin-Funktionen

---

### 8. Buchinformationen aktualisieren (PUT)

- **Endpunkt**: `/api/v1/books/:id`
- **Methode**: `PUT`
- **Authentifizierung**: Nur Admin
- **Anfragekörper**:

```json
{
  "field1": "value1",
  "field2": "value2"
}
```

- **Antwort**:
  - Erfolg: `200 OK`
  - Fehler: `400 Bad Request`, `404 Not Found` oder `500 Internal Server Error`

---

### 9. Buchinformationen teilweise aktualisieren (PATCH)

- **Endpunkt**: `/api/v1/books/:id`
- **Methode**: `PATCH`
- **Authentifizierung**: Nur Admin
- **Anfragekörper**:

```json
{
  "field1": "value1",
  "field2": "value2"
}
```

- **Antwort**:
  - Erfolg: `200 OK`
  - Fehler: `400 Bad Request`, `404 Not Found` oder `500 Internal Server Error`

---

### 10. Buch löschen

- **Endpunkt**: `/api/v1/books/:id`
- **Methode**: `DELETE`
- **Authentifizierung**: Nur Admin
- **Antwort**:
  - Erfolg: `204 No Content`
  - Fehler: `404 Not Found` oder `500 Internal Server Error`

---

### 11. Buchpreise massenaktualisieren

- **Endpunkt**: `/api/v1/admin/pricing`
- **Methode**: `POST`
- **Authentifizierung**: Nur Admin
- **Anfragekörper**:

```json
{
  "title": "string",
  "adjustment": "number"
}
```

- **Antwort**:
  - Erfolg: `200 OK`
  - Fehler: `403 Forbidden` oder `500 Internal Server Error`

---

## Zusätzliche Funktionen

### Adresseverwaltung

- **Adresse speichern**: `/api/v1/addresses`
- **Adresse aktualisieren**: `/api/v1/addresses/:addressId`
- **Adresse löschen**: `/api/v1/addresses/:addressId`

### Wunschliste

- **In Wunschliste hinzufügen**: `/api/v1/wishlist`
- **Wunschliste-Eintrag löschen**: `/api/v1/wishlist/:wishlistId`

### Bibliotheksverwaltung

- **Bibliothek erstellen**: `/api/v1/libraries`
- **Bibliothek aktualisieren**: `/api/v1/libraries/:libraryId`
- **Bibliothek löschen**: `/api/v1/libraries/:libraryId`

### Benutzer-Buch-Verwaltung

- **Buch zum Benutzer hinzufügen**: `/api/v1/user-books`
- **Benutzer-Bücher suchen**: `/api/v1/user-books`
- **Benutzer-Buch aktualisieren**: `/api/v1/user-books/:userBookId`
- **Benutzer-Buch löschen**: `/api/v1/user-books/:userBookId`

### Bestellverwaltung

- **Bestellung erstellen**: `/api/v1/orders`
- **Bestellungen suchen**: `/api/v1/orders`
- **Bestellung aktualisieren**: `/api/v1/orders/:orderId`
- **Bestellung löschen**: `/api/v1/orders/:orderId`

### Benachrichtigungen

- **Benachrichtigungen abrufen**: `/api/v1/notifications`
- **Benachrichtigung markieren als gelesen**: `/api/v1/notifications/:notificationId/read`
- **Benachrichtigung senden**: `/api/v1/notifications`
- **Alle Benachrichtigungen zurücksetzen**: `/api/v1/admin/reset-notifications`
- **Benachrichtigung löschen**: `/api/v1/admin/notifications/:notificationId`

---

## Anmerkungen

- Alle authentifizierten Endpunkte erfordern ein JWT-Token im `Authorization`-Header im Format: `Bearer <token>`.
- Fehlerantworten enthalten ein `message`-Feld mit Fehlerdetails.

```

```
