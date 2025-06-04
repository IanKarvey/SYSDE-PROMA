<?php
session_start();
require_once 'config.php';

// Enable error reporting for debugging
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Set JSON header
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Check if user is logged in
if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Not authenticated']);
    exit();
}

$user_id = $_SESSION['user_id'];
$user_role = $_SESSION['user_role'] ?? '';

try {
    $method = $_SERVER['REQUEST_METHOD'];
    
    switch ($method) {
        case 'GET':
            handleGetRequest($pdo, $user_id, $user_role);
            break;
        case 'POST':
            handlePostRequest($pdo, $user_id, $user_role);
            break;
        case 'PUT':
            handlePutRequest($pdo, $user_id, $user_role);
            break;
        default:
            http_response_code(405);
            echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    }
} catch (Exception $e) {
    error_log("Authorization API Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Internal server error: ' . $e->getMessage()]);
}

function handleGetRequest($pdo, $user_id, $user_role) {
    $action = $_GET['action'] ?? 'list_codes';
    
    switch ($action) {
        case 'validate_code':
            validateAuthorizationCode($pdo, $user_id, $_GET['code'] ?? '');
            break;
        case 'list_codes':
            listAuthorizationCodes($pdo, $user_id, $user_role);
            break;
        case 'my_codes':
            getUserAuthorizationCodes($pdo, $user_id);
            break;
        default:
            listAuthorizationCodes($pdo, $user_id, $user_role);
    }
}

function handlePostRequest($pdo, $user_id, $user_role) {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input) {
        $input = $_POST;
    }
    $action = $input['action'] ?? '';
    
    switch ($action) {
        case 'generate_code':
            generateAuthorizationCode($pdo, $user_id, $user_role, $input);
            break;
        case 'use_code':
            useAuthorizationCode($pdo, $user_id, $input);
            break;
        default:
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Invalid action']);
    }
}

function handlePutRequest($pdo, $user_id, $user_role) {
    $input = json_decode(file_get_contents('php://input'), true);
    $action = $input['action'] ?? '';
    
    switch ($action) {
        case 'cancel_code':
            cancelAuthorizationCode($pdo, $user_id, $user_role, $input);
            break;
        default:
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Invalid action']);
    }
}

// Generate cryptographically secure authorization code
function generateSecureCode($length = 8) {
    $characters = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    $code = '';
    $max = strlen($characters) - 1;
    
    for ($i = 0; $i < $length; $i++) {
        $code .= $characters[random_int(0, $max)];
    }
    
    return $code;
}

