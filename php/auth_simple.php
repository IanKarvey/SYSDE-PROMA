<?php
// Simplified authentication endpoint for debugging
session_start();
require_once 'config.php';
require_once 'utils.php';

header('Content-Type: application/json');

$method = $_SERVER['REQUEST_METHOD'];
$action = $_POST['action'] ?? $_GET['action'] ?? '';

if ($action === 'login' && $method === 'POST') {
    $email = trim($_POST['email'] ?? '');
    $password = $_POST['password'] ?? '';

    // Basic validation
    if (!$email || !$password) {
        echo json_encode(['success' => false, 'message' => 'Email and password required.']);
        exit;
    }

    try {
        // Simple database query
        $stmt = $pdo->prepare('SELECT * FROM users WHERE email = ?');
        $stmt->execute([$email]);
        $user = $stmt->fetch();

        if (!$user) {
            echo json_encode(['success' => false, 'message' => 'User not found.']);
            exit;
        }

        // Check if user is active
        if (isset($user['status']) && $user['status'] !== 'active') {
            echo json_encode(['success' => false, 'message' => 'Account is not active.']);
            exit;
        }

        // Simple password check - try both methods
        $password_valid = false;
        
        // Method 1: Plain text comparison
        if ($password === $user['password']) {
            $password_valid = true;
        }
        // Method 2: Password verify (for hashed passwords)
        else if (password_verify($password, $user['password'])) {
            $password_valid = true;
        }

        if ($password_valid) {
            // Set session variables
            $_SESSION['user_id'] = $user['id'];
            $_SESSION['role'] = $user['role'];
            $_SESSION['first_name'] = $user['first_name'];
            $_SESSION['last_name'] = $user['last_name'];
            $_SESSION['email'] = $user['email'];
            $_SESSION['department'] = $user['department'] ?? '';
            $_SESSION['login_time'] = time();

            echo json_encode([
                'success' => true,
                'message' => 'Login successful',
                'user' => [
                    'id' => (int)$user['id'],
                    'first_name' => $user['first_name'],
                    'last_name' => $user['last_name'],
                    'email' => $user['email'],
                    'role' => $user['role'],
                    'department' => $user['department'] ?? ''
                ]
            ]);
        } else {
            echo json_encode(['success' => false, 'message' => 'Invalid password.']);
        }

    } catch (PDOException $e) {
        error_log("Database error: " . $e->getMessage());
        echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
    }
    exit;
}

if ($action === 'check_session') {
    if (isset($_SESSION['user_id'])) {
        echo json_encode([
            'success' => true,
            'user' => [
                'id' => (int)$_SESSION['user_id'],
                'first_name' => $_SESSION['first_name'],
                'last_name' => $_SESSION['last_name'],
                'email' => $_SESSION['email'],
                'role' => $_SESSION['role'],
                'department' => $_SESSION['department'] ?? ''
            ]
        ]);
    } else {
        echo json_encode(['success' => false, 'message' => 'No active session.']);
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
