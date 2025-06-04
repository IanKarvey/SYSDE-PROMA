-- Database updates for enhanced laboratory inventory system

-- Add quantity column to requests table
ALTER TABLE requests ADD COLUMN quantity INT DEFAULT 1 AFTER item_id;

-- Update requests table to support cancelled status
ALTER TABLE requests MODIFY COLUMN status ENUM('pending', 'approved', 'rejected', 'cancelled') DEFAULT 'pending';

-- Create contact_messages table for staff-user communication
CREATE TABLE IF NOT EXISTS contact_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    from_user_id INT NOT NULL,
    to_user_id INT NOT NULL,
    subject VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP NULL,
    FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_to_user (to_user_id),
    INDEX idx_from_user (from_user_id),
    INDEX idx_sent_at (sent_at)
);

-- Create activity_logs table for comprehensive logging
CREATE TABLE IF NOT EXISTS activity_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id INT NOT NULL,
    details TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_action (action),
    INDEX idx_entity (entity_type, entity_id),
    INDEX idx_created_at (created_at)
);

-- Create borrowing_transactions table for detailed tracking
CREATE TABLE IF NOT EXISTS borrowing_transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    request_id INT NOT NULL,
    user_id INT NOT NULL,
    item_id INT NOT NULL,
    quantity_borrowed INT NOT NULL,
    borrowed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    due_date DATE NOT NULL,
    returned_at TIMESTAMP NULL,
    condition_out ENUM('excellent', 'good', 'fair', 'poor') DEFAULT 'good',
    condition_in ENUM('excellent', 'good', 'fair', 'poor', 'damaged') NULL,
    notes TEXT,
    staff_out_id INT NOT NULL,
    staff_in_id INT NULL,
    FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES inventory(id) ON DELETE CASCADE,
    FOREIGN KEY (staff_out_id) REFERENCES users(id),
    FOREIGN KEY (staff_in_id) REFERENCES users(id),
    INDEX idx_user_id (user_id),
    INDEX idx_item_id (item_id),
    INDEX idx_borrowed_at (borrowed_at),
    INDEX idx_due_date (due_date),
    INDEX idx_returned_at (returned_at)
);

-- Add indexes for better search performance
ALTER TABLE inventory ADD INDEX idx_name (name);
ALTER TABLE inventory ADD INDEX idx_category (category);
ALTER TABLE inventory ADD INDEX idx_status (status);
ALTER TABLE inventory ADD INDEX idx_location (location);

ALTER TABLE requests ADD INDEX idx_status (status);
ALTER TABLE requests ADD INDEX idx_date_requested (date_requested);
ALTER TABLE requests ADD INDEX idx_needed_by (needed_by);

ALTER TABLE users ADD INDEX idx_email (email);
ALTER TABLE users ADD INDEX idx_role (role);
ALTER TABLE users ADD INDEX idx_status (status);

-- Update existing data to ensure consistency
UPDATE requests SET quantity = 1 WHERE quantity IS NULL OR quantity = 0;

-- Insert sample activity log entries for existing data
INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details, created_at)
SELECT 
    user_id,
    'request_created',
    'request',
    id,
    CONCAT('Request created for item ID: ', item_id, ', quantity: ', COALESCE(quantity, 1)),
    created_at
FROM requests
WHERE NOT EXISTS (
    SELECT 1 FROM activity_logs 
    WHERE entity_type = 'request' AND entity_id = requests.id AND action = 'request_created'
);

-- Create view for comprehensive request information
CREATE OR REPLACE VIEW request_details AS
SELECT 
    r.*,
    u.first_name,
    u.last_name,
    u.email,
    u.department,
    i.name as item_name,
    i.category as item_category,
    i.location as item_location,
    i.status as item_status
FROM requests r
JOIN users u ON r.user_id = u.id
JOIN inventory i ON r.item_id = i.id;

-- Create view for user activity summary
CREATE OR REPLACE VIEW user_activity_summary AS
SELECT 
    u.id,
    u.first_name,
    u.last_name,
    u.email,
    u.role,
    COUNT(DISTINCT r.id) as total_requests,
    COUNT(DISTINCT CASE WHEN r.status = 'pending' THEN r.id END) as pending_requests,
    COUNT(DISTINCT CASE WHEN r.status = 'approved' THEN r.id END) as approved_requests,
    COUNT(DISTINCT bt.id) as total_borrowings,
    COUNT(DISTINCT CASE WHEN bt.returned_at IS NULL THEN bt.id END) as active_borrowings,
    MAX(r.created_at) as last_request_date,
    MAX(bt.borrowed_at) as last_borrow_date
FROM users u
LEFT JOIN requests r ON u.id = r.user_id
LEFT JOIN borrowing_transactions bt ON u.id = bt.user_id
GROUP BY u.id, u.first_name, u.last_name, u.email, u.role;
