<?php
require_once 'config.php';
require_once 'session.php';
require_once 'utils.php';

header('Content-Type: application/json');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('X-XSS-Protection: 1; mode=block');
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
    
    // Handle search functionality
    $search = $_GET['search'] ?? '';
    $limit = isset($_GET['limit']) ? intval($_GET['limit']) : null;

    if ($user['role'] === 'admin' || $user['role'] === 'staff') {
        // Admin/staff: all requests
        $sql = 'SELECT r.*, u.first_name, u.last_name, i.name AS item_name FROM requests r JOIN users u ON r.user_id=u.id JOIN inventory i ON r.item_id=i.id';
        $params = [];

        if ($search) {
            $sql .= ' WHERE (i.name LIKE ? OR u.first_name LIKE ? OR u.last_name LIKE ? OR r.status LIKE ?)';
            $searchParam = "%$search%";
            $params = [$searchParam, $searchParam, $searchParam, $searchParam];
        }

        $sql .= ' ORDER BY r.created_at DESC';

        if ($limit) {
            $sql .= ' LIMIT ?';
            $params[] = $limit;
        }

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $requests = $stmt->fetchAll();
    } else {
        // User: only their requests
        $sql = 'SELECT r.*, i.name AS item_name FROM requests r JOIN inventory i ON r.item_id=i.id WHERE r.user_id=?';
        $params = [$user['id']];

        if ($search) {
            $sql .= ' AND (i.name LIKE ? OR r.status LIKE ?)';
            $searchParam = "%$search%";
            $params[] = $searchParam;
            $params[] = $searchParam;
        }

        $sql .= ' ORDER BY r.created_at DESC';

        if ($limit) {
            $sql .= ' LIMIT ?';
            $params[] = $limit;
        }

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
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
    $quantity = intval($_POST['quantity'] ?? 1);
    $needed_by = trim($_POST['needed_by'] ?? '');
    $purpose = trim(sanitize_string($_POST['purpose'] ?? ''));

    // Enhanced input validation
    if (!$item_id || !$quantity || !$needed_by || !$purpose) {
        echo json_encode(['success' => false, 'message' => 'Missing required fields.']);
        exit;
    }

    if ($quantity < 1 || $quantity > 10) {
        echo json_encode(['success' => false, 'message' => 'Quantity must be between 1 and 10.']);
        exit;
    }

    // Validate date format and ensure it's not in the past
    $needed_date = DateTime::createFromFormat('Y-m-d', $needed_by);
    if (!$needed_date || $needed_date->format('Y-m-d') !== $needed_by) {
        echo json_encode(['success' => false, 'message' => 'Invalid date format.']);
        exit;
    }

    $today = new DateTime();
    if ($needed_date < $today) {
        echo json_encode(['success' => false, 'message' => 'Needed by date cannot be in the past.']);
        exit;
    }

    // Validate purpose length
    if (strlen($purpose) < 10 || strlen($purpose) > 500) {
        echo json_encode(['success' => false, 'message' => 'Purpose must be between 10 and 500 characters.']);
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
        $stmt = $pdo->prepare('INSERT INTO requests (item_id, user_id, quantity, date_requested, needed_by, purpose, status) VALUES (?, ?, ?, CURDATE(), ?, ?, "pending")');
        $stmt->execute([$item_id, $user['id'], $quantity, $needed_by, $purpose]);
        
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
    if (!in_array($status, ['approved', 'rejected', 'cancelled'])) {
        echo json_encode(['success' => false, 'message' => 'Invalid status.']);
        exit;
    }

    // Check permissions
    if ($status === 'cancelled') {
        // Students can cancel their own pending requests
        if ($user['role'] === 'student') {
            $stmt = $pdo->prepare('SELECT user_id, status FROM requests WHERE id = ?');
            $stmt->execute([$id]);
            $request = $stmt->fetch();

            if (!$request || $request['user_id'] != $user['id']) {
                echo json_encode(['success' => false, 'message' => 'Unauthorized to cancel this request.']);
                exit;
            }

            if ($request['status'] !== 'pending') {
                echo json_encode(['success' => false, 'message' => 'Can only cancel pending requests.']);
                exit;
            }
        } else if (!in_array($user['role'], ['admin', 'staff'])) {
            echo json_encode(['success' => false, 'message' => 'Unauthorized to cancel request.']);
            exit;
        }
    } else {
        // Only admin/staff can approve/reject
        if (!in_array($user['role'], ['admin', 'staff'])) {
            echo json_encode(['success' => false, 'message' => 'Unauthorized to update request status.']);
            exit;
        }
    }

    try {
        // Begin transaction for atomic operations
        $pdo->beginTransaction();

        // Get request details for inventory deduction
        $stmt = $pdo->prepare('SELECT item_id, quantity, user_id FROM requests WHERE id = ?');
        $stmt->execute([$id]);
        $request = $stmt->fetch();

        if (!$request) {
            $pdo->rollBack();
            echo json_encode(['success' => false, 'message' => 'Request not found.']);
            exit;
        }

        // If approving request, check and deduct inventory
        if ($status === 'approved') {
            // Check current inventory availability
            $stmt = $pdo->prepare('SELECT quantity, name FROM inventory WHERE id = ?');
            $stmt->execute([$request['item_id']]);
            $inventory_item = $stmt->fetch();

            if (!$inventory_item) {
                $pdo->rollBack();
                echo json_encode(['success' => false, 'message' => 'Inventory item not found.']);
                exit;
            }

            // Validate sufficient inventory
            if ($inventory_item['quantity'] < $request['quantity']) {
                $pdo->rollBack();
                echo json_encode([
                    'success' => false,
                    'message' => "Insufficient inventory. Available: {$inventory_item['quantity']}, Requested: {$request['quantity']}"
                ]);
                exit;
            }

            // Deduct inventory quantity
            $new_quantity = $inventory_item['quantity'] - $request['quantity'];
            $stmt = $pdo->prepare('UPDATE inventory SET quantity = ? WHERE id = ?');
            $stmt->execute([$new_quantity, $request['item_id']]);

            // Log inventory adjustment (skip if table doesn't exist)
            try {
                $stmt = $pdo->prepare('INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details, created_at) VALUES (?, ?, ?, ?, ?, NOW())');
                $log_details = "Inventory reduced by {$request['quantity']} units for approved request #{$id}. New quantity: {$new_quantity}";
                $stmt->execute([$user['id'], 'inventory_deduction', 'inventory', $request['item_id'], $log_details]);
            } catch (PDOException $log_error) {
                // Continue without logging if table doesn't exist
                error_log("Activity logging failed: " . $log_error->getMessage());
            }
        }

        // Update the request status
        $stmt = $pdo->prepare('UPDATE requests SET status = ? WHERE id = ?');
        $stmt->execute([$status, $id]);

        // Log request status change (skip if table doesn't exist)
        try {
            $stmt = $pdo->prepare('INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details, created_at) VALUES (?, ?, ?, ?, ?, NOW())');
            $log_details = "Request status changed to: {$status}";
            $stmt->execute([$user['id'], 'request_status_update', 'request', $id, $log_details]);
        } catch (PDOException $log_error) {
            // Continue without logging if table doesn't exist
            error_log("Activity logging failed: " . $log_error->getMessage());
        }

        // Commit transaction
        $pdo->commit();

        $message = "Request $status successfully.";
        if ($status === 'approved') {
            $message .= " Inventory updated automatically.";
        }

        echo json_encode(['success' => true, 'message' => $message]);

    } catch (PDOException $e) {
        $pdo->rollBack();
        error_log("Database error during request status update: " . $e->getMessage());
        echo json_encode(['success' => false, 'message' => 'Database error occurred.']);
    }
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