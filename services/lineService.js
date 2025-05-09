const axios = require("axios");

async function sendRefillNotification(lineId, patientName, startDate, endDate, typeId, totalCount) {
    const accessToken = process.env.LINE_ACCESS_TOKEN;
    if (!accessToken) {
        console.error("LINE_ACCESS_TOKEN is not defined in environment variables.");
        throw new Error("LINE_ACCESS_TOKEN is not configured, cannot send message.");
    }
    if (!lineId || !patientName) {
        // This validation is also in the service, but good to have here too for direct use if any
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
                    {
                        type: "box",
                        layout: "baseline",
                        contents: [
                            { type: "icon", url: "https://scdn.line-apps.com/n/channel_devcenter/img/fx/review_gold_star_28.png", offsetStart: "25%" },
                            { type: "text", text: "建議領藥區間", align: "center", margin: "md", size: "md" }
                        ],
                        margin: "lg"
                    },
                    { type: "text", text: `${startDate}-${endDate}`, wrap: true, color: "#666666", size: "md", flex: 5, align: "center", margin: "md" },
                    {
                        type: "box",
                        layout: "baseline",
                        contents: [
                            { type: "icon", url: "https://scdn.line-apps.com/n/channel_devcenter/img/fx/review_gold_star_28.png", offsetStart: "33%" },
                            { type: "text", text: "處方資訊", align: "center", margin: "md", size: "md" }
                        ],
                        margin: "lg"
                    },
                    { type: "text", text: `第${typeId}次 / 共${totalCount}次`, wrap: true, color: "#666666", size: "md", flex: 5, align: "center", margin: "md" },
                ],
            },
        },
    };
    const data = { to: lineId, messages: [bubbleMessage] };

    try {
        await axios.post("https://api.line.me/v2/bot/message/push", data, {
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        });
        console.log(`LINE notification sent to ${patientName} (${lineId}) successfully.`);
        return { success: true, message: "LINE notification sent successfully." };
    } catch (error) {
        console.error("Failed to send LINE notification:", error.response?.data || error.message);
        throw new Error(`Failed to send LINE notification: ${error.response?.data?.message || error.message}`);
    }
}

module.exports = {
    sendRefillNotification,
};

