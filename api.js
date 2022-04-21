const passwordHash = require('password-hash');
const database = require("lowdb")(new (require("lowdb/adapters/FileSync"))("./database.json"));

const nodemailer = require("nodemailer");
const momenttz = require("moment-timezone");

const header = `
<div style="text-align: center;">
<a href="${process.env.URL}" style="color: #ccc;">site web</a>
<h1>Les Yeux D'Eliyah</h1>
</div>
`;

const express = require("express");
const router = express.Router();

router.use("*", (req, res, next) => {
    console.log(req.headers.origin, req.headers.referer, process.env.URL, req.headers["sec-fetch-site"])
    if (!(req.headers.origin || req.headers.referer || "").startsWith(process.env.URL) || req.headers["sec-fetch-site"] != "same-origin") return res.sendStatus(403);
    next();
});

router.post("/login", (req, res) => {
    var { username, password } = req.body;
    if (!username || !password) return res.status(400).send("UsernameOrPasswordNull");
    if (username.length > 24 || password.length > 24) return res.status(400).send("WrongRequest");

    var user = database.get("users").find({ username }).value();
    if (!user) return res.status(403).send("UsernameOrPasswordInvalide");
    if (!passwordHash.verify(password, user.password)) return res.status(403).send("UsernameOrPasswordInvalide");

    database.get("sessions").remove({ userID: user.userID }).write();

    var token = generateID(25);
    var session = { userID: user.userID, date: new Date().getTime(), expireIn: 7200, token };
    database.get("sessions").push(session).write();
    return res.status(201).json({ token, user: { userID: user.userID, username, nickname: user.nickname } });
});

router.post("/disconnect", (req, res) => {
    var token = req.headers.authorization;
    if (!token) return res.status(401).send("TokenNull");

    token = token.replace("token ", "");

    var session = database.get("sessions").find({ token }).value();
    if (!session) return res.status(403).send("TokenInvalide");

    database.get("sessions").remove({ token }).write();

    return res.sendStatus(201);
});

router.get("/user", (req, res) => {
    var token = req.headers.authorization;
    if (!token) return res.status(401).send("TokenNull");

    token = token.replace("token ", "");

    var session = database.get("sessions").find({ token }).value();
    if (!session) return res.status(403).send("TokenInvalide");

    var user = database.get("users").find({ userID: session.userID }).value();
    if (!user) return res.status(403).send("TokenInvalide");

    return res.status(200).json({ user: { userID: user.userID, username: user.username, nickname: user.nickname } });
});

router.post("/appointment", async (req, res) => {
    var { firstname, lastname, tel, email, scheduledDate, formule, place, message } = req.body;

    if (!firstname || !lastname || !tel || !email || !place) return res.status(400).send("WrongRequest");

    var inputs = [firstname, lastname, tel, email, place];
    for (var i = 0; i < inputs.length; i++) {
        var a = inputs[i];
        if (a.length < 3 || a.length > 100) {
            return res.status(400).send("WrongRequest");
        }
    }

    if (message.length > 1000) {
        return res.status(400).send("WrongRequest");
    }

    var numRegex = /^(\+33)|(\+41)|0\d{9}$/;
    if (!numRegex.test(tel) || tel.replace(numRegex, "") != "") {
        return res.status(400).send("WrongRequest");
    }

    var mailRegex = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    if (!mailRegex.test(email)) {
        return res.status(400).send("WrongRequest");
    }

    if (!["basic", "premium", "full"].includes(formule)) {
        return res.status(400).send("WrongRequest");
    }

    var inWeek = new Date();
    inWeek.setDate(inWeek.getDate() + 7);

    if (scheduledDate < inWeek.getTime()) {
        return res.status(400).send("WrongRequest");
    }

    var ap = database.get("appointments").find({ email }).value() || database.get("appointments").find({ tel }).value();
    if (ap && (ap.status == 0 || ap.status == 1)) return res.status(400).send("AlreadyExist");

    //status: 0 - en cours de validation ; 1 - programmé ; 2 - annulé ; 3 - terminé
    var id = database.get("appointments").size().value();
    database.get("appointments").push({ firstname, lastname, tel, email, formule, scheduledDate, place, message, id, status: 0, date: new Date().getTime() }).write();

    var transporter = nodemailer.createTransport({
        host: process.env.MAIL_HOST,
        port: process.env.MAIL_PORT,
        secure: false, // true for 465, false for other ports
        auth: {
            user: process.env.MAIL_USER,
            pass: process.env.MAIL_PAS,
        }
    });

    await transporter.sendMail({
        from: '"Les Yeux D\'Eliyah" <contact@lesyeuxdeliyah.art>',
        to: email,
        subject: "[Confirmation] Séance photo",
        html: header + `
        <h2>Confirmation de séance photo</h2>
        <p style="color: #808080">Votre demande est en attente de validation, une fois qu'elle sera validée, vous recevrez un email. En cas d'impossibilité, vous serez avertit. En cas de problème de vôtre part, vous pouvez nous contacter via le mail ci-dessus (<a href="mailto:contact@lesyeuxdeliyah.art">contact@lesyeuxdeliyah.art</a>)</p>
        <p>ID: <strong>${String(id).padStart(3, "0")}</strong></p>
        <p>Prénom: <strong>${firstname}</strong></p>
        <p>Tel: <strong>${tel}</strong></p>
        <p>Formule: <strong>${formule}</strong></p>
        <p>Date prévue: <strong>${formatDate(new Date(scheduledDate))}</strong></p>
        <p>Lieu: <strong>${place}</strong></p>
        <p>Message: <strong>${message || "sans message"}</strong></p>
        `
    });

    transporter.close()

    return res.sendStatus(201);
});

