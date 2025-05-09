const { ObjectId } = require("mongodb");
const dbManager = require("./database");
const axios = require("axios");

async function getProcessedPrescriptions(pid, sortOrderBeforeToday = "desc") {
    const today = new Date();
    const todayString = today.toISOString().split("T")[0].replace(/-/g, "");

    const db = dbManager.getDb();
    const prescriptionsCollection = db.collection("prescriptions");
    const patientsCollection = db.collection("patients");

    const query = {
        $or: [
            { predate2: { $ne: 0, $exists: true } },
            { predate3: { $ne: 0, $exists: true } }
        ]
    };
    if (pid) { query.pid = pid; }

    const allPrescriptions = await prescriptionsCollection.find(query).toArray();
    const formattedPrescriptionsPromises = allPrescriptions.map(async item => {
        const patient = await patientsCollection.findOne({ pid: item.pid });
        const pname = patient ? patient.pname : "Unknown";
        const pline = patient ? patient.pline : "Unknown";
        const pphone = patient ? patient.pphone : "Unknown";
        const pdetail = patient ? patient.pdetail : "Unknown";
        const rows = [];
        if (item.predate2 && item.predate2 !== 0) {
            rows.push({ id: item._id, precount: item.precount, type: "predate2", check: "prei2", value: item.predate2, pname, pline, pphone, pdetail, pid: item.pid, preday: item.preday, prei: item.prei2 });
        }
        if (item.predate3 && item.predate3 !== 0) {
            rows.push({ id: item._id, precount: item.precount, type: "predate3", check: "prei3", value: item.predate3, pname, pline, pphone, pdetail, pid: item.pid, preday: item.preday, prei: item.prei3 });
        }
        return rows;
    });

    const formattedPrescriptionsArrays = await Promise.all(formattedPrescriptionsPromises);
    const flattenedPrescriptions = formattedPrescriptionsArrays.flat();

    const groupedPrescriptions = flattenedPrescriptions.reduce((acc, item) => {
        if (parseInt(item.value) > parseInt(todayString)) {
            acc.afterToday.push(item);
        } else {
            acc.beforeToday.push(item);
        }
        return acc;
    }, { beforeToday: [], afterToday: [] });

    if (sortOrderBeforeToday === "desc") {
        groupedPrescriptions.beforeToday.sort((a, b) => b.value - a.value);
    } else {
        groupedPrescriptions.beforeToday.sort((a, b) => a.value - b.value); // asc
    }
    groupedPrescriptions.afterToday.sort((a, b) => a.value - b.value);

    return groupedPrescriptions;
}

async function updatePreiStatus(prescriptionId, preiValue, checkField) {
    const db = dbManager.getDb();
    const prescriptionsCollection = db.collection("prescriptions");
    await prescriptionsCollection.updateOne(
        { _id: new ObjectId(prescriptionId) },
        { $set: { [checkField]: preiValue } }
    );
    return { success: true, prei: preiValue };
}

async function sendLineNotification(lineId, patientName, startDate, endDate, typeId, totalCount, checkField, prescriptionObjectId) {
    const accessToken = process.env.LINE_ACCESS_TOKEN;
    if (!accessToken) {
        throw new Error("LINE_ACCESS_TOKEN is not defined in environment variables.");
    }
    if (!lineId || !patientName) {
        throw new Error("LINE ID or patient name cannot be empty.");
    }

    const bubbleMessage = {
        type: "flex",
        altText: "竹文領藥通知",
        contents: {
            type: "bubble",
            body: {
                type: "box",
                layout: "vertical",
                contents: [
                    { type: "text", text: "處方領藥通知", weight: "bold", size: "xl", align: "center" },
                    { type: "text", text: `通知${patientName}先生/女士，您的慢性處方箋藥已經準備好。`, wrap: true },
                    { type: "text", text: "可持健保卡至興安藥局領藥，謝謝。" },
                    { type: "box", layout: "baseline", contents: [{ type: "icon", url: "https://scdn.line-apps.com/n/channel_devcenter/img/fx/review_gold_star_28.png", offsetStart: "25%" }, { type: "text", text: "建議領藥區間", align: "center", margin: "md", size: "md" }], margin: "lg" },
                    { type: "text", text: `${startDate}-${endDate}`, wrap: true, color: "#666666", size: "md", flex: 5, align: "center", margin: "md" },
                    { type: "box", layout: "baseline", contents: [{ type: "icon", url: "https://scdn.line-apps.com/n/channel_devcenter/img/fx/review_gold_star_28.png", offsetStart: "33%" }, { type: "text", text: "處方資訊", align: "center", margin: "md", size: "md" }], margin: "lg" },
                    { type: "text", text: `第${typeId}次 / 共${totalCount}次`, wrap: true, color: "#666666", size: "md", flex: 5, align: "center", margin: "md" },
                ],
            },
        },
    };
    const data = { to: lineId, messages: [bubbleMessage] };

    await axios.post("https://api.line.me/v2/bot/message/push", data, {
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    });

    const db = dbManager.getDb();
    const prescriptionsCollection = db.collection("prescriptions");
    await prescriptionsCollection.updateOne(
        { _id: new ObjectId(prescriptionObjectId) },
        { $set: { [checkField]: "0" } }
    );
    return { success: true, message: `${patientName} 推送通知成功，prei 已更新！` };
}

module.exports = {
    getProcessedPrescriptions,
    updatePreiStatus,
    sendLineNotification,
};