// Generate authorization code for approved request
function generateAuthorizationCode($pdo, $user_id, $user_role, $input) {
    // Only admin/staff can generate codes
    if (!in_array($user_role, ['admin', 'staff'])) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Insufficient permissions']);
        return;
    }
    
    try {
        $pdo->beginTransaction();
        
        $request_id = intval($input['request_id'] ?? 0);
        $expiry_hours = intval($input['expiry_hours'] ?? 48); // Default 48 hours
        
        if (!$request_id) {
            throw new Exception('Request ID is required');
        }
        
        // Get request details
        $stmt = $pdo->prepare("
            SELECT r.*, u.first_name, u.last_name, u.email, i.name as item_name
            FROM requests r
            JOIN users u ON r.user_id = u.id
            JOIN inventory i ON r.item_id = i.id
            WHERE r.id = ? AND r.status = 'approved'
        ");
        $stmt->execute([$request_id]);
        $request = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$request) {
            throw new Exception('Request not found or not approved');
        }
        
        // Check if code already exists for this request
        $stmt = $pdo->prepare("
            SELECT id FROM authorization_codes 
            WHERE request_id = ? AND status IN ('active', 'used')
        ");
        $stmt->execute([$request_id]);
        if ($stmt->fetch()) {
            throw new Exception('Authorization code already exists for this request');
        }
        
        // Generate unique code
        do {
            $code = generateSecureCode(8);
            $stmt = $pdo->prepare("SELECT id FROM authorization_codes WHERE code = ?");
            $stmt->execute([$code]);
        } while ($stmt->fetch());
        
        // Calculate expiry time
        $expires_at = date('Y-m-d H:i:s', strtotime("+{$expiry_hours} hours"));
        
        // Insert authorization code
        $stmt = $pdo->prepare("
            INSERT INTO authorization_codes (
                code, request_id, user_id, item_id, expires_at, created_by
            ) VALUES (?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $code, 
            $request_id, 
            $request['user_id'], 
            $request['item_id'], 
            $expires_at, 
            $user_id
        ]);
        
        $code_id = $pdo->lastInsertId();
        
        // Log activity
        try {
            $stmt = $pdo->prepare("
                INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details, created_at) 
                VALUES (?, ?, ?, ?, ?, NOW())
            ");
            $details = "Generated authorization code {$code} for request #{$request_id} ({$request['item_name']}) - expires {$expires_at}";
            $stmt->execute([$user_id, 'generate_auth_code', 'authorization_codes', $code_id, $details]);
        } catch (PDOException $log_error) {
            error_log("Activity logging failed: " . $log_error->getMessage());
        }
        
        $pdo->commit();
        
        echo json_encode([
            'success' => true,
            'message' => 'Authorization code generated successfully',
            'data' => [
                'code' => $code,
                'expires_at' => $expires_at,
                'request_id' => $request_id,
                'user_name' => $request['first_name'] . ' ' . $request['last_name'],
                'item_name' => $request['item_name'],
                'expiry_hours' => $expiry_hours
            ]
        ]);
        
    } catch (Exception $e) {
        $pdo->rollBack();
        error_log("Generate authorization code error: " . $e->getMessage());
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
}

// Validate authorization code
function validateAuthorizationCode($pdo, $user_id, $code) {
    try {
        if (!$code) {
            throw new Exception('Authorization code is required');
        }
        
        $stmt = $pdo->prepare("
            SELECT ac.*, r.quantity, r.needed_by as request_due_date,
                   u.first_name, u.last_name, i.name as item_name, i.quantity as available_quantity
            FROM authorization_codes ac
            JOIN requests r ON ac.request_id = r.id
            JOIN users u ON ac.user_id = u.id
            JOIN inventory i ON ac.item_id = i.id
            WHERE ac.code = ?
        ");
        $stmt->execute([$code]);
        $auth_code = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$auth_code) {
            throw new Exception('Invalid authorization code');
        }

        // Check if code is in active status first
        if ($auth_code['status'] !== 'active') {
            if ($auth_code['status'] === 'used') {
                throw new Exception('Authorization code has already been used');
            } elseif ($auth_code['status'] === 'cancelled') {
                throw new Exception('Authorization code has been cancelled');
            } elseif ($auth_code['status'] === 'expired') {
                throw new Exception('Authorization code has expired');
            } else {
                throw new Exception('Authorization code is not active');
            }
        }
        
        // Check if code has expired (after status check)
        if (strtotime($auth_code['expires_at']) < time()) {
            // Mark as expired
            $stmt = $pdo->prepare("UPDATE authorization_codes SET status = 'expired' WHERE code = ?");
            $stmt->execute([$code]);
            throw new Exception('Authorization code has expired');
        }
        
        // Verify user is the original requestor (for students)
        if ($_SESSION['user_role'] === 'student' && $auth_code['user_id'] !== $user_id) {
            throw new Exception('You are not authorized to use this code');
        }
        
        echo json_encode([
            'success' => true,
            'message' => 'Authorization code is valid',
            'data' => [
                'code' => $code,
                'request_id' => $auth_code['request_id'],
                'user_id' => $auth_code['user_id'],
                'item_id' => $auth_code['item_id'],
                'user_name' => $auth_code['first_name'] . ' ' . $auth_code['last_name'],
                'item_name' => $auth_code['item_name'],
                'quantity' => $auth_code['quantity'],
                'due_date' => $auth_code['request_due_date'],
                'expires_at' => $auth_code['expires_at'],
                'available_quantity' => $auth_code['available_quantity']
            ]
        ]);
        
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
}

// Use authorization code for checkout
function useAuthorizationCode($pdo, $user_id, $input) {
    try {
        $pdo->beginTransaction();

        $code = $input['code'] ?? '';
        $notes = $input['notes'] ?? '';

        if (!$code) {
            throw new Exception('Authorization code is required');
        }

        // Validate code first
        $stmt = $pdo->prepare("
            SELECT ac.*, r.quantity, r.needed_by as request_due_date, i.quantity as available_quantity
            FROM authorization_codes ac
            JOIN requests r ON ac.request_id = r.id
            JOIN inventory i ON ac.item_id = i.id
            WHERE ac.code = ? AND ac.status = 'active'
        ");
        $stmt->execute([$code]);
        $auth_code = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$auth_code) {
            throw new Exception('Invalid or inactive authorization code');
        }

        // Check expiry
        if (strtotime($auth_code['expires_at']) < time()) {
            $stmt = $pdo->prepare("UPDATE authorization_codes SET status = 'expired' WHERE code = ?");
            $stmt->execute([$code]);
            throw new Exception('Authorization code has expired');
        }

        // Verify user authorization
        if ($_SESSION['user_role'] === 'student' && $auth_code['user_id'] !== $user_id) {
            throw new Exception('You are not authorized to use this code');
        }

        // Check inventory availability
        if ($auth_code['available_quantity'] < $auth_code['quantity']) {
            throw new Exception('Insufficient inventory available for checkout');
        }

        // Create checkout record
        $stmt = $pdo->prepare("
            INSERT INTO checkouts (
                item_id, user_id, date_out, due_date, status, notes,
                authorization_code, request_id, created_at
            ) VALUES (?, ?, NOW(), ?, 'checked_out', ?, ?, ?, NOW())
        ");
        $stmt->execute([
            $auth_code['item_id'],
            $auth_code['user_id'],
            $auth_code['request_due_date'],
            $notes,
            $code,
            $auth_code['request_id']
        ]);

        $checkout_id = $pdo->lastInsertId();

        // Update inventory quantity
        $new_quantity = $auth_code['available_quantity'] - $auth_code['quantity'];
        $new_status = $new_quantity > 0 ? 'available' : 'checked-out';

        $stmt = $pdo->prepare("
            UPDATE inventory
            SET quantity = ?, status = ?, last_checked = NOW()
            WHERE id = ?
        ");
        $stmt->execute([$new_quantity, $new_status, $auth_code['item_id']]);

        // Mark authorization code as used
        $stmt = $pdo->prepare("
            UPDATE authorization_codes
            SET status = 'used', used_at = NOW(), checkout_id = ?
            WHERE code = ?
        ");
        $stmt->execute([$checkout_id, $code]);

        // Update request status to completed
        $stmt = $pdo->prepare("
            UPDATE requests
            SET status = 'completed', updated_at = NOW()
            WHERE id = ?
        ");
        $stmt->execute([$auth_code['request_id']]);

        // Log activity
        try {
            $stmt = $pdo->prepare("
                INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details, created_at)
                VALUES (?, ?, ?, ?, ?, NOW())
            ");
            $details = "Used authorization code {$code} for checkout - Request #{$auth_code['request_id']}";
            $stmt->execute([$user_id, 'use_auth_code', 'checkouts', $checkout_id, $details]);
        } catch (PDOException $log_error) {
            error_log("Activity logging failed: " . $log_error->getMessage());
        }

        $pdo->commit();

        echo json_encode([
            'success' => true,
            'message' => 'Equipment checked out successfully using authorization code',
            'data' => [
                'checkout_id' => $checkout_id,
                'code' => $code,
                'new_quantity' => $new_quantity
            ]
        ]);

    } catch (Exception $e) {
        $pdo->rollBack();
        error_log("Use authorization code error: " . $e->getMessage());
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
}

// List authorization codes (admin/staff)
function listAuthorizationCodes($pdo, $user_id, $user_role) {
    if (!in_array($user_role, ['admin', 'staff'])) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Insufficient permissions']);
        return;
    }

    try {
        $stmt = $pdo->prepare("
            SELECT ac.*,
                   u.first_name, u.last_name, u.email,
                   i.name as item_name,
                   r.quantity as request_quantity,
                   creator.first_name as created_by_name
            FROM authorization_codes ac
            JOIN users u ON ac.user_id = u.id
            JOIN inventory i ON ac.item_id = i.id
            JOIN requests r ON ac.request_id = r.id
            JOIN users creator ON ac.created_by = creator.id
            ORDER BY ac.created_at DESC
        ");
        $stmt->execute();
        $codes = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Update expired codes
        $stmt = $pdo->prepare("
            UPDATE authorization_codes
            SET status = 'expired'
            WHERE status = 'active' AND expires_at < NOW()
        ");
        $stmt->execute();

        echo json_encode([
            'success' => true,
            'data' => $codes,
            'count' => count($codes)
        ]);

    } catch (PDOException $e) {
        error_log("Error fetching authorization codes: " . $e->getMessage());
        echo json_encode(['success' => false, 'message' => 'Failed to fetch authorization codes']);
    }
}

// Get user's authorization codes
function getUserAuthorizationCodes($pdo, $user_id) {
    try {
        $stmt = $pdo->prepare("
            SELECT ac.*, i.name as item_name, r.quantity as request_quantity
            FROM authorization_codes ac
            JOIN inventory i ON ac.item_id = i.id
            JOIN requests r ON ac.request_id = r.id
            WHERE ac.user_id = ?
            ORDER BY ac.created_at DESC
        ");
        $stmt->execute([$user_id]);
        $codes = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode([
            'success' => true,
            'data' => $codes,
            'count' => count($codes)
        ]);

    } catch (PDOException $e) {
        error_log("Error fetching user authorization codes: " . $e->getMessage());
        echo json_encode(['success' => false, 'message' => 'Failed to fetch authorization codes']);
    }
}

// Cancel authorization code
function cancelAuthorizationCode($pdo, $user_id, $user_role, $input) {
    if (!in_array($user_role, ['admin', 'staff'])) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Insufficient permissions']);
        return;
    }

    try {
        $code = $input['code'] ?? '';
        $reason = $input['reason'] ?? 'Cancelled by admin';

        if (!$code) {
            throw new Exception('Authorization code is required');
        }

        $stmt = $pdo->prepare("
            UPDATE authorization_codes
            SET status = 'cancelled', updated_at = NOW()
            WHERE code = ? AND status = 'active'
        ");
        $stmt->execute([$code]);

        if ($stmt->rowCount() === 0) {
            throw new Exception('Authorization code not found or already processed');
        }

        // Log activity
        try {
            $stmt = $pdo->prepare("
                INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details, created_at)
                VALUES (?, ?, ?, ?, ?, NOW())
            ");
            $details = "Cancelled authorization code {$code} - Reason: {$reason}";
            $stmt->execute([$user_id, 'cancel_auth_code', 'authorization_codes', 0, $details]);
        } catch (PDOException $log_error) {
            error_log("Activity logging failed: " . $log_error->getMessage());
        }

        echo json_encode([
            'success' => true,
            'message' => 'Authorization code cancelled successfully'
        ]);

    } catch (Exception $e) {
        error_log("Cancel authorization code error: " . $e->getMessage());
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
}

?>
