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
