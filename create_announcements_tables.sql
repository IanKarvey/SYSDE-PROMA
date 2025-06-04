-- Create announcements table
CREATE TABLE IF NOT EXISTS announcements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    target_role ENUM('all', 'student', 'staff', 'admin') DEFAULT 'all',
    priority ENUM('low', 'normal', 'high', 'urgent') DEFAULT 'normal',
    status ENUM('active', 'inactive', 'deleted') DEFAULT 'active',
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Create user dismissed announcements table
CREATE TABLE IF NOT EXISTS user_dismissed_announcements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    announcement_id INT NOT NULL,
    dismissed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_user_announcement (user_id, announcement_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (announcement_id) REFERENCES announcements(id) ON DELETE CASCADE
);

-- Create checkouts table for equipment check-in/checkout functionality
CREATE TABLE IF NOT EXISTS checkouts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    item_id INT NOT NULL,
    user_id INT NOT NULL,
    date_out DATE NOT NULL,
    due_date DATE NOT NULL,
    date_in DATE NULL,
    status ENUM('checked_out', 'returned', 'overdue') DEFAULT 'checked_out',
    condition_in VARCHAR(50) NULL,
    notes TEXT NULL,
    authorization_code VARCHAR(20) NULL,
    request_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (item_id) REFERENCES inventory(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE SET NULL,
    INDEX idx_status (status),
    INDEX idx_date_out (date_out),
    INDEX idx_user_id (user_id),
    INDEX idx_item_id (item_id),
    INDEX idx_authorization_code (authorization_code),
    INDEX idx_request_id (request_id)
);

-- Create authorization codes table for request-to-checkout workflow
CREATE TABLE IF NOT EXISTS authorization_codes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,
    request_id INT NOT NULL,
    user_id INT NOT NULL,
    item_id INT NOT NULL,
    status ENUM('active', 'used', 'expired', 'cancelled') DEFAULT 'active',
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP NULL,
    checkout_id INT NULL,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES inventory(id) ON DELETE CASCADE,
    FOREIGN KEY (checkout_id) REFERENCES checkouts(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_code (code),
    INDEX idx_status (status),
    INDEX idx_expires_at (expires_at),
    INDEX idx_request_id (request_id),
    INDEX idx_user_id (user_id)
);

-- Create activity_logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS activity_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id INT,
    details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Insert sample announcements
INSERT INTO announcements (title, content, target_role, priority, created_by) VALUES
('Welcome to Laboratory Inventory System', 'Welcome to our new laboratory inventory management system. Please familiarize yourself with the new features and procedures.', 'all', 'normal', 1),
('Equipment Maintenance Schedule', 'Regular maintenance will be performed on all laboratory equipment every first Monday of the month. Please plan your experiments accordingly.', 'all', 'high', 1),
('New Safety Protocols', 'New safety protocols have been implemented. All students must complete the safety training before accessing laboratory equipment.', 'student', 'urgent', 1),
('Inventory Update Procedures', 'Staff members are reminded to update inventory quantities immediately after equipment usage or maintenance.', 'staff', 'normal', 1);

-- Insert sample laboratory equipment for testing check-in/checkout functionality
INSERT INTO inventory (name, category, quantity, location, description, status, created_at, last_checked) VALUES

-- Microscopy Equipment
('Olympus CX23 Compound Microscope', 'equipment', 4, 'Biology Lab A', 'Professional compound microscope with LED illumination, 4x, 10x, 40x, and 100x objectives. Ideal for cellular biology and histology studies.', 'available', NOW(), NOW()),
('Zeiss Stereo Discovery V8 Microscope', 'equipment', 3, 'Biology Lab B', 'High-performance stereo microscope with 8:1 zoom ratio. Perfect for dissection work and specimen examination.', 'available', NOW(), NOW()),

-- Centrifugation Equipment
('Eppendorf 5424R Refrigerated Centrifuge', 'equipment', 2, 'Molecular Biology Lab', 'High-speed refrigerated microcentrifuge with temperature control (-9°C to +40°C). Maximum speed 21,130 x g.', 'available', NOW(), NOW()),
('Thermo Scientific Sorvall ST 8R Centrifuge', 'equipment', 2, 'Biochemistry Lab', 'Benchtop centrifuge with refrigeration capability. Accommodates various rotor types for different applications.', 'available', NOW(), NOW()),

-- Spectroscopy Equipment
('Thermo Scientific NanoDrop 2000c Spectrophotometer', 'equipment', 3, 'Analytical Lab', 'UV-Vis spectrophotometer for nucleic acid and protein quantification. Requires only 1-2 μL sample volume.', 'available', NOW(), NOW()),
('Agilent Cary 60 UV-Vis Spectrophotometer', 'equipment', 2, 'Chemistry Lab A', 'Double-beam UV-Vis spectrophotometer with xenon flash lamp. Wavelength range 190-1100 nm.', 'available', NOW(), NOW()),

-- Heating and Mixing Equipment
('IKA RCT Basic Hot Plate Stirrer', 'equipment', 5, 'General Chemistry Lab', 'Magnetic stirrer with heating plate. Temperature range up to 340°C with precise digital control.', 'available', NOW(), NOW()),
('Thermo Scientific Heratherm Incubator', 'equipment', 3, 'Microbiology Lab', 'General purpose incubator with natural convection. Temperature range +5°C above ambient to +100°C.', 'available', NOW(), NOW()),

-- Analytical Balances
('Mettler Toledo XS205 Analytical Balance', 'equipment', 4, 'Analytical Lab', 'Precision analytical balance with 0.1 mg readability. Internal calibration and draft shield included.', 'available', NOW(), NOW()),
('Sartorius Entris II Precision Balance', 'equipment', 3, 'Chemistry Lab B', 'Precision balance with 1 mg readability. Ideal for routine weighing applications in laboratory settings.', 'available', NOW(), NOW()),

-- pH and Electrochemistry
('Hanna Instruments HI-2020 pH Meter', 'equipment', 4, 'Environmental Lab', 'Benchtop pH meter with automatic temperature compensation. Includes glass body pH electrode.', 'available', NOW(), NOW()),

-- Pipettes and Liquid Handling
('Eppendorf Research Plus Pipette Set', 'equipment', 6, 'Equipment Storage Room', 'Variable volume pipette set (0.1-2.5 μL, 0.5-10 μL, 2-20 μL, 10-100 μL, 20-200 μL, 100-1000 μL).', 'available', NOW(), NOW()),

-- Electrophoresis Equipment
('Bio-Rad Mini-PROTEAN Tetra System', 'equipment', 3, 'Protein Lab', 'Vertical electrophoresis system for protein separation. Includes casting frames, combs, and power supply.', 'available', NOW(), NOW()),

-- PCR and Thermal Cycling
('Applied Biosystems Veriti 96-Well Thermal Cycler', 'equipment', 2, 'PCR Lab', 'High-performance thermal cycler with 96-well capacity. Advanced Peltier technology for precise temperature control.', 'available', NOW(), NOW()),

-- Safety Equipment
('Labconco Purifier Logic+ Class II Biosafety Cabinet', 'equipment', 2, 'Biosafety Lab', 'Class II Type A2 biological safety cabinet with HEPA filtration. Provides personnel, product, and environmental protection.', 'available', NOW(), NOW());
