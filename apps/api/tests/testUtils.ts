import { UserModel } from "../src/models/User";
import { StaffRole } from "@complaint-system/shared";

export async function createTestUser(role: (typeof StaffRole)[keyof typeof StaffRole] = StaffRole.CUSTOMER_SERVICE) {
  const user = await UserModel.create({
    name: "Test Staff",
    email: `test-${Date.now()}-${Math.random().toString(36).slice(2)}@shopfa.internal`,
    role,
    active: true,
  });
  return user;
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
