import dotenv from "dotenv";
dotenv.config();
import app from "./app.mjs";
import connectDB from "./config/db.mjs";

const PORT = process.env.PORT || 5000;

(async () => {
  try {
    await connectDB(process.env.MONGO_URI);
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  } catch (err) {
    console.error("Failed to start server", err);
    process.exit(1);
  }
})();
