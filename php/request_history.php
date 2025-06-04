<?php
// Request History API - For admin reports and historical data
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
    if (!$user || ($user['role'] !== 'admin' && $user['role'] !== 'staff')) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Admin access required.']);
        exit;
    }
}

if ($method === 'GET') {
    require_login();
    require_admin($user);
    
    // Get all historical requests for admin reports
    $search = $_GET['search'] ?? '';
    $status = $_GET['status'] ?? '';
    $dateFrom = $_GET['date_from'] ?? '';
    $dateTo = $_GET['date_to'] ?? '';
    $userId = $_GET['user_id'] ?? '';
    $limit = isset($_GET['limit']) ? intval($_GET['limit']) : null;

    try {
        // Build comprehensive historical query
        $sql = 'SELECT r.*, u.first_name, u.last_name, u.email, u.department, i.name AS item_name, i.category,
                       ac.code as authorization_code, ac.status as code_status, 
                       ac.expires_at as code_expires_at, ac.used_at as code_used_at,
                       ac.created_at as code_created_at,
                       co.id as checkout_id, co.date_out, co.date_in, co.due_date as checkout_due_date,
                       co.status as checkout_status
                FROM requests r 
                JOIN users u ON r.user_id=u.id 
                JOIN inventory i ON r.item_id=i.id 
                LEFT JOIN authorization_codes ac ON r.id = ac.request_id
                LEFT JOIN checkouts co ON ac.code = co.authorization_code
                WHERE 1=1';
        $params = [];

        // Add filters
        if ($search) {
            $sql .= ' AND (i.name LIKE ? OR u.first_name LIKE ? OR u.last_name LIKE ? OR r.status LIKE ?)';
            $searchParam = "%$search%";
            $params = array_merge($params, [$searchParam, $searchParam, $searchParam, $searchParam]);
        }

        if ($status && $status !== 'all') {
            $sql .= ' AND r.status = ?';
            $params[] = $status;
        }

        if ($userId) {
            $sql .= ' AND r.user_id = ?';
            $params[] = $userId;
        }

        if ($dateFrom) {
            $sql .= ' AND DATE(r.created_at) >= ?';
            $params[] = $dateFrom;
        }

        if ($dateTo) {
            $sql .= ' AND DATE(r.created_at) <= ?';
            $params[] = $dateTo;
        }

        $sql .= ' ORDER BY r.created_at DESC';

        if ($limit) {
            $sql .= ' LIMIT ?';
            $params[] = $limit;
        }

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $requests = $stmt->fetchAll(PDO::FETCH_ASSOC);

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

        // Get summary statistics
        $statsQuery = 'SELECT 
                        COUNT(*) as total_requests,
                        SUM(CASE WHEN r.status = "pending" THEN 1 ELSE 0 END) as pending_requests,
                        SUM(CASE WHEN r.status = "approved" THEN 1 ELSE 0 END) as approved_requests,
                        SUM(CASE WHEN r.status = "rejected" THEN 1 ELSE 0 END) as rejected_requests,
                        SUM(CASE WHEN r.status = "cancelled" THEN 1 ELSE 0 END) as cancelled_requests,
                        COUNT(DISTINCT r.user_id) as unique_users,
                        COUNT(DISTINCT r.item_id) as unique_items
                       FROM requests r 
                       JOIN users u ON r.user_id=u.id 
                       JOIN inventory i ON r.item_id=i.id 
                       WHERE 1=1';
        
        $statsParams = [];
        
        // Apply same filters to stats
        if ($search) {
            $statsQuery .= ' AND (i.name LIKE ? OR u.first_name LIKE ? OR u.last_name LIKE ? OR r.status LIKE ?)';
            $statsParams = array_merge($statsParams, [$searchParam, $searchParam, $searchParam, $searchParam]);
        }

        if ($status && $status !== 'all') {
            $statsQuery .= ' AND r.status = ?';
            $statsParams[] = $status;
        }

        if ($userId) {
            $statsQuery .= ' AND r.user_id = ?';
            $statsParams[] = $userId;
        }

        if ($dateFrom) {
            $statsQuery .= ' AND DATE(r.created_at) >= ?';
            $statsParams[] = $dateFrom;
        }

        if ($dateTo) {
            $statsQuery .= ' AND DATE(r.created_at) <= ?';
            $statsParams[] = $dateTo;
        }

        $statsStmt = $pdo->prepare($statsQuery);
        $statsStmt->execute($statsParams);
        $stats = $statsStmt->fetch(PDO::FETCH_ASSOC);

        echo json_encode([
            'success' => true, 
            'data' => $requests,
            'stats' => $stats,
            'total_records' => count($requests)
        ]);
    } catch (PDOException $e) {
        error_log("Error fetching request history: " . $e->getMessage());
        echo json_encode(['success' => false, 'message' => 'Failed to fetch request history']);
    }
    exit;
}

// Method not allowed
http_response_code(405);
echo json_encode(['success' => false, 'message' => 'Method not allowed']);
?>
