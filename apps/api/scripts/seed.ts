import mongoose from "mongoose";
import {
  CaseCategory,
  CasePriority,
  CaseSource,
  CaseStatus,
  StaffRole,
  type CaseCategory as CaseCategoryT,
  type CasePriority as CasePriorityT,
  type CaseSource as CaseSourceT,
  type CaseStatus as CaseStatusT,
} from "@complaint-system/shared";
import { env } from "../src/config/env";
import { logger } from "../src/config/logger";
import { UserModel } from "../src/models/User";
import { CaseModel } from "../src/models/Case";
import { CaseEventModel } from "../src/models/CaseEvent";
import { AttachmentModel } from "../src/models/Attachment";
import { CounterModel } from "../src/models/Counter";
import { MOCK_CUSTOMERS, MOCK_ORDERS } from "../src/integrations/shopfa/mockData";
import * as caseService from "../src/services/caseService";

interface CaseSeed {
  customerIdx: number;
  subject: string;
  description: string;
  category: CaseCategoryT;
  priority: CasePriorityT;
  source: CaseSourceT;
  tags?: string[];
  assignRole?: (typeof StaffRole)[keyof typeof StaffRole];
  linkOrder?: boolean;
  linkItem?: boolean;
  notes?: Array<{ body: string; visibility: "internal" | "customer" }>;
  transitions?: CaseStatusT[];
}

