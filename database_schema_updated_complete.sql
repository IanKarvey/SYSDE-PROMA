-- =====================================================
-- LABORATORY INVENTORY MANAGEMENT SYSTEM - UPDATED DATABASE SCHEMA
-- =====================================================
-- This schema includes all new features and fixes implemented:
-- 1. Authorization codes system with enhanced validation
-- 2. Admin logs for transaction history management
-- 3. Enhanced foreign key relationships
-- 4. Optimized indexes for better performance
-- =====================================================

-- Drop existing database if it exists and create new one
DROP DATABASE IF EXISTS slis;
CREATE DATABASE slis;
USE slis;

-- =====================================================
-- USERS TABLE
-- =====================================================
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('student', 'faculty', 'staff', 'admin') NOT NULL DEFAULT 'student',
    department VARCHAR(100),
    student_id VARCHAR(20),
    phone VARCHAR(20),
    status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL,
    
    INDEX idx_email (email),
    INDEX idx_role (role),
    INDEX idx_status (status),
    INDEX idx_department (department)
);

-- =====================================================
-- INVENTORY TABLE
-- =====================================================
CREATE TABLE inventory (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    quantity INT NOT NULL DEFAULT 0,
    location VARCHAR(255) NOT NULL,
    description TEXT,
    status ENUM('available', 'checked-out', 'maintenance', 'damaged', 'retired') DEFAULT 'available',
    image_path VARCHAR(500),
    barcode VARCHAR(100),
    purchase_date DATE,
    warranty_expiry DATE,
    last_checked TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_name (name),
    INDEX idx_category (category),
    INDEX idx_status (status),
    INDEX idx_location (location),
    INDEX idx_barcode (barcode),
    FULLTEXT idx_search (name, description, category)
);

-- =====================================================
-- REQUESTS TABLE
-- =====================================================
CREATE TABLE requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    item_id INT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    needed_by DATE NOT NULL,
    notes TEXT,
    status ENUM('pending', 'approved', 'rejected', 'cancelled') DEFAULT 'pending',
    admin_notes TEXT,
    approved_by INT NULL,
    approved_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES inventory(id) ON DELETE CASCADE,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
    
    INDEX idx_user_id (user_id),
    INDEX idx_item_id (item_id),
    INDEX idx_status (status),
    INDEX idx_needed_by (needed_by),
    INDEX idx_created_at (created_at),
    INDEX idx_approved_by (approved_by)
);

-- =====================================================
-- AUTHORIZATION CODES TABLE
-- =====================================================
CREATE TABLE authorization_codes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(8) UNIQUE NOT NULL,
    request_id INT NOT NULL,
    user_id INT NOT NULL,
    item_id INT NOT NULL,
    status ENUM('active', 'used', 'expired', 'cancelled') DEFAULT 'active',
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP NULL,
    cancelled_at TIMESTAMP NULL,
    cancelled_by INT NULL,
    cancellation_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES inventory(id) ON DELETE CASCADE,
    FOREIGN KEY (cancelled_by) REFERENCES users(id) ON DELETE SET NULL,
    
    INDEX idx_code (code),
    INDEX idx_request_id (request_id),
    INDEX idx_user_id (user_id),
    INDEX idx_item_id (item_id),
    INDEX idx_status (status),
    INDEX idx_expires_at (expires_at),
    INDEX idx_created_at (created_at)
);

-- =====================================================
-- CHECKOUTS TABLE
-- =====================================================
CREATE TABLE checkouts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    item_id INT NOT NULL,
    user_id INT NOT NULL,
    date_out TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    due_date DATE NOT NULL,
    date_in TIMESTAMP NULL,
    condition_out ENUM('excellent', 'good', 'fair', 'poor') DEFAULT 'good',
    condition_in ENUM('excellent', 'good', 'fair', 'poor', 'damaged') NULL,
    notes TEXT,
    return_notes TEXT,
    status ENUM('checked_out', 'returned', 'overdue', 'lost', 'damaged') DEFAULT 'checked_out',
    authorization_code VARCHAR(8) NULL,
    checked_out_by INT NULL,
    checked_in_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (item_id) REFERENCES inventory(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (checked_out_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (checked_in_by) REFERENCES users(id) ON DELETE SET NULL,
    
    INDEX idx_item_id (item_id),
    INDEX idx_user_id (user_id),
    INDEX idx_status (status),
    INDEX idx_date_out (date_out),
    INDEX idx_due_date (due_date),
    INDEX idx_date_in (date_in),
    INDEX idx_authorization_code (authorization_code),
    INDEX idx_checked_out_by (checked_out_by)
);

-- =====================================================
-- ADMIN LOGS TABLE (NEW)
-- =====================================================
CREATE TABLE admin_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    admin_id INT NOT NULL,
    action VARCHAR(100) NOT NULL,
    details TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE,
    
    INDEX idx_admin_id (admin_id),
    INDEX idx_action (action),
    INDEX idx_timestamp (timestamp)
);

