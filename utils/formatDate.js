// formatDate.js
function formatDate(dateString) {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0'); // 月份從0開始，+1
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`; // 返回 YYYYMMDD
}

module.exports = formatDate; // 將函數導出