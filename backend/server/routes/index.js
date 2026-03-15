import { Router } from "express";
import systemRoutes from "./systemRoutes.js";
import chatRoutes from "./chatRoutes.js";

const router = Router();

router.use("/api", systemRoutes);
router.use("/api", chatRoutes);

export default router;
