import "dotenv/config";
import { readFileSync } from "node:fs";
import prisma from "../src/lib/prisma";
import { hashPassword } from "../src/lib/security";

// Password arrives over stdin so it is absent from shell history and process arguments.
async function main() {
  const [email, name, role = "ADMIN"] = process.argv.slice(2);
  const password = readFileSync(0, "utf8").trimEnd();
  if (
    !email ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    !name ||
    !["ADMIN", "EDITOR"].includes(role) ||
    password.length < 14 ||
    Buffer.byteLength(password) > 72
  )
    throw new Error(
      "Usage: npm run user:create -- email name [ADMIN|EDITOR]; supply a 14–72 byte password on stdin",
    );
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: email.toLowerCase(),
        name,
        role: role as "ADMIN" | "EDITOR",
        passwordHash: await hashPassword(password),
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: "USER_PROVISIONED",
        entityType: "User",
        entityId: user.id,
      },
    });
  });
  console.log("Account created. Sign in to enroll MFA.");
}
main()
  .catch(() => {
    console.error(
      "Account creation failed. Check inputs, uniqueness, and database access.",
    );
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
