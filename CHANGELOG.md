# Changelog

All notable changes to the expense-tracker-API project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to Semantic Versioning.

## [Unreleased]

## [1.0.0] - 2025-09-14
### Added
- Initial database migration to convert string-based categories in the `Expense` model to references to a new `Category` model.
  - Created 9 default categories: `Food`, `Transportation`, `Leisure`, `Electronics`, `Utilities`, `Clothing`, `Health`, `Education`, `Others` with `userId: null` and `isDefault: true`.
  - Updated 8 existing expenses for 2 users (`emmaimade@hotmail.com` with 2 expenses, `jamestravis@gmail.com` with 6 expenses) to use `Category` ObjectId references.
  - Mapped unmapped category strings to the default "Others" category (ID: `68c5fdf43575f382bfc535f0`).
- Backup of the database created at `/c/Users/HP/Documents/backup-20250914` before migration.

### Notes
- Migration executed successfully at 12:29 AM WAT on 2025-09-14.
- No errors reported; processed 5 users with no expenses for 3 users.
- Script `migrate-categories.js` archived locally and added to `.gitignore`.

[Unreleased]: https://github.com/emmaimade/expense-tracker-API/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/emmaimade/expense-tracker-API/releases/tag/v1.0.0