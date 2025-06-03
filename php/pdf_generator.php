<?php
require_once 'config.php';
require_once 'session.php';
require_once 'utils.php';

header('Content-Type: application/json');

$action = $_GET['action'] ?? $_POST['action'] ?? '';

// Generate QR Code for request/checkout
function generateQRCode($type, $referenceId, $data) {
    global $pdo;
    
    // Generate unique code
    $code = strtoupper(uniqid($type . '_'));
    
    // Store in database
    $stmt = $pdo->prepare('INSERT INTO qr_codes (code, type, reference_id, data) VALUES (?, ?, ?, ?)');
    $stmt->execute([$code, $type, $referenceId, json_encode($data)]);
    
    return $code;
}

// Generate PDF Receipt
function generatePDFReceipt($type, $data) {
    // Simple HTML to PDF conversion (you can use libraries like TCPDF or FPDF for better results)
    $html = generateReceiptHTML($type, $data);
    
    // For now, return HTML that can be printed
    return $html;
}

function generateReceiptHTML($type, $data) {
    $currentDate = date('Y-m-d H:i:s');
    $transactionId = strtoupper(uniqid('TXN_'));
    
    $html = "
    <!DOCTYPE html>
    <html>
    <head>
        <title>Laboratory Equipment Receipt</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
            .receipt-info { margin-bottom: 20px; }
            .receipt-info table { width: 100%; border-collapse: collapse; }
            .receipt-info td { padding: 8px; border-bottom: 1px solid #ddd; }
            .receipt-info td:first-child { font-weight: bold; width: 30%; }
            .qr-section { text-align: center; margin: 20px 0; }
            .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #666; }
            @media print { body { margin: 0; } }
        </style>
    </head>
    <body>
        <div class='header'>
            <h2>Science Laboratory Inventory System</h2>
            <h3>Equipment " . ucfirst($type) . " Receipt</h3>
        </div>
        
        <div class='receipt-info'>
            <table>
                <tr><td>Transaction ID:</td><td>{$transactionId}</td></tr>
                <tr><td>Date:</td><td>{$currentDate}</td></tr>
                <tr><td>Student Name:</td><td>{$data['student_name']}</td></tr>
                <tr><td>Student Email:</td><td>{$data['student_email']}</td></tr>
                <tr><td>Item Name:</td><td>{$data['item_name']}</td></tr>
                <tr><td>Item Location:</td><td>{$data['item_location']}</td></tr>";
    
    if ($type === 'checkout') {
        $html .= "
                <tr><td>Checkout Date:</td><td>{$data['checkout_date']}</td></tr>
                <tr><td>Due Date:</td><td>{$data['due_date']}</td></tr>";
    } else {
        $html .= "
                <tr><td>Request Date:</td><td>{$data['request_date']}</td></tr>
                <tr><td>Needed By:</td><td>{$data['needed_by']}</td></tr>
                <tr><td>Purpose:</td><td>{$data['purpose']}</td></tr>";
    }
    
    $html .= "
            </table>
        </div>
        
        <div class='qr-section'>
            <p><strong>QR Code: {$data['qr_code']}</strong></p>
            <p>Scan this code for quick verification</p>
        </div>
        
        <div class='footer'>
            <p>This is an official receipt from the Science Laboratory Inventory System</p>
            <p>Please keep this receipt for your records</p>
        </div>
        
        <script>
            // Auto-print when opened
            window.onload = function() {
                window.print();
            }
        </script>
    </body>
    </html>";
    
    return $html;
}

if ($action === 'generate_receipt') {
    require_login();
    
    $type = sanitize_string($_POST['type'] ?? ''); // 'request' or 'checkout'
    $referenceId = intval($_POST['reference_id'] ?? 0);
    
    if (!$type || !$referenceId) {
        echo json_encode(['success' => false, 'message' => 'Invalid parameters']);
        exit;
    }
    
    try {
        // Fetch data based on type
        if ($type === 'request') {
            $stmt = $pdo->prepare('
                SELECT r.*, u.first_name, u.last_name, u.email, i.name as item_name, i.location as item_location
                FROM requests r 
                JOIN users u ON r.user_id = u.id 
                JOIN inventory i ON r.item_id = i.id 
                WHERE r.id = ?
            ');
            $stmt->execute([$referenceId]);
            $record = $stmt->fetch();
            
            if (!$record) {
                echo json_encode(['success' => false, 'message' => 'Request not found']);
                exit;
            }
            
            $data = [
                'student_name' => $record['first_name'] . ' ' . $record['last_name'],
                'student_email' => $record['email'],
                'item_name' => $record['item_name'],
                'item_location' => $record['item_location'],
                'request_date' => $record['date_requested'],
                'needed_by' => $record['needed_by'],
                'purpose' => $record['purpose']
            ];
        } else {
            $stmt = $pdo->prepare('
                SELECT c.*, u.first_name, u.last_name, u.email, i.name as item_name, i.location as item_location
                FROM checkouts c 
                JOIN users u ON c.user_id = u.id 
                JOIN inventory i ON c.item_id = i.id 
                WHERE c.id = ?
            ');
            $stmt->execute([$referenceId]);
            $record = $stmt->fetch();
            
            if (!$record) {
                echo json_encode(['success' => false, 'message' => 'Checkout not found']);
                exit;
            }
            
            $data = [
                'student_name' => $record['first_name'] . ' ' . $record['last_name'],
                'student_email' => $record['email'],
                'item_name' => $record['item_name'],
                'item_location' => $record['item_location'],
                'checkout_date' => $record['date_out'],
                'due_date' => $record['due_date']
            ];
        }
        
        // Generate QR code
        $qrCode = generateQRCode($type, $referenceId, $data);
        $data['qr_code'] = $qrCode;
        
        // Generate PDF HTML
        $receiptHTML = generatePDFReceipt($type, $data);
        
        echo json_encode([
            'success' => true, 
            'receipt_html' => $receiptHTML,
            'qr_code' => $qrCode
        ]);
        
    } catch (Exception $e) {
        error_log("PDF Generation error: " . $e->getMessage());
        echo json_encode(['success' => false, 'message' => 'Failed to generate receipt']);
    }
    exit;
}

if ($action === 'verify_qr') {
    $code = sanitize_string($_GET['code'] ?? '');
    
    if (!$code) {
        echo json_encode(['success' => false, 'message' => 'QR code required']);
        exit;
    }
    
    try {
        $stmt = $pdo->prepare('SELECT * FROM qr_codes WHERE code = ?');
        $stmt->execute([$code]);
        $qrData = $stmt->fetch();
        
        if (!$qrData) {
            echo json_encode(['success' => false, 'message' => 'Invalid QR code']);
            exit;
        }
        
        echo json_encode([
            'success' => true,
            'data' => json_decode($qrData['data'], true),
            'type' => $qrData['type'],
            'created_at' => $qrData['created_at']
        ]);
        
    } catch (Exception $e) {
        error_log("QR Verification error: " . $e->getMessage());
        echo json_encode(['success' => false, 'message' => 'Failed to verify QR code']);
    }
    exit;
}

echo json_encode(['success' => false, 'message' => 'Invalid action']);
?>
