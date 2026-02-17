import dotenv from "dotenv";
import path from "path";
import { startServer } from "./server";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const PORT = parseInt(process.env.PORT || "3000", 10);

startServer(PORT);
