-- Run this once on an EXISTING kamalarani_db where admission_applications
-- was created from an older schema (missing ARN / address / document fields).
-- Safe to re-run: each statement is skipped if the column already exists
-- when you execute via the Node helper: node migrations/apply_admissions_alter.js

USE kamalarani_db;

ALTER TABLE admission_applications ADD COLUMN arn VARCHAR(50) UNIQUE AFTER id;
ALTER TABLE admission_applications ADD COLUMN school_name VARCHAR(255) NULL AFTER gender;
ALTER TABLE admission_applications ADD COLUMN occupation VARCHAR(255) NULL AFTER mother_name;
ALTER TABLE admission_applications ADD COLUMN mother_mobile VARCHAR(20) NULL AFTER parent_mobile;
ALTER TABLE admission_applications ADD COLUMN aadhaar_no VARCHAR(20) NULL AFTER email;
ALTER TABLE admission_applications ADD COLUMN village_locality VARCHAR(255) NULL AFTER aadhaar_no;
ALTER TABLE admission_applications ADD COLUMN po VARCHAR(255) NULL AFTER village_locality;
ALTER TABLE admission_applications ADD COLUMN ps VARCHAR(255) NULL AFTER po;
ALTER TABLE admission_applications ADD COLUMN district VARCHAR(255) NULL AFTER ps;
ALTER TABLE admission_applications ADD COLUMN state VARCHAR(100) NULL DEFAULT 'West Bengal' AFTER district;
ALTER TABLE admission_applications ADD COLUMN pin_code VARCHAR(10) NULL AFTER state;
ALTER TABLE admission_applications ADD COLUMN branch VARCHAR(50) NULL AFTER programme;
