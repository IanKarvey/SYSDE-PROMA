<?php
// Enable error reporting for debugging
error_reporting(E_ALL);
ini_set('display_errors', 0); // Don't display errors in output
ini_set('log_errors', 1);

// Start output buffering to catch any unexpected output
ob_start();

try {
    require_once 'config.php';
    require_once 'session.php';
    require_once 'utils.php';

    // Clear any output that might have been generated
    ob_clean();

    header('Content-Type: application/json');
} catch (Exception $e) {
    ob_clean();
    header('Content-Type: application/json');
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Server configuration error: ' . $e->getMessage()]);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];
$user = get_user();

if ($method === 'GET') {
    try {
        // Check if requesting a specific item
        if (isset($_GET['id'])) {
            $id = intval($_GET['id']);
            $stmt = $pdo->prepare('SELECT * FROM inventory WHERE id = ?');
            $stmt->execute([$id]);
            $item = $stmt->fetch();
            if ($item) {
                echo json_encode(['success' => true, 'item' => $item]);
            } else {
                echo json_encode(['success' => false, 'message' => 'Item not found']);
            }
            exit;
        }

    // List/search inventory with pagination
    $search = isset($_GET['search']) ? '%' . sanitize_string($_GET['search']) . '%' : '%';
    $category = $_GET['category'] ?? '';
    $status = $_GET['status'] ?? '';
    $page = max(1, intval($_GET['page'] ?? 1));
    $limit = intval($_GET['limit'] ?? 10);
    $offset = ($page - 1) * $limit;

    // Build base query for counting total items
    $countSql = 'SELECT COUNT(*) as total FROM inventory WHERE name LIKE ?';
    $params = [$search];
    if ($category && $category !== 'all') {
        $countSql .= ' AND category = ?';
        $params[] = $category;
    }
    if ($status && $status !== 'all') {
        $countSql .= ' AND status = ?';
        $params[] = $status;
    }

    // Get total count
    $stmt = $pdo->prepare($countSql);
    $stmt->execute($params);
    $totalItems = $stmt->fetch()['total'];
    $totalPages = ceil($totalItems / $limit);

    // Build query for actual data
    $sql = 'SELECT * FROM inventory WHERE name LIKE ?';
    $params = [$search];
    if ($category && $category !== 'all') {
        $sql .= ' AND category = ?';
        $params[] = $category;
    }
    if ($status && $status !== 'all') {
        $sql .= ' AND status = ?';
        $params[] = $status;
    }
    $sql .= ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    $params[] = $limit;
    $params[] = $offset;

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $items = $stmt->fetchAll();

        echo json_encode([
            'success' => true,
            'data' => $items,
            'pagination' => [
                'current_page' => $page,
                'total_pages' => $totalPages,
                'total_items' => $totalItems,
                'items_per_page' => $limit,
                'has_next' => $page < $totalPages,
                'has_previous' => $page > 1,
                'start_item' => $totalItems > 0 ? $offset + 1 : 0,
                'end_item' => min($offset + $limit, $totalItems)
            ]
        ]);
        exit;

    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
        exit;
    }
}

if ($method === 'POST') {
    require_login();
    require_staff_admin($user);
    $name = sanitize_string($_POST['name'] ?? '');
    $category = sanitize_string($_POST['category'] ?? '');
    $quantity = intval($_POST['quantity'] ?? 1);
    $status = sanitize_string($_POST['status'] ?? 'available');
    $location = sanitize_string($_POST['location'] ?? '');
    $description = sanitize_string($_POST['description'] ?? '');
    $last_checked = $_POST['last_checked'] ?? null;
    $image = null;
    // Handle file upload
    if (!empty($_FILES['image']['name'])) {
        $target_dir = '../uploads/';
        if (!is_dir($target_dir)) mkdir($target_dir, 0777, true);
        $filename = uniqid() . '_' . basename($_FILES['image']['name']);
        $target_file = $target_dir . $filename;
        if (move_uploaded_file($_FILES['image']['tmp_name'], $target_file)) {
            $image = $filename;
        }
    }
    $stmt = $pdo->prepare('INSERT INTO inventory (name, category, quantity, status, location, description, image, last_checked) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    $stmt->execute([$name, $category, $quantity, $status, $location, $description, $image, $last_checked]);
    echo json_encode(['success' => true, 'message' => 'Item added.']);
    exit;
}

if ($method === 'PUT') {
    require_login();
    require_staff_admin($user);
    parse_str(file_get_contents('php://input'), $_PUT);
    $id = intval($_PUT['id'] ?? 0);
    $name = sanitize_string($_PUT['name'] ?? '');
    $category = sanitize_string($_PUT['category'] ?? '');
    $quantity = intval($_PUT['quantity'] ?? 1);
    $status = sanitize_string($_PUT['status'] ?? 'available');
    $location = sanitize_string($_PUT['location'] ?? '');
    $description = sanitize_string($_PUT['description'] ?? '');
    $last_checked = $_PUT['last_checked'] ?? null;
    $stmt = $pdo->prepare('UPDATE inventory SET name=?, category=?, quantity=?, status=?, location=?, description=?, last_checked=? WHERE id=?');
    $stmt->execute([$name, $category, $quantity, $status, $location, $description, $last_checked, $id]);
    echo json_encode(['success' => true, 'message' => 'Item updated.']);
    exit;
}

if ($method === 'DELETE') {
    require_login();
    require_staff_admin($user);
    parse_str(file_get_contents('php://input'), $_DELETE);
    $id = intval($_DELETE['id'] ?? 0);
    $stmt = $pdo->prepare('DELETE FROM inventory WHERE id=?');
    $stmt->execute([$id]);
    echo json_encode(['success' => true, 'message' => 'Item deleted.']);
    exit;
}

echo json_encode(['success' => false, 'message' => 'Invalid request.']); 