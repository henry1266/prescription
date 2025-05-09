const prescriptionRepository = require("../repositories/prescriptionRepository");
const patientRepository = require("../repositories/patientRepository"); // Assuming this will be created
const lineService = require("./lineService"); // Assuming this will be created for LINE notifications
const { ObjectId } = require("mongodb");

async function getGroupedPrescriptions(pid, sortOrderBeforeToday = "desc") {
    const today = new Date();
    const todayString = today.toISOString().split("T")[0].replace(/-/g, "");

    const query = {
        $or: [
            { predate2: { $ne: 0, $exists: true } },
            { predate3: { $ne: 0, $exists: true } }
        ]
    };
    if (pid) { query.pid = pid; }

    const allPrescriptions = await prescriptionRepository.find(query);
    
    const formattedPrescriptionsPromises = allPrescriptions.map(async item => {
        const patient = await patientRepository.findByPid(item.pid); // Use patientRepository
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

async function updatePrescriptionStatus(prescriptionId, preiValue, checkField) {
    // The repository already handles the ObjectId conversion
    const result = await prescriptionRepository.updatePreiStatus(prescriptionId, checkField, preiValue);
    if (result.modifiedCount === 1 || result.matchedCount === 1) { // Check if update was successful or if value was already set
        return { success: true, prei: preiValue };
    }
    throw new Error("Prescription status update failed or no changes made.");
}

async function sendPrescriptionNotification(lineId, patientName, startDate, endDate, typeId, totalCount, checkField, prescriptionId) {
    if (!lineId || !patientName) {
        throw new Error("LINE ID or patient name cannot be empty.");
    }

    // Delegate LINE message sending to a dedicated LineService
    await lineService.sendRefillNotification(lineId, patientName, startDate, endDate, typeId, totalCount);
    
    // Update prescription status after sending notification
    await prescriptionRepository.updatePreiStatus(prescriptionId, checkField, "0");
    
    return { success: true, message: `${patientName} 推送通知成功，prei 已更新！` };
}

async function deletePrescription(prescriptionId) {
    const result = await prescriptionRepository.deleteOne({ _id: new ObjectId(prescriptionId) });
    if (result.deletedCount === 1) {
        return { success: true, message: "Prescription deleted successfully" };
    }
    throw new Error("Prescription not found or deletion failed.");
}


module.exports = {
    getGroupedPrescriptions,
    updatePrescriptionStatus,
    sendPrescriptionNotification,
    deletePrescription,
};

