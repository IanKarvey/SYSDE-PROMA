<?php
require_once 'config.php';
require_once 'session.php';
require_once 'utils.php';

header('Content-Type: application/json');
$method = $_SERVER['REQUEST_METHOD'];
$user = get_user();

if ($method === 'POST') {
    require_login();
    
    // Only admin/staff can send contact messages
    if (!in_array($user['role'], ['admin', 'staff'])) {
        echo json_encode(['success' => false, 'message' => 'Unauthorized.']);
        exit;
    }
    
    $user_id = intval($_POST['user_id'] ?? 0);
    $subject = trim(sanitize_string($_POST['subject'] ?? ''));
    $message = trim(sanitize_string($_POST['message'] ?? ''));

    // Enhanced input validation
    if (!$user_id || !$subject || !$message) {
        echo json_encode(['success' => false, 'message' => 'All fields are required.']);
        exit;
    }

    // Validate subject
    $valid_subjects = ['request_clarification', 'approval_notification', 'return_reminder', 'equipment_issue', 'general'];
    if (!in_array($subject, $valid_subjects)) {
        echo json_encode(['success' => false, 'message' => 'Invalid subject.']);
        exit;
    }

    // Validate message length
    if (strlen($message) < 10 || strlen($message) > 1000) {
        echo json_encode(['success' => false, 'message' => 'Message must be between 10 and 1000 characters.']);
        exit;
    }
    
    // Verify target user exists
    $stmt = $pdo->prepare('SELECT id, first_name, last_name, email FROM users WHERE id = ?');
    $stmt->execute([$user_id]);
    $target_user = $stmt->fetch();
    
    if (!$target_user) {
        echo json_encode(['success' => false, 'message' => 'User not found.']);
        exit;
    }
    
    try {
        // Insert message into database (for logging)
        $stmt = $pdo->prepare('INSERT INTO contact_messages (from_user_id, to_user_id, subject, message, sent_at) VALUES (?, ?, ?, ?, NOW())');
        $stmt->execute([$user['id'], $user_id, $subject, $message]);
        
        // In a real application, you would send an email here
        // For now, we'll just log the message
        error_log("Contact message sent from {$user['first_name']} {$user['last_name']} to {$target_user['first_name']} {$target_user['last_name']}: $subject");
        
        echo json_encode(['success' => true, 'message' => 'Message sent successfully.']);
    } catch (PDOException $e) {
        error_log("Database error: " . $e->getMessage());
        echo json_encode(['success' => false, 'message' => 'Failed to send message.']);
    }
    exit;
}

if ($method === 'GET') {
    require_login();
    
    // Get contact messages for current user
    $stmt = $pdo->prepare('
        SELECT cm.*, 
               fu.first_name as from_first_name, fu.last_name as from_last_name,
               tu.first_name as to_first_name, tu.last_name as to_last_name
        FROM contact_messages cm
        JOIN users fu ON cm.from_user_id = fu.id
        JOIN users tu ON cm.to_user_id = tu.id
        WHERE cm.to_user_id = ? OR cm.from_user_id = ?
        ORDER BY cm.sent_at DESC
    ');
    $stmt->execute([$user['id'], $user['id']]);
    $messages = $stmt->fetchAll();
    
    echo json_encode(['success' => true, 'data' => $messages]);
    exit;
}

echo json_encode(['success' => false, 'message' => 'Invalid request.']);