const CASE_SEEDS: CaseSeed[] = [
  {
    customerIdx: 0,
    subject: "Necklace arrived with a broken clasp",
    description: "Customer reports the gold necklace clasp was broken on arrival.",
    category: CaseCategory.DAMAGED_ITEM,
    priority: CasePriority.HIGH,
    source: CaseSource.PHONE,
    tags: ["damaged", "clasp"],
    assignRole: StaffRole.CUSTOMER_SERVICE,
    linkOrder: true,
    linkItem: true,
    notes: [{ body: "Customer says the necklace arrived damaged. Requesting photos.", visibility: "internal" }],
    transitions: [CaseStatus.IN_PROGRESS],
  },
  {
    customerIdx: 1,
    subject: "Wrong ring size shipped",
    description: "Customer ordered size 7 but received size 6.",
    category: CaseCategory.WRONG_ITEM,
    priority: CasePriority.NORMAL,
    source: CaseSource.EMAIL,
    tags: ["wrong-size"],
    assignRole: StaffRole.WAREHOUSE,
    linkOrder: true,
    linkItem: true,
    notes: [{ body: "Verified with warehouse, size mismatch confirmed.", visibility: "internal" }],
    transitions: [CaseStatus.IN_PROGRESS, CaseStatus.WAITING_FOR_CUSTOMER],
  },
  {
    customerIdx: 2,
    subject: "Order never arrived",
    description: "Tracking shows delivered but customer says it never arrived.",
    category: CaseCategory.DELIVERY,
    priority: CasePriority.URGENT,
    source: CaseSource.CHAT,
    tags: ["lost-in-transit"],
    assignRole: StaffRole.CUSTOMER_SERVICE,
    linkOrder: true,
    notes: [{ body: "Opened a trace request with the courier.", visibility: "internal" }],
    transitions: [CaseStatus.IN_PROGRESS],
  },
  {
    customerIdx: 3,
    subject: "Refund not received",
    description: "Return was accepted three weeks ago; refund has not posted.",
    category: CaseCategory.PAYMENT,
    priority: CasePriority.HIGH,
    source: CaseSource.EMAIL,
    tags: ["refund"],
    assignRole: StaffRole.MANAGER,
    notes: [
      { body: "Escalated to finance for manual refund review.", visibility: "internal" },
      { body: "We are looking into your refund and will update you shortly.", visibility: "customer" },
    ],
    transitions: [CaseStatus.IN_PROGRESS, CaseStatus.WAITING_FOR_INTERNAL_ACTION],
  },
  {
    customerIdx: 4,
    subject: "Earring stone fell out after one week",
    description: "Pearl fell out of the drop earring within a week of purchase.",
    category: CaseCategory.QUALITY,
    priority: CasePriority.NORMAL,
    source: CaseSource.SHOPFA,
    tags: ["quality"],
    linkOrder: true,
    linkItem: true,
  },
  {
    customerIdx: 5,
    subject: "Requesting exchange for a smaller bracelet",
    description: "Customer would like to exchange for a smaller size.",
    category: CaseCategory.EXCHANGE,
    priority: CasePriority.LOW,
    source: CaseSource.CHAT,
    assignRole: StaffRole.CUSTOMER_SERVICE,
    notes: [{ body: "Exchange approved, awaiting item return.", visibility: "internal" }],
    transitions: [CaseStatus.IN_PROGRESS, CaseStatus.WAITING_FOR_CUSTOMER],
  },
  {
    customerIdx: 6,
    subject: "Missing item from multi-item order",
    description: "Order had two items, only one arrived in the package.",
    category: CaseCategory.MISSING_ITEM,
    priority: CasePriority.HIGH,
    source: CaseSource.PHONE,
    tags: ["missing-item"],
    assignRole: StaffRole.WAREHOUSE,
    linkOrder: true,
    notes: [{ body: "Confirmed with packing team, second item was not packed. Reshipping.", visibility: "internal" }],
    transitions: [CaseStatus.IN_PROGRESS, CaseStatus.RESOLVED],
  },
  {
    customerIdx: 7,
    subject: "Return request - changed mind",
    description: "Customer no longer wants the item, requests standard return.",
    category: CaseCategory.RETURN,
    priority: CasePriority.LOW,
    source: CaseSource.EMAIL,
    transitions: [CaseStatus.IN_PROGRESS, CaseStatus.RESOLVED, CaseStatus.CLOSED],
  },
  {
    customerIdx: 8,
    subject: "Payment charged twice",
    description: "Customer was charged twice for the same order.",
    category: CaseCategory.PAYMENT,
    priority: CasePriority.URGENT,
    source: CaseSource.PHONE,
    tags: ["duplicate-charge"],
    assignRole: StaffRole.MANAGER,
    linkOrder: true,
    notes: [{ body: "Duplicate charge confirmed in payment gateway logs. Refunding one charge.", visibility: "internal" }],
    transitions: [CaseStatus.IN_PROGRESS, CaseStatus.RESOLVED, CaseStatus.CLOSED],
  },
  {
    customerIdx: 9,
    subject: "General question about order status",
    description: "Customer asking when the order will ship.",
    category: CaseCategory.ORDER,
    priority: CasePriority.LOW,
    source: CaseSource.CHAT,
    linkOrder: true,
    transitions: [CaseStatus.IN_PROGRESS, CaseStatus.RESOLVED, CaseStatus.CLOSED],
  },
  {
    customerIdx: 10,
    subject: "Ring tarnished after two days",
    description: "Silver ring tarnished unusually fast, possible plating issue.",
    category: CaseCategory.QUALITY,
    priority: CasePriority.NORMAL,
    source: CaseSource.SHOPFA,
    tags: ["quality", "plating"],
    assignRole: StaffRole.PURCHASING,
    linkItem: true,
    notes: [{ body: "Flagged batch for purchasing to review supplier plating quality.", visibility: "internal" }],
    transitions: [CaseStatus.IN_PROGRESS],
  },
  {
    customerIdx: 11,
    subject: "Delivery delayed beyond estimate",
    description: "Order estimate was 3 days, now on day 9 with no movement.",
    category: CaseCategory.DELIVERY,
    priority: CasePriority.HIGH,
    source: CaseSource.EMAIL,
    tags: ["delayed"],
    assignRole: StaffRole.CUSTOMER_SERVICE,
    linkOrder: true,
    notes: [{ body: "Contacted courier for an updated ETA.", visibility: "internal" }],
    transitions: [CaseStatus.IN_PROGRESS, CaseStatus.WAITING_FOR_CUSTOMER, CaseStatus.IN_PROGRESS],
  },
  {
    customerIdx: 0,
    subject: "Customer wants gift wrapping for reorder",
    description: "Reorder request with a note about gift wrapping preference.",
    category: CaseCategory.OTHER,
    priority: CasePriority.LOW,
    source: CaseSource.IN_PERSON,
  },
  {
    customerIdx: 2,
    subject: "Damaged packaging, item intact",
    description: "Outer box arrived crushed; item itself is undamaged.",
    category: CaseCategory.DAMAGED_ITEM,
    priority: CasePriority.LOW,
    source: CaseSource.CHAT,
    linkOrder: true,
    transitions: [CaseStatus.IN_PROGRESS, CaseStatus.RESOLVED, CaseStatus.CLOSED],
  },
  {
    customerIdx: 4,
    subject: "Wants to reopen resolved complaint",
    description: "Customer says the replacement item has the same defect.",
    category: CaseCategory.QUALITY,
    priority: CasePriority.HIGH,
    source: CaseSource.PHONE,
    tags: ["quality", "repeat-issue"],
    assignRole: StaffRole.MANAGER,
    notes: [{ body: "Replacement showed the same defect. Escalating to purchasing.", visibility: "internal" }],
    transitions: [CaseStatus.IN_PROGRESS, CaseStatus.RESOLVED, CaseStatus.OPEN, CaseStatus.IN_PROGRESS],
  },
  {
    customerIdx: 9,
    subject: "Exchange for different metal color",
    description: "Customer prefers rose gold over yellow gold.",
    category: CaseCategory.EXCHANGE,
    priority: CasePriority.NORMAL,
    source: CaseSource.SHOPFA,
    linkOrder: true,
    linkItem: true,
    assignRole: StaffRole.CUSTOMER_SERVICE,
  },
];

