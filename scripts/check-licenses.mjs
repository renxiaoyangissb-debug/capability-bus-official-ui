import { dependencyInventory } from "./dependency-inventory.mjs";

const inventory = dependencyInventory();
const unknown = inventory.filter((item) => item.license === "UNKNOWN");
if (unknown.length > 0) throw new Error(`Dependencies without declared licenses: ${unknown.map((item) => item.name).join(", ")}`);
console.log(`licenses: ${inventory.length} installed packages declare licenses`);
