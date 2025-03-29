import mongoose from "mongoose";

const connectDB = async () => {
  mongoose
    .connect(process.env.DB_URI)
    .then(() => {
      console.log("Connected to MongoDB");
    })
    .catch((err) => {
      console.log("Failed to connect to MongoDB", err);
    });
};

export default connectDB;