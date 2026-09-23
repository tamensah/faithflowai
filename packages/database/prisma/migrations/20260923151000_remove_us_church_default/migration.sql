-- A worldwide onboarding flow cannot assume a new church is in the United States.
ALTER TABLE "Church" ALTER COLUMN "countryCode" DROP DEFAULT;
