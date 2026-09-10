import mongoose from "mongoose";
import { StaffRole } from "@complaint-system/shared";
import { env } from "../src/config/env";
import { logger } from "../src/config/logger";
import { hashPassword } from "../src/utils/password";
import { UserModel } from "../src/models/User";

/**
 * One-off bootstrap for a fresh deployment: creates a single admin user
 * without touching any other data (unlike scripts/seed.ts, which wipes and
 * repopulates the whole database with demo content -- not safe to run
 * against a real instance). Admins bypass the stored `permissions` array
 * entirely (see middleware/authenticate.ts#requirePermission), so none is
 * set here.
 *
 * Usage: node dist/scripts/createAdmin.js "Full Name" admin@example.com 'StrongPassword!'
 */
async function main() {
  const [name, email, password] = process.argv.slice(2);
  if (!name || !email || !password) {
    logger.error('Usage: node dist/scripts/createAdmin.js "Full Name" email@example.com \'password\'');
    process.exit(1);
  }

  await mongoose.connect(env.MONGODB_URI);

  const existing = await UserModel.findOne({ email: email.toLowerCase() });
  if (existing) {
    logger.error(`A user with email ${email} already exists -- not creating a duplicate.`);
    await mongoose.disconnect();
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);
  await UserModel.create({ name, email, passwordHash, role: StaffRole.ADMIN, active: true });
  logger.info(`Created admin user ${email}`);

  await mongoose.disconnect();
}

main().catch((err) => {
  logger.error("Failed to create admin user", { err });
  process.exit(1);
});
