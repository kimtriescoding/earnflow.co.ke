/** Standalone mongod does not support multi-document transactions (replica set / mongos only). */
export function isStandaloneMongoTransactionError(err) {
  if (!err) return false;
  if (err.code === 20 && err.codeName === "IllegalOperation") return true;
  const msg = String(err.message || err.errmsg || "");
  return /Transaction numbers are only allowed|replica set member or mongos/i.test(msg);
}
