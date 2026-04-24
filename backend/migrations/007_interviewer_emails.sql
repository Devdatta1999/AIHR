-- Lets HR loop in one or more employees as interviewers on an invite.
-- Stored as a plain TEXT[] of lowercased emails; the employee portal
-- queries this column to show upcoming interviews to the signed-in user.

ALTER TABLE applicants.interview_invitations
    ADD COLUMN IF NOT EXISTS interviewer_emails TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_invites_interviewer_emails
    ON applicants.interview_invitations USING GIN (interviewer_emails);
