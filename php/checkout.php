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
$method = $_SERVER['REQUEST_METHOD'];

try {
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
    error_log("Checkout API Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Internal server error: ' . $e->getMessage()]);
}

function handleGetRequest($pdo, $user_id, $user_role) {
    $action = $_GET['action'] ?? 'list_checkouts';

    switch ($action) {
        case 'available_items':
            getAvailableItems($pdo);
            break;
        case 'list_checkouts':
            getCheckouts($pdo, $user_id, $user_role);
            break;
        case 'user_checkouts':
            getUserCheckouts($pdo, $user_id);
            break;
        default:
            getCheckouts($pdo, $user_id, $user_role);
    }
}

function handlePostRequest($pdo, $user_id, $user_role) {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input) {
        $input = $_POST;
    }
    $action = $input['action'] ?? '';

    switch ($action) {
        case 'checkout':
            processCheckout($pdo, $user_id, $user_role, $input);
            break;
        case 'checkin':
            processCheckin($pdo, $user_id, $user_role, $input);
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
        case 'update_checkout':
            updateCheckout($pdo, $user_id, $user_role, $input);
            break;
        default:
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Invalid action']);
    }
}

// Get available items for checkout
function getAvailableItems($pdo) {
    try {
        $stmt = $pdo->prepare("
            SELECT id, name, category, quantity, location, description, status
            FROM inventory
            WHERE status = 'available' AND quantity > 0
            ORDER BY category, name
        ");
        $stmt->execute();
        $items = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode([
            'success' => true,
            'data' => $items,
            'count' => count($items)
        ]);
    } catch (PDOException $e) {
        error_log("Error fetching available items: " . $e->getMessage());
        echo json_encode(['success' => false, 'message' => 'Failed to fetch available items']);
    }
}

// Get checkouts based on user role
function getCheckouts($pdo, $user_id, $user_role) {
    try {
        if ($user_role === 'student') {
            // Students see only their checkouts
            $stmt = $pdo->prepare("
                SELECT c.*, i.name as item_name, u.first_name, u.last_name, i.category, i.location
                FROM checkouts c
                JOIN inventory i ON c.item_id = i.id
                JOIN users u ON c.user_id = u.id
                WHERE c.user_id = ?
                ORDER BY c.date_out DESC
            ");
            $stmt->execute([$user_id]);
        } else {
            // Admin/staff see all checkouts
            $stmt = $pdo->prepare("
                SELECT c.*, i.name as item_name, u.first_name, u.last_name, i.category, i.location
                FROM checkouts c
                JOIN inventory i ON c.item_id = i.id
                JOIN users u ON c.user_id = u.id
                ORDER BY c.date_out DESC
            ");
            $stmt->execute();
        }

        $checkouts = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode([
            'success' => true,
            'data' => $checkouts,
            'count' => count($checkouts)
        ]);
    } catch (PDOException $e) {
        error_log("Error fetching checkouts: " . $e->getMessage());
        echo json_encode(['success' => false, 'message' => 'Failed to fetch checkouts']);
    }
}

// Get user-specific checkouts
function getUserCheckouts($pdo, $user_id) {
    try {
        $stmt = $pdo->prepare("
            SELECT c.*, i.name as item_name, i.category, i.location
            FROM checkouts c
            JOIN inventory i ON c.item_id = i.id
            WHERE c.user_id = ? AND c.status = 'checked_out'
            ORDER BY c.date_out DESC
        ");
        $stmt->execute([$user_id]);
        $checkouts = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode([
            'success' => true,
            'data' => $checkouts,
            'count' => count($checkouts)
        ]);
    } catch (PDOException $e) {
        error_log("Error fetching user checkouts: " . $e->getMessage());
        echo json_encode(['success' => false, 'message' => 'Failed to fetch user checkouts']);
    }
}

// Process checkout request with inventory integration
function processCheckout($pdo, $current_user_id, $user_role, $input) {
    try {
        $pdo->beginTransaction();

        $item_id = intval($input['item_id'] ?? 0);
        $checkout_user_id = intval($input['user_id'] ?? $current_user_id);
        $due_date = $input['due_date'] ?? '';
        $notes = $input['notes'] ?? '';

        // Validate input
        if (!$item_id || !$checkout_user_id || !$due_date) {
            throw new Exception('Missing required fields');
        }

        // Students can only check out for themselves
        if ($user_role === 'student' && $checkout_user_id !== $current_user_id) {
            throw new Exception('Students can only check out items for themselves');
        }

        // Check if item is available
        $stmt = $pdo->prepare("SELECT name, quantity, status FROM inventory WHERE id = ?");
        $stmt->execute([$item_id]);
        $item = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$item) {
            throw new Exception('Item not found');
        }

        if ($item['status'] !== 'available' || $item['quantity'] <= 0) {
            throw new Exception('Item is not available for checkout');
        }

        // Create checkout record
        $stmt = $pdo->prepare("
            INSERT INTO checkouts (item_id, user_id, date_out, due_date, status, notes, created_at)
            VALUES (?, ?, NOW(), ?, 'checked_out', ?, NOW())
        ");
        $stmt->execute([$item_id, $checkout_user_id, $due_date, $notes]);
        $checkout_id = $pdo->lastInsertId();

        // Update inventory quantity
        $new_quantity = $item['quantity'] - 1;
        $new_status = $new_quantity > 0 ? 'available' : 'checked-out';

        $stmt = $pdo->prepare("
            UPDATE inventory
            SET quantity = ?, status = ?, last_checked = NOW()
            WHERE id = ?
        ");
        $stmt->execute([$new_quantity, $new_status, $item_id]);

        // Log activity
        try {
            $stmt = $pdo->prepare("
                INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details, created_at)
                VALUES (?, ?, ?, ?, ?, NOW())
            ");
            $details = "Checked out {$item['name']} (ID: {$item_id}) until {$due_date}";
            $stmt->execute([$current_user_id, 'checkout', 'inventory', $item_id, $details]);
        } catch (PDOException $log_error) {
            // Continue without logging if table doesn't exist
            error_log("Activity logging failed: " . $log_error->getMessage());
        }

        $pdo->commit();

        echo json_encode([
            'success' => true,
            'message' => 'Item checked out successfully',
            'checkout_id' => $checkout_id,
            'new_quantity' => $new_quantity
        ]);

    } catch (Exception $e) {
        $pdo->rollBack();
        error_log("Checkout error: " . $e->getMessage());
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
}

// Process check-in request with inventory integration
function processCheckin($pdo, $current_user_id, $user_role, $input) {
    try {
        $pdo->beginTransaction();

        $checkout_id = intval($input['checkout_id'] ?? 0);
        $condition = $input['condition'] ?? 'good';
        $notes = $input['notes'] ?? '';

        if (!$checkout_id) {
            throw new Exception('Missing checkout ID');
        }

        // Get checkout details
        $stmt = $pdo->prepare("
            SELECT c.*, i.name as item_name, i.quantity as current_quantity
            FROM checkouts c
            JOIN inventory i ON c.item_id = i.id
            WHERE c.id = ? AND c.status = 'checked_out'
        ");
        $stmt->execute([$checkout_id]);
        $checkout = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$checkout) {
            throw new Exception('Checkout record not found or already returned');
        }

        // Students can only check in their own items
        if ($user_role === 'student' && $checkout['user_id'] !== $current_user_id) {
            throw new Exception('Students can only check in their own items');
        }

        // Update checkout record
        $stmt = $pdo->prepare("
            UPDATE checkouts
            SET date_in = NOW(), condition_in = ?, notes = CONCAT(COALESCE(notes, ''), ?, ?), status = 'returned'
            WHERE id = ?
        ");
        $return_notes = $notes ? "\nReturn notes: " . $notes : '';
        $condition_note = "\nCondition on return: " . $condition;
        $stmt->execute([$condition, $condition_note, $return_notes, $checkout_id]);

        // Update inventory quantity and status
        $new_quantity = $checkout['current_quantity'] + 1;
        $new_status = 'available';

        $stmt = $pdo->prepare("
            UPDATE inventory
            SET quantity = ?, status = ?, last_checked = NOW()
            WHERE id = ?
        ");
        $stmt->execute([$new_quantity, $new_status, $checkout['item_id']]);

        // Log activity
        try {
            $stmt = $pdo->prepare("
                INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details, created_at)
                VALUES (?, ?, ?, ?, ?, NOW())
            ");
            $details = "Checked in {$checkout['item_name']} (ID: {$checkout['item_id']}) in {$condition} condition";
            $stmt->execute([$current_user_id, 'checkin', 'inventory', $checkout['item_id'], $details]);
        } catch (PDOException $log_error) {
            // Continue without logging if table doesn't exist
            error_log("Activity logging failed: " . $log_error->getMessage());
        }

        $pdo->commit();

        echo json_encode([
            'success' => true,
            'message' => 'Item checked in successfully',
            'new_quantity' => $new_quantity
        ]);

    } catch (Exception $e) {
        $pdo->rollBack();
        error_log("Check-in error: " . $e->getMessage());
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
}

// Update checkout (for admin/staff)
function updateCheckout($pdo, $user_id, $user_role, $input) {
    // Admin/staff only function
    if (!in_array($user_role, ['admin', 'staff'])) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Insufficient permissions']);
        return;
    }

    try {
        $checkout_id = intval($input['checkout_id'] ?? 0);
        $due_date = $input['due_date'] ?? '';
        $notes = $input['notes'] ?? '';

        if (!$checkout_id) {
            throw new Exception('Missing checkout ID');
        }

        $stmt = $pdo->prepare("
            UPDATE checkouts
            SET due_date = ?, notes = ?, updated_at = NOW()
            WHERE id = ?
        ");
        $stmt->execute([$due_date, $notes, $checkout_id]);

        echo json_encode([
            'success' => true,
            'message' => 'Checkout updated successfully'
        ]);

    } catch (Exception $e) {
        error_log("Update checkout error: " . $e->getMessage());
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
}

?>