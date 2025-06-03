<?php
// Session utility functions
session_start();

function is_logged_in() {
    return isset($_SESSION['user_id']);
}

function require_login() {
    if (!is_logged_in()) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Not authenticated.']);
        exit;
    }
}

function get_user() {
    if (!is_logged_in()) return null;
    return [
        'id' => $_SESSION['user_id'],
        'role' => $_SESSION['role'],
        'first_name' => $_SESSION['first_name'],
        'last_name' => $_SESSION['last_name'],
        'email' => $_SESSION['email'],
    ];
}

function require_staff_admin($user = null) {
    if (!$user) {
        $user = get_user();
    }
    if (!$user || ($user['role'] !== 'admin' && $user['role'] !== 'staff')) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Access denied. Admin or staff privileges required.']);
        exit;
    }
}