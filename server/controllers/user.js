import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

import UserModal from "../models/user.js";

const secret = 'test';

export const signin = async (req, res) => {
  const { email, password } = req.body;

  try {
    const oldUser = await UserModal.findOne({ email });

    if (!oldUser) return res.status(404).json({ message: "User doesn't exist" });

    const isPasswordCorrect = await bcrypt.compare(password, oldUser.password);

    if (!isPasswordCorrect) return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign({ email: oldUser.email, id: oldUser._id }, secret, { expiresIn: "1h" });

    res.status(200).json({ result: oldUser, token });
  } catch (err) {
    res.status(500).json({ message: "Something went wrong" });
  }
};

export const signup = async (req, res) => {
  const { email, password, firstName, lastName } = req.body;

  try {
    const oldUser = await UserModal.findOne({ email });

    if (oldUser) return res.status(400).json({ message: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 12);

    const result = await UserModal.create({ email, password: hashedPassword, name: `${firstName} ${lastName}` });

    const token = jwt.sign( { email: result.email, id: result._id }, secret, { expiresIn: "1h" } );

    res.status(201).json({ result, token });
  } catch (error) {
    res.status(500).json({ message: "Something went wrong" });
    
    console.log(error);
  }
};

export const getUsers = async (req, res) => {
  try {
    const users = await UserModal.find().select("name");

    res.status(200).json({ data: users });
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
};

export const getUser = async (req, res) => {
  const { id } = req.params;

  try {
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(404).json({ message: `No user with id: ${id}` });

    const user = await UserModal.findById(id).select("name");

    if (!user) return res.status(404).json({ message: "User doesn't exist" });

    res.status(200).json(user);
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
};

export const updateUser = async (req, res) => {
  const { id } = req.params;

  try {
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(404).json({ message: `No user with id: ${id}` });

    if (!req.userId) return res.status(401).json({ message: "Unauthenticated" });

    if (String(req.userId) !== String(id)) return res.status(403).json({ message: "You can only update your own profile" });

    const { name, email, password } = req.body;

    const updates = {};

    if (name) updates.name = name;

    if (email) {
      const existing = await UserModal.findById(id);

      if (!existing) return res.status(404).json({ message: "User doesn't exist" });

      if (email !== existing.email) {
        const dupe = await UserModal.findOne({ email });

        if (dupe) return res.status(400).json({ message: "User already exists" });
      }

      updates.email = email;
    }

    if (password) updates.password = await bcrypt.hash(password, 12);

    const updatedUser = await UserModal.findByIdAndUpdate(id, updates, { new: true }).select("-password");

    if (!updatedUser) return res.status(404).json({ message: "User doesn't exist" });

    res.status(200).json(updatedUser);
  } catch (error) {
    res.status(500).json({ message: "Something went wrong" });
  }
};

export const deleteUser = async (req, res) => {
  const { id } = req.params;

  try {
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(404).json({ message: `No user with id: ${id}` });

    if (!req.userId) return res.status(401).json({ message: "Unauthenticated" });

    if (String(req.userId) !== String(id)) return res.status(403).json({ message: "You can only delete your own profile" });

    const deleted = await UserModal.findByIdAndRemove(id);

    if (!deleted) return res.status(404).json({ message: "User doesn't exist" });

    res.status(200).json({ message: "User deleted successfully." });
  } catch (error) {
    res.status(500).json({ message: "Something went wrong" });
  }
};
