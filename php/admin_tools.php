<?php
// Admin Tools API - For administrative functions like clearing transaction history
require_once 'config.php';
require_once 'auth.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

$method = $_SERVER['REQUEST_METHOD'];

// Authentication helper functions
function require_login() {
    global $user;
    if (!$user) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Authentication required.']);
        exit;
    }
}

function require_admin($user) {
    if (!$user || $user['role'] !== 'admin') {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Admin access required.']);
        exit;
    }
}

if ($method === 'POST') {
    require_login();
    require_admin($user);
    
    $input = json_decode(file_get_contents('php://input'), true);
    $action = $input['action'] ?? '';

    if ($action === 'clear_transaction_history') {
        try {
            // Start transaction for atomic operation
            $pdo->beginTransaction();

            // Get current active transactions that should be preserved
            $activeCheckouts = $pdo->query("
                SELECT id, item_id, user_id, date_out, due_date, notes, authorization_code, status 
                FROM checkouts 
                WHERE status = 'checked_out'
            ")->fetchAll(PDO::FETCH_ASSOC);

            $activeRequests = $pdo->query("
                SELECT id, user_id, item_id, quantity, needed_by, notes, status, created_at 
                FROM requests 
                WHERE status IN ('pending', 'approved')
            ")->fetchAll(PDO::FETCH_ASSOC);

            $activeAuthCodes = $pdo->query("
                SELECT id, code, request_id, user_id, item_id, status, expires_at, created_at 
                FROM authorization_codes 
                WHERE status = 'active'
            ")->fetchAll(PDO::FETCH_ASSOC);

            // Clear all transaction tables
            $pdo->exec("DELETE FROM checkouts");
            $pdo->exec("DELETE FROM authorization_codes");
            $pdo->exec("DELETE FROM requests");

            // Reset auto-increment IDs to 1
            $pdo->exec("ALTER TABLE checkouts AUTO_INCREMENT = 1");
            $pdo->exec("ALTER TABLE authorization_codes AUTO_INCREMENT = 1");
            $pdo->exec("ALTER TABLE requests AUTO_INCREMENT = 1");

            // Re-insert active transactions with new IDs starting from 1
            $requestIdMapping = [];
            $newRequestId = 1;
            
            // Re-insert active requests first (needed for authorization codes)
            foreach ($activeRequests as $request) {
                $oldRequestId = $request['id'];
                
                $stmt = $pdo->prepare("
                    INSERT INTO requests (user_id, item_id, quantity, needed_by, notes, status, created_at) 
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                ");
                $stmt->execute([
                    $request['user_id'],
                    $request['item_id'],
                    $request['quantity'],
                    $request['needed_by'],
                    $request['notes'],
                    $request['status'],
                    $request['created_at']
                ]);
                
                $requestIdMapping[$oldRequestId] = $newRequestId;
                $newRequestId++;
            }

            // Re-insert active authorization codes with updated request IDs
            foreach ($activeAuthCodes as $authCode) {
                $newRequestId = $requestIdMapping[$authCode['request_id']] ?? null;
                
                if ($newRequestId) {
                    $stmt = $pdo->prepare("
                        INSERT INTO authorization_codes (code, request_id, user_id, item_id, status, expires_at, created_at) 
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    ");
                    $stmt->execute([
                        $authCode['code'],
                        $newRequestId,
                        $authCode['user_id'],
                        $authCode['item_id'],
                        $authCode['status'],
                        $authCode['expires_at'],
                        $authCode['created_at']
                    ]);
                }
            }

            // Re-insert active checkouts
            foreach ($activeCheckouts as $checkout) {
                $stmt = $pdo->prepare("
                    INSERT INTO checkouts (item_id, user_id, date_out, due_date, notes, authorization_code, status) 
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                ");
                $stmt->execute([
                    $checkout['item_id'],
                    $checkout['user_id'],
                    $checkout['date_out'],
                    $checkout['due_date'],
                    $checkout['notes'],
                    $checkout['authorization_code'],
                    $checkout['status']
                ]);
            }

            // Commit transaction
            $pdo->commit();

            // Create admin_logs table if it doesn't exist
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS admin_logs (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    admin_id INT NOT NULL,
                    action VARCHAR(100) NOT NULL,
                    details TEXT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (admin_id) REFERENCES users(id)
                )
            ");

            // Log the admin action
            $logStmt = $pdo->prepare("
                INSERT INTO admin_logs (admin_id, action, details, timestamp)
                VALUES (?, 'clear_transaction_history', ?, NOW())
            ");
            $logStmt->execute([
                $user['id'],
                json_encode([
                    'preserved_requests' => count($activeRequests),
                    'preserved_checkouts' => count($activeCheckouts),
                    'preserved_auth_codes' => count($activeAuthCodes),
                    'request_id_mapping' => $requestIdMapping
                ])
            ]);

            echo json_encode([
                'success' => true,
                'message' => 'Transaction history cleared successfully',
                'data' => [
                    'preserved_requests' => count($activeRequests),
                    'preserved_checkouts' => count($activeCheckouts),
                    'preserved_auth_codes' => count($activeAuthCodes),
                    'new_id_start' => 1
                ]
            ]);

        } catch (Exception $e) {
            // Rollback transaction on error
            $pdo->rollback();
            error_log("Error clearing transaction history: " . $e->getMessage());
            echo json_encode([
                'success' => false,
                'message' => 'Failed to clear transaction history: ' . $e->getMessage()
            ]);
        }
        exit;
    }

    // Get transaction statistics
    if ($action === 'get_transaction_stats') {
        try {
            $stats = [];

            // Get total counts
            $stats['total_requests'] = $pdo->query("SELECT COUNT(*) FROM requests")->fetchColumn();
            $stats['total_checkouts'] = $pdo->query("SELECT COUNT(*) FROM checkouts")->fetchColumn();
            $stats['total_auth_codes'] = $pdo->query("SELECT COUNT(*) FROM authorization_codes")->fetchColumn();

            // Get active counts
            $stats['active_requests'] = $pdo->query("SELECT COUNT(*) FROM requests WHERE status IN ('pending', 'approved')")->fetchColumn();
            $stats['active_checkouts'] = $pdo->query("SELECT COUNT(*) FROM checkouts WHERE status = 'checked_out'")->fetchColumn();
            $stats['active_auth_codes'] = $pdo->query("SELECT COUNT(*) FROM authorization_codes WHERE status = 'active'")->fetchColumn();

            // Get historical counts (will be deleted)
            $stats['historical_requests'] = $stats['total_requests'] - $stats['active_requests'];
            $stats['historical_checkouts'] = $stats['total_checkouts'] - $stats['active_checkouts'];
            $stats['historical_auth_codes'] = $stats['total_auth_codes'] - $stats['active_auth_codes'];

            // Get current max IDs
            $stats['max_request_id'] = $pdo->query("SELECT COALESCE(MAX(id), 0) FROM requests")->fetchColumn();
            $stats['max_checkout_id'] = $pdo->query("SELECT COALESCE(MAX(id), 0) FROM checkouts")->fetchColumn();
            $stats['max_auth_code_id'] = $pdo->query("SELECT COALESCE(MAX(id), 0) FROM authorization_codes")->fetchColumn();

            echo json_encode(['success' => true, 'data' => $stats]);

        } catch (Exception $e) {
            error_log("Error getting transaction stats: " . $e->getMessage());
            echo json_encode(['success' => false, 'message' => 'Failed to get transaction statistics']);
        }
        exit;
    }
}

// Method not allowed
http_response_code(405);
echo json_encode(['success' => false, 'message' => 'Method not allowed']);
?>
