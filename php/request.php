<?php
require_once 'config.php';
require_once 'session.php';
require_once 'utils.php';

header('Content-Type: application/json');
$method = $_SERVER['REQUEST_METHOD'];
$user = get_user();

function require_admin($user) {
    if (!$user || $user['role'] !== 'admin') {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Forbidden.']);
        exit;
    }
}

if ($method === 'GET') {
    require_login();
    
    // If specific request ID is provided
    if (isset($_GET['id'])) {
        $id = intval($_GET['id']);
        $stmt = $pdo->prepare('
            SELECT r.*, u.first_name, u.last_name, i.name AS item_name 
            FROM requests r 
            JOIN users u ON r.user_id=u.id 
            JOIN inventory i ON r.item_id=i.id 
            WHERE r.id=?
        ');
        $stmt->execute([$id]);
        $request = $stmt->fetch();
        
        if (!$request) {
            echo json_encode(['success' => false, 'message' => 'Request not found.']);
            exit;
        }
        
        // For students, only allow viewing their own requests
        if ($user['role'] === 'student' && $request['user_id'] != $user['id']) {
            echo json_encode(['success' => false, 'message' => 'Unauthorized.']);
            exit;
        }
        
        echo json_encode(['success' => true, 'request' => $request]);
        exit;
    }
    
    if ($user['role'] === 'admin' || $user['role'] === 'staff') {
        // Admin/staff: all requests
        $stmt = $pdo->query('SELECT r.*, u.first_name, u.last_name, i.name AS item_name FROM requests r JOIN users u ON r.user_id=u.id JOIN inventory i ON r.item_id=i.id ORDER BY r.created_at DESC');
        $requests = $stmt->fetchAll();
    } else {
        // User: only their requests
        $stmt = $pdo->prepare('SELECT r.*, i.name AS item_name FROM requests r JOIN inventory i ON r.item_id=i.id WHERE r.user_id=? ORDER BY r.created_at DESC');
        $stmt->execute([$user['id']]);
        $requests = $stmt->fetchAll();
    }
    echo json_encode(['success' => true, 'data' => $requests]);
    exit;
}

if ($method === 'POST') {
    require_login();
    // Only students can make new requests
    if ($user['role'] !== 'student') {
        echo json_encode(['success' => false, 'message' => 'Only students can make requests.']);
        exit;
    }
    $item_id = intval($_POST['item_id'] ?? 0);
    $needed_by = $_POST['needed_by'] ?? '';
    $purpose = sanitize_string($_POST['purpose'] ?? '');
    
    if (!$item_id || !$needed_by || !$purpose) {
        echo json_encode(['success' => false, 'message' => 'Missing required fields.']);
        exit;
    }

    try {
        // First check if item is still available
        $stmt = $pdo->prepare('SELECT status FROM inventory WHERE id = ?');
        $stmt->execute([$item_id]);
        $item = $stmt->fetch();

        if (!$item || $item['status'] !== 'available') {
            echo json_encode(['success' => false, 'message' => 'Item is no longer available.']);
            exit;
        }

        // Insert the request
        $stmt = $pdo->prepare('INSERT INTO requests (item_id, user_id, date_requested, needed_by, purpose, status) VALUES (?, ?, CURDATE(), ?, ?, "pending")');
        $stmt->execute([$item_id, $user['id'], $needed_by, $purpose]);
        
        echo json_encode(['success' => true, 'message' => 'Request submitted successfully.']);
    } catch (PDOException $e) {
        error_log("Database error: " . $e->getMessage());
        echo json_encode(['success' => false, 'message' => 'Failed to submit request.']);
    }
    exit;
}

if ($method === 'PUT') {
    require_login();
    parse_str(file_get_contents('php://input'), $_PUT);
    $id = intval($_PUT['id'] ?? 0);
    $status = sanitize_string($_PUT['status'] ?? '');
    
    // Validate status
    if (!in_array($status, ['approved', 'rejected'])) {
        echo json_encode(['success' => false, 'message' => 'Invalid status.']);
        exit;
    }
    
    // Only admin/staff can approve/reject
    if (!in_array($user['role'], ['admin', 'staff'])) {
        echo json_encode(['success' => false, 'message' => 'Unauthorized to update request status.']);
        exit;
    }
    
    $stmt = $pdo->prepare('UPDATE requests SET status=? WHERE id=?');
    $stmt->execute([$status, $id]);
    echo json_encode(['success' => true, 'message' => 'Request updated.']);
    exit;
}

if ($method === 'DELETE') {
    require_login();
    parse_str(file_get_contents('php://input'), $_DELETE);
    $id = intval($_DELETE['id'] ?? 0);
    // Only admin can delete
    require_admin($user);
    $stmt = $pdo->prepare('DELETE FROM requests WHERE id=?');
    $stmt->execute([$id]);
    echo json_encode(['success' => true, 'message' => 'Request deleted.']);
    exit;
}

echo json_encode(['success' => false, 'message' => 'Invalid request.']);