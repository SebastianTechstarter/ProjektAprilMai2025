<?php
    //error_reporting(0);
    //ini_set('display_errors', 0);

    header("Content-Type: application/json");
    header("Access-Control-Allow-Origin: *");
    header("Access-Control-Allow-Credentials: true");
    header("Access-Control-Allow-Methods: POST, OPTIONS");
    header("Access-Control-Allow-Headers: Content-Type");

    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        header("Access-Control-Allow-Origin: $allowed_origin");
        header("Access-Control-Allow-Credentials: true");
        http_response_code(200);
        exit();
    }

    session_start();

    $raw = file_get_contents("php://input");
    $request = json_decode($raw, true);

    if (!is_array($request)) {
        echo json_encode(["success" => false, "message" => "Ungültige JSON-Daten."]);
        exit();
    }


    $servername = 'mysql36.1blu.de';
    $username = 's326899_3710788';
    $password = 'xxAU!9L7VvQ3RBu';
    $database = 'db326899x3710788';

    $conn = new mysqli($servername, $username, $password, $database);
    if ($conn->connect_error) {
        echo json_encode(["success" => false, "message" => "DB-Verbindung fehlgeschlagen: " . $conn->connect_error]);
        exit();
    }

    if (isset($request['action'])) {
        if ($request['action'] === 'register') {
            $response = api_register($request);
            echo json_encode($response);
            $conn->close();
            exit();
        }

        if ($request['action'] === 'login') {
            $response = api_login($request);
            echo json_encode($response);
            $conn->close();
            exit();
        }

        if ($request['action'] === 'books') {
            $response = api_books();
            echo json_encode($response);
            $conn->close();
            exit();
        }

        if ($request['action'] === 'book') {
            if (!isset($request['book_id'])) {
                echo json_encode(["success" => false, "message" => "book_id fehlt"]);
                $conn->close();
                exit();
            }

            $bookId = intval($request['book_id']);
            
            // Buch mit JOIN auf Kategorie abfragen
            $stmt = $conn->prepare("
                SELECT 
                    b.*, 
                    c.name AS category_name 
                FROM 
                    book b 
                LEFT JOIN 
                    category c ON b.category_id = c.category_id 
                WHERE 
                    b.book_id = ?
            ");
            
            $stmt->bind_param("i", $bookId);
            $stmt->execute();
            $result = $stmt->get_result();

            if ($result->num_rows === 0) {
                echo json_encode(["success" => false, "message" => "Buch nicht gefunden"]);
            } else {
                echo json_encode($result->fetch_assoc());
            }
            $conn->close();
            exit();
        }

        if ($request['action'] === 'publishers') {
            $response = api_publishers();
            echo json_encode($response);
            $conn->close();
            exit();
        }

        if ($request['action'] === 'categories') {
            $response = api_categories();
            echo json_encode($response);
            $conn->close();
            exit();
        }

        if ($request['action'] === 'add_to_cart') {
            if (empty($request['user_id']) or $request['user_id'] == 0) {
                echo json_encode(["success" => false, "message" => "Nicht eingeloggt."]);
                $conn->close();
                exit();
            }

            $userId = intval($request['user_id']);
            $bookId = intval($request['book_id']);
            $quantity = intval($request['quantity']);

            $stmt = $conn->prepare("INSERT INTO `cart` (`user_id`, `book_id`, `quantity`, `created_at`) VALUES (?, ?, ?, NOW())");
            $stmt->bind_param("iii", $userId, $bookId, $quantity);

            if ($stmt->execute()) {
                echo json_encode(["success" => true, "message" => "In den Warenkorb gelegt."]);
            } else {
                echo json_encode(["success" => false, "message" => "Fehler beim Einfügen in den Warenkorb."]);
            }

            $conn->close();
            exit();
        }

        if ($request['action'] === 'get_cart') {
            if (empty($request['user_id']) || $request['user_id'] == 0) {
                echo json_encode(["success" => false, "message" => "Nicht eingeloggt."]);
                $conn->close();
                exit();
            }

            $userId = intval($request['user_id']);

            $stmt = $conn->prepare("
                SELECT 
                    c.book_id,
                    c.quantity,
                    b.title,
                    b.price,
                    cat.name AS category_name
                FROM cart c
                JOIN book b ON c.book_id = b.book_id
                LEFT JOIN category cat ON b.category_id = cat.category_id
                WHERE c.user_id = ?
            ");
            $stmt->bind_param("i", $userId);
            $stmt->execute();
            $result = $stmt->get_result();

            $cartItems = [];
            while ($row = $result->fetch_assoc()) {
                $cartItems[] = $row;
            }

            echo json_encode([
                "success" => true,
                "cart" => $cartItems
            ]);

            $conn->close();
            exit();
        }

        if ($request['action'] === 'remove_from_cart') {
            if (empty($request['user_id']) || $request['user_id'] == 0) {
                echo json_encode(["success" => false, "message" => "Nicht eingeloggt."]);
                $conn->close();
                exit();
            }

            if (empty($request['book_id'])) {
                echo json_encode(["success" => false, "message" => "book_id fehlt."]);
                $conn->close();
                exit();
            }

            $userId = intval($request['user_id']);
            $bookId = intval($request['book_id']);

            $stmt = $conn->prepare("DELETE FROM `cart` WHERE `user_id` = ? AND `book_id` = ?");
            $stmt->bind_param("ii", $userId, $bookId);

            if ($stmt->execute()) {
                echo json_encode(["success" => true, "message" => "Artikel entfernt."]);
            } else {
                echo json_encode(["success" => false, "message" => "Fehler beim Entfernen."]);
            }

            $conn->close();
            exit();
        }

        if ($request['action'] === 'update_cart_quantity') {
            if (empty($request['user_id']) || empty($request['book_id']) || !isset($request['quantity'])) {
                echo json_encode(["success" => false, "message" => "Fehlende Parameter."]);
                $conn->close();
                exit();
            }

            $userId = intval($request['user_id']);
            $bookId = intval($request['book_id']);
            $quantity = intval($request['quantity']);

            $stmt = $conn->prepare("UPDATE `cart` SET `quantity` = ?, `created_at` = NOW() WHERE `user_id` = ? AND `book_id` = ?");
            $stmt->bind_param("iii", $quantity, $userId, $bookId);

            if ($stmt->execute()) {
                echo json_encode(["success" => true, "message" => "Menge aktualisiert."]);
            } else {
                echo json_encode(["success" => false, "message" => "Update fehlgeschlagen."]);
            }

            $conn->close();
            exit();
        }

        if ($request['action'] === 'add_to_library') {
            if (empty($request['user_id']) || empty($request['book_id'])) {
                echo json_encode(["success" => false, "message" => "Benutzer-ID oder Buch-ID fehlt."]);
                $conn->close();
                exit();
            }
            $userId = intval($request['user_id']);
            $bookId = intval($request['book_id']);
            $stmt = $conn->prepare("SELECT 1 FROM `library` WHERE `user_id` = ? AND `book_id` = ? LIMIT 1");
            $stmt->bind_param("ii", $userId, $bookId);
            $stmt->execute();
            $check = $stmt->get_result();
            if ($check->num_rows > 0) {
                echo json_encode(["success" => false, "message" => "Buch ist bereits in deiner Bibliothek."]);
                $conn->close();
                exit();
            }
            $stmt = $conn->prepare("INSERT INTO `library` (`user_id`, `book_id`, `created_at`) VALUES (?, ?, NOW())");
            $stmt->bind_param("ii", $userId, $bookId);
            if ($stmt->execute()) {
                echo json_encode(["success" => true, "message" => "Zur Bibliothek hinzugefügt."]);
            } else {
                echo json_encode(["success" => false, "message" => "Fehler beim Hinzufügen zur Bibliothek."]);
            }
            $conn->close();
            exit();
        }

        if ($request['action'] === 'library') {
            if (empty($request['user_id']) || empty($request['book_id'])) {
                echo json_encode(["success" => false, "message" => "Benutzer-ID oder Buch-ID fehlt."]);
                $conn->close();
                exit();
            }
            $userId = intval($request['user_id']);
            $bookId = intval($request['book_id']);
            $stmt = $conn->prepare("SELECT 1 FROM `library` WHERE `user_id` = ? AND `book_id` = ? LIMIT 1");
            $stmt->bind_param("ii", $userId, $bookId);
            $stmt->execute();
            $check = $stmt->get_result();
            if ($check->num_rows > 0) {
                echo json_encode(["success" => true, "message" => "Buch ist bereits in deiner Bibliothek."]);
                $conn->close();
                exit();
            }
            echo json_encode(["success" => false, "message" => "Buch ist nicht in der Bibliothek."]);
            $conn->close();
            exit();
        }

        if ($request['action'] === 'add_to_wishlist') {
            if (empty($request['user_id']) || empty($request['book_id'])) {
                echo json_encode(["success" => false, "message" => "Benutzer-ID oder Buch-ID fehlt."]);
                $conn->close();
                exit();
            }
            $userId = intval($request['user_id']);
            $bookId = intval($request['book_id']);
            $stmt = $conn->prepare("SELECT 1 FROM `wishlist` WHERE `user_id` = ? AND `book_id` = ? LIMIT 1");
            $stmt->bind_param("ii", $userId, $bookId);
            $stmt->execute();
            $check = $stmt->get_result();
            if ($check->num_rows > 0) {
                echo json_encode(["success" => false, "message" => "Buch ist bereits in der Wunschliste."]);
                $conn->close();
                exit();
            }
            $stmt = $conn->prepare("INSERT INTO `wishlist` (`user_id`, `book_id`, `created_at`) VALUES (?, ?, NOW())");
            $stmt->bind_param("ii", $userId, $bookId);
            if ($stmt->execute()) {
                echo json_encode(["success" => true, "message" => "Zur Wunschliste hinzugefügt."]);
            } else {
                echo json_encode(["success" => false, "message" => "Fehler beim Hinzufügen zur Wunschliste."]);
            }
            $conn->close();
            exit();
        }

        if ($request['action'] === 'wishlist') {
            if (empty($request['user_id']) || empty($request['book_id'])) {
                echo json_encode(["success" => false, "message" => "Benutzer-ID oder Buch-ID fehlt."]);
                $conn->close();
                exit();
            }
            $userId = intval($request['user_id']);
            $bookId = intval($request['book_id']);
            $stmt = $conn->prepare("SELECT 1 FROM `wishlist` WHERE `user_id` = ? AND `book_id` = ? LIMIT 1");
            $stmt->bind_param("ii", $userId, $bookId);
            $stmt->execute();
            $check = $stmt->get_result();
            if ($check->num_rows > 0) {
                echo json_encode(["success" => true, "message" => "Buch ist bereits in deiner Wunschliste."]);
                $conn->close();
                exit();
            }
            echo json_encode(["success" => false, "message" => "Buch ist nicht in der Wunschliste."]);
            $conn->close();
            exit();
        }

        if ($request['action'] === 'get_library_books') {
            if (empty($request['user_id'])) {
                echo json_encode(["success" => false, "message" => "Benutzer-ID fehlt."]);
                $conn->close();
                exit();
            }

            $userId = intval($request['user_id']);

            $stmt = $conn->prepare("
                SELECT 
                    b.book_id,
                    b.title,
                    b.author,
                    b.publication_year,
                    c.name AS category_name
                FROM library l
                JOIN book b ON l.book_id = b.book_id
                LEFT JOIN category c ON b.category_id = c.category_id
                WHERE l.user_id = ?
            ");
            $stmt->bind_param("i", $userId);
            $stmt->execute();
            $result = $stmt->get_result();

            $books = [];
            while ($row = $result->fetch_assoc()) {
                $books[] = $row;
            }

            echo json_encode([
                "success" => true,
                "books" => $books
            ]);

            $conn->close();
            exit();
        }

        if ($request['action'] === 'get_wishlist_books') {
            if (empty($request['user_id'])) {
                echo json_encode(["success" => false, "message" => "Benutzer-ID fehlt."]);
                $conn->close();
                exit();
            }

            $userId = intval($request['user_id']);

            $stmt = $conn->prepare("
                SELECT 
                    b.book_id,
                    b.title,
                    b.author,
                    b.publication_year,
                    c.name AS category_name
                FROM wishlist w
                JOIN book b ON w.book_id = b.book_id
                LEFT JOIN category c ON b.category_id = c.category_id
                WHERE w.user_id = ?
            ");
            $stmt->bind_param("i", $userId);
            $stmt->execute();
            $result = $stmt->get_result();

            $books = [];
            while ($row = $result->fetch_assoc()) {
                $books[] = $row;
            }

            echo json_encode([
                "success" => true,
                "books" => $books
            ]);

            $conn->close();
            exit();
        }

        if ($request['action'] === 'remove_from_library') {
            if (empty($request['user_id']) || empty($request['book_id'])) {
                echo json_encode(["success" => false, "message" => "Benutzer-ID oder Buch-ID fehlt."]);
                $conn->close();
                exit();
            }

            $userId = intval($request['user_id']);
            $bookId = intval($request['book_id']);

            $stmt = $conn->prepare("DELETE FROM `library` WHERE `user_id` = ? AND `book_id` = ?");
            $stmt->bind_param("ii", $userId, $bookId);

            if ($stmt->execute()) {
                echo json_encode(["success" => true, "message" => "Buch aus der Bibliothek entfernt."]);
            } else {
                echo json_encode(["success" => false, "message" => "Fehler beim Entfernen aus der Bibliothek."]);
            }
            $conn->close();
            exit();
        }

        if ($request['action'] === 'remove_from_wishlist') {
            if (empty($request['user_id']) || empty($request['book_id'])) {
                echo json_encode(["success" => false, "message" => "Benutzer-ID oder Buch-ID fehlt."]);
                $conn->close();
                exit();
            }

            $userId = intval($request['user_id']);
            $bookId = intval($request['book_id']);

            $stmt = $conn->prepare("DELETE FROM `wishlist` WHERE `user_id` = ? AND `book_id` = ?");
            $stmt->bind_param("ii", $userId, $bookId);

            if ($stmt->execute()) {
                echo json_encode(["success" => true, "message" => "Buch aus der Wunschliste entfernt."]);
            } else {
                echo json_encode(["success" => false, "message" => "Fehler beim Entfernen aus der Wunschliste."]);
            }
            $conn->close();
            exit();
        }

    }

    echo json_encode(["success" => false, "message" => "Ungültige Anfrage"]);
    $conn->close();
    exit();

    function api_register($data) {
        global $conn;
        $username = $data['username'];
        $email = $data['email'];
        $password = md5($data['password']);
        $type = $data['user_type'];

        $stmt = $conn->prepare("SELECT * FROM `user` WHERE `username` = ? OR `email` = ?");
        $stmt->bind_param("ss", $username, $email);
        $stmt->execute();
        $result = $stmt->get_result();

        if ($result->num_rows > 0) {
            return ["success" => false, "message" => "Benutzername oder E-Mail ist bereits vergeben."];
        }

        $stmt = $conn->prepare("INSERT INTO `user` (`username`, `password`, `email`, `type`) VALUES (?, ?, ?, ?)");
        $stmt->bind_param("ssss", $username, $password, $email, $type);

        if ($stmt->execute()) {
            return ["success" => true, "message" => "Benutzer erfolgreich registriert."];
        } else {
            return ["success" => false, "message" => "Fehler beim Registrieren des Benutzers."];
        }
    }

    function api_login($data) {
        global $conn;
        $email = $data['email'];
        $password = md5($data['password']);

        $stmt = $conn->prepare("SELECT `id`, `username`, `email`, `type` FROM `user` WHERE `email` = ? AND `password` = ?");
        $stmt->bind_param("ss", $email, $password);
        $stmt->execute();
        $result = $stmt->get_result();

        if ($result->num_rows == 0) {
            return ["success" => false, "message" => "E-Mail oder Passwort falsch."];
        }

        $user = $result->fetch_assoc();

        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }

        $_SESSION['user'] = [
            "id" => $user['id'],
            "username" => $user['username'],
            "email" => $user['email'],
            "type" => $user['type']
        ];

        return [
            "success" => true,
            "message" => "Login erfolgreich.",
            "user" => $_SESSION['user']  
        ];
    }

    function api_books() {
        global $conn;
        $books = [];
        $result = $conn->query("SELECT * FROM `book`");
        while ($row = $result->fetch_assoc()) {
            $books[] = $row;
        }
        return $books;
    }

    function api_publishers() {
        global $conn;
        $publishers = [];
        $result = $conn->query("SELECT * FROM `publisher`");
        while ($row = $result->fetch_assoc()) {
            $publishers[] = $row;
        }
        return $publishers;
    }

    function api_categories() {
        global $conn;
        $categories = [];
        $result = $conn->query("SELECT * FROM `category`");
        while ($row = $result->fetch_assoc()) {
            $categories[] = $row;
        }
        return $categories;
    }
?>