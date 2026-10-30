import dns from "node:dns";
import { PrismaClient } from "@prisma/client";

// Ensure Node 24 prioritizes IPv4 for AWS Neon endpoints
try {
  dns.setDefaultResultOrder("ipv4first");
} catch {}

const prismaClientSingleton = () => {
  return new PrismaClient();
};


declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>;
}

const db = globalThis.prismaGlobal ?? prismaClientSingleton();

export default db;

if (process.env.NODE_ENV !== "production") globalThis.prismaGlobal = db;
