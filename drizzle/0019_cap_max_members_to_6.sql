-- Cap all existing circles to max 6 members
UPDATE circles SET max_members = 6 WHERE max_members > 6;

-- Update the default from 5 to 6
ALTER TABLE circles ALTER COLUMN max_members SET DEFAULT 6;
