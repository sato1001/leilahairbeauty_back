/*
  Warnings:

  - Added the required column `ends_at` to the `appointments` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "ends_at" TIMESTAMPTZ(6) NOT NULL;

-- Extension for exclusion constraint
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Exclusion constraint to prevent overlapping active appointments (PENDING, CONFIRMED)
-- '[)' allows abutting appointments (e.g. 14:00-15:00 and 15:00-16:00)
ALTER TABLE "appointments"
ADD CONSTRAINT "no_overlapping_active_appointments"
EXCLUDE USING gist (
  tstzrange("scheduled_at", "ends_at", '[)') WITH &&
)
WHERE ("status" IN ('PENDING', 'CONFIRMED'));