-- =====================================================
-- ISSUES TABLE
-- =====================================================
CREATE TABLE issues (
    id INT AUTO_INCREMENT PRIMARY KEY,
    item_id INT NOT NULL,
    user_id INT NOT NULL,
    type ENUM('damage', 'malfunction', 'missing', 'safety', 'other') NOT NULL,
    severity ENUM('low', 'medium', 'high', 'critical') NOT NULL,
    description TEXT NOT NULL,
    image_path VARCHAR(500),
    status ENUM('open', 'in_progress', 'resolved', 'closed') DEFAULT 'open',
    assigned_to INT NULL,
    resolution_notes TEXT,
    resolved_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (item_id) REFERENCES inventory(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
    
    INDEX idx_item_id (item_id),
    INDEX idx_user_id (user_id),
    INDEX idx_type (type),
    INDEX idx_severity (severity),
    INDEX idx_status (status),
    INDEX idx_assigned_to (assigned_to),
    INDEX idx_created_at (created_at)
);

-- =====================================================
-- ANNOUNCEMENTS TABLE
-- =====================================================
CREATE TABLE announcements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    type ENUM('general', 'maintenance', 'emergency', 'policy') DEFAULT 'general',
    priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
    status ENUM('draft', 'published', 'archived') DEFAULT 'published',
    author_id INT NOT NULL,
    expires_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
    
    INDEX idx_author_id (author_id),
    INDEX idx_type (type),
    INDEX idx_priority (priority),
    INDEX idx_status (status),
    INDEX idx_expires_at (expires_at),
    INDEX idx_created_at (created_at)
);

-- =====================================================
-- TRIGGERS FOR AUTOMATIC STATUS UPDATES
-- =====================================================

-- Trigger to automatically expire authorization codes
DELIMITER $$
CREATE TRIGGER update_expired_auth_codes
BEFORE UPDATE ON authorization_codes
FOR EACH ROW
BEGIN
    IF NEW.expires_at < NOW() AND OLD.status = 'active' THEN
        SET NEW.status = 'expired';
    END IF;
END$$
DELIMITER ;

-- Trigger to update checkout status when overdue
DELIMITER $$
CREATE TRIGGER update_overdue_checkouts
BEFORE UPDATE ON checkouts
FOR EACH ROW
BEGIN
    IF NEW.due_date < CURDATE() AND OLD.status = 'checked_out' THEN
        SET NEW.status = 'overdue';
    END IF;
END$$
DELIMITER ;

-- =====================================================
-- SAMPLE DATA FOR TESTING
-- =====================================================

