<?php
require_once 'config.php';
require_once 'session.php';
require_once 'utils.php';

// Generate cryptographically secure authorization code
function generateSecureAuthCode($length = 8) {
    $characters = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    $code = '';
    $max = strlen($characters) - 1;

    for ($i = 0; $i < $length; $i++) {
        $code .= $characters[random_int(0, $max)];
    }

    return $code;
}

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
        // Admin/staff: only current/active requests (not completed history)
        $sql = 'SELECT r.*, u.first_name, u.last_name, i.name AS item_name,
                       ac.code as authorization_code, ac.status as code_status,
                       ac.expires_at as code_expires_at, ac.used_at as code_used_at,
                       ac.created_at as code_created_at
                FROM requests r
                JOIN users u ON r.user_id=u.id
                JOIN inventory i ON r.item_id=i.id
                LEFT JOIN authorization_codes ac ON r.id = ac.request_id
                WHERE r.status IN ("pending", "approved")';
        $params = [];

        if ($search) {
            $sql .= ' AND (i.name LIKE ? OR u.first_name LIKE ? OR u.last_name LIKE ? OR r.status LIKE ?)';
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
        // User: only their current/active requests (not completed history)
        $sql = 'SELECT r.*, i.name AS item_name, u.first_name, u.last_name,
                       ac.code as authorization_code, ac.status as code_status,
                       ac.expires_at as code_expires_at, ac.used_at as code_used_at,
                       ac.created_at as code_created_at
                FROM requests r
                JOIN inventory i ON r.item_id=i.id
                JOIN users u ON r.user_id=u.id
                LEFT JOIN authorization_codes ac ON r.id = ac.request_id
                WHERE r.user_id=? AND r.status IN ("pending", "approved")';
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

    // Process authorization code data for each request
    foreach ($requests as &$request) {
        if ($request['authorization_code']) {
            // Calculate time remaining for active codes
            if ($request['code_status'] === 'active' && $request['code_expires_at']) {
                $now = new DateTime();
                $expires = new DateTime($request['code_expires_at']);
                $diff = $expires->diff($now);

                if ($expires < $now) {
                    $request['code_expired'] = true;
                    $request['time_remaining'] = 'Expired';
                } else {
                    $request['code_expired'] = false;
                    $hours = $diff->h + $diff->days * 24;
                    $minutes = $diff->i;
                    $seconds = $diff->s;

                    if ($hours > 0) {
                        $request['time_remaining'] = "{$hours}h {$minutes}m {$seconds}s";
                    } elseif ($minutes > 0) {
                        $request['time_remaining'] = "{$minutes}m {$seconds}s";
                    } else {
                        $request['time_remaining'] = "{$seconds}s";
                    }
                }
            } else {
                $request['code_expired'] = $request['code_status'] === 'expired';
                $request['time_remaining'] = null;
            }
        }
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
    $notes = trim(sanitize_string($_POST['purpose'] ?? '')); // Map 'purpose' from form to 'notes' in database

    // Enhanced input validation
    if (!$item_id || !$quantity || !$needed_by || !$notes) {
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

    // Validate notes length
    if (strlen($notes) < 10 || strlen($notes) > 500) {
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
        $stmt = $pdo->prepare('INSERT INTO requests (item_id, user_id, quantity, needed_by, notes, status) VALUES (?, ?, ?, ?, ?, "pending")');
        $stmt->execute([$item_id, $user['id'], $quantity, $needed_by, $notes]);
        
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

        // If approving request, generate authorization code instead of immediate inventory deduction
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

            // Generate authorization code
            $code = generateSecureAuthCode(8);

            // Ensure code is unique
            do {
                $stmt = $pdo->prepare("SELECT id FROM authorization_codes WHERE code = ?");
                $stmt->execute([$code]);
                if ($stmt->fetch()) {
                    $code = generateSecureAuthCode(8);
                } else {
                    break;
                }
            } while (true);

            // Set expiry to 48 hours from now
            $expires_at = date('Y-m-d H:i:s', strtotime('+48 hours'));

            // Insert authorization code
            $stmt = $pdo->prepare("
                INSERT INTO authorization_codes (
                    code, request_id, user_id, item_id, expires_at
                ) VALUES (?, ?, ?, ?, ?)
            ");
            $stmt->execute([
                $code,
                $id,
                $request['user_id'],
                $request['item_id'],
                $expires_at
            ]);

            // Log authorization code generation
            try {
                $stmt = $pdo->prepare('INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details, created_at) VALUES (?, ?, ?, ?, ?, NOW())');
                $log_details = "Generated authorization code {$code} for approved request #{$id} ({$inventory_item['name']}) - expires {$expires_at}";
                $stmt->execute([$user['id'], 'generate_auth_code', 'authorization_codes', $pdo->lastInsertId(), $log_details]);
            } catch (PDOException $log_error) {
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
        $response_data = ['success' => true, 'message' => $message];

        if ($status === 'approved' && isset($code)) {
            $message .= " Authorization code generated: $code (expires in 48 hours).";
            $response_data['message'] = $message;
            $response_data['authorization_code'] = $code;
            $response_data['expires_at'] = $expires_at;
        }

        echo json_encode($response_data);

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