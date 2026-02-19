export const shopConfig = {
  openTime: '09:00',
  closeTime: '21:00',
  slotDuration: 60, // minutes
  maxDaysAdvance: 7, // how many days in advance to show
};

// 模拟的预约数据
// 实际开发中，这些数据应该从后端 API 获取
export const appointments = [
  { date: '2026-02-19', time: '10:00', status: 'booked', customerName: '王先生' },
  { date: '2026-02-19', time: '14:00', status: 'booked', customerName: '李小姐' },
  { date: '2026-02-20', time: '11:00', status: 'booked', customerName: '张先生' },
];

// 模拟的休息日
export const closedDates = [
  '2026-02-22', // 周日休息示例
];
