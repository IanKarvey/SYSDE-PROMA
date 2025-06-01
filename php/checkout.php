<?php
require_once 'config.php';
require_once 'session.php';
require_once 'utils.php';

header('Content-Type: application/json');
$method = $_SERVER['REQUEST_METHOD'];
$user = get_user();

function require_staff_admin($user) {
    if (!$user || !in_array($user['role'], ['staff', 'admin'])) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Forbidden.']);
        exit;
    }
}

if ($method === 'GET') {
    require_login();
    // List all currently checked out items
    $stmt = $pdo->query('SELECT c.*, u.first_name, u.last_name, i.name AS item_name FROM checkouts c JOIN users u ON c.user_id=u.id JOIN inventory i ON c.item_id=i.id WHERE c.status="checked-out" ORDER BY c.date_out DESC');
    $items = $stmt->fetchAll();
    echo json_encode(['success' => true, 'data' => $items]);
    exit;
}

if ($method === 'POST') {
    require_login();
    require_staff_admin($user);
    $item_id = intval($_POST['item_id'] ?? 0);
    $user_id = intval($_POST['user_id'] ?? 0);
    $due_date = $_POST['due_date'] ?? '';
    $notes = sanitize_string($_POST['notes'] ?? '');
    if (!$item_id || !$user_id || !$due_date) {
        echo json_encode(['success' => false, 'message' => 'Missing required fields.']);
        exit;
    }
    $stmt = $pdo->prepare('INSERT INTO checkouts (item_id, user_id, date_out, due_date, status, notes) VALUES (?, ?, CURDATE(), ?, "checked-out", ?)');
    $stmt->execute([$item_id, $user_id, $due_date, $notes]);
    // Update inventory status
    $pdo->prepare('UPDATE inventory SET status="checked-out" WHERE id=?')->execute([$item_id]);
    echo json_encode(['success' => true, 'message' => 'Item checked out.']);
    exit;
}

if ($method === 'PUT') {
    require_login();
    require_staff_admin($user);
    parse_str(file_get_contents('php://input'), $_PUT);
    $id = intval($_PUT['id'] ?? 0);
    $condition_in = sanitize_string($_PUT['condition_in'] ?? 'good');
    $notes = sanitize_string($_PUT['notes'] ?? '');
    // Mark as returned
    $stmt = $pdo->prepare('UPDATE checkouts SET date_in=CURDATE(), condition_in=?, notes=?, status="returned" WHERE id=?');
    $stmt->execute([$condition_in, $notes, $id]);
    // Get item_id to update inventory
    $stmt = $pdo->prepare('SELECT item_id FROM checkouts WHERE id=?');
    $stmt->execute([$id]);
    $item_id = $stmt->fetchColumn();
    if ($item_id) {
        $pdo->prepare('UPDATE inventory SET status="available" WHERE id=?')->execute([$item_id]);
    }
    echo json_encode(['success' => true, 'message' => 'Item checked in.']);
    exit;
}

echo json_encode(['success' => false, 'message' => 'Invalid request.']); 