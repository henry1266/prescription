const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// MongoDB 連接 URL 和資料庫名稱
const url = 'mongodb://192.168.68.79:27017';
const dbName = 'pharmacy';
const collectionName = 'prescriptions';
let db, prescriptionsCollection;

// 連接至 MongoDB
MongoClient.connect(url)
    .then(client => {
        console.log('Connected to Database');
        db = client.db(dbName);
        prescriptionsCollection = db.collection(collectionName);
    })
    .catch(error => console.error(error));

// 首頁：顯示筆記
app.get('/', async (req, res) => {
    try {
        const notes = await prescriptionsCollection
            .find({ pretype: "04" }, { projection: { pid: 1, predate: 1, preday: 1, precount: 1, _id: 0 } })
            .sort({ predate: 1 })
            .toArray();

        // 日期統計
        const dailyCounts = {};

        const parseDate = (yyyymmdd) => {
            const year = parseInt(yyyymmdd.slice(0, 4), 10);
            const month = parseInt(yyyymmdd.slice(4, 6), 10) - 1;
            const day = parseInt(yyyymmdd.slice(6, 8), 10);
            return new Date(year, month, day);
        };

        for (const item of notes) {
            const startDate = parseDate(item.predate);
            const days = item.preday * item.precount;

            for (let i = 0; i < days; i++) {
                const date = new Date(startDate);
                date.setDate(date.getDate() + i);
                const key = date.toISOString().split("T")[0]; // yyyy-mm-dd

                dailyCounts[key] = (dailyCounts[key] || 0) + 1;
            }
        }

        // 轉成陣列並排序
        const calendar = Object.entries(dailyCounts).map(([date, count]) => ({
            date,
            count
        })).sort((a, b) => new Date(a.date) - new Date(b.date));

        res.render('index', { notes, calendar });

    } catch (error) {
        console.error(error);
        res.sendStatus(500);
    }
});


app.listen(3005, () => {
    console.log('Server is running on http://localhost:3005');
});
