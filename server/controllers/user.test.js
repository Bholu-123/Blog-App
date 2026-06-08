import { describe, it, expect, beforeAll, afterEach, afterAll } from "@jest/globals";
import express from "express";
import request from "supertest";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { MongoMemoryServer } from "mongodb-memory-server";

import userRouter from "../routes/user.js";
import UserModal from "../models/user.js";

const secret = "test";

const app = express();
app.use(express.json());
app.use("/user", userRouter);

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();

  await mongoose.connect(mongod.getUri(), {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
});

afterEach(async () => {
  await mongoose.connection.dropDatabase();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

// Helpers
const tokenFor = (id, email) => jwt.sign({ id, email }, secret);

const seedUser = async ({ name = "Test User", email = "test@example.com", password = "secret123" } = {}) => {
  const hashedPassword = await bcrypt.hash(password, 12);

  return UserModal.create({ name, email, password: hashedPassword });
};

describe("Read users", () => {
  it("GET /user returns 200 with a data array exposing only _id and name", async () => {
    await seedUser({ name: "Alice", email: "alice@example.com" });
    await seedUser({ name: "Bob", email: "bob@example.com" });

    const res = await request(app).get("/user");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(2);

    res.body.data.forEach((u) => {
      expect(u).toHaveProperty("_id");
      expect(u).toHaveProperty("name");
      expect(u).not.toHaveProperty("email");
      expect(u).not.toHaveProperty("password");
    });
  });

  it("GET /user/:id returns 200 with only _id and name for a valid existing id", async () => {
    const user = await seedUser({ name: "Carol", email: "carol@example.com" });

    const res = await request(app).get(`/user/${user._id}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("_id");
    expect(res.body.name).toBe("Carol");
    expect(res.body).not.toHaveProperty("email");
    expect(res.body).not.toHaveProperty("password");
  });

  it("GET /user/:id returns 404 for an invalid id", async () => {
    const res = await request(app).get("/user/not-a-valid-id");

    expect(res.status).toBe(404);
  });

  it("GET /user/:id returns 404 for a non-existent valid id", async () => {
    const id = new mongoose.Types.ObjectId().toString();

    const res = await request(app).get(`/user/${id}`);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("User doesn't exist");
  });
});

describe("Update user", () => {
  it("PATCH /user/:id without a token returns 401", async () => {
    const user = await seedUser();

    const res = await request(app).patch(`/user/${user._id}`).send({ name: "New Name" });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Unauthenticated");
  });

  it("PATCH /user/:id with a token for a different id returns 403", async () => {
    const user = await seedUser();
    const otherId = new mongoose.Types.ObjectId().toString();

    const res = await request(app)
      .patch(`/user/${user._id}`)
      .set("Authorization", `Bearer ${tokenFor(otherId, "other@example.com")}`)
      .send({ name: "New Name" });

    expect(res.status).toBe(403);
    expect(res.body.message).toBe("You can only update your own profile");
  });

  it("PATCH /user/:id updating name returns 200 without password in response", async () => {
    const user = await seedUser({ name: "Dave", email: "dave@example.com" });

    const res = await request(app)
      .patch(`/user/${user._id}`)
      .set("Authorization", `Bearer ${tokenFor(user._id, user.email)}`)
      .send({ name: "Dave Updated" });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Dave Updated");
    expect(res.body).not.toHaveProperty("password");
  });

  it("PATCH /user/:id updating email to a free email returns 200", async () => {
    const user = await seedUser({ email: "free@example.com" });

    const res = await request(app)
      .patch(`/user/${user._id}`)
      .set("Authorization", `Bearer ${tokenFor(user._id, user.email)}`)
      .send({ email: "newfree@example.com" });

    expect(res.status).toBe(200);
    expect(res.body.email).toBe("newfree@example.com");
    expect(res.body).not.toHaveProperty("password");
  });

  it("PATCH /user/:id updating email to an existing user's email returns 400", async () => {
    await seedUser({ name: "Taken", email: "taken@example.com" });
    const user = await seedUser({ name: "Mine", email: "mine@example.com" });

    const res = await request(app)
      .patch(`/user/${user._id}`)
      .set("Authorization", `Bearer ${tokenFor(user._id, user.email)}`)
      .send({ email: "taken@example.com" });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("User already exists");
  });

  it("PATCH /user/:id updating password re-hashes so the new password works via signin", async () => {
    const user = await seedUser({ email: "pw@example.com", password: "oldpassword" });

    const patchRes = await request(app)
      .patch(`/user/${user._id}`)
      .set("Authorization", `Bearer ${tokenFor(user._id, user.email)}`)
      .send({ password: "brandnewpass" });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body).not.toHaveProperty("password");

    const signinRes = await request(app)
      .post("/user/signin")
      .send({ email: "pw@example.com", password: "brandnewpass" });

    expect(signinRes.status).toBe(200);
    expect(signinRes.body).toHaveProperty("token");
  });
});

describe("Delete user", () => {
  it("DELETE /user/:id without a token returns 401", async () => {
    const user = await seedUser();

    const res = await request(app).delete(`/user/${user._id}`);

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Unauthenticated");
  });

  it("DELETE /user/:id with a mismatched token returns 403", async () => {
    const user = await seedUser();
    const otherId = new mongoose.Types.ObjectId().toString();

    const res = await request(app)
      .delete(`/user/${user._id}`)
      .set("Authorization", `Bearer ${tokenFor(otherId, "other@example.com")}`);

    expect(res.status).toBe(403);
    expect(res.body.message).toBe("You can only delete your own profile");
  });

  it("DELETE /user/:id with a matching token returns 200 and removes the user", async () => {
    const user = await seedUser();

    const res = await request(app)
      .delete(`/user/${user._id}`)
      .set("Authorization", `Bearer ${tokenFor(user._id, user.email)}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("User deleted successfully.");

    const getRes = await request(app).get(`/user/${user._id}`);
    expect(getRes.status).toBe(404);
  });
});

describe("Signup/Signin regression", () => {
  it("POST /user/signup creates a user and returns 201 with a token", async () => {
    const res = await request(app).post("/user/signup").send({
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com",
      password: "password123",
    });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("token");
  });

  it("POST /user/signin authenticates a signed-up user and returns 200 with a token", async () => {
    await request(app).post("/user/signup").send({
      firstName: "Jane",
      lastName: "Doe",
      email: "jane@example.com",
      password: "password123",
    });

    const res = await request(app).post("/user/signin").send({
      email: "jane@example.com",
      password: "password123",
    });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("token");
  });
});
