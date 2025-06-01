<?php
require_once 'config.php';
require_once 'session.php';
require_once 'utils.php';

header('Content-Type: application/json');

$method = $_SERVER['REQUEST_METHOD'];
$user = get_user();

// Helper: Only staff/admin
function require_staff_admin($user) {
    if (!$user || !in_array($user['role'], ['staff', 'admin'])) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Forbidden.']);
        exit;
    }
}

if ($method === 'GET') {
    // List/search inventory
    $search = isset($_GET['search']) ? '%' . sanitize_string($_GET['search']) . '%' : '%';
    $category = $_GET['category'] ?? '';
    $status = $_GET['status'] ?? '';
    $sql = 'SELECT * FROM inventory WHERE name LIKE ?';
    $params = [$search];
    if ($category && $category !== 'all') {
        $sql .= ' AND category = ?';
        $params[] = $category;
    }
    if ($status && $status !== 'all') {
        $sql .= ' AND status = ?';
        $params[] = $status;
    }
    $sql .= ' ORDER BY created_at DESC';
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $items = $stmt->fetchAll();
    echo json_encode(['success' => true, 'data' => $items]);
    exit;
}

if ($method === 'POST') {
    require_login();
    require_staff_admin($user);
    $name = sanitize_string($_POST['name'] ?? '');
    $category = sanitize_string($_POST['category'] ?? '');
    $quantity = intval($_POST['quantity'] ?? 1);
    $status = sanitize_string($_POST['status'] ?? 'available');
    $location = sanitize_string($_POST['location'] ?? '');
    $description = sanitize_string($_POST['description'] ?? '');
    $last_checked = $_POST['last_checked'] ?? null;
    $image = null;
    // Handle file upload
    if (!empty($_FILES['image']['name'])) {
        $target_dir = '../uploads/';
        if (!is_dir($target_dir)) mkdir($target_dir, 0777, true);
        $filename = uniqid() . '_' . basename($_FILES['image']['name']);
        $target_file = $target_dir . $filename;
        if (move_uploaded_file($_FILES['image']['tmp_name'], $target_file)) {
            $image = $filename;
        }
    }
    $stmt = $pdo->prepare('INSERT INTO inventory (name, category, quantity, status, location, description, image, last_checked) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    $stmt->execute([$name, $category, $quantity, $status, $location, $description, $image, $last_checked]);
    echo json_encode(['success' => true, 'message' => 'Item added.']);
    exit;
}

if ($method === 'PUT') {
    require_login();
    require_staff_admin($user);
    parse_str(file_get_contents('php://input'), $_PUT);
    $id = intval($_PUT['id'] ?? 0);
    $name = sanitize_string($_PUT['name'] ?? '');
    $category = sanitize_string($_PUT['category'] ?? '');
    $quantity = intval($_PUT['quantity'] ?? 1);
    $status = sanitize_string($_PUT['status'] ?? 'available');
    $location = sanitize_string($_PUT['location'] ?? '');
    $description = sanitize_string($_PUT['description'] ?? '');
    $last_checked = $_PUT['last_checked'] ?? null;
    $stmt = $pdo->prepare('UPDATE inventory SET name=?, category=?, quantity=?, status=?, location=?, description=?, last_checked=? WHERE id=?');
    $stmt->execute([$name, $category, $quantity, $status, $location, $description, $last_checked, $id]);
    echo json_encode(['success' => true, 'message' => 'Item updated.']);
    exit;
}

if ($method === 'DELETE') {
    require_login();
    require_staff_admin($user);
    parse_str(file_get_contents('php://input'), $_DELETE);
    $id = intval($_DELETE['id'] ?? 0);
    $stmt = $pdo->prepare('DELETE FROM inventory WHERE id=?');
    $stmt->execute([$id]);
    echo json_encode(['success' => true, 'message' => 'Item deleted.']);
    exit;
}

echo json_encode(['success' => false, 'message' => 'Invalid request.']); 