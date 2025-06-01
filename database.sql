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
('Admin Ian', 'Manimtim', 'admin@dlsl.edu.ph', '123', 'staff', 'Laboratory Staff'),
('Jane', 'Smith', 'jane.smith@dlsl.edu.ph', '123', 'faculty', 'Biology'),
('Alice', 'Cooper', 'alice.cooper@dlsl.edu.ph', '123', 'student', 'Physics');

INSERT INTO inventory (name, category, quantity, status, location, description, image, last_checked) VALUES
('Microscope', 'equipment', 10, 'available', 'Lab A', 'High precision microscope', NULL, '2024-06-01 10:00:00'),
('Bunsen Burner', 'equipment', 15, 'checked-out', 'Lab B', 'Standard lab burner', NULL, '2024-06-02 09:00:00'),
('Beaker Set', 'glassware', 30, 'available', 'Lab C', 'Set of 250ml beakers', NULL, '2024-06-01 11:00:00'),
('Sodium Chloride', 'chemicals', 5, 'maintenance', 'Storage', 'NaCl reagent grade', NULL, '2024-06-03 08:00:00');

INSERT INTO requests (item_id, user_id, date_requested, needed_by, purpose, status) VALUES
(1, 2, '2024-06-01', '2024-06-05', 'Student experiment', 'pending'),
(2, 1, '2024-06-02', '2024-06-06', 'Faculty research', 'approved');

INSERT INTO checkouts (item_id, user_id, date_out, due_date, date_in, condition_in, notes, status) VALUES
(2, 1, '2024-06-01', '2024-06-07', NULL, NULL, 'For lab session', 'checked-out');

INSERT INTO issues (item_id, user_id, type, severity, description, image, date_reported, status) VALUES
(1, 1, 'malfunction', 'high', 'Microscope focus knob is stuck.', NULL, '2024-06-01', 'open');

-- Debug Queries
-- To check users table structure:
-- DESCRIBE users;

-- To check user accounts:
-- SELECT email, role, status FROM users;