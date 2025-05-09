const express = require('express');
const { MongoClient, ObjectId } = require('mongodb'); // 確保 ObjectId 正確引入
const path = require('path');
const http = require('http');
const app = express();
const port = 3001;

// MongoDB 连接  URI
const uri = "mongodb://localhost:27017";
const client = new MongoClient(uri);

// 创建 HTTP 服务器并绑定到 Express
const server = http.createServer(app);

// 设置 EJS 模板引擎
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));


const formatDate = require('./utils/formatDate');

const calculateRouter = require('./routes/calculate'); // 引入 calculate 路由
const searchByDateRouter = require('./routes/searchByDate'); // 引入 searchByDate 路由
const customerTimeChartRouter = require('./routes/customerTimeChart'); // 引入 customerTimeChart 路由
const searchPrescriptionsRouter = require('./routes/searchPrescriptions'); // 引入 searchPrescriptions 路由
const searchByInsuranceCodeRouter = require('./routes/searchByInsuranceCode'); // 引入 searchByInsuranceCode 路由
const updatePrescriptionRouter = require('./routes/updatePrescription'); // 引入 updatePrescription 路由
const updatePatientRouter = require('./routes/updatePatient'); // 引入 updatePatient 路由
const getReportsRouter = require('./routes/getReports'); // 引入 getReports 路由
const getReportsAgeRouter = require('./routes/getReportsAge'); // 引入 getReports1 路由
const calendarRoute = require('./routes/calendar'); // 引入 calendar 路由檔案
const weeksRoute = require('./routes/weeks'); // 引入 weeks 路由檔案
const dashboardRoute = require('./routes/dashboard'); // 引入 dashboard 路由檔案
const managePrescriptionsRoute = require('./routes/managePrescriptions'); // 引入 managePrescriptions 路由檔案
const ordersRouter = require('./routes/orders');
const ordersresultRouter = require('./routes/ordersresult');
const orderskeyinRouter = require('./routes/orderskeyin');
const stockRouter = require('./routes/stock'); // 引入 stock 路由檔案
const ganttRouter = require('./routes/gantt'); // 引入 gantt 路由檔案
const filterRouter = require('./routes/filter'); // 引入 filter 路由檔案


// 渲染主页，显示日期选择框
app.get('/', (req, res) => {
  res.render('index');
});

app.get('/search', (req, res) => {
  res.render('search');
});

app.get('/search2', (req, res) => {
  res.render('search2');
});

// 使用 Express 解析表单数据
app.use(express.urlencoded({ extended: true }));
app.use(express.json());  // 解析 JSON
// 設置 public 資料夾為靜態資源路徑
app.use(express.static(path.join(__dirname, 'public')));

app.use('/calculate', calculateRouter);
app.use('/searchByDate', searchByDateRouter);
app.use('/customer-time-chart', customerTimeChartRouter);
app.use('/searchPrescriptions', searchPrescriptionsRouter);
app.use('/searchByInsuranceCode', searchByInsuranceCodeRouter);
app.use('/updatePrescription', updatePrescriptionRouter);
app.use('/updatePatient', updatePatientRouter);
app.use('/getReports', getReportsRouter);
app.use('/getReportsAge', getReportsAgeRouter);
app.use('/calendar', calendarRoute);
app.use('/weeks', weeksRoute);
app.use('/dashboard', dashboardRoute);
app.use('/manageprescription', managePrescriptionsRoute);
app.use('/orders', ordersRouter);
app.use('/ordersresult', ordersresultRouter);
app.use('/orderskeyin', orderskeyinRouter);
app.use('/stock', stockRouter);
app.use('/gantt', ganttRouter);
app.use('/filter', filterRouter);

app.post('/delete/:id', async (req, res) => {
  const prescriptionId = req.params.id;

  try {
    await client.connect();
    const db = client.db("pharmacy");

    // Delete the prescription by ID
    const result = await db.collection("prescriptions").deleteOne({ _id: new ObjectId(prescriptionId) });

    if (result.deletedCount === 1) {
      res.status(200).send({ message: 'Prescription deleted successfully' });
    } else {
      res.status(404).send({ message: 'Prescription not found' });
    }

  } catch (e) {
    console.error("Error deleting prescription:", e);
    res.status(500).send({ message: 'Server error, unable to delete prescription' });
  } finally {
    await client.close();
  }
});

// 啟動服務
server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

