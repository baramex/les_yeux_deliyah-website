window.addEventListener("load", async () => {
    var user = JSON.parse(sessionStorage.getItem("user"));
    document.getElementById("name").innerText = "Bonjour, " + user.nickname;

    if (!sessionStorage.getItem("appointments")) await getAppointments();
    var appointments = JSON.parse(sessionStorage.getItem("appointments")).sort((a, b) => a.id - b.id);

    var element = document.querySelector("div#appointments .container");
    appointments.forEach(app => {
        var details = document.createElement("details");
        details.classList.add("appointment");

        details.innerHTML = `
        <summary>
            <p class="arrow">➤</p>
            <h2>${String(app.id).padStart(3, "0")}</h2>
            <span class="info">${app.firstname} ${app.lastname}</span>
            <span class="info" style="border-right: 1px solid #5a5a5a;padding-right: 5px;">${app.tel}</span>
            <div class="status status${app.status}"></div><span class="info" style="border: none;margin: 0;">${["Demande validation", "Programmée", "Annulée", "Terminée"][app.status]}</span>
            <span class="date">${formatDate(new Date(app.date))}</span>
        </summary>
        <div class="content">
            <div class="fields">
                <div>
                    <h2>Status</h2>
                    <div style="margin-right: 5px" class="status status${app.status}"></div><p style="display: inline">${["Demande validation", "Programmée", "Annulée", "Terminée"][app.status]}</p>
                </div>
                <div>
                <h2>Prénom</h2>
                    <p>${app.firstname}</p>
                </div>
                <div>
                    <h2>Nom</h2>
                    <p>${app.lastname}</p>
                </div>
                <div>
                    <h2>N° de téléphone</h2>
                    <p>${app.tel}</p>
                </div>
                <div>
                    <h2>Adresse email</h2>
                    <p>${app.email}</p>
                </div>
                <div>
                    <h2>Formule</h2>
                    <p>${{ basic: "basique", premium: "premium", full: "complète" }[app.formule]}</p>
                </div>
                <div>
                    <h2>Date prévue</h2>
                    <p>${formatDate(new Date(app.scheduledDate))}</p>
                </div>
                <div>
                    <h2>Lieu</h2>
                    <p>${app.place}</p>
                </div>
                <div>
                    <h2>Message</h2>
                    <p>${app.message || "sans message"}</p>
                </div>
                <div>
                    <h2>Date de création</h2>
                    <p>${formatDate(new Date(app.date))}</p>
                </div>
            </div>
            <div class="buttons">
                
            </div>
        </div>
        `;

        var valid = document.createElement("button");
        valid.classList.add("valid-button", "cbutton");
        valid.innerText = "Valider la commande";
        valid.onclick = () => {
            validAppointment(app.id);
        }

        var cancel = document.createElement("button");
        cancel.classList.add("cancel-button", "cbutton");
        cancel.innerText = "Annuler la commande";
        cancel.onclick = () => {
            cancelAppointment(app.id);
        }

        var buttons = [];
        if (app.status == 0) buttons.push(valid);
        if (app.status < 2) buttons.push(cancel)

        if (buttons.length > 0) details.querySelector("div.buttons").append(...buttons);

        element.appendChild(details);
    });

    if(appointments.length == 0) {
        var div = document.createElement("div");
        div.classList.add("no-appointment");
        div.innerHTML = `
        <span class="info" style="border: none;">Aucune demande</span>
        `;
        element.appendChild(div);
    }
});

function cancelAppointment(id) {
    openPopup("popup-cancel-app");
    document.getElementById("message-1").value = "";

    var popup = document.getElementById("popup-cancel-app");

    popup.querySelector(".id-app").innerText = String(id).padStart(3, "0");
    document.getElementById("confirm-cancel-app").onclick = () => confirmCancelAppointment(id);
    document.getElementById("cancel-cancel-app").onclick = () => closePopup("popup-cancel-app");
}

function confirmCancelAppointment(id) {
    var message = document.getElementById("message-1").value;
    if (message.length > 1000) {
        showErrorMessage("La longueur du message ne peut pas excéder 1000 caracères.");
        return;
    }

    if (!sessionStorage.getItem("token")) return;

    axios.post("/api/appointment/" + id + "/cancel", { message }, { headers: { Authorization: "token " + sessionStorage.getItem("token") } }).then(response => {
        closePopup("popup-cancel-app", false);
        showSuccess("Opération réussie avec succès !", () => window.location.reload());
        var curr = JSON.parse(sessionStorage.getItem("appointments"));
        curr.find(a => a.id == id).status = 2;
        sessionStorage.setItem("appointments", JSON.stringify(curr));
    }, error => {
        closePopup("popup-cancel-app", false);
        showErrorMessage(getMessage(error?.response));
    });
}

function validAppointment(id) {
    openPopup("popup-valid-app");
    document.getElementById("message").value = "";

    var popup = document.getElementById("popup-valid-app");

    popup.querySelector(".id-app").innerText = String(id).padStart(3, "0");
    document.getElementById("confirm-valid-app").onclick = () => confirmValidAppointment(id);
    document.getElementById("cancel-valid-app").onclick = () => closePopup("popup-valid-app");
}

function confirmValidAppointment(id) {
    var message = document.getElementById("message").value;
    if (message.length > 1000) {
        showErrorMessage("La longueur du message ne peut pas excéder 1000 caracères.");
        return;
    }

    if (!sessionStorage.getItem("token")) return;

    axios.post("/api/appointment/" + id + "/valid", { message }, { headers: { Authorization: "token " + sessionStorage.getItem("token") } }).then(response => {
        closePopup("popup-valid-app", false);
        showSuccess("Opération réussie avec succès !", () => window.location.reload());
        var curr = JSON.parse(sessionStorage.getItem("appointments"));
        curr.find(a => a.id == id).status = 1;
        sessionStorage.setItem("appointments", JSON.stringify(curr));
    }, error => {
        closePopup("popup-valid-app", false);
        showErrorMessage(getMessage(error?.response));
    });
}