import { UserModel } from "../src/models/User";
import { DEFAULT_PERMISSIONS_BY_ROLE, StaffRole } from "@complaint-system/shared";
import { hashPassword } from "../src/utils/password";
import { signAccessToken } from "../src/utils/jwt";

export async function createTestUser(role: (typeof StaffRole)[keyof typeof StaffRole] = StaffRole.CUSTOMER_SERVICE) {
  const passwordHash = await hashPassword("Passw0rd!");
  const user = await UserModel.create({
    name: "Test Staff",
    email: `test-${Date.now()}-${Math.random().toString(36).slice(2)}@shopfa.internal`,
    passwordHash,
    role,
    active: true,
    // Mirrors userService.createUser's default -- this helper creates users
    // directly via the model (bypassing that service), so it has to apply
    // the same default permission set itself or every non-admin test user
    // would 403 on their own role's routes.
    permissions: DEFAULT_PERMISSIONS_BY_ROLE[role],
  });
  return user;
}

/** Creates a test staff user and returns it along with an `Authorization` header value for its JWT. */
export async function createAuthenticatedUser(role: (typeof StaffRole)[keyof typeof StaffRole] = StaffRole.CUSTOMER_SERVICE) {
  const user = await createTestUser(role);
  const token = signAccessToken({ sub: String(user._id), role: user.role });
  return { user, token, authHeader: `Bearer ${token}` };
}

export const validCasePayload = {
  customer: {
    externalCustomerId: "cust_1001",
    name: "Ali Ahmadi",
    phone: "+98 912 111 2233",
    email: "ali.ahmadi@example.com",
  },
  subject: "Necklace arrived damaged",
  description: "The clasp was broken when the package was opened.",
  category: "damaged_item",
  priority: "high",
  source: "phone",
};
