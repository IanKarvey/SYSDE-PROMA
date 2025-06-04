<?php
// Simple authentication test script
require_once 'php/config.php';

header('Content-Type: text/plain');

echo "=== AUTHENTICATION TEST SCRIPT ===\n\n";

try {
    // Test database connection
    echo "1. Testing database connection...\n";
    $stmt = $pdo->query('SELECT COUNT(*) as count FROM users');
    $result = $stmt->fetch();
    echo "   ✓ Database connected. Found " . $result['count'] . " users.\n\n";
    
    // Test specific users
    $test_emails = [
        'admin@dlsl.edu.ph',
        'john_aaron_manalo@dlsl.edu.ph',
        'ian_karvey_manimtim@dlsl.edu.ph'
    ];
    
    echo "2. Testing user accounts...\n";
    foreach ($test_emails as $email) {
        echo "   Testing: $email\n";
        
        $stmt = $pdo->prepare('SELECT id, first_name, last_name, email, role, password, status FROM users WHERE email = ?');
        $stmt->execute([$email]);
        $user = $stmt->fetch();
        
        if ($user) {
            echo "     ✓ User found: {$user['first_name']} {$user['last_name']} ({$user['role']})\n";
            echo "     ✓ Status: {$user['status']}\n";
            echo "     ✓ Password length: " . strlen($user['password']) . " characters\n";
            echo "     ✓ Password starts with: " . substr($user['password'], 0, 10) . "...\n";
            
            // Test password verification
            $test_password = '123';
            echo "     Testing password '123':\n";
            
            // Test password_verify
            if (password_verify($test_password, $user['password'])) {
                echo "       ✓ password_verify() SUCCESS\n";
            } else {
                echo "       ✗ password_verify() FAILED\n";
            }
            
            // Test plain text
            if ($test_password === $user['password']) {
                echo "       ✓ Plain text comparison SUCCESS\n";
            } else {
                echo "       ✗ Plain text comparison FAILED\n";
            }
            
        } else {
            echo "     ✗ User NOT FOUND\n";
        }
        echo "\n";
    }
    
    echo "3. Testing session functionality...\n";
    session_start();
    $_SESSION['test'] = 'working';
    if (isset($_SESSION['test'])) {
        echo "   ✓ Sessions are working\n";
    } else {
        echo "   ✗ Sessions are NOT working\n";
    }
    
    echo "\n=== TEST COMPLETE ===\n";
    
} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
    echo "Stack trace:\n" . $e->getTraceAsString() . "\n";
}
?>
