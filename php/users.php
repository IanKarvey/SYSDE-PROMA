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

if ($method === 'GET') {
    require_login();
    
    // Only admin/staff can search users
    if (!in_array($user['role'], ['admin', 'staff'])) {
        echo json_encode(['success' => false, 'message' => 'Unauthorized.']);
        exit;
    }
    
    // Handle search functionality
    $search = $_GET['search'] ?? '';
    $limit = isset($_GET['limit']) ? intval($_GET['limit']) : null;
    $role = $_GET['role'] ?? '';
    
    $sql = 'SELECT id, first_name, last_name, email, role, department, status, created_at FROM users WHERE 1=1';
    $params = [];
    
    if ($search) {
        $sql .= ' AND (first_name LIKE ? OR last_name LIKE ? OR email LIKE ? OR role LIKE ? OR department LIKE ?)';
        $searchParam = "%$search%";
        $params = array_fill(0, 5, $searchParam);
    }
    
    if ($role && $role !== 'all') {
        $sql .= ' AND role = ?';
        $params[] = $role;
    }
    
    $sql .= ' ORDER BY created_at DESC';
    
    if ($limit) {
        $sql .= ' LIMIT ?';
        $params[] = $limit;
    }
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $users = $stmt->fetchAll();

    // Sanitize output data to prevent XSS
    $sanitized_users = array_map(function($user) {
        return [
            'id' => (int)$user['id'],
            'first_name' => htmlspecialchars($user['first_name'], ENT_QUOTES, 'UTF-8'),
            'last_name' => htmlspecialchars($user['last_name'], ENT_QUOTES, 'UTF-8'),
            'email' => htmlspecialchars($user['email'], ENT_QUOTES, 'UTF-8'),
            'role' => htmlspecialchars($user['role'], ENT_QUOTES, 'UTF-8'),
            'department' => htmlspecialchars($user['department'] ?? '', ENT_QUOTES, 'UTF-8'),
            'status' => htmlspecialchars($user['status'], ENT_QUOTES, 'UTF-8'),
            'created_at' => $user['created_at']
        ];
    }, $users);

    echo json_encode(['success' => true, 'data' => $sanitized_users]);
    exit;
}

if ($method === 'POST') {
    require_login();
    require_staff_admin($user);
    
    $first_name = sanitize_string($_POST['first_name'] ?? '');
    $last_name = sanitize_string($_POST['last_name'] ?? '');
    $email = sanitize_email($_POST['email'] ?? '');
    $password = $_POST['password'] ?? '';
    $role = sanitize_string($_POST['role'] ?? 'student');
    $department = sanitize_string($_POST['department'] ?? '');
    
    if (!$first_name || !$last_name || !$email || !$password) {
        echo json_encode(['success' => false, 'message' => 'All fields are required.']);
        exit;
    }
    
    // Check for duplicate email
    $stmt = $pdo->prepare('SELECT id FROM users WHERE email = ?');
    $stmt->execute([$email]);
    if ($stmt->fetch()) {
        echo json_encode(['success' => false, 'message' => 'Email already registered.']);
        exit;
    }
    
    $hash = hash_password($password);
    $stmt = $pdo->prepare('INSERT INTO users (first_name, last_name, email, password, role, department) VALUES (?, ?, ?, ?, ?, ?)');
    $stmt->execute([$first_name, $last_name, $email, $hash, $role, $department]);
    echo json_encode(['success' => true, 'message' => 'User created successfully.']);
    exit;
}

if ($method === 'PUT') {
    require_login();
    require_staff_admin($user);
    
    parse_str(file_get_contents('php://input'), $_PUT);
    $id = intval($_PUT['id'] ?? 0);
    $first_name = sanitize_string($_PUT['first_name'] ?? '');
    $last_name = sanitize_string($_PUT['last_name'] ?? '');
    $email = sanitize_email($_PUT['email'] ?? '');
    $role = sanitize_string($_PUT['role'] ?? 'student');
    $department = sanitize_string($_PUT['department'] ?? '');
    $status = sanitize_string($_PUT['status'] ?? 'active');
    
    if (!$first_name || !$last_name || !$email) {
        echo json_encode(['success' => false, 'message' => 'Required fields missing.']);
        exit;
    }
    
    $stmt = $pdo->prepare('UPDATE users SET first_name=?, last_name=?, email=?, role=?, department=?, status=? WHERE id=?');
    $stmt->execute([$first_name, $last_name, $email, $role, $department, $status, $id]);
    echo json_encode(['success' => true, 'message' => 'User updated successfully.']);
    exit;
}

if ($method === 'DELETE') {
    require_login();
    require_staff_admin($user);
    
    parse_str(file_get_contents('php://input'), $_DELETE);
    $id = intval($_DELETE['id'] ?? 0);
    
    // Prevent deleting self
    if ($id == $user['id']) {
        echo json_encode(['success' => false, 'message' => 'Cannot delete your own account.']);
        exit;
    }
    
    $stmt = $pdo->prepare('DELETE FROM users WHERE id=?');
    $stmt->execute([$id]);
    echo json_encode(['success' => true, 'message' => 'User deleted successfully.']);
    exit;
}

echo json_encode(['success' => false, 'message' => 'Invalid request.']);
