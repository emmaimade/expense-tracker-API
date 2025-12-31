import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
    },
    lastName: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
    },
    resetPasswordToken: {
      type: String,
      select: false
    },
    resetPasswordExpires: {
      type: Date,
      select: false
    },
    // Email change request fields
    emailChangeRequest: {
      newEmail: {
        type: String,
        lowercase: true
      },
      currentEmailToken: {
        type: String,
        select: false
      },
      newEmailToken: {
        type: String,
        select: false
      },
      currentEmailVerified: {
        type: Boolean,
        default: false
      },
      newEmailVerified: {
        type: Boolean,
        default: false
      },
      expiresAt: {
        type: Date
      }
    }
    ,
    // Preferred currency (ISO 4217 3-letter code). Frontend may set this based on user location
    currency: {
      type: String,
      uppercase: true,
      trim: true,
      default: 'USD',
      validate: {
        validator: function(v) {
          return /^[A-Z]{3}$/.test(v);
        },
        message: props => `${props.value} is not a valid currency code (expected 3 uppercase letters)`
      }
    }
    ,
    // Record of last currency change (for auditing & troubleshooting)
    lastCurrencyChange: {
      from: { type: String, uppercase: true, trim: true },
      to: { type: String, uppercase: true, trim: true },
      rate: { type: Number },
      changedAt: { type: Date }
    }
  },
  { timestamps: true }
);

// Indexes for better performance on token lookups
userSchema.index({ 'emailChangeRequest.currentEmailToken': 1 });
userSchema.index({ 'emailChangeRequest.newEmailToken': 1 });
userSchema.index({ 'emailChangeRequest.expiresAt': 1 });
userSchema.index({ resetPasswordToken: 1 });

// Method to check if email change is in progress
userSchema.methods.hasEmailChangeInProgress = function() {
  if (!this.emailChangeRequest) return false;
  
  // Check if request exists and hasn't expired
  return this.emailChangeRequest.expiresAt && 
         this.emailChangeRequest.expiresAt > new Date();
};

// Method to clean up expired email change requests
userSchema.methods.cleanupExpiredEmailChange = function() {
  if (this.emailChangeRequest && 
      this.emailChangeRequest.expiresAt && 
      this.emailChangeRequest.expiresAt < new Date()) {
    this.emailChangeRequest = undefined;
    return true; // Indicates cleanup happened
  }
  return false; // Nothing to clean up
};

const User = mongoose.model("User", userSchema);

export default User;
