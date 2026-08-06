-- Kamalarani Foundation — Database Schema
-- Run this file once to create all tables.
-- For existing databases that already have admission_applications, run:
--   migrations/alter_admissions_columns.sql

CREATE DATABASE IF NOT EXISTS kamalarani_db;
USE kamalarani_db;

CREATE TABLE IF NOT EXISTS admins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  event_date DATETIME NOT NULL,
  end_date DATETIME NULL,
  location VARCHAR(500),
  cover_image_url TEXT,
  is_published BOOLEAN DEFAULT TRUE,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES admins(id) ON DELETE SET NULL
);
CREATE INDEX idx_events_date ON events(event_date);

CREATE TABLE IF NOT EXISTS gallery_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  media_type ENUM('image','video') NOT NULL,
  media_url TEXT NOT NULL,
  caption VARCHAR(500),
  file_name VARCHAR(255),
  uploaded_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (uploaded_by) REFERENCES admins(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS contact_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  subject VARCHAR(500),
  message TEXT NOT NULL,
  status ENUM('new','read','replied') DEFAULT 'new',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admission_applications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  arn VARCHAR(50) UNIQUE,
  student_name VARCHAR(255) NOT NULL,
  dob DATE,
  gender VARCHAR(20),
  school_name VARCHAR(255),
  class_applying_for VARCHAR(50),
  programme VARCHAR(50),
  branch VARCHAR(50),
  father_name VARCHAR(255),
  mother_name VARCHAR(255),
  occupation VARCHAR(255),
  parent_mobile VARCHAR(20) NOT NULL,
  mother_mobile VARCHAR(20),
  email VARCHAR(255),
  aadhaar_no VARCHAR(20),
  village_locality VARCHAR(255),
  po VARCHAR(255),
  ps VARCHAR(255),
  district VARCHAR(255),
  state VARCHAR(100) DEFAULT 'West Bengal',
  pin_code VARCHAR(10),
  address TEXT,
  passport_photo VARCHAR(500),
  id_proof VARCHAR(500),
  status ENUM('pending','approved','rejected') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);