const messages = {
    UsernameOrPasswordInvalide: "Nom d'utilisateur ou mot de passe invalide.",
    AlreadyExist: "Demande avec cette adresse email ou ce numéro de téléphone déjà existante.",
    "Too Many Requests": "Trop de requêtes, veuillez réessayer dans quelques minutes."
};

function getMessage(error) {
    return messages[error?.data] || messages[error?.statusText] || "Erreur inattendue";
}

window.addEventListener("load", async () => {
    history.pushState("", document.title, window.location.pathname + window.location.search);

    var popup = localStorage.getItem("popup");
    if (popup) {
        localStorage.removeItem("popup");
        popup = JSON.parse(popup);
        if (popup.type == "success") showSuccess(popup.content);
        else if (popup.type == "error") showErrorMessage(popup.content);
    }

    var lastUpdate = sessionStorage.getItem("lastUpdate") || 0;
    if (new Date().getTime() - lastUpdate >= 5 * 60 * 1000) {
        await getUser();
        await getAppointments();
        sessionStorage.setItem("lastUpdate", new Date().getTime());
    }
    update();

    var date = document.getElementById("date");
    if (date) {
        var currentDate = new Date();
        currentDate.setDate(currentDate.getDate() + 7);
        date.min = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}-${String(currentDate.getDate()).padStart(2, "0")}`;
    }

    var slider = document.querySelector("section#pictures .slider");
    if (slider) {
        var width = 860;
        var slides = slider.querySelectorAll(".slide");
        slides.forEach(slide => {
            width += slide.getBoundingClientRect().width;
        });

        slider.querySelector("div.slide-track").animate([{ transform: "translateX(0)" }, { transform: "translateX(-" + (width / 2) + "px)" }], { duration: 30 * 1000, iterations: Infinity });
        slider.querySelector("div.slide-track").style.width = width + "px";
    }
});

function disconnect() {
    if (!sessionStorage.getItem("token")) return;
    axios.post("/api/disconnect", {}, { headers: { Authorization: "token " + sessionStorage.getItem("token") } }).then(response => {
        localStorage.setItem("popup", JSON.stringify({ type: "success", content: "Déconnexion réussie !" }))
        window.location.href = "/";
    }, () => { });
    sessionStorage.clear();
}

function login(username, password) {
    if (!username || !password) {
        return showErrorMessage("Vous devez remplir les champs adresse email et mot de passe.");
    }

    sessionStorage.clear();
    axios.post("/api/login", { username, password }).then(response => {
        sessionStorage.setItem("token", response.data.token);
        sessionStorage.setItem("user", JSON.stringify(response.data.user));
        showSuccess("Vous êtes connecté sur le compte de " + response.data.user.nickname + " !");
        localStorage.setItem("popup", JSON.stringify({ type: "success", content: "Vous êtes connecté sur le compte de " + response.data.user.nickname + " !" }))
        window.location.href = "/myaccount#myaccount";
    }, (error) => {
        document.getElementById("password").value = "";
        showErrorMessage(getMessage(error?.response));
    });
}

async function getUser() {
    if (!sessionStorage.getItem("token")) return;
    await axios.get("/api/user", { headers: { Authorization: "token " + sessionStorage.getItem("token") } }).then(response => {
        sessionStorage.setItem("user", JSON.stringify(response.data.user));
    }, () => {
        sessionStorage.clear();
    });
    return;
}

async function getAppointments() {
    if (!sessionStorage.getItem("token")) return;
    await axios.get("/api/appointments", { headers: { Authorization: "token " + sessionStorage.getItem("token") } }).then(response => {
        sessionStorage.setItem("appointments", JSON.stringify(response.data));
    }, () => { });
    return;
}

function appointment() {
    var firstname = document.getElementById("firstname").value.trim();
    var lastname = document.getElementById("lastname").value.trim();
    var tel = document.getElementById("tel").value.trim();
    var email = document.getElementById("email").value.trim();
    var formule = document.getElementById("formule").value;
    var date = document.getElementById("date").value;
    var time = document.getElementById("time").value;
    var place = document.getElementById("place").value.trim();
    var message = document.getElementById("message").value.trim();

    var inputs = [firstname, lastname, tel, email, place];
    for (var i = 0; i < inputs.length; i++) {
        var a = inputs[i];
        if (a.length < 3 || a.length > 100) {
            showErrorMessage("Veuillez remplir tous les champs obligatoires, leur taille doit être comprise entre 3 et 100 caractères.");
            return false;
        }
    }

    if (message.length > 1000) {
        showErrorMessage("La longueur du message ne peut pas excéder 1000 caracères.");
        return false;
    }

    var numRegex = /^(\+33)|(\+41)|0\d{9}$/;
    if (!numRegex.test(tel) || tel.replace(numRegex, "") != "") {
        showErrorMessage("Numéro de téléphone invalide, il doit être composé de +33, +41 ou 0 puis 9 chiffres.");
        return false;
    }

    var mailRegex = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    if (!mailRegex.test(email)) {
        showErrorMessage("Adresse email invalide, elle doit correspondre au modèle suivant: nom@domaine.xyz");
        return false;
    }

    if (!["basic", "premium", "full"].includes(formule)) {
        showErrorMessage("Veuillez sélectionner la formule.");
        return false;
    }

    var d = new Date(date);
    d.setHours(0);
    var scheduledDate = new Date(d.getTime() + Number(time.split(":")[0]) * 60 * 60 * 1000 + Number(time.split(":")[1]) * 60 * 1000);
    if (!scheduledDate) return showErrorMessage("Date ou heure invalide.");

    var inWeek = new Date();
    inWeek.setDate(inWeek.getDate() + 7);

    if (scheduledDate.getTime() < inWeek.getTime()) {
        return showErrorMessage("Date invalide, elle doit être supérieur à une semaine depuis ce jour-là.");
    }

    axios.post("/api/appointment", { firstname, lastname, tel, email, formule, scheduledDate: scheduledDate.getTime(), place, message }).then(response => {
        document.getElementById("firstname").value = "";
        document.getElementById("lastname").value = "";
        document.getElementById("tel").value = "";
        document.getElementById("email").value = "";
        document.getElementById("formule").value = "";
        document.getElementById("date").value = "";
        document.getElementById("time").value = "";
        document.getElementById("place").value = "";
        document.getElementById("message").value = "";

        showSuccess("Demande de séance photo enregistrée, vous allez recevoir un email de confirmation !");
    }, (error) => {
        showErrorMessage(getMessage(error?.response));
    });
}

function update() {
    if (!sessionStorage.getItem("user")) {
        if (window.location.pathname.startsWith("/myaccount")) window.localStorage.href = "/";
        return;
    }

    if (window.location.pathname.startsWith("/login")) return window.location.href = "/";

    if (document.getElementById("login-hl")) {
        document.getElementById("login-hl").innerText = "Mon compte";
        document.getElementById("login-hl").classList.add("myaccount");
        document.getElementById("login-hl").href = "/myaccount#myaccount";
    }
}

function formatDate(date) {
    return `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")} ${date.getDate().toString().padStart(2, "0")}/${(date.getMonth() + 1).toString().padStart(2, "0")}/${date.getFullYear().toString().padStart(4, "0")}`;
}

function showErrorMessage(error, action = null) {
    openPopup("popup-error");
    var popup = document.getElementById("popup-error");
    popup.querySelector("p.text").innerText = error;

    document.getElementById("valid-error").onclick = () => {
        if (action) action();
        closePopup("popup-error");
    };
}

function showSuccess(message, action = null) {
    openPopup("popup-success");
    var popup = document.getElementById("popup-success");
    popup.querySelector("p.text").innerText = message;

    document.getElementById("valid-success").onclick = () => {
        if (action) action();
        closePopup("popup-success");
    };
}

function closePopup(id, hidden = true) {
    var popup = document.getElementById(id);
    if (!popup) return;
    popup.style.transform = "translate(-50%, -50%) scale(0)";

    setTimeout(() => popup.style.display = "none", 300);

    if (hidden) {
        var hidden = document.getElementById("hidden-tab");
        hidden.style.opacity = "0";
        setTimeout(() => hidden.style.display = "none", 300);
    }
}

function openPopup(id) {
    var popup = document.getElementById(id);
    if (!popup) return;

    popup.style.display = "block";
    setTimeout(() => popup.style.transform = "translate(-50%, -50%) scale(1)", 50);

    var hidden = document.getElementById("hidden-tab");
    hidden.style.display = "block";
    setTimeout(() => hidden.style.opacity = "1", 50);
}

window.addEventListener("scroll", () => {
    var header = document.querySelector("header#main-header");
    header?.classList.toggle("banner", window.scrollY > 0)
});