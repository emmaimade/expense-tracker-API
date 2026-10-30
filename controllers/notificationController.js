import mongoose from "mongoose";
import Notification from "../models/Notification.js";
import User from "../models/User.js";
import { ensureMonthlyNotice } from "../utils/budgetAlerts.js";

const MAX_LIMIT = 100;

const toClient = (n) => ({
  id: n._id,
  type: n.type,
  priority: n.priority,
  title: n.title,
  message: n.message,
  actionUrl: n.actionUrl,
  read: n.read,
  createdAt: n.createdAt,
});

const visible = (userId) => ({ userId, dismissed: false });

// GET /notifications?limit=50
const getNotifications = async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), MAX_LIMIT);
    const user = await User.findById(req.user.id).select("createdAt");
    await ensureMonthlyNotice(user);

    const [notifications, unreadCount] = await Promise.all([
      Notification.find(visible(req.user.id)).sort({ createdAt: -1 }).limit(limit).lean(),
      Notification.countDocuments({ ...visible(req.user.id), read: false }),
    ]);

    res.status(200).json({ success: true, data: { notifications: notifications.map(toClient), unreadCount } });
  } catch (error) {
    console.error("Error getting notifications:", error);
    res.status(500).json({ success: false, message: "Failed to get notifications" });
  }
};

// Run an update on one of the user's notifications by id
const updateOne = (update, successMessage) => async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid notification ID" });
    }
    const result = await Notification.updateOne({ _id: req.params.id, ...visible(req.user.id) }, update);
    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }
    res.status(200).json({ success: true, message: successMessage });
  } catch (error) {
    console.error("Error updating notification:", error);
    res.status(500).json({ success: false, message: "Failed to update notification" });
  }
};

// PATCH /notifications/:id/read
const markAsRead = updateOne({ read: true }, "Notification marked as read");

// DELETE /notifications/:id
const deleteNotification = updateOne({ dismissed: true, read: true }, "Notification deleted");

// PATCH /notifications/read-all
const markAllAsRead = async (req, res) => {
  try {
    const result = await Notification.updateMany({ ...visible(req.user.id), read: false }, { read: true });
    res.status(200).json({ success: true, message: "All notifications marked as read", updated: result.modifiedCount });
  } catch (error) {
    console.error("Error marking notifications as read:", error);
    res.status(500).json({ success: false, message: "Failed to update notifications" });
  }
};

// DELETE /notifications
const clearNotifications = async (req, res) => {
  try {
    const result = await Notification.updateMany(visible(req.user.id), { dismissed: true, read: true });
    res.status(200).json({ success: true, message: "Notifications cleared", cleared: result.modifiedCount });
  } catch (error) {
    console.error("Error clearing notifications:", error);
    res.status(500).json({ success: false, message: "Failed to clear notifications" });
  }
};

export { getNotifications, markAsRead, markAllAsRead, deleteNotification, clearNotifications };
