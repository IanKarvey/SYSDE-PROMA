<?php
session_start();
include 'db_connection.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $request_id = $_POST['request_id'];
    
    // Update the status to 'cancelled' or delete the request
    $sql = "UPDATE requests SET status = 'cancelled' WHERE id = ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("i", $request_id);
    
    if ($stmt->execute()) {
        $_SESSION['message'] = "Request successfully cancelled.";
    } else {
        $_SESSION['error'] = "Failed to cancel request.";
    }
    
    header("Location: " . $_SERVER['HTTP_REFERER']);
    exit();
}
?>
