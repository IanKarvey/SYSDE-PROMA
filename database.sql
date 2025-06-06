-- Science Laboratory Inventory System SQL
-- Import this file in phpMyAdmin

CREATE DATABASE IF NOT EXISTS slis CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE slis;

-- Users Table
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('student','faculty','staff','admin') NOT NULL DEFAULT 'student',
    department VARCHAR(100),
    status ENUM('active','inactive') NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Inventory Table
CREATE TABLE inventory (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    category ENUM('glassware','equipment','chemicals','tools') NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    status ENUM('available','checked-out','maintenance') NOT NULL DEFAULT 'available',
    location VARCHAR(100) NOT NULL,
    description TEXT,
    image VARCHAR(255),
    last_checked DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Requests Table
CREATE TABLE requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    item_id INT NOT NULL,
    user_id INT NOT NULL,
    date_requested DATE NOT NULL,
    needed_by DATE NOT NULL,
    purpose VARCHAR(255),
    status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (item_id) REFERENCES inventory(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Checkouts Table
CREATE TABLE checkouts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    item_id INT NOT NULL,
    user_id INT NOT NULL,
    date_out DATE NOT NULL,
    due_date DATE NOT NULL,
    date_in DATE,
    condition_in ENUM('excellent','good','fair','poor','damaged'),
    notes TEXT,
    status ENUM('checked-out','returned','overdue') NOT NULL DEFAULT 'checked-out',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (item_id) REFERENCES inventory(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Issues Table
CREATE TABLE issues (
    id INT AUTO_INCREMENT PRIMARY KEY,
    item_id INT NOT NULL,
    user_id INT NOT NULL,
    type ENUM('damage','malfunction','missing','safety','other') NOT NULL,
    severity ENUM('low','medium','high','critical') NOT NULL,
    description TEXT NOT NULL,
    image VARCHAR(255),
    date_reported DATE NOT NULL,
    status ENUM('open','resolved') NOT NULL DEFAULT 'open',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (item_id) REFERENCES inventory(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Sample Data
INSERT INTO users (first_name, last_name, email, password, role, department) VALUES
('Ian Karvey', 'Manimtim', 'ian_karvey_manimtim@dlsl.edu.ph', '123', 'student', 'Computer Science'),
('Admin', 'Manimtim', 'admin@dlsl.edu.ph', '123', 'staff', 'Laboratory Staff'),
('MIchael', 'Panuela', 'michael_josh_panuela@dlsl.edu.ph', '123', 'faculty', 'Biology'),
('Aaron', 'Manalo', 'john_aaron_manalo@dlsl.edu.ph', '123', 'student', 'Physics');

INSERT INTO inventory (name, category, quantity, status, location, description, image, last_checked) VALUES
('Microscope', 'equipment', 10, 'available', 'Lab A', 'High precision microscope', NULL, '2024-06-01 10:00:00'),
('Bunsen Burner', 'equipment', 15, 'checked-out', 'Lab B', 'Standard lab burner', NULL, '2024-06-02 09:00:00'),
('Beaker Set', 'glassware', 30, 'available', 'Lab C', 'Set of 250ml beakers', NULL, '2024-06-01 11:00:00'),
('Sodium Chloride', 'chemicals', 5, 'maintenance', 'Storage', 'NaCl reagent grade', NULL, '2024-06-03 08:00:00'),
('Digital Balance', 'equipment', 8, 'available', 'Lab A', 'Precision analytical balance 0.1mg', NULL, '2024-06-04 09:00:00'),
('Erlenmeyer Flask 250ml', 'glassware', 25, 'available', 'Lab B', 'Borosilicate glass flasks', NULL, '2024-06-04 10:00:00'),
('Hydrochloric Acid', 'chemicals', 12, 'available', 'Chemical Storage', '1M HCl solution', NULL, '2024-06-04 11:00:00'),
('Centrifuge', 'equipment', 3, 'available', 'Lab C', 'High-speed centrifuge 15000 RPM', NULL, '2024-06-04 12:00:00'),
('Pipette Set', 'tools', 20, 'available', 'Lab A', 'Micropipettes 10-1000μL', NULL, '2024-06-04 13:00:00'),
('Test Tube Rack', 'tools', 15, 'available', 'Lab B', 'Plastic test tube holders', NULL, '2024-06-04 14:00:00'),
('Graduated Cylinder 100ml', 'glassware', 18, 'available', 'Lab C', 'Class A graduated cylinders', NULL, '2024-06-04 15:00:00'),
('pH Meter', 'equipment', 5, 'checked-out', 'Lab A', 'Digital pH meter with electrode', NULL, '2024-06-04 16:00:00'),
('Sodium Hydroxide', 'chemicals', 8, 'available', 'Chemical Storage', '1M NaOH solution', NULL, '2024-06-04 17:00:00'),
('Hot Plate Stirrer', 'equipment', 6, 'available', 'Lab B', 'Magnetic stirrer with heating', NULL, '2024-06-04 18:00:00'),
('Petri Dishes', 'glassware', 50, 'available', 'Lab C', 'Sterile plastic petri dishes', NULL, '2024-06-04 19:00:00'),
('Thermometer', 'tools', 12, 'available', 'Lab A', 'Digital thermometers -50 to 300°C', NULL, '2024-06-04 20:00:00'),
('Distilled Water', 'chemicals', 20, 'available', 'Chemical Storage', 'Laboratory grade distilled water', NULL, '2024-06-04 21:00:00'),
('Spectrophotometer', 'equipment', 2, 'maintenance', 'Lab B', 'UV-Vis spectrophotometer', NULL, '2024-06-04 22:00:00'),
('Volumetric Flask 250ml', 'glassware', 15, 'available', 'Lab C', 'Class A volumetric flasks', NULL, '2024-06-04 23:00:00'),
('Safety Goggles', 'tools', 30, 'available', 'Safety Cabinet', 'Chemical splash protection goggles', NULL, '2024-06-05 08:00:00'),
('Ethanol', 'chemicals', 10, 'available', 'Chemical Storage', '95% ethyl alcohol', NULL, '2024-06-05 09:00:00'),
('Autoclave', 'equipment', 1, 'available', 'Sterilization Room', 'Steam sterilizer 121°C', NULL, '2024-06-05 10:00:00'),
('Burette 50ml', 'glassware', 12, 'available', 'Lab A', 'Class A burettes with stopcock', NULL, '2024-06-05 11:00:00'),
('Lab Spatula', 'tools', 25, 'available', 'Lab B', 'Stainless steel spatulas', NULL, '2024-06-05 12:00:00'),
('Incubator', 'equipment', 2, 'available', 'Microbiology Lab', 'Temperature controlled incubator', NULL, '2024-06-05 13:00:00');

INSERT INTO requests (item_id, user_id, date_requested, needed_by, purpose, status) VALUES
(1, 2, '2024-06-01', '2024-06-05', 'Student experiment', 'pending'),
(2, 1, '2024-06-02', '2024-06-06', 'Faculty research', 'approved');

INSERT INTO checkouts (item_id, user_id, date_out, due_date, date_in, condition_in, notes, status) VALUES
(2, 1, '2024-06-01', '2024-06-07', NULL, NULL, 'For lab session', 'checked-out');

INSERT INTO issues (item_id, user_id, type, severity, description, image, date_reported, status) VALUES
(1, 1, 'malfunction', 'high', 'Microscope focus knob is stuck.', NULL, '2024-06-01', 'open');

-- Transaction Logs Table for comprehensive tracking
CREATE TABLE transaction_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    transaction_id VARCHAR(50) UNIQUE NOT NULL,
    user_id INT NOT NULL,
    item_id INT NOT NULL,
    action ENUM('request', 'checkout', 'checkin', 'approve', 'reject') NOT NULL,
    details JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES inventory(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- QR Codes Table for tracking generated codes
CREATE TABLE qr_codes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(100) UNIQUE NOT NULL,
    type ENUM('request', 'checkout') NOT NULL,
    reference_id INT NOT NULL,
    data JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NULL
) ENGINE=InnoDB;

-- Student Activity Logs for comprehensive history
CREATE TABLE activity_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    action VARCHAR(100) NOT NULL,
    description TEXT,
    item_id INT NULL,
    reference_table VARCHAR(50) NULL,
    reference_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES inventory(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Debug Queries
-- To check users table structure:
-- DESCRIBE users;

-- To check user accounts:
-- SELECT email, role, status FROM users;