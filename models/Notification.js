import mongoose from "mongoose";

const RETENTION_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: ["budget_alert", "monthly_reset"],
      required: true,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },
    title: { type: String, required: true, maxlength: 120 },
    message: { type: String, required: true, maxlength: 500 },
    // Frontend route to open when the notification is clicked
    actionUrl: { type: String, maxlength: 200 },
    read: { type: Boolean, default: false },
    // Deleting only hides a notification, so the same alert isn't recreated
    // by the next expense; the 90-day expiry removes it for good
    dismissed: { type: Boolean, default: false },
    // Identifies "the same event" so it is only ever recorded once, e.g.
    // budget:<budgetId>:100 or month:2026-11
    dedupeKey: { type: String, required: true },
    // For budget alerts: the threshold reached (80, 100 or 120)
    threshold: { type: Number },
    budgetId: { type: mongoose.Schema.Types.ObjectId, ref: "Budget" },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + RETENTION_MS),
    },
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, dedupeKey: 1 }, { unique: true });
// MongoDB deletes notifications automatically after 90 days
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;