async function main() {
  await mongoose.connect(env.MONGODB_URI);
  logger.info("Connected for seeding");

  await Promise.all([
    CaseModel.deleteMany({}),
    CaseEventModel.deleteMany({}),
    AttachmentModel.deleteMany({}),
    UserModel.deleteMany({}),
    CounterModel.deleteMany({}),
  ]);
  logger.info("Cleared existing collections");

  const users = await UserModel.insertMany([
    { name: "Admin User", email: "admin@shopfa.internal", role: StaffRole.ADMIN, active: true },
    { name: "Sara Vakili", email: "sara.vakili@shopfa.internal", role: StaffRole.CUSTOMER_SERVICE, active: true },
    { name: "Behnam Rad", email: "behnam.rad@shopfa.internal", role: StaffRole.WAREHOUSE, active: true },
    { name: "Leila Farahani", email: "leila.farahani@shopfa.internal", role: StaffRole.MANAGER, active: true },
    { name: "Kian Sharifi", email: "kian.sharifi@shopfa.internal", role: StaffRole.PURCHASING, active: true },
  ]);
  logger.info(`Seeded ${users.length} staff users`);

  const actor = { id: String(users[1]!._id), name: users[1]!.name };

  let createdCount = 0;
  for (const seed of CASE_SEEDS) {
    const customer = MOCK_CUSTOMERS[seed.customerIdx]!;
    const order = MOCK_ORDERS.find((o) => o.customer_id === customer.id);

    const { case: created } = await caseService.createCase(
      {
        customer: {
          externalCustomerId: customer.id,
          name: customer.full_name,
          phone: customer.phone_number,
          email: customer.email ?? "",
        },
        subject: seed.subject,
        description: seed.description,
        category: seed.category,
        priority: seed.priority,
        source: seed.source,
        tags: seed.tags,
      },
      actor,
    );
    const caseId = String(created._id);

    if (seed.assignRole) {
      const assignee = users.find((u) => u.role === seed.assignRole)!;
      await caseService.assignCase(caseId, String(assignee._id), actor);
    }
    if (seed.linkOrder && order) {
      await caseService.linkOrder(caseId, { externalOrderId: order.id, orderNumber: order.order_number }, actor);
    }
    if (seed.linkItem && order?.items[0]) {
      const item = order.items[0];
      await caseService.linkItem(
        caseId,
        { externalItemId: item.item_id, sku: item.sku, title: item.title },
        actor,
      );
    }
    for (const note of seed.notes ?? []) {
      await caseService.addNote(caseId, note.body, note.visibility, actor);
    }
    for (const status of seed.transitions ?? []) {
      await caseService.changeStatus(caseId, status, undefined, actor);
    }

    createdCount += 1;
  }

  logger.info(`Seeded ${createdCount} cases with realistic timelines`);
  logger.info(`Seeded ${MOCK_CUSTOMERS.length} mock Shopfa customers and ${MOCK_ORDERS.length} mock orders (served via SHOPFA_MOCK)`);

  await mongoose.disconnect();
  logger.info("Seeding complete");
}

main().catch((err) => {
  logger.error("Seeding failed", { err });
  process.exit(1);
});
