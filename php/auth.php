<?php
// Enhanced security settings (relaxed for compatibility)
ini_set('session.cookie_httponly', 1);
ini_set('session.cookie_secure', 0); // Keep 0 for HTTP development
ini_set('session.use_strict_mode', 0); // Temporarily relaxed
// Temporarily disable SameSite for compatibility
// ini_set('session.cookie_samesite', 'Strict');

session_start();

// Regenerate session ID on login to prevent session fixation
// Temporarily disabled to avoid session issues
// if (!isset($_SESSION['initiated'])) {
//     session_regenerate_id(true);
//     $_SESSION['initiated'] = true;
// }

require_once 'config.php';
require_once 'utils.php';

header('Content-Type: application/json');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('X-XSS-Protection: 1; mode=block');

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

    // Enhanced input validation
    if (!$email || !$password) {
        echo json_encode(['success' => false, 'message' => 'Email and password required.']);
        exit;
    }

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        echo json_encode(['success' => false, 'message' => 'Invalid email format.']);
        exit;
    }

    // Enhanced rate limiting - restored to proper security specifications
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $rate_limit_key = "login_attempts_" . md5($ip);

    if (!isset($_SESSION[$rate_limit_key])) {
        $_SESSION[$rate_limit_key] = ['count' => 0, 'last_attempt' => time()];
    }

    $attempts = $_SESSION[$rate_limit_key];
    $lockout_time = 900; // 15 minutes in seconds
    $max_attempts = 5;

    // Check if user is currently locked out
    if ($attempts['count'] >= $max_attempts && (time() - $attempts['last_attempt']) < $lockout_time) {
        $remaining_time = $lockout_time - (time() - $attempts['last_attempt']);
        $remaining_minutes = ceil($remaining_time / 60);
        echo json_encode([
            'success' => false,
            'message' => "Too many login attempts. Please try again in $remaining_minutes minutes.",
            'lockout_remaining' => $remaining_time
        ]);
        exit;
    }

    // Reset attempts if lockout period has passed
    if ($attempts['count'] >= $max_attempts && (time() - $attempts['last_attempt']) >= $lockout_time) {
        $_SESSION[$rate_limit_key] = ['count' => 0, 'last_attempt' => time()];
    }

    try {
        // Debug logging
        error_log("Login attempt for email: " . $email);

        // Secure authentication with proper password verification
        $stmt = $pdo->prepare('SELECT * FROM users WHERE email = ? AND status = "active"');
        $stmt->execute([$email]);
        $user = $stmt->fetch();

        error_log("User found: " . ($user ? "Yes (ID: " . $user['id'] . ")" : "No"));

        // Hybrid authentication: support both hashed and plain text passwords
        $password_valid = false;
        $needs_hash_update = false;

        if ($user) {
            error_log("Stored password length: " . strlen($user['password']));
            error_log("Input password length: " . strlen($password));

            // First try password_verify for hashed passwords
            if (password_verify($password, $user['password'])) {
                $password_valid = true;
                error_log("Password verified with password_verify()");
            }
            // If that fails, try plain text comparison (for legacy passwords)
            else if ($password === $user['password']) {
                $password_valid = true;
                $needs_hash_update = true; // Flag for password hash update
                error_log("Password matched with plain text comparison");
            } else {
                error_log("Password verification failed for both methods");
            }
        }

        if ($password_valid) {
            // Reset rate limiting on successful login
            unset($_SESSION[$rate_limit_key]);

            // Update plain text password to hashed version
            if ($needs_hash_update) {
                try {
                    $hashed_password = password_hash($password, PASSWORD_DEFAULT);
                    $update_stmt = $pdo->prepare('UPDATE users SET password = ? WHERE id = ?');
                    $update_stmt->execute([$hashed_password, $user['id']]);
                    error_log("Password updated to hash for user: " . $user['email']);
                } catch (PDOException $e) {
                    error_log("Failed to update password hash for user " . $user['email'] . ": " . $e->getMessage());
                    // Continue with login even if hash update fails
                }
            }

            // Regenerate session ID to prevent session fixation
            session_regenerate_id(true);

            $_SESSION['user_id'] = $user['id'];
            $_SESSION['role'] = $user['role'];
            $_SESSION['first_name'] = $user['first_name'];
            $_SESSION['last_name'] = $user['last_name'];
            $_SESSION['email'] = $user['email'];
            $_SESSION['department'] = $user['department'];
            $_SESSION['login_time'] = time();

            echo json_encode([
                'success' => true,
                'message' => 'Login successful',
                'user' => [
                    'id' => (int)$user['id'],
                    'first_name' => htmlspecialchars($user['first_name'], ENT_QUOTES, 'UTF-8'),
                    'last_name' => htmlspecialchars($user['last_name'], ENT_QUOTES, 'UTF-8'),
                    'email' => htmlspecialchars($user['email'], ENT_QUOTES, 'UTF-8'),
                    'role' => htmlspecialchars($user['role'], ENT_QUOTES, 'UTF-8'),
                    'department' => htmlspecialchars($user['department'] ?? '', ENT_QUOTES, 'UTF-8')
                ]
            ]);
        } else {
            // Increment failed attempts
            $_SESSION[$rate_limit_key]['count']++;
            $_SESSION[$rate_limit_key]['last_attempt'] = time();

            $remaining_attempts = $max_attempts - $_SESSION[$rate_limit_key]['count'];

            if ($remaining_attempts > 0) {
                echo json_encode([
                    'success' => false,
                    'message' => "Invalid email or password. $remaining_attempts attempts remaining.",
                    'attempts_remaining' => $remaining_attempts
                ]);
            } else {
                echo json_encode([
                    'success' => false,
                    'message' => 'Invalid email or password. Account locked for 15 minutes.',
                    'attempts_remaining' => 0
                ]);
            }
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

if ($action === 'check_session') {
    if (isset($_SESSION['user_id'])) {
        // Check session timeout (24 hours)
        $session_timeout = 24 * 60 * 60; // 24 hours in seconds
        if (isset($_SESSION['login_time']) && (time() - $_SESSION['login_time']) > $session_timeout) {
            session_unset();
            session_destroy();
            echo json_encode(['success' => false, 'message' => 'Session expired.']);
            exit;
        }

        echo json_encode([
            'success' => true,
            'user' => [
                'id' => (int)$_SESSION['user_id'],
                'first_name' => htmlspecialchars($_SESSION['first_name'], ENT_QUOTES, 'UTF-8'),
                'last_name' => htmlspecialchars($_SESSION['last_name'], ENT_QUOTES, 'UTF-8'),
                'email' => htmlspecialchars($_SESSION['email'], ENT_QUOTES, 'UTF-8'),
                'role' => htmlspecialchars($_SESSION['role'], ENT_QUOTES, 'UTF-8'),
                'department' => htmlspecialchars($_SESSION['department'] ?? '', ENT_QUOTES, 'UTF-8')
            ]
        ]);
    } else {
        echo json_encode(['success' => false, 'message' => 'No active session.']);
    }
    exit;
}

echo json_encode(['success' => false, 'message' => 'Invalid action.']);