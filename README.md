# ProjektAprilMai2025

Gruppenmitglieder:

- Sebastian
- Marcel
- Dennis
- Weisong

## Plan für 02.Mai

- Basis-Struktur des Frontend und Backend aufziehen (gemeinsam)
- Product Backlog füllen
- Sprint Planning für Woche 1

Unsere Idee:

## BookBay, eine Handelsplattform für Bücher

Geplant ist eine Community, bei der Bücher verwaltet, hochgeladen, gekauft und verkauft werden können.
Im weiteren Verlauf ist eine Funktion für Login/Registrierung geplant, ebenso die Kontoverwaltung und eine Verwaltung der eigenen Bibliothek.
Wir haben vor, mySQL als Datenbank zu nutzen.

Idee für den Shop:

- Navbar
- Suchleiste
- toggle dark/light mode
- rechts oben Anmelden/Registrieren
- neue Nachrichten (+ Handelsanfragen)
- Warenkorb mit Anzahl der eingelegten Artikel
- meinShop (gekoppelt mit der Bib, sodass Bücher, die zum Verkauf stehen, automatisch in den eigenen Shop geschoben werden)
  - Weiterleitung zu DHL nach Verkauf, um direkt eine Versandmarke zu generieren.
- Main Shop: Angebot eigener Bücher (Shop des Site-Host) gekoppelt mit der Bib der User, sodass Verfügbarkeiten von uns (als Betreiber des Shops) erweitert werden
  - Shop gekoppelt mit User-Bib: System listet User auf, die das gesuchte Buch ebenfalls verkaufen
  - Rezensionen über gekaufte Bücher (Erweiterung: Ranking der beliebtesten Bücher / meistgehandelten Bücher)

Community:

- Nachrichtensystem (Chat?)
- User-Bewertungen:
  - Zuverlässigkeit
  - Freundlichkeit / Umgangsformen
  - Artikel wie beschrieben?
  - Schneller Versand bzw. Artikel zeitnah erhalten

Die Datenbank wird pro Eintrag folgende Werte enthalten:
table book:

- Autor (String)
- Titel (String)
- Klappentext (Longtext txt? md?)
- Seitenzahl (INT)
- Kategorie (String / ID?)
- Verlag (String / ID?)
- Erscheinungsjahr (INT date)
- ISBN (String)
- Titellayout / Design (JSON?) Base64
- Qualität (INT) Zahlen als Index für Zustandsabstufungen der einzelnen Bücher
- Preis

table user:

- User / Passwort
- User-ID
- Email
- Privater Nutzer / gewerblicher Nutzer
- Zahlungsdaten (PayPal, IBAN, Kreditkarte)
- Versandadresse (Erweiterung: Adressverwaltung?)
  - Straße
  - Hausnummer
  - Postfach? Packstation?
  - PLZ
  - Stadt

table ownBib:

- Eigene Bibliothek (Erweiterung: Mehrere frei verwaltbare eigene Bibliotheken)
  - Welche Bücher habe ich? Welche Bücher wünsche ich mir?
  - Verknüpfung zwischen den eigenen Büchern und den Suchen anderer User, sodass erkannt wird, wenn andere Bedarf haben und ein Handel leicht zustande kommt.
- Wunschliste
- Beim Hinzufügen der eigenen Bücher Haken setzen ("Ich möchte verkaufen"), dennoch gibt es eine Meldung, wenn das entsprechende Buch von anderen Usern gesucht wird.

## Beschreibung der Server- und Datenbankstruktur

### servers.js

Die Datei `servers.js` enthält die Backend-Logik für die Anwendung. Sie basiert auf **Node.js** und **Express** und bietet verschiedene API-Endpunkte für die Verwaltung der Benutzer, Bücher und Bestellungen. Die wichtigsten Funktionen umfassen:

- **Benutzerregistrierung und -anmeldung**: Benutzer können sich registrieren und anmelden. Passwörter werden sicher mit **bcrypt** gehasht, und **JWT** wird für die Authentifizierung verwendet.
- **Buchverwaltung**: Endpunkte zum Abrufen von Büchern, einschließlich Filter- und Sortieroptionen.
- **Warenkorbmodul**: Authentifizierte Benutzer können ihren Warenkorb einsehen.
- **Bestellmodul**: Benutzer können Bestellungen aufgeben, die in der Datenbank gespeichert werden.
- **Admin-Funktionen**: Administratoren können Buchpreise basierend auf Kategorien anpassen.

Die Verbindung zur MySQL-Datenbank wird über einen **Connection Pool** hergestellt, um eine effiziente Verwaltung der Datenbankverbindungen zu gewährleisten.

### Bookbay.session.sql

Die Datei `Bookbay.session.sql` definiert die Datenbankstruktur für die Anwendung. Die wichtigsten Tabellen sind:

- **user**: Speichert Benutzerdaten wie Benutzername, Passwort (gehasht), E-Mail, Benutzertyp (privat/gewerblich) und Zahlungsinformationen.
- **address**: Unterstützt mehrere Adressen pro Benutzer (z. B. Versand- und Rechnungsadressen).
- **publisher**: Enthält Verlagsinformationen.
- **category**: Organisiert Bücher in Kategorien, unterstützt hierarchische Strukturen.
- **book**: Speichert Buchinformationen wie Titel, Autor, ISBN, Beschreibung, Preis, Qualität und Verknüpfungen zu Kategorien und Verlagen.
- **library**: Ermöglicht Benutzern die Verwaltung mehrerer Bibliotheken (z. B. eigene Bücher und Wunschlisten).
- **user_books**: Verknüpft Benutzer mit Büchern, einschließlich Verkaufsstatus und Zustandsnotizen.
- **wishlist**: Speichert Wunschlisten der Benutzer mit Prioritäten.
- **search_history**: Protokolliert Suchanfragen der Benutzer, um Benachrichtigungen zu ermöglichen.
- **notification**: Speichert Benachrichtigungen für Benutzer, z. B. über verfügbare Bücher.
- **cart**: Verwalten von Warenkörben der Benutzer.
- **orders**: Speichert Bestellungen, einschließlich Versandadresse, Zahlungsart und Status.

Die Datenbank ist so strukturiert, dass sie die Anforderungen der Plattform erfüllt, einschließlich Benutzerverwaltung, Buchhandel und Community-Funktionen. Fremdschlüssel sorgen für Konsistenz zwischen den Tabellen.
