ALTER TABLE "users"
ADD COLUMN "phone_number" TEXT;

ALTER TABLE "users"
ALTER COLUMN "email" DROP NOT NULL;

CREATE UNIQUE INDEX "users_phone_number_key" ON "users"("phone_number");
