import mongoose from "mongoose";

// One signed-in device/browser. The refresh token is stored only as a hash and
// is rotated on every use: the old session is marked replaced and a new one is
// created, so reuse of an old refresh token reveals theft.
const sessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    refreshTokenHash: {
      type: String,
      required: true,
      unique: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    // Set when the refresh token has been exchanged for a new one
    replacedBy: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    // Set on logout, password change/reset, or suspected token theft
    revokedAt: {
      type: Date,
      default: null,
    },
    userAgent: {
      type: String,
      maxlength: 300,
    },
  },
  { timestamps: true }
);

// MongoDB removes sessions automatically once they expire
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Session = mongoose.model("Session", sessionSchema);

export default Session;
