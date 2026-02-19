export const shopConfig = {
  openTime: '09:00',
  closeTime: '21:00',
  slotDuration: 30, // Changed to 30 mins for better granularity
  maxDaysAdvance: 30, // how many days in advance to show
};

export const services = [
  { id: 'haircut', name: '剪发', duration: 15 },
  { id: 'wash', name: '洗头', duration: 15 },
  { id: 'wash_cut_blow', name: '洗剪吹', duration: 20 },
  { id: 'dye', name: '染发', duration: 20 },
  { id: 'perm', name: '电发', duration: 20 },
];

// 模拟的预约数据
// 实际开发中，这些数据应该从后端 API 获取
export const appointments = [
  { date: '2026-02-19', time: '10:00', status: 'booked', customerName: '王先生', duration: 60, service: '洗剪吹' },
];

// 模拟的休息日
export const closedDates = [
  '2026-02-22', // 周日休息示例
];
