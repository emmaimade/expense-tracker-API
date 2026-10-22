// One-off migration: drop the old global unique index on categories.name so
// different users can create categories with the same name.
//
//   npm run migrate:category-index            -> dry run (shows what would change)
//   npm run migrate:category-index -- --apply -> drops the index
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import connectDB from '../config/dbConfig.js';
import Category from '../models/Category.js';

dotenv.config();

const OLD_INDEX = 'name_1';
const apply = process.argv.includes('--apply');

const run = async () => {
  await connectDB();

  const indexes = await Category.collection.indexes();
  console.log('Current indexes:', indexes.map((i) => i.name).join(', '));

  if (!indexes.some((i) => i.name === OLD_INDEX)) {
    console.log(`Index "${OLD_INDEX}" not found - nothing to do.`);
  } else if (!apply) {
    console.log(`Dry run: would drop index "${OLD_INDEX}". Re-run with --apply to drop it.`);
  } else {
    await Category.collection.dropIndex(OLD_INDEX);
    console.log(`Dropped index "${OLD_INDEX}".`);
  }

  // Make sure the per-user unique index exists (creates only missing indexes, never drops)
  if (apply) {
    await Category.createIndexes();
    const after = await Category.collection.indexes();
    console.log('Indexes now:', after.map((i) => i.name).join(', '));
  }
};

run()
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
