<?php
session_start();
require_once 'config.php';
require_once 'utils.php';

header('Content-Type: application/json');

$method = $_SERVER['REQUEST_METHOD'];
$user = get_user();

if ($method === 'GET') {
    require_login();
    
    try {
        // Get announcements for current user role
        $role_filter = '';
        $params = [];
        
        if (isset($_GET['role'])) {
            $role_filter = ' AND (target_role = ? OR target_role = "all")';
            $params[] = $_GET['role'];
        } else {
            $role_filter = ' AND (target_role = ? OR target_role = "all")';
            $params[] = $user['role'];
        }
        
        $stmt = $pdo->prepare('SELECT * FROM announcements WHERE status = "active"' . $role_filter . ' ORDER BY created_at DESC');
        $stmt->execute($params);
        $announcements = $stmt->fetchAll();
        
        // Get dismissed announcements for current user
        $stmt = $pdo->prepare('SELECT announcement_id FROM user_dismissed_announcements WHERE user_id = ?');
        $stmt->execute([$user['id']]);
        $dismissed = $stmt->fetchAll(PDO::FETCH_COLUMN);
        
        // Filter out dismissed announcements
        $active_announcements = array_filter($announcements, function($announcement) use ($dismissed) {
            return !in_array($announcement['id'], $dismissed);
        });
        
        echo json_encode(['success' => true, 'data' => array_values($active_announcements)]);
        
    } catch (PDOException $e) {
        error_log("Database error: " . $e->getMessage());
        echo json_encode(['success' => false, 'message' => 'Database error occurred.']);
    }
    exit;
}

if ($method === 'POST') {
    require_login();
    require_staff_admin($user);
    
    $title = trim(sanitize_string($_POST['title'] ?? ''));
    $content = trim(sanitize_string($_POST['content'] ?? ''));
    $target_role = sanitize_string($_POST['target_role'] ?? 'all');
    $priority = sanitize_string($_POST['priority'] ?? 'normal');
    
    // Validate required fields
    if (empty($title) || empty($content)) {
        echo json_encode(['success' => false, 'message' => 'Title and content are required.']);
        exit;
    }
    
    // Validate target role
    $valid_roles = ['all', 'student', 'staff', 'admin'];
    if (!in_array($target_role, $valid_roles)) {
        echo json_encode(['success' => false, 'message' => 'Invalid target role.']);
        exit;
    }
    
    // Validate priority
    $valid_priorities = ['low', 'normal', 'high', 'urgent'];
    if (!in_array($priority, $valid_priorities)) {
        echo json_encode(['success' => false, 'message' => 'Invalid priority.']);
        exit;
    }
    
    try {
        $stmt = $pdo->prepare('INSERT INTO announcements (title, content, target_role, priority, created_by, created_at, status) VALUES (?, ?, ?, ?, ?, NOW(), "active")');
        $stmt->execute([$title, $content, $target_role, $priority, $user['id']]);
        
        echo json_encode(['success' => true, 'message' => 'Announcement created successfully.']);
        
    } catch (PDOException $e) {
        error_log("Database error: " . $e->getMessage());
        echo json_encode(['success' => false, 'message' => 'Failed to create announcement.']);
    }
    exit;
}

if ($method === 'PUT') {
    require_login();
    parse_str(file_get_contents('php://input'), $_PUT);
    
    $action = $_PUT['action'] ?? '';
    $announcement_id = intval($_PUT['announcement_id'] ?? 0);
    
    if ($action === 'dismiss') {
        // Dismiss announcement for current user
        try {
            $stmt = $pdo->prepare('INSERT IGNORE INTO user_dismissed_announcements (user_id, announcement_id, dismissed_at) VALUES (?, ?, NOW())');
            $stmt->execute([$user['id'], $announcement_id]);
            
            echo json_encode(['success' => true, 'message' => 'Announcement dismissed.']);
            
        } catch (PDOException $e) {
            error_log("Database error: " . $e->getMessage());
            echo json_encode(['success' => false, 'message' => 'Failed to dismiss announcement.']);
        }
    } else if ($action === 'update' && in_array($user['role'], ['admin', 'staff'])) {
        // Update announcement (admin/staff only)
        $title = trim(sanitize_string($_PUT['title'] ?? ''));
        $content = trim(sanitize_string($_PUT['content'] ?? ''));
        $target_role = sanitize_string($_PUT['target_role'] ?? 'all');
        $priority = sanitize_string($_PUT['priority'] ?? 'normal');
        $status = sanitize_string($_PUT['status'] ?? 'active');
        
        try {
            $stmt = $pdo->prepare('UPDATE announcements SET title = ?, content = ?, target_role = ?, priority = ?, status = ? WHERE id = ?');
            $stmt->execute([$title, $content, $target_role, $priority, $status, $announcement_id]);
            
            echo json_encode(['success' => true, 'message' => 'Announcement updated successfully.']);
            
        } catch (PDOException $e) {
            error_log("Database error: " . $e->getMessage());
            echo json_encode(['success' => false, 'message' => 'Failed to update announcement.']);
        }
    } else {
        echo json_encode(['success' => false, 'message' => 'Invalid action or insufficient permissions.']);
    }
    exit;
}

if ($method === 'DELETE') {
    require_login();
    require_staff_admin($user);
    
    parse_str(file_get_contents('php://input'), $_DELETE);
    $id = intval($_DELETE['id'] ?? 0);
    
    try {
        $stmt = $pdo->prepare('UPDATE announcements SET status = "deleted" WHERE id = ?');
        $stmt->execute([$id]);
        
        echo json_encode(['success' => true, 'message' => 'Announcement deleted successfully.']);
        
    } catch (PDOException $e) {
        error_log("Database error: " . $e->getMessage());
        echo json_encode(['success' => false, 'message' => 'Failed to delete announcement.']);
    }
    exit;
}

echo json_encode(['success' => false, 'message' => 'Invalid request method.']);
