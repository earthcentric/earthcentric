const { getAdminTransactions } = require('./src/actions/admin');

async function main() {
  const result = await getAdminTransactions();
  console.log("Result length:", result.length);
}

main().catch(console.error);
