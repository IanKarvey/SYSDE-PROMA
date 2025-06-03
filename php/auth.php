<?php
session_start();
require_once 'config.php';
require_once 'utils.php';

header('Content-Type: application/json');

$action = $_POST['action'] ?? $_GET['action'] ?? '';

if ($action === 'register') {
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
    echo json_encode(['success' => true, 'message' => 'Registration successful.']);
    exit;
}

if ($action === 'login') {
    $email = sanitize_email($_POST['email'] ?? '');
    $password = $_POST['password'] ?? '';

    if (!$email || !$password) {
        echo json_encode(['success' => false, 'message' => 'Email and password required.']);
        exit;
    }

    try {
        // Authenticate user based on email and password only
        // Role is automatically determined from database
        $stmt = $pdo->prepare('SELECT * FROM users WHERE email = ? AND password = ? AND status = "active"');
        $stmt->execute([$email, $password]);
        $user = $stmt->fetch();

        if ($user) {
            $_SESSION['user_id'] = $user['id'];
            $_SESSION['role'] = $user['role'];
            $_SESSION['first_name'] = $user['first_name'];
            $_SESSION['last_name'] = $user['last_name'];
            $_SESSION['email'] = $user['email'];
            $_SESSION['department'] = $user['department'];

            echo json_encode([
                'success' => true,
                'message' => 'Login successful',
                'user' => [
                    'id' => $user['id'],
                    'first_name' => $user['first_name'],
                    'last_name' => $user['last_name'],
                    'email' => $user['email'],
                    'role' => $user['role'],
                    'department' => $user['department']
                ]
            ]);
        } else {
            echo json_encode(['success' => false, 'message' => 'Invalid email or password']);
        }
    } catch (PDOException $e) {
        error_log("Database error: " . $e->getMessage());
        echo json_encode(['success' => false, 'message' => 'Database error occurred']);
    }
    exit;
}

if ($action === 'logout') {
    session_unset();
    session_destroy();
    echo json_encode(['success' => true, 'message' => 'Logged out.']);
    exit;
}

echo json_encode(['success' => false, 'message' => 'Invalid action.']);