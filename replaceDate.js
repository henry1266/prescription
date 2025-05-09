const fs = require('fs');
const path = require('path');
const iconv = require('iconv-lite');

// 定义目录路径
const inputDir = 'X:\\VISW\\VITAL';
const outputDir = 'X:\\jvm'; // 修改为你想要保存的目录

// 获取系统当前日期，格式为 'YYYYMMDD'
const currentDate = new Date();
const formattedCurrentDate = currentDate.toISOString().slice(0, 10).replace(/-/g, ''); // 例如 '20241010'

// 生成 2 天后的日期，作为初始替换目标
const futureDate = new Date(currentDate);
futureDate.setDate(currentDate.getDate() + 2);
let formattedFutureDate = futureDate.toISOString().slice(0, 10).replace(/-/g, ''); // 例如 '20241012'

// 读取指定目录下的文件列表
fs.readdir(inputDir, (err, files) => {
    if (err) {
        console.error('Error reading the directory:', err);
        return;
    }

    // 过滤出 .txt 文件
    const txtFiles = files.filter(file => path.extname(file).toLowerCase() === '.txt');

    if (txtFiles.length === 0) {
        console.log('No .txt files found in the directory.');
        return;
    }

    console.log(`Found ${txtFiles.length} .txt file(s), processing...`);

    // 对每个 .txt 文件执行操作
    txtFiles.forEach(file => {
        const filePath = path.join(inputDir, file);
        processFile(filePath);
    });
});

// 函数：处理每个文件的内容
function processFile(filePath) {
    fs.readFile(filePath, (err, data) => {
        if (err) {
            console.error('Error reading the file:', err);
            return;
        }

        // 使用 ANSI 编码解码文件内容
        const decodedData = iconv.decode(data, 'big5'); // 替换 'big5' 为适合的编码，例如 'windows-1252' 取决于实际编码格式

        // 检查是否包含 +1 到 +7
        const match = decodedData.match(/\+([1-7])/);
        if (match) {
            console.log(`Found ${match[0]} in file ${filePath}, proceeding with date adjustment.`);

            // 根据匹配到的 +1 到 +7 计算新的目标日期
            const increment = parseInt(match[1], 10); // 获取 +1, +2 等中的数字部分
            const adjustedFutureDate = new Date(currentDate);
            adjustedFutureDate.setDate(currentDate.getDate() + 2 + increment);
            formattedFutureDate = adjustedFutureDate.toISOString().slice(0, 10).replace(/-/g, ''); // 更新未来日期

            // 进行替换
            const updatedData = decodedData.replace(/20241012/g, formattedFutureDate);
            saveAndDeleteOriginal(filePath, updatedData);
        } else {
            console.log(`No +1 to +7 found in file ${filePath}, saving original data.`);
            saveAndDeleteOriginal(filePath, decodedData);
        }
    });
}

// 函数：保存文件到指定目录并删除原文件
function saveAndDeleteOriginal(originalPath, content) {
    // 编码回 ANSI 格式
    const encodedData = iconv.encode(content, 'big5');

    // 生成目标文件路径，保持原文件名
    const outputFilePath = path.join(outputDir, path.basename(originalPath));

    // 将替换后的内容写入目标目录
    fs.writeFile(outputFilePath, encodedData, (err) => {
        if (err) {
            console.error('Error writing to the new location:', err);
            return;
        }

        console.log(`File saved successfully to ${outputFilePath}`);

        // 删除原始文件
        fs.unlink(originalPath, (err) => {
            if (err) {
                console.error('Error deleting the original file:', err);
                return;
            }

            console.log('Original file deleted successfully.');
        });
    });
}
