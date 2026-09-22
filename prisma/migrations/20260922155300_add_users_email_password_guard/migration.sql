DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.users'::regclass
      AND conname = 'users_email_password_guard'
  ) THEN
    ALTER TABLE public."users"
    ADD CONSTRAINT "users_email_password_guard"
    CHECK (
      (email IS NULL AND password_hash IS NULL)
      OR
      (email IS NOT NULL AND password_hash IS NOT NULL)
    );
  END IF;
END $$;