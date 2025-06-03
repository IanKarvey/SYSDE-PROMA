<?php
require_once 'config.php';
require_once 'session.php';
require_once 'utils.php';

header('Content-Type: application/json');

$method = $_SERVER['REQUEST_METHOD'];
$user = get_user();

// Function to log student activity
function logActivity($userId, $action, $description, $itemId = null, $referenceTable = null, $referenceId = null) {
    global $pdo;
    
    try {
        $stmt = $pdo->prepare('
            INSERT INTO activity_logs (user_id, action, description, item_id, reference_table, reference_id) 
            VALUES (?, ?, ?, ?, ?, ?)
        ');
        $stmt->execute([$userId, $action, $description, $itemId, $referenceTable, $referenceId]);
        return true;
    } catch (Exception $e) {
        error_log("Activity logging error: " . $e->getMessage());
        return false;
    }
}

if ($method === 'GET') {
    require_login();
    
    $studentId = $_GET['student_id'] ?? null;
    $dateFrom = $_GET['date_from'] ?? null;
    $dateTo = $_GET['date_to'] ?? null;
    $itemType = $_GET['item_type'] ?? 'all';
    $status = $_GET['status'] ?? 'all';
    
    // If no student_id provided and user is student, show their own history
    if (!$studentId && $user['role'] === 'student') {
        $studentId = $user['id'];
    }
    
    // Only admin/staff can view other students' history
    if ($studentId != $user['id'] && !in_array($user['role'], ['admin', 'staff'])) {
        echo json_encode(['success' => false, 'message' => 'Unauthorized']);
        exit;
    }
    
    if (!$studentId) {
        echo json_encode(['success' => false, 'message' => 'Student ID required']);
        exit;
    }
    
    try {
        // Get student info
        $stmt = $pdo->prepare('SELECT first_name, last_name, email, department FROM users WHERE id = ?');
        $stmt->execute([$studentId]);
        $student = $stmt->fetch();
        
        if (!$student) {
            echo json_encode(['success' => false, 'message' => 'Student not found']);
            exit;
        }
        
        // Build date filter
        $dateFilter = '';
        $params = [$studentId];
        if ($dateFrom) {
            $dateFilter .= ' AND DATE(created_at) >= ?';
            $params[] = $dateFrom;
        }
        if ($dateTo) {
            $dateFilter .= ' AND DATE(created_at) <= ?';
            $params[] = $dateTo;
        }
        
        // Get requests history
        $requestsQuery = "
            SELECT r.*, i.name as item_name, i.category, i.location,
                   'request' as activity_type
            FROM requests r 
            JOIN inventory i ON r.item_id = i.id 
            WHERE r.user_id = ? $dateFilter
        ";
        if ($status !== 'all') {
            $requestsQuery .= ' AND r.status = ?';
            $params[] = $status;
        }
        $requestsQuery .= ' ORDER BY r.created_at DESC';
        
        $stmt = $pdo->prepare($requestsQuery);
        $stmt->execute($params);
        $requests = $stmt->fetchAll();
        
        // Reset params for checkouts
        $params = [$studentId];
        if ($dateFrom) $params[] = $dateFrom;
        if ($dateTo) $params[] = $dateTo;
        
        // Get checkouts history
        $checkoutsQuery = "
            SELECT c.*, i.name as item_name, i.category, i.location,
                   'checkout' as activity_type
            FROM checkouts c 
            JOIN inventory i ON c.item_id = i.id 
            WHERE c.user_id = ? $dateFilter
        ";
        if ($status !== 'all') {
            $checkoutsQuery .= ' AND c.status = ?';
            $params[] = $status;
        }
        $checkoutsQuery .= ' ORDER BY c.created_at DESC';
        
        $stmt = $pdo->prepare($checkoutsQuery);
        $stmt->execute($params);
        $checkouts = $stmt->fetchAll();
        
        // Reset params for issues
        $params = [$studentId];
        if ($dateFrom) $params[] = $dateFrom;
        if ($dateTo) $params[] = $dateTo;
        
        // Get issues history
        $issuesQuery = "
            SELECT iss.*, i.name as item_name, i.category, i.location,
                   'issue' as activity_type
            FROM issues iss 
            JOIN inventory i ON iss.item_id = i.id 
            WHERE iss.user_id = ? $dateFilter
        ";
        if ($status !== 'all') {
            $issuesQuery .= ' AND iss.status = ?';
            $params[] = $status;
        }
        $issuesQuery .= ' ORDER BY iss.created_at DESC';
        
        $stmt = $pdo->prepare($issuesQuery);
        $stmt->execute($params);
        $issues = $stmt->fetchAll();
        
        // Get activity logs
        $params = [$studentId];
        if ($dateFrom) $params[] = $dateFrom;
        if ($dateTo) $params[] = $dateTo;
        
        $activityQuery = "
            SELECT al.*, i.name as item_name
            FROM activity_logs al 
            LEFT JOIN inventory i ON al.item_id = i.id 
            WHERE al.user_id = ? $dateFilter
            ORDER BY al.created_at DESC
        ";
        
        $stmt = $pdo->prepare($activityQuery);
        $stmt->execute($params);
        $activities = $stmt->fetchAll();
        
        // Calculate statistics
        $stats = [
            'total_requests' => count($requests),
            'pending_requests' => count(array_filter($requests, fn($r) => $r['status'] === 'pending')),
            'approved_requests' => count(array_filter($requests, fn($r) => $r['status'] === 'approved')),
            'total_checkouts' => count($checkouts),
            'current_checkouts' => count(array_filter($checkouts, fn($c) => $c['status'] === 'checked-out')),
            'overdue_items' => count(array_filter($checkouts, fn($c) => $c['status'] === 'overdue')),
            'total_issues' => count($issues),
            'open_issues' => count(array_filter($issues, fn($i) => $i['status'] === 'open'))
        ];
        
        echo json_encode([
            'success' => true,
            'student' => $student,
            'requests' => $requests,
            'checkouts' => $checkouts,
            'issues' => $issues,
            'activities' => $activities,
            'stats' => $stats
        ]);
        
    } catch (Exception $e) {
        error_log("Student history error: " . $e->getMessage());
        echo json_encode(['success' => false, 'message' => 'Failed to fetch student history']);
    }
    exit;
}

if ($method === 'POST') {
    require_login();
    
    $action = $_POST['action'] ?? '';
    
    if ($action === 'log_activity') {
        $userId = intval($_POST['user_id'] ?? $user['id']);
        $actionType = sanitize_string($_POST['action_type'] ?? '');
        $description = sanitize_string($_POST['description'] ?? '');
        $itemId = intval($_POST['item_id'] ?? 0) ?: null;
        $referenceTable = sanitize_string($_POST['reference_table'] ?? '') ?: null;
        $referenceId = intval($_POST['reference_id'] ?? 0) ?: null;
        
        if (!$actionType || !$description) {
            echo json_encode(['success' => false, 'message' => 'Action type and description required']);
            exit;
        }
        
        $success = logActivity($userId, $actionType, $description, $itemId, $referenceTable, $referenceId);
        
        if ($success) {
            echo json_encode(['success' => true, 'message' => 'Activity logged successfully']);
        } else {
            echo json_encode(['success' => false, 'message' => 'Failed to log activity']);
        }
        exit;
    }
}

echo json_encode(['success' => false, 'message' => 'Invalid request']);
?>
