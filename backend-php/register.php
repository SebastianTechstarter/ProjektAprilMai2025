<?php
// --- CORS ---
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Credentials: true");

// OPTIONS-Anfragen für Preflight direkt beenden
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

session_start();

// --- DB-Verbindung ---
$host = 'mysql36.1blu.de';
$user = 's326899_3710788';
$pass = 'xxAU!9L7VvQ3RBu';
$db = 'db326899x3710788';

$conn = new mysqli($host, $user, $pass, $db);
if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode(['message' => 'Datenbankverbindung fehlgeschlagen: ' . $conn->connect_error]);
    exit;
}

// --- Nur POST ---
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['message' => 'Nur POST erlaubt']);
    exit;
}

// --- JSON-Daten lesen ---
$data = json_decode(file_get_contents('php://input'), true);
$action = $data['action'] ?? 'register';

// === Registrierung ===
if ($action === 'register') {
    // Pflichtfelder prüfen
    $required = ['username', 'email', 'password', 'passwordr', 'user_type', 'payment_method', 'address'];
    foreach ($required as $field) {
        if (empty($data[$field])) {
            http_response_code(400);
            echo json_encode(['message' => "Feld '$field' fehlt."]);
            exit;
        }
    }

    if (!filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
        http_response_code(400);
        echo json_encode(['message' => 'Ungültige E-Mail.']);
        exit;
    }

    if ($data['password'] !== $data['passwordr']) {
        http_response_code(400);
        echo json_encode(['message' => 'Passwörter stimmen nicht überein.']);
        exit;
    }

    // E-Mail oder Benutzername bereits vorhanden?
    $stmt = $conn->prepare("SELECT user_id FROM user WHERE email = ? OR username = ?");
    $stmt->bind_param("ss", $data['email'], $data['username']);
    $stmt->execute();
    $stmt->store_result();
    if ($stmt->num_rows > 0) {
        http_response_code(409);
        echo json_encode(['message' => 'E-Mail oder Benutzername bereits vergeben.']);
        exit;
    }
    $stmt->close();

    // Passwort-Hash
    $hash = password_hash($data['password'], PASSWORD_DEFAULT);

    // Zahlungsdaten vorbereiten
    $paypal = $data['payment_method'] === 'paypal' ? ($data['paypal_account'] ?? null) : null;
    $iban = $data['payment_method'] === 'iban' ? ($data['iban'] ?? null) : null;
    $cc_last4 = $data['payment_method'] === 'creditcard' ? substr($data['creditcard'] ?? '', -4) : null;

    // Benutzer einfügen
    $stmt = $conn->prepare("INSERT INTO user (username, password_hash, email, user_type, payment_method, paypal_account, iban, creditcard_last4)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    $stmt->bind_param("ssssssss", $data['username'], $hash, $data['email'], $data['user_type'], $data['payment_method'], $paypal, $iban, $cc_last4);
    if (!$stmt->execute()) {
        http_response_code(500);
        echo json_encode(['message' => 'Fehler beim Speichern des Benutzers: ' . $stmt->error]);
        exit;
    }
    $user_id = $stmt->insert_id;
    $stmt->close();

    // Adressdaten speichern
    $addr = $data['address'];
    $stmt = $conn->prepare("INSERT INTO address (user_id, address_type, street, house_number, post_office_box, postal_code, city, country)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    $stmt->bind_param("isssssss", $user_id, $addr['address_type'], $addr['street'], $addr['house_number'], $addr['post_office_box'], $addr['postal_code'], $addr['city'], $addr['country']);
    if (!$stmt->execute()) {
        http_response_code(500);
        echo json_encode(['message' => 'Adresse konnte nicht gespeichert werden: ' . $stmt->error]);
        exit;
    }

    echo json_encode(['message' => 'Registrierung erfolgreich!']);
}

// === Login ===
elseif ($action === 'login') {
    if (empty($data['email']) || empty($data['password'])) {
        http_response_code(400);
        echo json_encode(['message' => 'E-Mail und Passwort erforderlich.']);
        exit;
    }

    $stmt = $conn->prepare("SELECT user_id, username, password_hash, user_type FROM user WHERE email = ?");
    $stmt->bind_param("s", $data['email']);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($user = $result->fetch_assoc()) {
        if (password_verify($data['password'], $user['password_hash'])) {
            $_SESSION['user'] = [
                'id' => $user['user_id'],
                'username' => $user['username'],
                'email' => $data['email'],
                'user_type' => $user['user_type']
            ];
            echo json_encode(['message' => 'Login erfolgreich', 'user' => $_SESSION['user']]);
        } else {
            http_response_code(401);
            echo json_encode(['message' => 'Falsches Passwort.']);
        }
    } else {
        http_response_code(404);
        echo json_encode(['message' => 'Benutzer nicht gefunden.']);
    }

    $stmt->close();
}

// === Session prüfen ===
elseif ($action === 'check_session') {
    if (isset($_SESSION['user'])) {
        echo json_encode(['authenticated' => true, 'user' => $_SESSION['user']]);
    } else {
        http_response_code(401);
        echo json_encode(['authenticated' => false]);
    }
}

// === Logout ===
elseif ($action === 'logout') {
    session_destroy();
    echo json_encode(['message' => 'Logout erfolgreich.']);
}

$conn->close();
?>