function formatDate(date) {
    date = momenttz(date.getTime()).tz("Europe/Paris")._d;
    return `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")} ${date.getDate().toString().padStart(2, "0")}/${(date.getMonth() + 1).toString().padStart(2, "0")}/${date.getFullYear().toString().padStart(4, "0")}`;
}

router.get("/appointments", (req, res) => {
    var token = req.headers.authorization;
    if (!token) return res.status(401).send("TokenNull");

    token = token.replace("token ", "");

    var session = database.get("sessions").find({ token }).value();
    if (!session) return res.status(403).send("TokenInvalide");

    var user = database.get("users").find({ userID: session.userID }).value();
    if (!user) return res.status(403).send("TokenInvalide");

    if (user.grade != 1) return res.status(403).send("MissingPermission");

    return res.status(200).json(database.get("appointments").value());
});

router.post("/appointment/:id/valid", async (req, res) => {
    var token = req.headers.authorization;
    if (!token) return res.status(401).send("TokenNull");

    var message = req.body.message;
    if (message.length > 1000) return res.status(400).send("WrongRequest");

    var id = req.params.id;
    if (!id) return res.status(400).send("WrongRequest");
    id = Number(id);

    token = token.replace("token ", "");

    var session = database.get("sessions").find({ token }).value();
    if (!session) return res.status(403).send("TokenInvalide");

    var user = database.get("users").find({ userID: session.userID }).value();
    if (!user) return res.status(403).send("TokenInvalide");

    if (user.grade != 1) return res.status(403).send("MissingPermission");

    var app = database.get("appointments").find({ id, status: 0 });

    if (!app.value()) return res.status(400).send("NotFound");

    var email = app.value().email;
    app.assign({ status: 1 }).write();

    var transporter = nodemailer.createTransport({
        host: process.env.MAIL_HOST,
        port: process.env.MAIL_PORT,
        secure: false, // true for 465, false for other ports
        auth: {
            user: process.env.MAIL_USER,
            pass: process.env.MAIL_PAS,
        }
    });

    await transporter.sendMail({
        from: '"Les Yeux D\'Eliyah" <contact@lesyeuxdeliyah.art>',
        to: email,
        subject: "[Validation] Séance photo",
        html: header + `
        <h2>Séance photo validée !</h2>
        <p style="color: #808080">Votre demande a été accepté, en cas d'imprévu, un mail vous sera renvoyé. En cas de problème de vôtre part, vous pouvez nous contacter via le mail ci-dessus (<a href="mailto:contact@lesyeuxdeliyah.art">contact@lesyeuxdeliyah.art</a>)</p>
        <p>ID: <strong>${String(id).padStart(3, "0")}</strong></p>
        <br/>
        <u>Message:</u>
        <p>${message || "sans message"}</p>
        `
    });

    transporter.close();

    return res.sendStatus(201);
});

router.post("/appointment/:id/cancel", async (req, res) => {
    var token = req.headers.authorization;
    if (!token) return res.status(401).send("TokenNull");

    var message = req.body.message;
    if (message.length > 1000) return res.status(400).send("WrongRequest");

    var id = req.params.id;
    if (!id) return res.status(400).send("WrongRequest");
    id = Number(id);

    token = token.replace("token ", "");

    var session = database.get("sessions").find({ token }).value();
    if (!session) return res.status(403).send("TokenInvalide");

    var user = database.get("users").find({ userID: session.userID }).value();
    if (!user) return res.status(403).send("TokenInvalide");

    if (user.grade != 1) return res.status(403).send("MissingPermission");

    var app = database.get("appointments").find({ id });

    if (!app.value() || app.value().status >= 2) return res.status(400).send("NotFound");

    var email = app.value().email;
    app.assign({ status: 2 }).write();

    var transporter = nodemailer.createTransport({
        host: process.env.MAIL_HOST,
        port: process.env.MAIL_PORT,
        secure: false, // true for 465, false for other ports
        auth: {
            user: process.env.MAIL_USER,
            pass: process.env.MAIL_PAS,
        }
    });

    await transporter.sendMail({
        from: '"Les Yeux D\'Eliyah" <contact@lesyeuxdeliyah.art>',
        to: email,
        subject: "[Annulation] Séance photo",
        html: header + `
        <h2>Séance photo annulée !</h2>
        <p style="color: #808080">Votre demande a été annulée, plus d'information dans le message ci-dessous.</p>
        <p>ID: <strong>${String(id).padStart(3, "0")}</strong></p>
        <br/>
        <u>Message:</u>
        <p>${message || "sans message"}</p>
        `
    });

    transporter.close();

    return res.sendStatus(201);
});

function generateID(l) {
    var a = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890".split("");
    var b = "";
    for (var i = 0; i < l; i++) {
        var j = (Math.random() * (a.length - 1)).toFixed(0);
        b += a[j];
    }
    return b;
}

module.exports = router;