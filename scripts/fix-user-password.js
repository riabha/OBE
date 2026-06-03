/**
 * Set a university user password correctly (single bcrypt hash).
 * Use after fixing double-hash bug for users who cannot log in.
 *
 *   node scripts/fix-user-password.js --email=riaz.bhanbhro@quest.edu.pk --password=NewPass123 --db=obe_quest
 */
require('dotenv').config({ path: './config.env' });
require('dotenv').config({ path: './.env', override: false });

const args = process.argv.slice(2);
const email = args.find(a => a.startsWith('--email='))?.split('=')[1]?.toLowerCase();
const password = args.find(a => a.startsWith('--password='))?.split('=')[1];
const dbName = args.find(a => a.startsWith('--db='))?.split('=')[1] || 'obe_quest';

async function main() {
  if (!email || !password) {
    console.error('Usage: node scripts/fix-user-password.js --email=user@quest.edu.pk --password=Secret123 --db=obe_quest');
    process.exit(1);
  }
  const mongoose = require('mongoose');
  const UserSchema = require('../models/User');
  await mongoose.connect(process.env.MONGODB_URI);
  const uniDb = mongoose.connection.useDb(dbName);
  const User = uniDb.models.User || uniDb.model('User', UserSchema);
  const user = await User.findOne({ email });
  if (!user) {
    console.error(`❌ User not found: ${email} in ${dbName}`);
    process.exit(1);
  }
  user.password = password;
  await user.save();
  console.log(`✅ Password set for ${email} in ${dbName}. They can log in now.`);
  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
