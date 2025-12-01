-- Add active_chat_target column to subscribers table
-- This column will store the user_id of the person the admin is currently replying to.

ALTER TABLE subscribers 
ADD COLUMN active_chat_target text;

-- Optional: Add a comment to the column
COMMENT ON COLUMN subscribers.active_chat_target IS 'The user_id of the target user the admin is currently locked on to reply.';
