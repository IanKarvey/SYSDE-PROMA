<?php
session_start();
require_once 'config.php';

// Enable error reporting for debugging
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Set JSON header
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
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
    
    if ($method === 'GET') {
        $action = $_GET['action'] ?? 'statistics';
        
        switch ($action) {
            case 'statistics':
                getDashboardStatistics($pdo, $user_id, $user_role);
                break;
            case 'recent_activity':
                getRecentActivity($pdo, $user_id, $user_role);
                break;
            default:
                getDashboardStatistics($pdo, $user_id, $user_role);
        }
    } else {
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    }
} catch (Exception $e) {
    error_log("Dashboard API Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Internal server error: ' . $e->getMessage()]);
}

// Get comprehensive dashboard statistics
function getDashboardStatistics($pdo, $user_id, $user_role) {
    try {
        $stats = [];
        
        // 1. INVENTORY STATISTICS
        // Total Items - Sum of all quantities across all inventory items
        $stmt = $pdo->prepare("SELECT COALESCE(SUM(quantity), 0) as total_items FROM inventory");
        $stmt->execute();
        $stats['total_items'] = (int)$stmt->fetchColumn();

        // Available Items - Sum of quantities for items with status="available"
        $stmt = $pdo->prepare("
            SELECT COALESCE(SUM(quantity), 0) as available_items
            FROM inventory
            WHERE status = 'available'
        ");
        $stmt->execute();
        $stats['available_items'] = (int)$stmt->fetchColumn();

        // Total Equipment Types - Count of distinct equipment items
        $stmt = $pdo->prepare("SELECT COUNT(*) as total_equipment_types FROM inventory");
        $stmt->execute();
        $stats['total_equipment_types'] = (int)$stmt->fetchColumn();

        // Available Equipment Types - Count of equipment types with quantity > 0
        $stmt = $pdo->prepare("
            SELECT COUNT(*) as available_equipment_types
            FROM inventory
            WHERE status = 'available' AND quantity > 0
        ");
        $stmt->execute();
        $stats['available_equipment_types'] = (int)$stmt->fetchColumn();

        // Low Stock Items - Items with quantity <= 2 and status="available"
        $stmt = $pdo->prepare("
            SELECT COUNT(*) as low_stock_items
            FROM inventory
            WHERE status = 'available' AND quantity <= 2 AND quantity > 0
        ");
        $stmt->execute();
        $stats['low_stock_items'] = (int)$stmt->fetchColumn();

        // Out of Stock Items - Items with quantity = 0
        $stmt = $pdo->prepare("
            SELECT COUNT(*) as out_of_stock_items
            FROM inventory
            WHERE quantity = 0
        ");
        $stmt->execute();
        $stats['out_of_stock_items'] = (int)$stmt->fetchColumn();

        // Total Units Checked Out - Sum of quantities currently checked out
        $stmt = $pdo->prepare("
            SELECT COALESCE(COUNT(*), 0) as total_units_checked_out
            FROM checkouts
            WHERE status = 'checked_out'
        ");
        $stmt->execute();
        $stats['total_units_checked_out'] = (int)$stmt->fetchColumn();
        
        // 2. REQUESTS STATISTICS
        // Pending Requests - Requests with status="pending"
        $stmt = $pdo->prepare("
            SELECT COUNT(*) as pending_requests 
            FROM requests 
            WHERE status = 'pending'
        ");
        $stmt->execute();
        $stats['pending_requests'] = (int)$stmt->fetchColumn();
        
        // Total Requests
        $stmt = $pdo->prepare("SELECT COUNT(*) as total_requests FROM requests");
        $stmt->execute();
        $stats['total_requests'] = (int)$stmt->fetchColumn();
        
        // Approved Requests Today
        $stmt = $pdo->prepare("
            SELECT COUNT(*) as approved_today 
            FROM requests 
            WHERE status = 'approved' AND DATE(created_at) = CURDATE()
        ");
        $stmt->execute();
        $stats['approved_today'] = (int)$stmt->fetchColumn();
        
        // 3. CHECKOUT STATISTICS
        // Current Checkouts - Active checkouts
        $stmt = $pdo->prepare("
            SELECT COUNT(*) as current_checkouts 
            FROM checkouts 
            WHERE status = 'checked_out'
        ");
        $stmt->execute();
        $stats['current_checkouts'] = (int)$stmt->fetchColumn();
        
        // Overdue Checkouts - Checkouts past due date
        $stmt = $pdo->prepare("
            SELECT COUNT(*) as overdue_checkouts 
            FROM checkouts 
            WHERE status = 'checked_out' AND due_date < CURDATE()
        ");
        $stmt->execute();
        $stats['overdue_checkouts'] = (int)$stmt->fetchColumn();
        
        // Total Checkouts
        $stmt = $pdo->prepare("SELECT COUNT(*) as total_checkouts FROM checkouts");
        $stmt->execute();
        $stats['total_checkouts'] = (int)$stmt->fetchColumn();
        
        // Checkouts Today
        $stmt = $pdo->prepare("
            SELECT COUNT(*) as checkouts_today 
            FROM checkouts 
            WHERE DATE(date_out) = CURDATE()
        ");
        $stmt->execute();
        $stats['checkouts_today'] = (int)$stmt->fetchColumn();
        
        // 4. ISSUES STATISTICS
        // Issues Reported - Total count of all issues
        $stmt = $pdo->prepare("SELECT COUNT(*) as issues_reported FROM issues");
        $stmt->execute();
        $stats['issues_reported'] = (int)$stmt->fetchColumn();
        
        // Open Issues - Issues with status="open"
        $stmt = $pdo->prepare("
            SELECT COUNT(*) as open_issues 
            FROM issues 
            WHERE status = 'open'
        ");
        $stmt->execute();
        $stats['open_issues'] = (int)$stmt->fetchColumn();
        
        // Critical Issues - Issues with severity="critical"
        $stmt = $pdo->prepare("
            SELECT COUNT(*) as critical_issues 
            FROM issues 
            WHERE severity = 'critical' AND status = 'open'
        ");
        $stmt->execute();
        $stats['critical_issues'] = (int)$stmt->fetchColumn();
        
        // Issues Reported Today
        $stmt = $pdo->prepare("
            SELECT COUNT(*) as issues_today 
            FROM issues 
            WHERE DATE(created_at) = CURDATE()
        ");
        $stmt->execute();
        $stats['issues_today'] = (int)$stmt->fetchColumn();
        
        // 5. USER STATISTICS (for admin/staff)
        if (in_array($user_role, ['admin', 'staff'])) {
            // Total Users
            $stmt = $pdo->prepare("SELECT COUNT(*) as total_users FROM users");
            $stmt->execute();
            $stats['total_users'] = (int)$stmt->fetchColumn();
            
            // Active Users (logged in within last 30 days)
            $stmt = $pdo->prepare("
                SELECT COUNT(*) as active_users 
                FROM users 
                WHERE last_login >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            ");
            $stmt->execute();
            $stats['active_users'] = (int)$stmt->fetchColumn();
        }
        
        // 6. ROLE-SPECIFIC STATISTICS
        if ($user_role === 'student') {
            // Student's personal statistics
            $stmt = $pdo->prepare("
                SELECT COUNT(*) as my_requests 
                FROM requests 
                WHERE user_id = ?
            ");
            $stmt->execute([$user_id]);
            $stats['my_requests'] = (int)$stmt->fetchColumn();
            
            $stmt = $pdo->prepare("
                SELECT COUNT(*) as my_checkouts 
                FROM checkouts 
                WHERE user_id = ? AND status = 'checked_out'
            ");
            $stmt->execute([$user_id]);
            $stats['my_checkouts'] = (int)$stmt->fetchColumn();
            
            $stmt = $pdo->prepare("
                SELECT COUNT(*) as my_issues 
                FROM issues 
                WHERE reported_by = ?
            ");
            $stmt->execute([$user_id]);
            $stats['my_issues'] = (int)$stmt->fetchColumn();
        }
        
        // Add timestamp for cache validation
        $stats['last_updated'] = date('Y-m-d H:i:s');
        $stats['timestamp'] = time();
        
        echo json_encode([
            'success' => true,
            'data' => $stats,
            'user_role' => $user_role
        ]);
        
    } catch (PDOException $e) {
        error_log("Error fetching dashboard statistics: " . $e->getMessage());
        echo json_encode(['success' => false, 'message' => 'Failed to fetch dashboard statistics']);
    }
}

// Get recent activity for dashboard
function getRecentActivity($pdo, $user_id, $user_role) {
    try {
        $activities = [];
        
        // Recent requests (last 10)
        $stmt = $pdo->prepare("
            SELECT r.*, u.first_name, u.last_name, i.name as item_name
            FROM requests r
            JOIN users u ON r.user_id = u.id
            JOIN inventory i ON r.item_id = i.id
            ORDER BY r.created_at DESC
            LIMIT 10
        ");
        $stmt->execute();
        $activities['recent_requests'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Recent checkouts (last 10)
        $stmt = $pdo->prepare("
            SELECT c.*, u.first_name, u.last_name, i.name as item_name
            FROM checkouts c
            JOIN users u ON c.user_id = u.id
            JOIN inventory i ON c.item_id = i.id
            ORDER BY c.created_at DESC
            LIMIT 10
        ");
        $stmt->execute();
        $activities['recent_checkouts'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Recent issues (last 10)
        $stmt = $pdo->prepare("
            SELECT iss.*, u.first_name, u.last_name, i.name as item_name
            FROM issues iss
            JOIN users u ON iss.reported_by = u.id
            LEFT JOIN inventory i ON iss.item_id = i.id
            ORDER BY iss.created_at DESC
            LIMIT 10
        ");
        $stmt->execute();
        $activities['recent_issues'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo json_encode([
            'success' => true,
            'data' => $activities
        ]);
        
    } catch (PDOException $e) {
        error_log("Error fetching recent activity: " . $e->getMessage());
        echo json_encode(['success' => false, 'message' => 'Failed to fetch recent activity']);
    }
}

?>
