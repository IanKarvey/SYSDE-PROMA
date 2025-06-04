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
        // Handle duplicate check action - Enhanced to check by name only
        if (isset($_GET['action']) && $_GET['action'] === 'check_duplicate') {
            $name = trim($_GET['name'] ?? '');

            if (!$name) {
                echo json_encode(['success' => false, 'message' => 'Item name is required for duplicate check.']);
                exit;
            }

            // Check for any item with the same name (case-insensitive)
            $stmt = $pdo->prepare('SELECT id, name, category, location, quantity FROM inventory WHERE LOWER(name) = LOWER(?) AND status = "available"');
            $stmt->execute([$name]);
            $duplicates = $stmt->fetchAll();

            if (!empty($duplicates)) {
                // Return all duplicates for user to choose from
                $sanitized_duplicates = array_map(function($duplicate) {
                    return [
                        'id' => (int)$duplicate['id'],
                        'name' => htmlspecialchars($duplicate['name'], ENT_QUOTES, 'UTF-8'),
                        'category' => htmlspecialchars($duplicate['category'], ENT_QUOTES, 'UTF-8'),
                        'location' => htmlspecialchars($duplicate['location'], ENT_QUOTES, 'UTF-8'),
                        'quantity' => (int)$duplicate['quantity']
                    ];
                }, $duplicates);

                echo json_encode([
                    'success' => true,
                    'duplicates' => $sanitized_duplicates
                ]);
            } else {
                echo json_encode(['success' => true, 'duplicates' => []]);
            }
            exit;
        }

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

    // Enhanced input validation and sanitization
    $name = trim(sanitize_string($_POST['name'] ?? ''));
    $category = trim(sanitize_string($_POST['category'] ?? ''));
    $quantity = intval($_POST['quantity'] ?? 1);
    $status = sanitize_string($_POST['status'] ?? 'available');
    $location = trim(sanitize_string($_POST['location'] ?? ''));
    $description = trim(sanitize_string($_POST['description'] ?? ''));
    $last_checked = $_POST['last_checked'] ?? null;

    // Validate required fields
    if (empty($name) || empty($category) || empty($location)) {
        echo json_encode(['success' => false, 'message' => 'Name, category, and location are required.']);
        exit;
    }

    // Validate quantity
    if ($quantity < 1 || $quantity > 10000) {
        echo json_encode(['success' => false, 'message' => 'Quantity must be between 1 and 10,000.']);
        exit;
    }

    // Validate status
    $valid_statuses = ['available', 'checked-out', 'maintenance', 'damaged'];
    if (!in_array($status, $valid_statuses)) {
        echo json_encode(['success' => false, 'message' => 'Invalid status.']);
        exit;
    }

    try {
        // Enhanced duplicate detection - check for exact match first (name + category + location)
        $stmt = $pdo->prepare('SELECT id, quantity FROM inventory WHERE LOWER(name) = LOWER(?) AND LOWER(category) = LOWER(?) AND LOWER(location) = LOWER(?) AND status = "available"');
        $stmt->execute([$name, $category, $location]);
        $exact_match = $stmt->fetch();

        if ($exact_match) {
            // Update existing item quantity for exact match
            $new_quantity = $exact_match['quantity'] + $quantity;
            $stmt = $pdo->prepare('UPDATE inventory SET quantity = ?, last_checked = NOW() WHERE id = ?');
            $stmt->execute([$new_quantity, $exact_match['id']]);

            echo json_encode([
                'success' => true,
                'message' => "Added $quantity units to existing item. New total: $new_quantity units.",
                'action' => 'updated',
                'item_id' => $exact_match['id'],
                'new_quantity' => $new_quantity
            ]);
            exit;
        }

        // Check for name-only duplicates (for user confirmation)
        $stmt = $pdo->prepare('SELECT id, name, category, location, quantity FROM inventory WHERE LOWER(name) = LOWER(?) AND status = "available"');
        $stmt->execute([$name]);
        $name_duplicates = $stmt->fetchAll();

        // If name duplicates exist but user chose to create separate item, continue with creation
        // This will be handled by frontend confirmation

    } catch (PDOException $e) {
        error_log("Database error during duplicate check: " . $e->getMessage());
        echo json_encode(['success' => false, 'message' => 'Database error occurred.']);
        exit;
    }

    $image = null;
    // Handle secure file upload
    if (!empty($_FILES['image']['name'])) {
        $upload_error = $_FILES['image']['error'];
        if ($upload_error !== UPLOAD_ERR_OK) {
            echo json_encode(['success' => false, 'message' => 'File upload error.']);
            exit;
        }

        // Validate file type
        $allowed_types = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        $file_type = $_FILES['image']['type'];
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $detected_type = finfo_file($finfo, $_FILES['image']['tmp_name']);
        finfo_close($finfo);

        if (!in_array($detected_type, $allowed_types) || !in_array($file_type, $allowed_types)) {
            echo json_encode(['success' => false, 'message' => 'Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.']);
            exit;
        }

        // Validate file size (max 5MB)
        $max_size = 5 * 1024 * 1024; // 5MB
        if ($_FILES['image']['size'] > $max_size) {
            echo json_encode(['success' => false, 'message' => 'File too large. Maximum size is 5MB.']);
            exit;
        }

        $target_dir = '../uploads/';
        if (!is_dir($target_dir)) {
            mkdir($target_dir, 0755, true);
        }

        // Generate secure filename
        $extension = pathinfo($_FILES['image']['name'], PATHINFO_EXTENSION);
        $filename = uniqid('img_', true) . '.' . strtolower($extension);
        $target_file = $target_dir . $filename;

        if (move_uploaded_file($_FILES['image']['tmp_name'], $target_file)) {
            $image = $filename;
        } else {
            echo json_encode(['success' => false, 'message' => 'Failed to upload file.']);
            exit;
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