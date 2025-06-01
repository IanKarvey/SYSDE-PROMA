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
    // Staff/admin: all issues, others: only their reported issues
    if (in_array($user['role'], ['staff','admin'])) {
        $stmt = $pdo->query('SELECT iss.*, u.first_name, u.last_name, i.name AS item_name FROM issues iss JOIN users u ON iss.user_id=u.id JOIN inventory i ON iss.item_id=i.id ORDER BY iss.created_at DESC');
        $issues = $stmt->fetchAll();
    } else {
        $stmt = $pdo->prepare('SELECT iss.*, i.name AS item_name FROM issues iss JOIN inventory i ON iss.item_id=i.id WHERE iss.user_id=? ORDER BY iss.created_at DESC');
        $stmt->execute([$user['id']]);
        $issues = $stmt->fetchAll();
    }
    echo json_encode(['success' => true, 'data' => $issues]);
    exit;
}

if ($method === 'POST') {
    require_login();
    $item_id = intval($_POST['item_id'] ?? 0);
    $type = sanitize_string($_POST['type'] ?? 'other');
    $severity = sanitize_string($_POST['severity'] ?? 'low');
    $description = sanitize_string($_POST['description'] ?? '');
    $image = null;
    if (!$item_id || !$type || !$severity || !$description) {
        echo json_encode(['success' => false, 'message' => 'Missing required fields.']);
        exit;
    }
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
    $stmt = $pdo->prepare('INSERT INTO issues (item_id, user_id, type, severity, description, image, date_reported, status) VALUES (?, ?, ?, ?, ?, ?, CURDATE(), "open")');
    $stmt->execute([$item_id, $user['id'], $type, $severity, $description, $image]);
    echo json_encode(['success' => true, 'message' => 'Issue reported.']);
    exit;
}

if ($method === 'PUT') {
    require_login();
    require_staff_admin($user);
    parse_str(file_get_contents('php://input'), $_PUT);
    $id = intval($_PUT['id'] ?? 0);
    $stmt = $pdo->prepare('UPDATE issues SET status="resolved" WHERE id=?');
    $stmt->execute([$id]);
    echo json_encode(['success' => true, 'message' => 'Issue marked as resolved.']);
    exit;
}

echo json_encode(['success' => false, 'message' => 'Invalid request.']); 