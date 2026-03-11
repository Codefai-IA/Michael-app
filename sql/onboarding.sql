-- Add goal_type and onboarding_completed columns to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS goal_type text DEFAULT NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false;

-- Mark all existing active clients as onboarded (so they don't see the goal screen)
UPDATE profiles SET onboarding_completed = true WHERE role = 'client' AND is_active = true;
