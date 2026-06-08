import express from "express";
const router = express.Router();

import { signin, signup, getUsers, getUser, updateUser, deleteUser } from "../controllers/user.js";
import auth from "../middleware/auth.js";

router.post("/signin", signin);
router.post("/signup", signup);

router.get("/", getUsers);
router.get("/:id", getUser);
router.patch("/:id", auth, updateUser);
router.delete("/:id", auth, deleteUser);

export default router;