-- Insert sample users (password is 'password' for all users)
INSERT INTO users (first_name, last_name, email, password, role, department, student_id) VALUES
('Admin', 'User', 'admin@university.edu', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin', 'IT Department', NULL),
('Lab', 'Staff', 'staff@university.edu', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'staff', 'Chemistry Department', NULL),
('John', 'Doe', 'john.doe@student.university.edu', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'student', 'Chemistry', 'STU001'),
('Jane', 'Smith', 'jane.smith@student.university.edu', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'student', 'Biology', 'STU002'),
('Dr. Sarah', 'Wilson', 'sarah.wilson@university.edu', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'faculty', 'Chemistry Department', NULL);

-- Insert sample inventory items
INSERT INTO inventory (name, category, quantity, location, description, status) VALUES
('Digital Microscope', 'equipment', 5, 'Lab Room 101', 'High-resolution digital microscope with camera attachment', 'available'),
('Beaker Set (250ml)', 'glassware', 20, 'Storage Cabinet A1', 'Borosilicate glass beakers, 250ml capacity', 'available'),
('pH Meter', 'equipment', 3, 'Lab Room 102', 'Digital pH meter with calibration solutions', 'available'),
('Bunsen Burner', 'equipment', 8, 'Lab Room 101', 'Natural gas Bunsen burner with adjustable flame', 'available'),
('Graduated Cylinder (100ml)', 'glassware', 15, 'Storage Cabinet A2', 'Glass graduated cylinder, 100ml with spout', 'available'),
('Analytical Balance', 'equipment', 2, 'Lab Room 103', 'Precision analytical balance, 0.1mg accuracy', 'available'),
('Safety Goggles', 'safety', 30, 'Safety Station', 'Chemical splash safety goggles', 'available'),
('Lab Coat', 'safety', 25, 'Safety Station', 'White cotton lab coat, various sizes', 'available'),
('Centrifuge', 'equipment', 1, 'Lab Room 102', 'Benchtop centrifuge, 4000 RPM max', 'maintenance'),
('Pipette Set', 'tools', 12, 'Storage Cabinet B1', 'Variable volume micropipettes, 10-1000μl', 'available'),
('Erlenmeyer Flask (500ml)', 'glassware', 25, 'Storage Cabinet A3', 'Borosilicate glass Erlenmeyer flask', 'available'),
('Hot Plate Stirrer', 'equipment', 4, 'Lab Room 101', 'Digital hot plate with magnetic stirrer', 'available'),
('Thermometer (Digital)', 'tools', 10, 'Storage Cabinet B2', 'Digital thermometer with probe', 'available'),
('Test Tube Rack', 'tools', 15, 'Storage Cabinet B3', 'Plastic test tube rack, holds 24 tubes', 'available'),
('Fume Hood', 'equipment', 2, 'Lab Room 104', 'Chemical fume hood with ventilation system', 'available');

-- Insert sample requests
INSERT INTO requests (user_id, item_id, quantity, needed_by, notes, status) VALUES
(3, 1, 1, DATE_ADD(CURDATE(), INTERVAL 7 DAY), 'Need for biology lab experiment', 'pending'),
(4, 3, 1, DATE_ADD(CURDATE(), INTERVAL 5 DAY), 'Required for pH testing in chemistry lab', 'approved'),
(3, 5, 2, DATE_ADD(CURDATE(), INTERVAL 3 DAY), 'Measuring solutions for titration', 'approved'),
(4, 7, 1, DATE_ADD(CURDATE(), INTERVAL 10 DAY), 'Safety equipment for lab work', 'pending'),
(3, 12, 1, DATE_ADD(CURDATE(), INTERVAL 14 DAY), 'Heating solutions for experiment', 'approved');

-- Insert sample authorization codes for approved requests
INSERT INTO authorization_codes (code, request_id, user_id, item_id, status, expires_at) VALUES
('A7K9M2X8', 2, 4, 3, 'active', DATE_ADD(NOW(), INTERVAL 48 HOUR)),
('B3N8P5Q1', 3, 3, 5, 'active', DATE_ADD(NOW(), INTERVAL 48 HOUR)),
('C4R7T9W2', 5, 3, 12, 'active', DATE_ADD(NOW(), INTERVAL 48 HOUR));

-- Insert sample checkouts
INSERT INTO checkouts (item_id, user_id, due_date, notes, status, authorization_code) VALUES
(2, 3, DATE_ADD(CURDATE(), INTERVAL 14 DAY), 'Checked out for organic chemistry lab', 'checked_out', NULL),
(4, 4, DATE_ADD(CURDATE(), INTERVAL 7 DAY), 'For flame test experiments', 'checked_out', NULL),
(8, 3, DATE_ADD(CURDATE(), INTERVAL 21 DAY), 'Lab safety equipment', 'checked_out', NULL);

-- Insert sample issues
INSERT INTO issues (item_id, user_id, type, severity, description, status) VALUES
(9, 3, 'malfunction', 'medium', 'Centrifuge making unusual noise during operation', 'open'),
(1, 4, 'damage', 'low', 'Minor scratch on microscope lens', 'in_progress'),
(12, 3, 'malfunction', 'high', 'Hot plate not heating properly', 'open');

-- Insert sample announcements
INSERT INTO announcements (title, content, type, priority, author_id) VALUES
('Lab Safety Reminder', 'Please remember to wear safety goggles and lab coats at all times in the laboratory.', 'general', 'medium', 1),
('Equipment Maintenance Schedule', 'The analytical balance in Room 103 will be under maintenance this Friday from 2-4 PM.', 'maintenance', 'high', 2),
('New Equipment Available', 'We have added new digital microscopes to our inventory. Please submit requests through the system.', 'general', 'low', 1),
('Emergency Procedure Update', 'New emergency evacuation procedures are now in effect. Please review the updated safety manual.', 'emergency', 'urgent', 1);

-- =====================================================
-- VIEWS FOR COMMON QUERIES
-- =====================================================

-- View for active authorization codes with request details
CREATE VIEW active_authorization_codes AS
SELECT
    ac.id,
    ac.code,
    ac.status,
    ac.expires_at,
    ac.created_at,
    r.id as request_id,
    r.quantity as request_quantity,
    r.needed_by,
    u.first_name,
    u.last_name,
    u.email,
    i.name as item_name,
    i.category,
    i.location
FROM authorization_codes ac
JOIN requests r ON ac.request_id = r.id
JOIN users u ON ac.user_id = u.id
JOIN inventory i ON ac.item_id = i.id
WHERE ac.status = 'active' AND ac.expires_at > NOW();

-- View for current checkouts with user and item details
CREATE VIEW current_checkouts AS
SELECT
    c.id,
    c.date_out,
    c.due_date,
    c.status,
    c.notes,
    c.authorization_code,
    u.first_name,
    u.last_name,
    u.email,
    i.name as item_name,
    i.category,
    i.location,
    DATEDIFF(c.due_date, CURDATE()) as days_until_due
FROM checkouts c
JOIN users u ON c.user_id = u.id
JOIN inventory i ON c.item_id = i.id
WHERE c.status IN ('checked_out', 'overdue');

-- View for pending requests with user and item details
CREATE VIEW pending_requests AS
SELECT
    r.id,
    r.quantity,
    r.needed_by,
    r.notes,
    r.created_at,
    u.first_name,
    u.last_name,
    u.email,
    u.department,
    i.name as item_name,
    i.category,
    i.quantity as available_quantity,
    i.location
FROM requests r
JOIN users u ON r.user_id = u.id
JOIN inventory i ON r.item_id = i.id
WHERE r.status = 'pending'
ORDER BY r.created_at ASC;

-- =====================================================
-- STORED PROCEDURES FOR COMMON OPERATIONS
-- =====================================================

-- Procedure to generate authorization code
DELIMITER $$
CREATE PROCEDURE GenerateAuthorizationCode(
    IN p_request_id INT,
    OUT p_code VARCHAR(8)
)
BEGIN
    DECLARE v_user_id INT;
    DECLARE v_item_id INT;
    DECLARE v_code_exists INT DEFAULT 1;

    -- Get request details
    SELECT user_id, item_id INTO v_user_id, v_item_id
    FROM requests WHERE id = p_request_id;

    -- Generate unique code
    WHILE v_code_exists > 0 DO
        SET p_code = UPPER(CONCAT(
            CHAR(65 + FLOOR(RAND() * 26)),
            FLOOR(RAND() * 10),
            CHAR(65 + FLOOR(RAND() * 26)),
            FLOOR(RAND() * 10),
            CHAR(65 + FLOOR(RAND() * 26)),
            FLOOR(RAND() * 10),
            CHAR(65 + FLOOR(RAND() * 26)),
            FLOOR(RAND() * 10)
        ));

        SELECT COUNT(*) INTO v_code_exists
        FROM authorization_codes WHERE code = p_code;
    END WHILE;

    -- Insert authorization code
    INSERT INTO authorization_codes (code, request_id, user_id, item_id, expires_at)
    VALUES (p_code, p_request_id, v_user_id, v_item_id, DATE_ADD(NOW(), INTERVAL 48 HOUR));
END$$
DELIMITER ;

-- =====================================================
-- INDEXES FOR PERFORMANCE OPTIMIZATION
-- =====================================================

-- Additional composite indexes for common queries
CREATE INDEX idx_requests_user_status ON requests(user_id, status);
CREATE INDEX idx_checkouts_user_status ON checkouts(user_id, status);
CREATE INDEX idx_auth_codes_user_status ON authorization_codes(user_id, status);
CREATE INDEX idx_inventory_category_status ON inventory(category, status);

-- =====================================================
-- FINAL NOTES
-- =====================================================
--
-- This updated schema includes:
-- 1. Enhanced authorization_codes table with proper relationships
-- 2. New admin_logs table for transaction history management
-- 3. Improved indexes for better performance
-- 4. Triggers for automatic status updates
-- 5. Views for common queries
-- 6. Stored procedures for code generation
-- 7. Sample data for testing
--
-- Default login credentials (password: 'password'):
-- Admin: admin@university.edu
-- Staff: staff@university.edu
-- Student: john.doe@student.university.edu
-- Student: jane.smith@student.university.edu
-- Faculty: sarah.wilson@university.edu
--
-- Key Changes from Previous Version:
-- 1. Added admin_logs table for transaction history management
-- 2. Enhanced authorization_codes table with cancellation tracking
-- 3. Added triggers for automatic status updates
-- 4. Added views for common queries
-- 5. Added stored procedures for code generation
-- 6. Improved indexes for better performance
-- 7. Added sample authorization codes for testing
-- 8. Uses 'slis' database name for direct import
--
-- READY FOR TESTING:
-- - Authorization code validation (fixed bug)
-- - Mandatory student authorization requirements
-- - Transaction history management with ID reset
-- - Complete sample data with active authorization codes
--
-- =====================================================
