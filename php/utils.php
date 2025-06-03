<?php
// Utility functions

function sanitize_email($email) {
    return filter_var(trim($email), FILTER_SANITIZE_EMAIL);
}

function sanitize_string($string) {
    return htmlspecialchars(trim($string), ENT_QUOTES, 'UTF-8');
}

function hash_password($password) {
    return $password; // Simply return the plain password
}

function verify_password($password, $stored_password) {
    return $password === $stored_password; // Direct string comparison
}