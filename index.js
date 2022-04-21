const PORT = 3333;

require("dotenv").config();

const database = require("lowdb")(new (require("lowdb/adapters/FileSync"))("./database.json"));

const path = require("path");

const express = require("express");
const server = express();

const rateLimit = require('express-rate-limit')
const limiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
});

const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
server.use(express.static("./resources"));
server.use(bodyParser.json());
server.use(cookieParser());
server.use("/api", limiter, require("./api"));
server.listen(PORT, () => {
    console.log("Server started in " + PORT);
});

server.get("*", (req, res, next) => {
    var token = req.cookies.token;
    if (!token) return next();
    var session = database.get("sessions").find({ token }).value();
    var user = getUser(session.userID);
    if (!session || checkExpired(session.date + session.expireIn * 1000) || !user) {
        res.clearCookie("token");
        return next();
    }
    res.user = user;
    return next();
});

server.get("/", (req, res) => {
    return res.sendFile(path.join(__dirname, "resources", "pages", "index.html"));
});

server.get("/login", (req, res) => {
    return res.sendFile(path.join(__dirname, "resources", "pages", "login.html"));
});

server.get("/conditions", (req, res) => {
    return res.sendFile(path.join(__dirname, "resources", "pages", "conditions.html"));
});

server.get("/myaccount", (req, res) => {
    return res.sendFile(path.join(__dirname, "resources", "pages", "myaccount.html"));
});

function checkExpired(expiredTime) {
    return expiredTime < new Date().getTime();
}

function getUser(userID) {
    if (!userID) return false;
    return database.get("users").find({ userID }).value();
}