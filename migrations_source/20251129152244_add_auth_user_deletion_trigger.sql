/*
  # Add Auth User Deletion Trigger

  1. Changes
    - Create trigger function to delete auth user when profile is deleted
    - Automatically sync profile deletions with auth.users
  
  2. Security
    - Only triggered when profile is deleted
    - Ensures complete user removal from system
*/

-- Create function to delete auth user when profile is deleted
CREATE OR REPLACE FUNCTION delete_auth_user_on_profile_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete the auth user
  DELETE FROM auth.users WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically delete auth user when profile is deleted
DROP TRIGGER IF EXISTS trigger_delete_auth_user ON profiles;

CREATE TRIGGER trigger_delete_auth_user
  BEFORE DELETE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION delete_auth_user_on_profile_delete();